// src/pages/admin/Programmes.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, TabBar, SubTabBar, EmptyState,
  useDebouncedValue, summarizeErrors, unwrapList,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;
const PROGRAMME_TYPES = [
  { value: "certificate", label: "Certificate" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelor", label: "Bachelor Degree" },
  { value: "postgraduate_diploma", label: "Postgraduate Diploma" },
  { value: "master", label: "Master Degree" },
  { value: "phd", label: "PhD" },
];

// ----------------------------------------------------------------------
// Add / Edit Programme
// ----------------------------------------------------------------------
function ProgrammeFormModal({ mode, programme, faculties, departments, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    name: programme?.name || "",
    code: programme?.code || "",
    programme_type: programme?.programme_type || "bachelor",
    faculty: programme?.faculty || "",
    department: programme?.department || "",
    duration_years: programme?.duration_years || 4,
    semesters_per_year: programme?.semesters_per_year || 2,
    credit_hours_required: programme?.credit_hours_required || 120,
    is_active: programme?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const deptOptions = useMemo(
    () => departments.filter((d) => !form.faculty || String(d.faculty) === String(form.faculty)),
    [departments, form.faculty]
  );

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value, ...(field === "faculty" ? { department: "" } : {}) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.code || !form.faculty || !form.department) {
      setError("Name, code, faculty and department are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        duration_years: Number(form.duration_years),
        semesters_per_year: Number(form.semesters_per_year),
        credit_hours_required: Number(form.credit_hours_required),
      };
      const data = isEdit
        ? (await adminApi.updateProgramme(programme.id, payload)).data
        : (await adminApi.createProgramme(payload)).data;
      onSaved(data, isEdit ? "Programme updated." : "Programme created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save programme.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Programme" : "Add Programme"} onClose={onClose} width={560}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <Field label="Programme Name">
          <input className="mu-input" required value={form.name} onChange={handleChange("name")} placeholder="Bachelor of Science in Information Technology" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Code" hint='Registration-number prefix, e.g. "SC211"'>
            <input className="mu-input" required value={form.code} onChange={handleChange("code")} placeholder="SC211" />
          </Field>
          <Field label="Programme Type">
            <select className="mu-input" value={form.programme_type} onChange={handleChange("programme_type")}>
              {PROGRAMME_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Faculty">
            <select className="mu-input" required value={form.faculty} onChange={handleChange("faculty")}>
              <option value="">Select faculty...</option>
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Department">
            <select className="mu-input" required value={form.department} onChange={handleChange("department")} disabled={!form.faculty}>
              <option value="">{form.faculty ? "Select department..." : "Pick a faculty first"}</option>
              {deptOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Duration (Years)">
            <input type="number" min={1} max={8} className="mu-input" value={form.duration_years} onChange={handleChange("duration_years")} />
          </Field>
          <Field label="Semesters / Year">
            <select className="mu-input" value={form.semesters_per_year} onChange={handleChange("semesters_per_year")}>
              <option value={2}>2 (Semester)</option>
              <option value={3}>3 (Trimester)</option>
            </select>
          </Field>
          <Field label="Credit Hours Required">
            <input type="number" min={0} className="mu-input" value={form.credit_hours_required} onChange={handleChange("credit_hours_required")} />
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} />
          Programme is active (open for admissions)
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Programme"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// New Curriculum Version modal
// ----------------------------------------------------------------------
function CurriculumVersionFormModal({ programme, academicYears, existingVersions, onClose, onSaved }) {
  const usedYearIds = new Set(existingVersions.map((v) => v.effective_academic_year));
  const availableYears = academicYears.filter((y) => !usedYearIds.has(y.id));
  const [form, setForm] = useState({ effective_academic_year: "", notes: "", is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.effective_academic_year) { setError("Select an academic year."); return; }
    setSaving(true);
    setError("");
    try {
      const { data } = await adminApi.createCurriculumVersion({
        programme: programme.id,
        effective_academic_year: form.effective_academic_year,
        notes: form.notes,
        is_active: form.is_active,
      });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not create curriculum version.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Curriculum Version" onClose={onClose} width={440}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        <Field label="Effective Academic Year">
          <select
            className="mu-input" required
            value={form.effective_academic_year}
            onChange={(e) => setForm((f) => ({ ...f, effective_academic_year: e.target.value }))}
          >
            <option value="">Select...</option>
            {availableYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
          </select>
        </Field>
        <div style={{ marginTop: 12 }}>
          <Field label="Notes">
            <textarea className="mu-input" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          Set as the active curriculum version
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving || availableYears.length === 0}>
            {saving ? "Creating..." : "Create Version"}
          </button>
        </div>
        {availableYears.length === 0 && (
          <p style={{ fontSize: 12, color: "#999", marginTop: 10 }}>
            Every academic year already has a curriculum version for this programme.
          </p>
        )}
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Add / Edit CurriculumUnit modal
// ----------------------------------------------------------------------
function UnitFormModal({ mode, unit, curriculumVersionId, defaultYear, defaultSemester, courses, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    course: unit?.course || "",
    year: unit?.year || defaultYear,
    semester: unit?.semester || defaultSemester,
    is_mandatory: unit?.is_mandatory ?? true,
  });
  const [courseSearch, setCourseSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [courses, courseSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.course) { setError("Select a course."); return; }
    setSaving(true);
    try {
      const payload = {
        curriculum_version: curriculumVersionId,
        course: form.course,
        year: Number(form.year),
        semester: Number(form.semester),
        is_mandatory: form.is_mandatory,
      };
      const data = isEdit
        ? (await adminApi.updateCurriculumUnit(unit.id, payload)).data
        : (await adminApi.createCurriculumUnit(payload)).data;
      onSaved(data, isEdit ? "Unit updated." : "Unit added.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save unit (it may already exist in this slot).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Curriculum Unit" : "Add Unit"} onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <Field label="Course">
          <input
            className="mu-input" placeholder="Search by code or name..."
            value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
            style={{ marginBottom: 6 }}
          />
          <select className="mu-input" required size={6} value={form.course}
                  onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}>
            {filteredCourses.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.credit_hours} CH)</option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Programme Year">
            <input type="number" min={1} max={8} className="mu-input" value={form.year}
                   onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
          </Field>
          <Field label="Semester">
            <input type="number" min={1} max={3} className="mu-input" value={form.semester}
                   onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))} />
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_mandatory} onChange={(e) => setForm((f) => ({ ...f, is_mandatory: e.target.checked }))} />
          Mandatory unit
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Unit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Lecturer Allocation modal — shown per unit
// ----------------------------------------------------------------------
function LecturerAllocationModal({ unit, programme, onClose, showToast }) {
  const [allocations, setAllocations] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ semester: "", lecturer: "", is_supplementary_offering: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, lRes, sRes] = await Promise.all([
        adminApi.lecturerAllocations({ course: unit.course, programme: programme.id, year: unit.year, programme_semester: unit.semester }),
        adminApi.lecturers({ department: unit.course_detail?.department }),
        adminApi.semesters(),
      ]);
      setAllocations(unwrapList(aRes.data));
      setLecturers(unwrapList(lRes.data));
      setSemesters(unwrapList(sRes.data).sort((a, b) => b.id - a.id));
    } catch {
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }, [unit, programme.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.semester || !form.lecturer) { setError("Select both a semester and a lecturer."); return; }
    setSaving(true);
    try {
      await adminApi.createLecturerAllocation({
        lecturer: form.lecturer,
        course: unit.course,
        semester: form.semester,
        programme: programme.id,
        year: unit.year,
        programme_semester: unit.semester,
        is_supplementary_offering: form.is_supplementary_offering,
      });
      showToast("Lecturer allocated.");
      setForm({ semester: "", lecturer: "", is_supplementary_offering: false });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not allocate lecturer (may already be assigned).");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (allocation) => {
    try {
      await adminApi.updateLecturerAllocation(allocation.id, { is_active: !allocation.is_active });
      load();
    } catch {
      showToast("Could not update allocation.");
    }
  };

  const removeAllocation = async (allocation) => {
    try {
      await adminApi.deleteLecturerAllocation(allocation.id);
      showToast("Allocation removed.");
      load();
    } catch {
      showToast("Could not remove allocation.");
    }
  };

  return (
    <Modal title={`Allocate Lecturer — ${unit.course_detail?.code}`} onClose={onClose} width={560}>
      <p style={{ marginTop: 0, fontSize: 13, color: "#666" }}>
        {unit.course_detail?.name} &middot; Programme Y{unit.year} S{unit.semester}
      </p>

      {loading ? (
        <LoadingSpinner text="Loading..." />
      ) : (
        <>
          <div className="mu-table-wrapper" style={{ marginBottom: 20 }}>
            <table className="mu-table">
              <thead><tr><th>Lecturer</th><th>Semester</th><th>Type</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {allocations.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 16, color: "#999" }}>No lecturer allocated yet.</td></tr>
                )}
                {allocations.map((a) => (
                  <tr key={a.id}>
                    <td>{a.lecturer_detail?.user_detail?.first_name} {a.lecturer_detail?.user_detail?.last_name}</td>
                    <td>{a.semester_detail?.academic_year_detail?.year || a.semester} S{a.semester_detail?.semester_number ?? ""}</td>
                    <td>{a.is_supplementary_offering ? "Supplementary" : "Normal"}</td>
                    <td>
                      <span className={`mu-badge ${a.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => toggleActive(a)}>
                          <i className="bi bi-arrow-repeat" />
                        </button>
                        <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => removeAllocation(a)}>
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ margin: "0 0 10px" }}>Add Allocation</h4>
          <form onSubmit={handleCreate}>
            {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Lecturer">
                <select className="mu-input" value={form.lecturer} onChange={(e) => setForm((f) => ({ ...f, lecturer: e.target.value }))}>
                  <option value="">Select lecturer...</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>{l.user_detail?.first_name} {l.user_detail?.last_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Calendar Semester">
                <select className="mu-input" value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}>
                  <option value="">Select semester...</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>{s.academic_year_detail?.year} — Semester {s.semester_number}</option>
                  ))}
                </select>
              </Field>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
              <input type="checkbox" checked={form.is_supplementary_offering}
                     onChange={(e) => setForm((f) => ({ ...f, is_supplementary_offering: e.target.checked }))} />
              This offering also examines supplementary students from an earlier cohort
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Allocate"}
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Programme Detail Modal — curriculum version + Year tabs + Semester submenu
// ----------------------------------------------------------------------
function ProgrammeDetailModal({ programme, courses, academicYears, onClose, showToast }) {
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [units, setUnits] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [activeYear, setActiveYear] = useState(1);
  const [activeSemester, setActiveSemester] = useState(1);

  const [newVersionModal, setNewVersionModal] = useState(false);
  const [unitForm, setUnitForm] = useState(null); // { mode, unit? }
  const [deleteUnit, setDeleteUnit] = useState(null);
  const [allocationUnit, setAllocationUnit] = useState(null);

  const yearTabs = useMemo(
    () => Array.from({ length: programme.duration_years }, (_, i) => i + 1),
    [programme.duration_years]
  );
  const semesterTabs = useMemo(
    () => Array.from({ length: programme.semesters_per_year }, (_, i) => i + 1),
    [programme.semesters_per_year]
  );

  const loadVersions = useCallback(async () => {
    setLoadingVersions(true);
    try {
      const { data } = await adminApi.curriculumVersions({ programme: programme.id });
      const list = unwrapList(data);
      setVersions(list);
      const active = list.find((v) => v.is_active) || list[0];
      setSelectedVersionId((prev) => prev || active?.id || null);
    } finally {
      setLoadingVersions(false);
    }
  }, [programme.id]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const loadUnits = useCallback(async () => {
    if (!selectedVersionId) { setUnits([]); return; }
    setLoadingUnits(true);
    try {
      const { data } = await adminApi.curriculumUnits({
        curriculum_version: selectedVersionId, year: activeYear, semester: activeSemester,
      });
      setUnits(unwrapList(data));
    } catch {
      setUnits([]);
    } finally {
      setLoadingUnits(false);
    }
  }, [selectedVersionId, activeYear, activeSemester]);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const handleDeleteUnit = async () => {
    try {
      await adminApi.deleteCurriculumUnit(deleteUnit.id);
      showToast("Unit removed from curriculum.");
      setDeleteUnit(null);
      loadUnits();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not remove unit.");
      setDeleteUnit(null);
    }
  };

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const deptCourses = useMemo(
    () => courses.filter((c) => c.department === programme.department).concat(
      courses.filter((c) => c.department !== programme.department)
    ),
    [courses, programme.department]
  );

  return (
    <Modal title={`${programme.name} (${programme.code})`} onClose={onClose} width={880}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <div><div className="mu-label-sm">Type</div><div>{programme.programme_type}</div></div>
          <div><div className="mu-label-sm">Duration</div><div>{programme.duration_years} yrs / {programme.semesters_per_year} sem</div></div>
          <div><div className="mu-label-sm">Status</div>
            <span className={`mu-badge ${programme.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
              {programme.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Curriculum version selector */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ minWidth: 240 }}>
          <Field label="Curriculum Version">
            <select
              className="mu-input"
              value={selectedVersionId || ""}
              onChange={(e) => setSelectedVersionId(Number(e.target.value))}
              disabled={loadingVersions || versions.length === 0}
            >
              {versions.length === 0 && <option value="">No curriculum versions yet</option>}
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.effective_academic_year_detail?.year || `Version #${v.id}`} {v.is_active ? "(active)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setNewVersionModal(true)}>
          <i className="bi bi-plus-circle" /> New Version
        </button>
      </div>

      {versions.length === 0 ? (
        <EmptyState icon="bi-diagram-3" label="No curriculum set up yet" hint="Create a curriculum version to start mapping units to years and semesters." />
      ) : (
        <>
          {/* Year tabs */}
          <TabBar
            tabs={yearTabs.map((y) => ({ key: y, label: `Year ${y}` }))}
            active={activeYear}
            onChange={setActiveYear}
          />
          {/* Semester submenu */}
          <SubTabBar
            tabs={semesterTabs.map((s) => ({ key: s, label: `Semester ${s}` }))}
            active={activeSemester}
            onChange={setActiveSemester}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setUnitForm({ mode: "add" })}>
              <i className="bi bi-plus-circle" /> Add Unit
            </button>
          </div>

          {loadingUnits ? (
            <LoadingSpinner text="Loading units..." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table">
                <thead>
                  <tr><th>Code</th><th>Course</th><th>Credits</th><th>Mandatory</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {units.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "#999" }}>
                      No units mapped for Year {activeYear}, Semester {activeSemester}.
                    </td></tr>
                  )}
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td>{u.course_detail?.code}</td>
                      <td>{u.course_detail?.name}</td>
                      <td>{u.course_detail?.credit_hours}</td>
                      <td>{u.is_mandatory ? "Yes" : "Elective"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Allocate lecturer"
                                  onClick={() => setAllocationUnit(u)}>
                            <i className="bi bi-person-video3" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Edit"
                                  onClick={() => setUnitForm({ mode: "edit", unit: u })}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" title="Remove"
                                  onClick={() => setDeleteUnit(u)}>
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
        </>
      )}

      {newVersionModal && (
        <CurriculumVersionFormModal
          programme={programme}
          academicYears={academicYears}
          existingVersions={versions}
          onClose={() => setNewVersionModal(false)}
          onSaved={(v) => { setNewVersionModal(false); showToast("Curriculum version created."); setSelectedVersionId(v.id); loadVersions(); }}
        />
      )}

      {unitForm && selectedVersion && (
        <UnitFormModal
          mode={unitForm.mode}
          unit={unitForm.unit}
          curriculumVersionId={selectedVersion.id}
          defaultYear={activeYear}
          defaultSemester={activeSemester}
          courses={deptCourses}
          onClose={() => setUnitForm(null)}
          onSaved={(_d, msg) => { setUnitForm(null); showToast(msg); loadUnits(); }}
        />
      )}

      {deleteUnit && (
        <ConfirmModal
          title="Remove Unit"
          message={`Remove ${deleteUnit.course_detail?.code} from Year ${deleteUnit.year} Semester ${deleteUnit.semester}?`}
          onConfirm={handleDeleteUnit}
          onClose={() => setDeleteUnit(null)}
        />
      )}

      {allocationUnit && (
        <LecturerAllocationModal
          unit={allocationUnit}
          programme={programme}
          onClose={() => setAllocationUnit(null)}
          showToast={showToast}
        />
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function Programmes() {
  const [programmes, setProgrammes] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [facultyFilter, setFacultyFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [formModal, setFormModal] = useState(null);
  const [detailProgramme, setDetailProgramme] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.faculties(), adminApi.departments(), adminApi.courses(), adminApi.academicYears()])
      .then(([fRes, dRes, cRes, yRes]) => {
        setFaculties(unwrapList(fRes.data));
        setDepartments(unwrapList(dRes.data));
        setCourses(unwrapList(cRes.data));
        setAcademicYears(unwrapList(yRes.data));
      })
      .catch(() => {});
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchProgrammes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (facultyFilter) params.faculty = facultyFilter;
      if (departmentFilter) params.department = departmentFilter;
      if (typeFilter) params.programme_type = typeFilter;
      if (statusFilter) params.is_active = statusFilter === "active";

      const { data } = await adminApi.programmes(params);
      if (Array.isArray(data)) { setProgrammes(data); setCount(data.length); }
      else { setProgrammes(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load programmes.");
      setProgrammes([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, facultyFilter, departmentFilter, typeFilter, statusFilter]);

  useEffect(() => { fetchProgrammes(); }, [fetchProgrammes]);
  useEffect(() => { setPage(1); }, [debouncedSearch, facultyFilter, departmentFilter, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const deptOptions = useMemo(
    () => departments.filter((d) => !facultyFilter || String(d.faculty) === String(facultyFilter)),
    [departments, facultyFilter]
  );

  const handleDelete = async () => {
    try {
      await adminApi.deleteProgramme(deleteTarget.id);
      showToast(`${deleteTarget.code} deleted.`);
      setDeleteTarget(null);
      fetchProgrammes();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete — programme likely has students or curriculum data.");
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-mortarboard" /> Programmes</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Programmes</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add Programme
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      {/* Filters */}
      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Name or code..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Faculty">
              <select className="mu-input" value={facultyFilter} onChange={(e) => { setFacultyFilter(e.target.value); setDepartmentFilter(""); }}>
                <option value="">All Faculties</option>
                {faculties.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Department">
              <select className="mu-input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                <option value="">All Departments</option>
                {deptOptions.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 170 }}>
            <Field label="Type">
              <select className="mu-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {PROGRAMME_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
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
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setFacultyFilter(""); setDepartmentFilter(""); setTypeFilter(""); setStatusFilter(""); }}>
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Programmes</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading programmes..." /></div>
          ) : programmes.length === 0 ? (
            <EmptyState icon="bi-mortarboard" label="No programmes found" hint="Try adjusting filters or add a new programme." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Faculty</th><th>Department</th><th>Type</th><th>Duration</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {programmes.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.code}</strong></td>
                      <td>{p.name}</td>
                      <td>{faculties.find((f) => f.id === p.faculty)?.code || "—"}</td>
                      <td>{departments.find((d) => d.id === p.department)?.code || "—"}</td>
                      <td>{p.programme_type}</td>
                      <td>{p.duration_years}y / {p.semesters_per_year}s</td>
                      <td><span className={`mu-badge ${p.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>{p.is_active ? "Active" : "Inactive"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailProgramme(p)} title="View / curriculum">
                            <i className="bi bi-eye" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", programme: p })} title="Edit">
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(p)} title="Delete">
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

        {!loading && programmes.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} programmes</span>
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
        <ProgrammeFormModal
          mode={formModal.mode}
          programme={formModal.programme}
          faculties={faculties}
          departments={departments}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchProgrammes(); }}
        />
      )}

      {detailProgramme && (
        <ProgrammeDetailModal
          programme={detailProgramme}
          courses={courses}
          academicYears={academicYears}
          onClose={() => setDetailProgramme(null)}
          showToast={showToast}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Programme"
          message={`Delete ${deleteTarget.name} (${deleteTarget.code})? This fails if students or curriculum data reference it.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}