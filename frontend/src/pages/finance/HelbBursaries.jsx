// src/pages/finance/HelbBursaries.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi, financeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState,
  useDebouncedValue, summarizeErrors, unwrapList, fmtDate,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;
const SOURCES = [
  { value: "helb", label: "HELB Loan" },
  { value: "bursary", label: "County/CDF Bursary" },
  { value: "scholarship", label: "Scholarship" },
];

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

// ----------------------------------------------------------------------
// Add / Edit modal
// ----------------------------------------------------------------------
function AwardFormModal({ mode, award, academicYears, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [results, setResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(award?.student_detail || null);
  const [form, setForm] = useState({
    academic_year: award?.academic_year || "",
    source: award?.source || "helb",
    amount_awarded: award?.amount_awarded || "",
    reference_number: award?.reference_number || "",
    disbursed: award?.disbursed || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) { setResults([]); return; }
    adminApi.students({ search: debouncedSearch, page_size: 8 })
      .then(({ data }) => setResults(unwrapList(data)))
      .catch(() => setResults([]));
  }, [debouncedSearch]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isEdit && !selectedStudent) { setError("Select a student."); return; }
    if (!form.academic_year || !form.amount_awarded) { setError("Academic year and amount are required."); return; }
    setSaving(true);
    try {
      const payload = {
        ...form, amount_awarded: Number(form.amount_awarded),
        ...(isEdit ? {} : { student: selectedStudent.id }),
      };
      const data = isEdit
        ? (await financeApi.updateHelbAward(award.id, payload)).data
        : (await financeApi.createHelbAward(payload)).data;
      onSaved(data, isEdit ? "Award updated." : "Award recorded.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save award.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Award" : "Record HELB/Bursary Award"} onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        {!isEdit && (
          <div style={{ marginBottom: 12 }}>
            <Field label="Student">
              <input className="mu-input" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedStudent(null); }} placeholder="Search reg no. or name..." />
            </Field>
            {search && !selectedStudent && (
              <div style={{ border: "1px solid #eee", borderRadius: 8, marginTop: 6, maxHeight: 180, overflowY: "auto" }}>
                {results.map((st) => (
                  <button key={st.id} type="button" onClick={() => { setSelectedStudent(st); setSearch(""); setResults([]); }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "transparent", borderBottom: "1px solid #f2f2f2", cursor: "pointer" }}>
                    <strong>{st.registration_number}</strong> — {fullName(st.user_detail)}
                  </button>
                ))}
              </div>
            )}
            {selectedStudent && (
              <div style={{ marginTop: 6, background: "#f4f6fb", padding: "6px 10px", borderRadius: 6, fontSize: 13 }}>
                {selectedStudent.registration_number} — {fullName(selectedStudent.user_detail)}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Academic Year">
            <select className="mu-input" required value={form.academic_year} onChange={handleChange("academic_year")}>
              <option value="">Select...</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select className="mu-input" value={form.source} onChange={handleChange("source")}>
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Amount Awarded (Ksh)">
            <input type="number" step="0.01" min={0} className="mu-input" required value={form.amount_awarded} onChange={handleChange("amount_awarded")} />
          </Field>
          <Field label="Reference Number">
            <input className="mu-input" value={form.reference_number} onChange={handleChange("reference_number")} />
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
          <input type="checkbox" checked={form.disbursed} onChange={handleChange("disbursed")} />
          Already disbursed
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Record Award"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function HelbBursaries() {
  const [awards, setAwards] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [sourceFilter, setSourceFilter] = useState("");
  const [disbursedFilter, setDisbursedFilter] = useState("");

  const [academicYears, setAcademicYears] = useState([]);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    adminApi.academicYears().then(({ data }) => setAcademicYears(unwrapList(data))).catch(() => {});
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchAwards = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (sourceFilter) params.source = sourceFilter;
      if (disbursedFilter) params.disbursed = disbursedFilter === "yes";

      const { data } = await financeApi.helbAwards(params);
      if (Array.isArray(data)) { setAwards(data); setCount(data.length); }
      else { setAwards(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load awards.");
      setAwards([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sourceFilter, disbursedFilter]);

  useEffect(() => { fetchAwards(); }, [fetchAwards]);
  useEffect(() => { setPage(1); }, [debouncedSearch, sourceFilter, disbursedFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleMarkDisbursed = async (award) => {
    try {
      await financeApi.markDisbursed(award.id);
      showToast("Marked as disbursed.");
      fetchAwards();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not update.");
    }
  };

  const handleDelete = async () => {
    try {
      await financeApi.deleteHelbAward(deleteTarget.id);
      showToast("Award deleted.");
      setDeleteTarget(null);
      fetchAwards();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete award.");
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-award" /> HELB &amp; Bursaries</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Finance <span className="separator">/</span> HELB &amp; Bursaries</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Record Award
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Registration number..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Source">
              <select className="mu-input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="">All Sources</option>
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 160 }}>
            <Field label="Disbursed">
              <select className="mu-input" value={disbursedFilter} onChange={(e) => setDisbursedFilter(e.target.value)}>
                <option value="">All</option>
                <option value="yes">Disbursed</option>
                <option value="no">Pending</option>
              </select>
            </Field>
          </div>
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setSourceFilter(""); setDisbursedFilter(""); }}>Reset</button>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Awards</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : awards.length === 0 ? (
            <EmptyState icon="bi-award" label="No awards found" />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead><tr><th>Student</th><th>Academic Year</th><th>Source</th><th>Amount</th><th>Reference</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {awards.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.student_detail?.registration_number}</strong><div style={{ fontSize: 12, color: "#777" }}>{fullName(a.student_detail?.user_detail)}</div></td>
                      <td>{academicYears.find((y) => y.id === a.academic_year)?.year || "—"}</td>
                      <td>{SOURCES.find((s) => s.value === a.source)?.label}</td>
                      <td>Ksh {Number(a.amount_awarded).toLocaleString()}</td>
                      <td>{a.reference_number || "—"}</td>
                      <td>
                        {a.disbursed
                          ? <span className="mu-badge mu-badge-success">Disbursed{a.disbursed_date ? ` (${fmtDate(a.disbursed_date)})` : ""}</span>
                          : <span className="mu-badge mu-badge-warning">Pending</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {!a.disbursed && (
                            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Mark disbursed" onClick={() => handleMarkDisbursed(a)}>
                              <i className="bi bi-check-circle" />
                            </button>
                          )}
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Edit" onClick={() => setFormModal({ mode: "edit", award: a })}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" title="Delete" onClick={() => setDeleteTarget(a)}>
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && awards.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} awards</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <i className="bi bi-chevron-left" /> Prev
              </button>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {formModal && (
        <AwardFormModal
          mode={formModal.mode} award={formModal.award} academicYears={academicYears}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchAwards(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Award"
          message={`Delete this ${deleteTarget.source} award of Ksh ${Number(deleteTarget.amount_awarded).toLocaleString()}?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}