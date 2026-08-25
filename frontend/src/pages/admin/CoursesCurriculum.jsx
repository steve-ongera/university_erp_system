// src/pages/admin/CoursesCurriculum.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { adminApi, studentsApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const PAGE_SIZE = 20;
const COURSE_TYPES = [
  { value: "core", label: "Core" },
  { value: "elective", label: "Elective" },
  { value: "common", label: "Common / Shared" },
  { value: "capstone", label: "Capstone Project" },
];

function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function unwrapList(data) {
  return Array.isArray(data) ? data : data.results || [];
}

function summarizeErrors(err) {
  const data = err?.response?.data;
  if (!data || typeof data !== "object") return null;
  const parts = Object.entries(data).map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(" ") : msgs}`);
  return parts.join(" ");
}

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

function downloadCsv(filename, rows, headers) {
  const escape = (val) => {
    const str = String(val ?? "");
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--mu-border)", marginBottom: 16, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            border: "none",
            borderBottom: active === t.key ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
            borderRadius: 0,
            background: "transparent",
            padding: "8px 16px",
            cursor: "pointer",
            color: active === t.key ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
            fontWeight: active === t.key ? 600 : 400,
            fontSize: "var(--mu-font-size-sm)",
            transition: "all var(--mu-transition-fast)",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ========================================================================
// Add / Edit Course modal
// ========================================================================
function CourseFormModal({ mode, course, departments, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    name: course?.name || "",
    code: course?.code || "",
    course_type: course?.course_type || "core",
    credit_hours: course?.credit_hours || 3,
    department: course?.department || "",
    description: course?.description || "",
    is_active: course?.is_active ?? true,
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
    if (!form.name || !form.code || !form.department) {
      setError("Name, code and department are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, credit_hours: Number(form.credit_hours) };
      const data = isEdit
        ? (await adminApi.updateCourse(course.id, payload)).data
        : (await adminApi.createCourse(payload)).data;
      onSaved(data, isEdit ? "Course updated." : "Course created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save course.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEdit ? "Edit Course" : "Add Course"} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-form-group">
          <label>Course Name</label>
          <input className="mu-input" required value={form.name} onChange={handleChange("name")} placeholder="Data Structures and Algorithms" />
        </div>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Code</label>
            <input className="mu-input" required value={form.code} onChange={handleChange("code")} placeholder="IT201" />
          </div>
          <div className="mu-form-group">
            <label>Credit Hours</label>
            <input type="number" min={1} max={15} className="mu-input" value={form.credit_hours} onChange={handleChange("credit_hours")} />
          </div>
        </div>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Course Type</label>
            <select className="mu-select" value={form.course_type} onChange={handleChange("course_type")}>
              {COURSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="mu-form-group">
            <label>Department</label>
            <select className="mu-select" required value={form.department} onChange={handleChange("department")}>
              <option value="">Select department...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mu-form-group">
          <label>Description</label>
          <textarea className="mu-textarea" rows={3} value={form.description} onChange={handleChange("description")} />
        </div>

        <div className="mu-checkbox">
          <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} id="course_active" />
          <label htmlFor="course_active">Course is active</label>
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Create Course"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ========================================================================
// Course Detail Modal
// ========================================================================
function CourseDetailModal({ course, programmesMap, onClose }) {
  const [tab, setTab] = useState("placements");
  const [placements, setPlacements] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loadingPlacements, setLoadingPlacements] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);

  useEffect(() => {
    adminApi.curriculumUnits({ course: course.id })
      .then(({ data }) => setPlacements(unwrapList(data)))
      .catch(() => setPlacements([]))
      .finally(() => setLoadingPlacements(false));

    studentsApi.enrollments({ course: course.id })
      .then(({ data }) => setEnrollments(unwrapList(data)))
      .catch(() => setEnrollments([]))
      .finally(() => setLoadingEnrollments(false));
  }, [course.id]);

  const grouped = useMemo(() => {
    const map = new Map();
    enrollments.forEach((en) => {
      const sem = en.semester_detail;
      const key = sem ? `${sem.academic_year_detail?.year} — Semester ${sem.semester_number}` : `Semester #${en.semester}`;
      if (!map.has(key)) map.set(key, { key, sortKey: sem ? `${sem.academic_year_detail?.year}-${sem.semester_number}` : "", rows: [] });
      map.get(key).rows.push(en);
    });
    return Array.from(map.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [enrollments]);

  const handleDownloadAll = () => {
    downloadCsv(
      `${course.code}_enrolled_students.csv`,
      enrollments.map((en) => ({
        registration_number: en.student_detail?.registration_number,
        name: fullName(en.student_detail?.user_detail),
        programme: en.student_detail?.programme_detail?.code,
        semester: en.semester_detail
          ? `${en.semester_detail.academic_year_detail?.year} S${en.semester_detail.semester_number}`
          : en.semester,
        registration_type: en.registration?.registration_type || "normal",
      })),
      ["registration_number", "name", "programme", "semester", "registration_type"]
    );
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`${course.name} (${course.code})`} size="xl" showFooter={false}>
      <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="mu-form-group" style={{ marginBottom: 0 }}>
          <label>Type</label>
          <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{course.course_type}</div>
        </div>
        <div className="mu-form-group" style={{ marginBottom: 0 }}>
          <label>Credit Hours</label>
          <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{course.credit_hours}</div>
        </div>
        <div className="mu-form-group" style={{ marginBottom: 0 }}>
          <label>Status</label>
          <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
            <span className={`mu-badge ${course.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
              {course.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>
      {course.description && <p style={{ color: "var(--mu-gray-600)", fontSize: 13, marginBottom: 16 }}>{course.description}</p>}

      <TabBar
        tabs={[
          { key: "placements", label: `Curriculum Placements (${placements.length})` },
          { key: "students", label: `Enrolled Students (${enrollments.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "placements" && (
        loadingPlacements ? <LoadingSpinner text="Loading placements..." /> : (
          <div className="mu-table-wrapper">
            <table className="mu-table">
              <thead><tr><th>Programme</th><th>Academic Year</th><th>Year</th><th>Semester</th><th>Mandatory</th></tr></thead>
              <tbody>
                {placements.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--mu-gray-400)" }}>
                    This course isn't mapped into any curriculum yet. Use the Curriculum Builder tab to place it.
                  </td></tr>
                )}
                {placements.map((p) => {
                  const version = p.curriculum_version_detail;
                  const programme = version ? programmesMap[version.programme] : null;
                  return (
                    <tr key={p.id}>
                      <td>{programme ? `${programme.name} (${programme.code})` : "—"}</td>
                      <td>{version?.effective_academic_year_detail?.year || "—"}</td>
                      <td>Year {p.year}</td>
                      <td>Semester {p.semester}</td>
                      <td>{p.is_mandatory ? "Yes" : "Elective"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "students" && (
        loadingEnrollments ? <LoadingSpinner text="Loading enrollments..." /> : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={handleDownloadAll} disabled={enrollments.length === 0}>
                <i className="bi bi-download" /> Export All
              </button>
            </div>
            {grouped.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-people" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No students enrolled</h3>
                <p style={{ margin: "8px 0 0" }}>No one is currently registered for this unit.</p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.key} style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--mu-gray-800)" }}>
                    {group.key} <span className="mu-badge mu-badge-primary" style={{ marginLeft: 6 }}>{group.rows.length}</span>
                  </h4>
                  <div className="mu-table-wrapper">
                    <table className="mu-table">
                      <thead><tr><th>Registration No</th><th>Name</th><th>Programme</th><th>Type</th></tr></thead>
                      <tbody>
                        {group.rows.map((en) => (
                          <tr key={en.id}>
                            <td>{en.student_detail?.registration_number}</td>
                            <td>{fullName(en.student_detail?.user_detail)}</td>
                            <td>{en.student_detail?.programme_detail?.code}</td>
                            <td>{en.registration?.registration_type || "normal"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </>
        )
      )}
    </Modal>
  );
}

// ========================================================================
// Curriculum Version Form Modal
// ========================================================================
function CurriculumVersionFormModal({ programme, academicYears, existingVersions, onClose, onSaved }) {
  const usedYearIds = new Set(existingVersions.map((v) => v.effective_academic_year));
  const [academicYear, setAcademicYear] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!academicYear) { setError("Select an academic year."); return; }
    setSaving(true);
    try {
      const { data } = await adminApi.createCurriculumVersion({
        programme: programme.id,
        effective_academic_year: academicYear,
        notes,
        is_active: isActive,
      });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not create curriculum version.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`New Curriculum Version — ${programme.code}`} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-form-group">
          <label>Effective Academic Year</label>
          <select className="mu-select" required value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            <option value="">Select academic year...</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id} disabled={usedYearIds.has(y.id)}>
                {y.year}{usedYearIds.has(y.id) ? " (already has a version)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mu-form-group">
          <label>Notes</label>
          <textarea className="mu-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Revised after curriculum review" />
        </div>

        <div className="mu-checkbox">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="cv_active" />
          <label htmlFor="cv_active">Active (newly admitted students will follow this version)</label>
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Creating...
              </>
            ) : "Create Version"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ========================================================================
// Curriculum Unit Form Modal
// ========================================================================
function CurriculumUnitFormModal({ curriculumVersion, programme, courses, departments, onClose, onSaved }) {
  const maxYear = programme?.duration_years || 4;
  const maxSem = programme?.semesters_per_year || 2;

  const [localCourses, setLocalCourses] = useState(courses);
  const [courseQuery, setCourseQuery] = useState("");
  const [courseId, setCourseId] = useState("");
  const [year, setYear] = useState(1);
  const [semester, setSemester] = useState(1);
  const [isMandatory, setIsMandatory] = useState(true);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    const pool = q
      ? localCourses.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      : localCourses;
    return pool.slice(0, 30);
  }, [courseQuery, localCourses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!courseId) { setError("Search for and select a course above."); return; }
    setSaving(true);
    try {
      const { data } = await adminApi.createCurriculumUnit({
        curriculum_version: curriculumVersion.id,
        course: courseId,
        year: Number(year),
        semester: Number(semester),
        is_mandatory: isMandatory,
      });
      onSaved(data);
    } catch (err) {
      setError(
        err.response?.data?.detail
        || summarizeErrors(err)
        || "Could not add unit — it may already be placed at this year/semester."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Unit to Curriculum" size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-form-group">
          <label>Course</label>
          <input
            className="mu-input"
            placeholder="Search by code or name..."
            value={courseQuery}
            onChange={(e) => { setCourseQuery(e.target.value); setCourseId(""); }}
          />
          <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--mu-border)", borderRadius: "var(--mu-radius-sm)", marginTop: 6 }}>
            {filteredCourses.map((c) => (
              <div
                key={c.id}
                onClick={() => { setCourseId(c.id); setCourseQuery(`${c.code} — ${c.name}`); }}
                style={{
                  padding: "6px 10px", cursor: "pointer", fontSize: 13,
                  background: courseId === c.id ? "var(--mu-primary-50)" : "transparent",
                  borderBottom: "1px solid var(--mu-border)",
                  transition: "background var(--mu-transition-fast)",
                }}
                onMouseEnter={(e) => { if (courseId !== c.id) e.currentTarget.style.background = "var(--mu-gray-50)"; }}
                onMouseLeave={(e) => { if (courseId !== c.id) e.currentTarget.style.background = "transparent"; }}
              >
                <strong>{c.code}</strong> — {c.name}
              </div>
            ))}
            {filteredCourses.length === 0 && (
              <div style={{ padding: "6px 10px", fontSize: 13, color: "var(--mu-gray-400)" }}>No matching course.</div>
            )}
          </div>
          <button
            type="button"
            className="mu-btn mu-btn-sm mu-btn-outline-primary"
            style={{ marginTop: 8 }}
            onClick={() => setShowNewCourse(true)}
          >
            <i className="bi bi-plus-circle" /> Course not listed — create it
          </button>
        </div>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Programme Year</label>
            <select className="mu-select" value={year} onChange={(e) => setYear(e.target.value)}>
              {Array.from({ length: maxYear }, (_, i) => i + 1).map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>
          <div className="mu-form-group">
            <label>Semester</label>
            <select className="mu-select" value={semester} onChange={(e) => setSemester(e.target.value)}>
              {Array.from({ length: maxSem }, (_, i) => i + 1).map((sNum) => (
                <option key={sNum} value={sNum}>Semester {sNum}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mu-checkbox">
          <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} id="cu_mandatory" />
          <label htmlFor="cu_mandatory">Mandatory unit (uncheck for elective)</label>
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Adding...
              </>
            ) : "Add Unit"}
          </button>
        </div>
      </form>

      {showNewCourse && (
        <CourseFormModal
          mode="add"
          departments={departments}
          onClose={() => setShowNewCourse(false)}
          onSaved={(newCourse) => {
            setLocalCourses((prev) => [newCourse, ...prev]);
            setCourseId(newCourse.id);
            setCourseQuery(`${newCourse.code} — ${newCourse.name}`);
            setShowNewCourse(false);
          }}
        />
      )}
    </Modal>
  );
}

// ========================================================================
// Curriculum Builder Panel
// ========================================================================
function CurriculumBuilderPanel({ programmes, academicYears, departments }) {
  const [programmeId, setProgrammeId] = useState("");
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState(null);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [deleteUnitTarget, setDeleteUnitTarget] = useState(null);
  const [coursesLite, setCoursesLite] = useState([]);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const programme = programmes.find((p) => String(p.id) === String(programmeId));

  useEffect(() => {
    adminApi.courses({ page_size: 1000 })
      .then(({ data }) => setCoursesLite(unwrapList(data)))
      .catch(() => setCoursesLite([]));
  }, []);

  const loadVersions = useCallback(() => {
    if (!programmeId) { setVersions([]); setActiveVersionId(null); return; }
    setLoadingVersions(true);
    adminApi.curriculumVersions({ programme: programmeId })
      .then(({ data }) => {
        const list = unwrapList(data).sort((a, b) =>
          (b.effective_academic_year_detail?.year || "").localeCompare(a.effective_academic_year_detail?.year || "")
        );
        setVersions(list);
        setActiveVersionId((prev) => (list.find((v) => v.id === prev) ? prev : list[0]?.id ?? null));
      })
      .catch(() => setVersions([]))
      .finally(() => setLoadingVersions(false));
  }, [programmeId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const activeVersion = versions.find((v) => v.id === activeVersionId);

  const unitsBySlot = useMemo(() => {
    const map = new Map();
    if (!activeVersion) return map;
    (activeVersion.units || []).forEach((u) => {
      const key = `${u.year}-${u.semester}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    });
    return map;
  }, [activeVersion]);

  const handleDeleteUnit = async () => {
    try {
      await adminApi.deleteCurriculumUnit(deleteUnitTarget.id);
      showToast(`${deleteUnitTarget.course_detail?.code} removed from curriculum.`);
      setDeleteUnitTarget(null);
      loadVersions();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not remove unit.");
      setDeleteUnitTarget(null);
    }
  };

  const toggleVersionActive = async (version) => {
    try {
      await adminApi.updateCurriculumVersion(version.id, { is_active: !version.is_active });
      loadVersions();
    } catch {
      showToast("Could not update version.");
    }
  };

  return (
    <div>
      {toast && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {toast}
        </div>
      )}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body">
          <div className="mu-form-group" style={{ marginBottom: 0 }}>
            <label>Programme</label>
            <select className="mu-select" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
              <option value="">Select a programme to view or build its curriculum...</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
        </div>
      </div>

      {!programmeId && (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
            <i className="bi bi-diagram-3" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
            <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>Pick a Programme</h3>
            <p style={{ margin: "8px 0 0" }}>Select a programme above to view or build its curriculum map.</p>
          </div>
        </div>
      )}

      {programmeId && loadingVersions && <LoadingSpinner text="Loading curriculum versions..." />}

      {programmeId && programme && !loadingVersions && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <TabBar
              tabs={versions.map((v) => ({
                key: v.id,
                label: `${v.effective_academic_year_detail?.year || "—"}${v.is_active ? "" : " (inactive)"}`,
              }))}
              active={activeVersionId}
              onChange={setActiveVersionId}
            />
            <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setShowNewVersion(true)}>
              <i className="bi bi-plus-circle" /> New Version
            </button>
          </div>

          {versions.length === 0 && (
            <div className="mu-card">
              <div className="mu-card-body" style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-diagram-3" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Curriculum Version Yet</h3>
                <p style={{ margin: "8px 0 0" }}>Create one to start mapping units to years and semesters.</p>
              </div>
            </div>
          )}

          {activeVersion && (
            <div className="mu-card">
              <div className="mu-card-header">
                <div>
                  <h4 style={{ margin: 0 }}>{programme.code} curriculum — {activeVersion.effective_academic_year_detail?.year}</h4>
                  {activeVersion.notes && <div style={{ fontSize: 12, color: "var(--mu-gray-500)" }}>{activeVersion.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => toggleVersionActive(activeVersion)}>
                    {activeVersion.is_active ? "Mark Inactive" : "Mark Active"}
                  </button>
                  <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setShowAddUnit(true)}>
                    <i className="bi bi-plus-circle" /> Add Unit
                  </button>
                </div>
              </div>
              <div className="mu-card-body">
                {Array.from({ length: programme.duration_years }, (_, i) => i + 1).map((yr) => (
                  <div key={yr} style={{ marginBottom: 20 }}>
                    <h5 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--mu-gray-500)", marginBottom: 8, fontWeight: 600 }}>Year {yr}</h5>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${programme.semesters_per_year}, 1fr)`, gap: 12 }}>
                      {Array.from({ length: programme.semesters_per_year }, (_, i) => i + 1).map((sem) => {
                        const key = `${yr}-${sem}`;
                        const rows = unitsBySlot.get(key) || [];
                        return (
                          <div key={sem} style={{ border: "1px solid var(--mu-border)", borderRadius: "var(--mu-radius-sm)", padding: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--mu-gray-600)", marginBottom: 6 }}>
                              Semester {sem} <span className="mu-badge mu-badge-gray" style={{ marginLeft: 4 }}>{rows.length}</span>
                            </div>
                            {rows.length === 0 && <div style={{ fontSize: 12, color: "var(--mu-gray-300)" }}>No units placed yet.</div>}
                            {rows.map((u) => (
                              <div key={u.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "4px 0", borderBottom: "1px solid var(--mu-border)",
                                fontSize: 12,
                              }}>
                                <span>
                                  <strong>{u.course_detail?.code}</strong> {u.course_detail?.name}
                                  {!u.is_mandatory && <span className="mu-badge mu-badge-gray" style={{ marginLeft: 6, fontSize: "0.6rem" }}>Elective</span>}
                                </span>
                                <button
                                  className="mu-btn mu-btn-sm mu-btn-danger" style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                                  onClick={() => setDeleteUnitTarget(u)} title="Remove"
                                >
                                  <i className="bi bi-x" />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showNewVersion && (
        <CurriculumVersionFormModal
          programme={programme}
          academicYears={academicYears}
          existingVersions={versions}
          onClose={() => setShowNewVersion(false)}
          onSaved={() => { setShowNewVersion(false); showToast("Curriculum version created."); loadVersions(); }}
        />
      )}

      {showAddUnit && activeVersion && (
        <CurriculumUnitFormModal
          curriculumVersion={activeVersion}
          programme={programme}
          courses={coursesLite}
          departments={departments}
          onClose={() => setShowAddUnit(false)}
          onSaved={() => { setShowAddUnit(false); showToast("Unit added to curriculum."); loadVersions(); }}
        />
      )}

      {deleteUnitTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteUnitTarget(null)}
          title="Remove Unit"
          size="sm"
          confirmText="Remove"
          onConfirm={handleDeleteUnit}
          danger={true}
        >
          <p style={{ marginTop: 0 }}>
            Remove {deleteUnitTarget.course_detail?.code} from Year {deleteUnitTarget.year} Semester {deleteUnitTarget.semester}?
            <br />
            <span style={{ color: "var(--mu-danger)", fontSize: "var(--mu-font-size-sm)" }}>
              This cannot be undone.
            </span>
          </p>
        </Modal>
      )}
    </div>
  );
}

// ========================================================================
// Courses Panel
// ========================================================================
function CoursesPanel({ departments, programmes, academicYears }) {
  const [courses, setCourses] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [academicYearFilter, setAcademicYearFilter] = useState("");

  const [formModal, setFormModal] = useState(null);
  const [detailCourse, setDetailCourse] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const programmesMap = useMemo(
    () => Object.fromEntries(programmes.map((p) => [p.id, p])),
    [programmes]
  );

  const [filteredCourseIds, setFilteredCourseIds] = useState(null);
  const [resolvingCurriculumFilter, setResolvingCurriculumFilter] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!programmeFilter && !academicYearFilter) {
      setFilteredCourseIds(null);
      return;
    }
    setResolvingCurriculumFilter(true);
    const params = {};
    if (programmeFilter) params.programme = programmeFilter;
    if (academicYearFilter) params.effective_academic_year = academicYearFilter;
    adminApi.curriculumVersions(params)
      .then(({ data }) => {
        if (cancelled) return;
        const ids = new Set();
        unwrapList(data).forEach((v) => (v.units || []).forEach((u) => ids.add(u.course)));
        setFilteredCourseIds(ids);
      })
      .catch(() => { if (!cancelled) setFilteredCourseIds(new Set()); })
      .finally(() => { if (!cancelled) setResolvingCurriculumFilter(false); });
    return () => { cancelled = true; };
  }, [programmeFilter, academicYearFilter]);

  const isCrossFilterMode = filteredCourseIds !== null;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = isCrossFilterMode ? { page_size: 1000 } : { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (departmentFilter) params.department = departmentFilter;
      if (typeFilter) params.course_type = typeFilter;
      if (statusFilter) params.is_active = statusFilter === "active";

      const { data } = await adminApi.courses(params);
      let list = Array.isArray(data) ? data : (data.results || []);
      let total = Array.isArray(data) ? data.length : (data.count ?? list.length);

      if (isCrossFilterMode) {
        list = list.filter((c) => filteredCourseIds.has(c.id));
        total = list.length;
        const start = (page - 1) * PAGE_SIZE;
        list = list.slice(start, start + PAGE_SIZE);
      }

      setCourses(list);
      setCount(total);
    } catch (err) {
      console.error(err);
      setError("Failed to load courses.");
      setCourses([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, departmentFilter, typeFilter, statusFilter, isCrossFilterMode, filteredCourseIds]);

  useEffect(() => { if (!resolvingCurriculumFilter) fetchCourses(); }, [fetchCourses, resolvingCurriculumFilter]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter, typeFilter, statusFilter, programmeFilter, academicYearFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleDelete = async () => {
    try {
      await adminApi.deleteCourse(deleteTarget.id);
      showToast(`${deleteTarget.code} deleted.`);
      setDeleteTarget(null);
      fetchCourses();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete — course is likely referenced by curriculum units or enrollments.");
      setDeleteTarget(null);
    }
  };

  const handleExportAll = () => {
    downloadCsv(
      "courses_export.csv",
      courses.map((c) => ({
        code: c.code, name: c.name,
        department: departments.find((d) => d.id === c.department)?.code || "",
        type: c.course_type, credit_hours: c.credit_hours,
        status: c.is_active ? "active" : "inactive",
      })),
      ["code", "name", "department", "type", "credit_hours", "status"]
    );
  };

  const resetFilters = () => {
    setSearch(""); setDepartmentFilter(""); setTypeFilter(""); setStatusFilter("");
    setProgrammeFilter(""); setAcademicYearFilter("");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        <button className="mu-btn mu-btn-outline-primary" onClick={handleExportAll}>
          <i className="bi bi-download" /> Export CSV
        </button>
        <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
          <i className="bi bi-plus-circle" /> Add Course
        </button>
      </div>

      {toast && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {toast}
        </div>
      )}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Table with Filters Above Header */}
      <div className="mu-card">
        <div className="mu-card-body" style={{ padding: 0 }}>
          <div className="mu-table-wrapper">
            <table className="mu-table">
              <thead>
                {/* Filter Row */}
                <tr style={{ background: "var(--mu-gray-50)" }}>
                  <th colSpan={7} style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {/* Search */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 180px" }}>
                        <div style={{ position: "relative", width: "100%" }}>
                          <i className="bi bi-search" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--mu-gray-400)" }} />
                          <input
                            type="text"
                            className="mu-input"
                            placeholder="Search courses..."
                            style={{ 
                              width: "100%", 
                              padding: "3px 8px 3px 26px", 
                              fontSize: "var(--mu-font-size-xs)",
                              minHeight: "auto",
                              height: 28
                            }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Department Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Dept:</span>
                        <select
                          className="mu-select"
                          style={{ width: 120, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={departmentFilter}
                          onChange={(e) => setDepartmentFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
                        </select>
                      </div>

                      {/* Type Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Type:</span>
                        <select
                          className="mu-select"
                          style={{ width: 110, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {COURSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* Status Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Status:</span>
                        <select
                          className="mu-select"
                          style={{ width: 90, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>

                      {/* Programme Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Prog:</span>
                        <select
                          className="mu-select"
                          style={{ width: 130, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={programmeFilter}
                          onChange={(e) => setProgrammeFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {programmes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                      </div>

                      {/* Academic Year Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Aca Year:</span>
                        <select
                          className="mu-select"
                          style={{ width: 110, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={academicYearFilter}
                          onChange={(e) => setAcademicYearFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
                        </select>
                      </div>

                      {/* Reset */}
                      <button
                        className="mu-btn mu-btn-secondary"
                        style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        onClick={resetFilters}
                      >
                        <i className="bi bi-arrow-counterclockwise" />
                        Reset
                      </button>

                      {/* Results count */}
                      <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginLeft: "auto" }}>
                        {count} course(s)
                      </span>
                    </div>
                  </th>
                </tr>
                {/* Column Headers */}
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th style={{ textAlign: "center" }}>Credits</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(loading || resolvingCurriculumFilter) ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: "center" }}><LoadingSpinner text="Loading courses..." /></td></tr>
                ) : courses.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                    <i className="bi bi-journal-x" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                    <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No courses found</h3>
                    <p style={{ margin: "8px 0 0" }}>Try adjusting filters or add a new course.</p>
                  </td></tr>
                ) : (
                  courses.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.code}</strong></td>
                      <td>{c.name}</td>
                      <td>{departments.find((d) => d.id === c.department)?.code || "—"}</td>
                      <td>{c.course_type}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-primary">{c.credit_hours}</span>
                      </td>
                      <td>
                        <span className={`mu-badge ${c.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailCourse(c)} title="View">
                            <i className="bi bi-eye" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", course: c })} title="Edit">
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(c)} title="Delete">
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!loading && !resolvingCurriculumFilter && courses.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              Page {page} of {totalPages} &middot; {count} courses
            </span>
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
        <CourseFormModal
          mode={formModal.mode}
          course={formModal.course}
          departments={departments}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchCourses(); }}
        />
      )}

      {detailCourse && (
        <CourseDetailModal
          course={detailCourse}
          programmesMap={programmesMap}
          onClose={() => setDetailCourse(null)}
        />
      )}

      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Course"
          size="sm"
          confirmText="Delete"
          onConfirm={handleDelete}
          danger={true}
        >
          <p style={{ marginTop: 0 }}>
            Delete {deleteTarget.name} ({deleteTarget.code})?
            <br />
            <span style={{ color: "var(--mu-danger)", fontSize: "var(--mu-font-size-sm)" }}>
              This fails if it's used in curriculum units or has enrollments.
            </span>
          </p>
        </Modal>
      )}
    </div>
  );
}

// ========================================================================
// MAIN PAGE
// ========================================================================
export default function CoursesCurriculum() {
  const [pageTab, setPageTab] = useState("courses");
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.departments(), adminApi.programmes(), adminApi.academicYears()])
      .then(([dRes, pRes, yRes]) => {
        setDepartments(unwrapList(dRes.data));
        setProgrammes(unwrapList(pRes.data));
        setAcademicYears(unwrapList(yRes.data));
      })
      .catch(() => {})
      .finally(() => setLoadingLookups(false));
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-journal-bookmark" />
            Courses &amp; Curriculum
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Courses
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <TabBar
        tabs={[
          { key: "courses", label: "Courses" },
          { key: "curriculum", label: "Curriculum Builder" },
        ]}
        active={pageTab}
        onChange={setPageTab}
      />

      <div style={{ marginTop: 16 }}>
        {loadingLookups ? (
          <LoadingSpinner text="Loading..." />
        ) : pageTab === "courses" ? (
          <CoursesPanel departments={departments} programmes={programmes} academicYears={academicYears} />
        ) : (
          <CurriculumBuilderPanel departments={departments} programmes={programmes} academicYears={academicYears} />
        )}
      </div>
    </div>
  );
}