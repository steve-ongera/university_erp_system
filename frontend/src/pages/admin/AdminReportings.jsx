import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const STATUS_OPTIONS = ["pending", "approved", "rejected"];
const PAGE_SIZE = 20;

function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}
const REPORTING_TYPE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "physical", label: "Physical" },
];

const STATUS_STYLES = {
  pending: "mu-badge-warning",
  approved: "mu-badge-success",
  rejected: "mu-badge-danger",
};

const inputSm = {
  width: "100%",
  padding: "3px 8px",
  fontSize: "var(--mu-font-size-xs)",
  minHeight: "auto",
  height: 30,
};

function studentName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

export default function AdminReportings() {
  const [reportings, setReportings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- filters ---
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [academicYearFilter, setAcademicYearFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");

  // --- pagination ---
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // --- status breakdown (independent of the status filter, so the stat
  // cards always reflect the full picture for the current search/year/
  // semester/programme scope, not just the currently-open page) ---
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // --- lookups ---
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);

  // --- selection / bulk ---
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("approved");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);

  // --- "Report for Student" modal ---
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState([]);
  const [studentSearching, setStudentSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reportSemester, setReportSemester] = useState("");
  const [reportType, setReportType] = useState("physical");
  const [reportStatus, setReportStatus] = useState("approved");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");

  // ---------------------------------------------------------------
  // Lookups (load once)
  // ---------------------------------------------------------------
  useEffect(() => {
    Promise.all([adminApi.academicYears(), adminApi.semesters(), adminApi.programmes()])
      .then(([yRes, sRes, pRes]) => {
        setAcademicYears(yRes.data.results ?? yRes.data ?? []);
        setSemesters(sRes.data.results ?? sRes.data ?? []);
        setProgrammes(pRes.data.results ?? pRes.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLookupsLoading(false));
  }, []);

  // Semesters scoped to the chosen academic year (used in both the filter
  // bar and the "Report for Student" modal).
  const semestersForYear = (yearId) =>
    yearId ? semesters.filter((sem) => String(sem.academic_year) === String(yearId)) : semesters;

  // If the academic year filter changes and the currently selected semester
  // no longer belongs to it, clear it.
  useEffect(() => {
    if (!academicYearFilter || !semesterFilter) return;
    const stillValid = semesters.some(
      (sem) => String(sem.id) === String(semesterFilter) && String(sem.academic_year) === String(academicYearFilter)
    );
    if (!stillValid) setSemesterFilter("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearFilter]);

  // ---------------------------------------------------------------
  // Load reportings
  // ---------------------------------------------------------------
  const baseFilterParams = useCallback(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (semesterFilter) params.semester = semesterFilter;
    else if (academicYearFilter) params.semester__academic_year = academicYearFilter;
    if (programmeFilter) params.student__programme = programmeFilter;
    return params;
  }, [debouncedSearch, semesterFilter, academicYearFilter, programmeFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { ...baseFilterParams(), page, page_size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;

      const { data } = await adminApi.reportings(params);
      const list = Array.isArray(data) ? data : (data.results || []);
      const total = Array.isArray(data) ? data.length : (data.count ?? list.length);
      setReportings(list);
      setTotalCount(total);
      setSelected(new Set());
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load reportings.");
    } finally {
      setLoading(false);
    }
  }, [baseFilterParams, page, statusFilter]);

  const loadCounts = useCallback(async () => {
    const base = baseFilterParams();
    try {
      const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
        adminApi.reportings({ ...base, page_size: 1 }),
        adminApi.reportings({ ...base, status: "pending", page_size: 1 }),
        adminApi.reportings({ ...base, status: "approved", page_size: 1 }),
        adminApi.reportings({ ...base, status: "rejected", page_size: 1 }),
      ]);
      const countOf = (res) => (Array.isArray(res.data) ? res.data.length : (res.data.count ?? 0));
      setCounts({
        total: countOf(totalRes),
        pending: countOf(pendingRes),
        approved: countOf(approvedRes),
        rejected: countOf(rejectedRes),
      });
    } catch {
      // non-fatal — stat cards just keep their previous values
    }
  }, [baseFilterParams]);

  // ---------------------------------------------------------------
  // Fetch orchestration
  // ---------------------------------------------------------------
  // A filter change must never let `load()` fire with a stale `page`
  // value — DRF's PageNumberPagination 404s if the requested page no
  // longer exists for the new, narrower result set (e.g. staying on
  // page 2 while typing a search that only matches 1 page of results).
  // We track the filter "scope" as a single key: whenever it changes
  // we reset the page and skip this run's fetch; the page-state change
  // then re-triggers this same effect (via `load`'s dependency on
  // `page`), and on that run the scope key matches so we fetch for
  // real with page already at 1.
  const filterScopeKey = [
    debouncedSearch, statusFilter, semesterFilter, academicYearFilter, programmeFilter,
  ].join("|");
  const prevFilterScopeKey = useRef(filterScopeKey);

  useEffect(() => {
    if (prevFilterScopeKey.current !== filterScopeKey) {
      prevFilterScopeKey.current = filterScopeKey;
      if (page !== 1) {
        setPage(1);
        return; // wait for the page reset to re-trigger this effect
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, filterScopeKey]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const resetFilters = () => {
    setStatusFilter("");
    setSearch("");
    setAcademicYearFilter("");
    setSemesterFilter("");
    setProgrammeFilter("");
    setSelected(new Set());
    setPage(1);
  };

  // ---------------------------------------------------------------
  // Selection / row & bulk status changes
  // ---------------------------------------------------------------
  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === reportings.length) setSelected(new Set());
    else setSelected(new Set(reportings.map((r) => r.id)));
  };

  const handleRowStatusChange = async (id, newStatus) => {
    setRowBusyId(id);
    try {
      await adminApi.updateReportingStatus(id, newStatus);
      await Promise.all([load(), loadCounts()]);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update status.");
    } finally {
      setRowBusyId(null);
    }
  };

  const handleBulkApply = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError("");
    try {
      await adminApi.bulkUpdateReportingStatus(Array.from(selected), bulkStatus);
      setSelected(new Set());
      setConfirmModalOpen(false);
      await Promise.all([load(), loadCounts()]);
    } catch (err) {
      setError(err.response?.data?.detail || "Bulk update failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  const openBulkConfirm = () => {
    if (selected.size === 0) return;
    setBulkAction({ type: "bulk", status: bulkStatus, count: selected.size });
    setConfirmModalOpen(true);
  };

  // ---------------------------------------------------------------
  // Report-for-student flow
  // ---------------------------------------------------------------
  const openReportModal = () => {
    setStudentQuery(""); setStudentOptions([]); setSelectedStudent(null);
    setReportSemester(""); setReportType("physical"); setReportStatus("approved");
    setReportError("");
    setReportModalOpen(true);
  };

  useEffect(() => {
    if (!studentQuery || studentQuery.trim().length < 2) { setStudentOptions([]); return; }
    setStudentSearching(true);
    const handle = setTimeout(() => {
      adminApi.students({ search: studentQuery.trim(), page_size: 10 })
        .then(({ data }) => setStudentOptions(data.results ?? data ?? []))
        .catch(() => setStudentOptions([]))
        .finally(() => setStudentSearching(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [studentQuery]);

  const handleReportForStudent = async () => {
    setReportError("");
    if (!selectedStudent) { setReportError("Search for and select a student first."); return; }
    if (!reportSemester) { setReportError("Select a semester."); return; }
    setReportBusy(true);
    try {
      await adminApi.reportForStudent({
        student: selectedStudent.id,
        semester: reportSemester,
        reporting_type: reportType,
        status: reportStatus,
      });
      setReportModalOpen(false);
      await Promise.all([load(), loadCounts()]);
    } catch (err) {
      setReportError(err.response?.data?.detail || "Could not create this reporting record.");
    } finally {
      setReportBusy(false);
    }
  };

  if (loading && lookupsLoading) {
    return <LoadingSpinner text="Loading semester reportings..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-clipboard-check" />
            Semester Reportings
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Reportings
          </div>
        </div>
        <div className="mu-page-header-actions" style={{ display: "flex", gap: 8 }}>
          <button className="mu-btn mu-btn-primary" onClick={openReportModal}>
            <i className="bi bi-plus-circle" /> Report for Student
          </button>
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Stats Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Total</span>
            <span className="mu-badge mu-badge-primary" style={{ fontSize: "var(--mu-font-size-xs)" }}>{counts.total}</span>
          </div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>{counts.total}</div>
        </div>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Pending</span>
            <span className="mu-badge mu-badge-warning" style={{ fontSize: "var(--mu-font-size-xs)" }}>{counts.pending}</span>
          </div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>{counts.pending}</div>
        </div>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Approved</span>
            <span className="mu-badge mu-badge-success" style={{ fontSize: "var(--mu-font-size-xs)" }}>{counts.approved}</span>
          </div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>{counts.approved}</div>
        </div>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Rejected</span>
            <span className="mu-badge mu-badge-danger" style={{ fontSize: "var(--mu-font-size-xs)" }}>{counts.rejected}</span>
          </div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>{counts.rejected}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Search</div>
            <div style={{ position: "relative" }}>
              <i className="bi bi-search" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--mu-gray-400)" }} />
              <input
                type="text" className="mu-input" placeholder="Reg no. or name..."
                style={{ ...inputSm, paddingLeft: 26 }}
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ width: 170 }}>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Academic Year</div>
            <select className="mu-select" style={inputSm} value={academicYearFilter} onChange={(e) => setAcademicYearFilter(e.target.value)}>
              <option value="">All Years</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </div>

          <div style={{ width: 170 }}>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Semester</div>
            <select className="mu-select" style={inputSm} value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
              <option value="">All Semesters</option>
              {semestersForYear(academicYearFilter).map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.academic_year_detail?.year || academicYears.find((y) => String(y.id) === String(sem.academic_year))?.year} — S{sem.semester_number}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: 220 }}>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Programme</div>
            <select className="mu-select" style={inputSm} value={programmeFilter} onChange={(e) => setProgrammeFilter(e.target.value)}>
              <option value="">All Programmes</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>

          <div style={{ width: 130 }}>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Status</div>
            <select className="mu-select" style={inputSm} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          </div>

          <button className="mu-btn mu-btn-secondary" style={{ height: 30 }} onClick={resetFilters}>
            <i className="bi bi-arrow-counterclockwise" /> Reset
          </button>

          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                {selected.size} selected
              </span>
              <select className="mu-select" style={{ width: 110, height: 30, fontSize: "var(--mu-font-size-xs)" }}
                      value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                ))}
              </select>
              <button onClick={openBulkConfirm} disabled={bulkBusy} className="mu-btn mu-btn-primary" style={{ height: 30, fontSize: "var(--mu-font-size-xs)" }}>
                {bulkBusy ? <i className="bi bi-arrow-repeat mu-animate-spin" /> : (<><i className="bi bi-check2" /> Apply</>)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="mu-card">
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading reportings..." /></div>
          ) : reportings.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Reportings Found</h3>
              <p style={{ margin: "8px 0 0" }}>No semester reportings match your filters.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input type="checkbox" className="mu-checkbox-input"
                             checked={reportings.length > 0 && selected.size === reportings.length}
                             onChange={toggleAll} />
                    </th>
                    <th>Registration No.</th>
                    <th>Student</th>
                    <th>Programme</th>
                    <th>Semester</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Change Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportings.map((r) => (
                    <tr key={r.id}>
                      <td style={{ textAlign: "center" }}>
                        <input type="checkbox" className="mu-checkbox-input"
                               checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                      </td>
                      <td><strong>{r.student_detail?.registration_number || r.student || "N/A"}</strong></td>
                      <td>{studentName(r.student_detail?.user_detail)}</td>
                      <td>{r.student_detail?.programme_detail?.code || "—"}</td>
                      <td>
                        {r.semester_detail
                          ? `${r.semester_detail.academic_year_detail?.year || "N/A"} S${r.semester_detail.semester_number}`
                          : r.semester || "N/A"}
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary" style={{ fontSize: "var(--mu-font-size-xs)" }}>
                          {r.reporting_type || "online"}
                        </span>
                      </td>
                      <td>{r.reporting_date ? new Date(r.reporting_date).toLocaleDateString() : "—"}</td>
                      <td>
                        <span className={`mu-badge ${STATUS_STYLES[r.status] || "mu-badge-gray"}`} style={{ fontSize: "var(--mu-font-size-xs)" }}>
                          {r.status || "pending"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <select
                          className="mu-select"
                          style={{ width: 110, padding: "2px 6px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={r.status || "pending"}
                          disabled={rowBusyId === r.id}
                          onChange={(e) => handleRowStatusChange(r.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {!loading && reportings.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Page {page} of {totalPages} &middot; {totalCount} record(s)
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="mu-btn mu-btn-sm mu-btn-outline-primary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <i className="bi bi-chevron-left" /> Prev
              </button>
              <button
                className="mu-btn mu-btn-sm mu-btn-outline-primary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Confirm Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => { setConfirmModalOpen(false); setBulkAction(null); }}
        title="Confirm Bulk Status Update"
        size="md"
        confirmText="Apply to All"
        onConfirm={handleBulkApply}
        isLoading={bulkBusy}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-check2-square" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Bulk Status Update</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to update the status of <strong>{bulkAction?.count}</strong> reporting(s) to:
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)" }}>
            <span className={`mu-badge ${STATUS_STYLES[bulkAction?.status] || "mu-badge-gray"}`} style={{ fontSize: "1rem", padding: "4px 16px" }}>
              {bulkAction?.status?.charAt(0).toUpperCase() + bulkAction?.status?.slice(1)}
            </span>
          </div>
          <div className="mu-alert mu-alert-warning" style={{ marginTop: 12, textAlign: "left" }}>
            <i className="bi bi-exclamation-triangle" />
            <div><strong>Warning:</strong> This action will update all selected reportings. This cannot be undone.</div>
          </div>
        </div>
      </Modal>

      {/* Report-for-Student Modal */}
      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Report for Student"
        size="md"
        confirmText={reportBusy ? "Submitting..." : "Submit Reporting"}
        onConfirm={handleReportForStudent}
        isLoading={reportBusy}
      >
        <div>
          {reportError && (
            <div className="mu-alert mu-alert-danger" style={{ marginBottom: 14 }}>
              <i className="bi bi-exclamation-triangle" /> {reportError}
            </div>
          )}

          <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Student</div>
          {selectedStudent ? (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 10px", background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)", marginBottom: 12,
            }}>
              <div>
                <strong>{selectedStudent.registration_number}</strong> — {studentName(selectedStudent.user_detail)}
                <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                  {selectedStudent.programme_detail?.code} · Y{selectedStudent.current_year} S{selectedStudent.current_semester}
                </div>
              </div>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setSelectedStudent(null)}>
                Change
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <input
                type="text" className="mu-input" style={{ ...inputSm, height: 34 }}
                placeholder="Search by registration number or name..."
                value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)}
              />
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--mu-gray-200)", borderRadius: 6, marginTop: 6 }}>
                {studentSearching && <div style={{ padding: 8, fontSize: 12, color: "var(--mu-gray-400)" }}>Searching...</div>}
                {!studentSearching && studentQuery.trim().length >= 2 && studentOptions.length === 0 && (
                  <div style={{ padding: 8, fontSize: 12, color: "var(--mu-gray-400)" }}>No matching student.</div>
                )}
                {studentOptions.map((stu) => (
                  <div
                    key={stu.id}
                    onClick={() => { setSelectedStudent(stu); setStudentQuery(""); setStudentOptions([]); }}
                    style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--mu-gray-100)" }}
                  >
                    <strong>{stu.registration_number}</strong> — {studentName(stu.user_detail)}
                    <div style={{ fontSize: 11, color: "var(--mu-gray-400)" }}>{stu.programme_detail?.code}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Semester</div>
              <select className="mu-select" style={{ ...inputSm, height: 34 }} value={reportSemester} onChange={(e) => setReportSemester(e.target.value)}>
                <option value="">Select semester...</option>
                {semesters.map((sem) => (
                  <option key={sem.id} value={sem.id}>
                    {sem.academic_year_detail?.year || academicYears.find((y) => String(y.id) === String(sem.academic_year))?.year} — S{sem.semester_number}
                    {sem.is_current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Reporting Type</div>
              <select className="mu-select" style={{ ...inputSm, height: 34 }} value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {REPORTING_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Status to set</div>
            <select className="mu-select" style={{ ...inputSm, height: 34 }} value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="mu-alert mu-alert-warning" style={{ marginTop: 14, fontSize: 12 }}>
            <i className="bi bi-info-circle" />
            <div>If this student already has a reporting record for the chosen semester, it will be updated rather than duplicated.</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}