// src/pages/admin/UnitAllocations.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi, unitsApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState,
  useDebouncedValue, summarizeErrors, unwrapList,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;

function lecturerName(l) {
  const u = l?.user_detail;
  return u ? `${u.first_name} ${u.last_name}` : "—";
}

// ----------------------------------------------------------------------
// Add / Edit Allocation modal
// ----------------------------------------------------------------------
function AllocationFormModal({ mode, allocation, lecturers, courses, programmes, semesters, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    lecturer: allocation?.lecturer || "",
    course: allocation?.course || "",
    semester: allocation?.semester || "",
    programme: allocation?.programme || "",
    year: allocation?.year || 1,
    programme_semester: allocation?.programme_semester || 1,
    is_supplementary_offering: allocation?.is_supplementary_offering || false,
    is_active: allocation?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.lecturer || !form.course || !form.semester || !form.programme) {
      setError("Lecturer, course, semester and programme are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, year: Number(form.year), programme_semester: Number(form.programme_semester) };
      const data = isEdit
        ? (await adminApi.updateLecturerAllocation(allocation.id, payload)).data
        : (await adminApi.createLecturerAllocation(payload)).data;
      onSaved(data, isEdit ? "Allocation updated." : "Allocation created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save allocation (it may already exist).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Allocation" : "Add Allocation"} onClose={onClose} width={560}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <Field label="Lecturer">
          <select className="mu-input" required value={form.lecturer} onChange={handleChange("lecturer")}>
            <option value="">Select lecturer...</option>
            {lecturers.map((l) => <option key={l.id} value={l.id}>{lecturerName(l)} — {l.department_detail?.code || ""}</option>)}
          </select>
        </Field>

        <div style={{ marginTop: 12 }}>
          <Field label="Course">
            <select className="mu-input" required value={form.course} onChange={handleChange("course")}>
              <option value="">Select course...</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Programme">
            <select className="mu-input" required value={form.programme} onChange={handleChange("programme")}>
              <option value="">Select programme...</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          </Field>
          <Field label="Calendar Semester">
            <select className="mu-input" required value={form.semester} onChange={handleChange("semester")}>
              <option value="">Select semester...</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.academic_year_detail?.year} — Semester {s.semester_number}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Programme Year" hint="e.g. 2 for a 2.2 unit">
            <input type="number" min={1} max={8} className="mu-input" value={form.year} onChange={handleChange("year")} />
          </Field>
          <Field label="Programme Semester" hint="e.g. 2 for a 2.2 unit">
            <input type="number" min={1} max={3} className="mu-input" value={form.programme_semester} onChange={handleChange("programme_semester")} />
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_supplementary_offering} onChange={handleChange("is_supplementary_offering")} />
          This offering also examines supplementary students from an earlier cohort
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} />
          Allocation is active
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Allocation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Roster viewer modal
// ----------------------------------------------------------------------
function RosterModal({ allocation, onClose }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    unitsApi.roster(allocation.id)
      .then(({ data }) => setRoster(unwrapList(data)))
      .catch(() => setRoster([]))
      .finally(() => setLoading(false));
  }, [allocation.id]);

  return (
    <Modal title={`Roster — ${allocation.course_detail?.code}`} onClose={onClose} width={560}>
      {loading ? (
        <LoadingSpinner text="Loading roster..." />
      ) : roster.length === 0 ? (
        <EmptyState icon="bi-people" label="No students enrolled yet" />
      ) : (
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead><tr><th>Reg No</th><th>Name</th><th>Programme</th></tr></thead>
            <tbody>
              {roster.map((en) => (
                <tr key={en.id}>
                  <td>{en.student_detail?.registration_number}</td>
                  <td>{en.student_detail?.user_detail?.first_name} {en.student_detail?.user_detail?.last_name}</td>
                  <td>{en.student_detail?.programme_detail?.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function UnitAllocations() {
  const [allocations, setAllocations] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [lecturers, setLecturers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [formModal, setFormModal] = useState(null);
  const [rosterAllocation, setRosterAllocation] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.lecturers(), adminApi.courses(), adminApi.programmes(), adminApi.semesters()])
      .then(([lRes, cRes, pRes, sRes]) => {
        setLecturers(unwrapList(lRes.data));
        setCourses(unwrapList(cRes.data));
        setProgrammes(unwrapList(pRes.data));
        setSemesters(unwrapList(sRes.data));
      })
      .catch(() => {});
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (programmeFilter) params.programme = programmeFilter;
      if (semesterFilter) params.semester = semesterFilter;
      if (statusFilter) params.is_active = statusFilter === "active";

      const { data } = await adminApi.lecturerAllocations(params);
      if (Array.isArray(data)) { setAllocations(data); setCount(data.length); }
      else { setAllocations(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load allocations.");
      setAllocations([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, programmeFilter, semesterFilter, statusFilter]);

  useEffect(() => { fetchAllocations(); }, [fetchAllocations]);
  useEffect(() => { setPage(1); }, [debouncedSearch, programmeFilter, semesterFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleDelete = async () => {
    try {
      await adminApi.deleteLecturerAllocation(deleteTarget.id);
      showToast("Allocation removed.");
      setDeleteTarget(null);
      fetchAllocations();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete allocation.");
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-person-video3" /> Unit Allocations</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Unit Allocations</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add Allocation
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      {/* Filters */}
      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Lecturer or course..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Programme">
              <select className="mu-input" value={programmeFilter} onChange={(e) => setProgrammeFilter(e.target.value)}>
                <option value="">All Programmes</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 220 }}>
            <Field label="Semester">
              <select className="mu-input" value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
                <option value="">All Semesters</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>{s.academic_year_detail?.year} S{s.semester_number}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 140 }}>
            <Field label="Status">
              <select className="mu-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setProgrammeFilter(""); setSemesterFilter(""); setStatusFilter(""); }}>
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Allocations</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading allocations..." /></div>
          ) : allocations.length === 0 ? (
            <EmptyState icon="bi-person-video3" label="No allocations found" hint="Try adjusting filters or add a new allocation." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr><th>Lecturer</th><th>Course</th><th>Programme</th><th>Y/S</th><th>Semester</th><th>Type</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id}>
                      <td>{lecturerName(a.lecturer_detail)}</td>
                      <td><strong>{a.course_detail?.code}</strong> — {a.course_detail?.name}</td>
                      <td>{programmes.find((p) => p.id === a.programme)?.code || "—"}</td>
                      <td>Y{a.year} S{a.programme_semester}</td>
                      <td>{a.semester_detail?.academic_year_detail?.year} S{a.semester_detail?.semester_number}</td>
                      <td>{a.is_supplementary_offering ? <span className="mu-badge mu-badge-warning">Supp</span> : "Normal"}</td>
                      <td><span className={`mu-badge ${a.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>{a.is_active ? "Active" : "Inactive"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Roster" onClick={() => setRosterAllocation(a)}>
                            <i className="bi bi-people" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Edit" onClick={() => setFormModal({ mode: "edit", allocation: a })}>
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

        {!loading && allocations.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} allocations</span>
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
        <AllocationFormModal
          mode={formModal.mode}
          allocation={formModal.allocation}
          lecturers={lecturers}
          courses={courses}
          programmes={programmes}
          semesters={semesters}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchAllocations(); }}
        />
      )}

      {rosterAllocation && <RosterModal allocation={rosterAllocation} onClose={() => setRosterAllocation(null)} />}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Allocation"
          message={`Remove ${lecturerName(deleteTarget.lecturer_detail)} from ${deleteTarget.course_detail?.code}?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}