// src/pages/admin/CoursesCurriculum.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi, studentsApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, TabBar, EmptyState,
  useDebouncedValue, summarizeErrors, unwrapList, downloadCsv, fmtDate,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;
const COURSE_TYPES = [
  { value: "core", label: "Core" },
  { value: "elective", label: "Elective" },
  { value: "common", label: "Common / Shared" },
  { value: "capstone", label: "Capstone Project" },
];

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

// ----------------------------------------------------------------------
// Add / Edit Course modal
// ----------------------------------------------------------------------
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
    <Modal title={isEdit ? "Edit Course" : "Add Course"} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <Field label="Course Name">
          <input className="mu-input" required value={form.name} onChange={handleChange("name")} placeholder="Data Structures and Algorithms" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Code">
            <input className="mu-input" required value={form.code} onChange={handleChange("code")} placeholder="IT201" />
          </Field>
          <Field label="Credit Hours">
            <input type="number" min={1} max={15} className="mu-input" value={form.credit_hours} onChange={handleChange("credit_hours")} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Course Type">
            <select className="mu-input" value={form.course_type} onChange={handleChange("course_type")}>
              {COURSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Department">
            <select className="mu-input" required value={form.department} onChange={handleChange("department")}>
              <option value="">Select department...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 12 }}>
          <Field label="Description">
            <textarea className="mu-input" rows={3} value={form.description} onChange={handleChange("description")} />
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} />
          Course is active
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Course"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Course Detail Modal — curriculum placements + enrolled students (grouped)
// ----------------------------------------------------------------------
function CourseDetailModal({ course, programmesMap, academicYearsMap, onClose }) {
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

  // Group enrollments by semester, newest first.
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
        registration_type: en.registration.registration_type,
      })),
      ["registration_number", "name", "programme", "semester", "registration_type"]
    );
  };

  return (
    <Modal title={`${course.name} (${course.code})`} onClose={onClose} width={780}>
      <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
        <div><div className="mu-label-sm">Type</div><div>{course.course_type}</div></div>
        <div><div className="mu-label-sm">Credit Hours</div><div>{course.credit_hours}</div></div>
        <div><div className="mu-label-sm">Status</div>
          <span className={`mu-badge ${course.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
            {course.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
      {course.description && <p style={{ color: "#666", fontSize: 13 }}>{course.description}</p>}

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
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "#999" }}>
                    This course isn't mapped into any curriculum yet.
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
              <EmptyState icon="bi-people" label="No students enrolled" hint="No one is currently registered for this unit." />
            ) : (
              grouped.map((group) => (
                <div key={group.key} style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>
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

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function CoursesCurriculum() {
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

  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [formModal, setFormModal] = useState(null);
  const [detailCourse, setDetailCourse] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.departments(), adminApi.programmes(), adminApi.academicYears()])
      .then(([dRes, pRes, yRes]) => {
        setDepartments(unwrapList(dRes.data));
        setProgrammes(unwrapList(pRes.data));
        setAcademicYears(unwrapList(yRes.data));
      })
      .catch(() => {});
  }, []);

  const programmesMap = useMemo(
    () => Object.fromEntries(programmes.map((p) => [p.id, p])),
    [programmes]
  );
  const academicYearsMap = useMemo(
    () => Object.fromEntries(academicYears.map((y) => [y.id, y])),
    [academicYears]
  );

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (departmentFilter) params.department = departmentFilter;
      if (typeFilter) params.course_type = typeFilter;
      if (statusFilter) params.is_active = statusFilter === "active";

      const { data } = await adminApi.courses(params);
      if (Array.isArray(data)) { setCourses(data); setCount(data.length); }
      else { setCourses(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load courses.");
      setCourses([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, departmentFilter, typeFilter, statusFilter]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);
  useEffect(() => { setPage(1); }, [debouncedSearch, departmentFilter, typeFilter, statusFilter]);

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

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-journal-bookmark" /> Courses &amp; Curriculum</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Courses</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-outline-primary" onClick={handleExportAll}>
            <i className="bi bi-download" /> Export CSV
          </button>
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add Course
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      {/* Filters */}
      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Course code or name..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 200 }}>
            <Field label="Department">
              <select className="mu-input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 170 }}>
            <Field label="Type">
              <select className="mu-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {COURSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
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
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setDepartmentFilter(""); setTypeFilter(""); setStatusFilter(""); }}>
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Courses</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading courses..." /></div>
          ) : courses.length === 0 ? (
            <EmptyState icon="bi-journal-x" label="No courses found" hint="Try adjusting filters or add a new course." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Department</th><th>Type</th><th>Credits</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.code}</strong></td>
                      <td>{c.name}</td>
                      <td>{departments.find((d) => d.id === c.department)?.code || "—"}</td>
                      <td>{c.course_type}</td>
                      <td>{c.credit_hours}</td>
                      <td><span className={`mu-badge ${c.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>{c.is_active ? "Active" : "Inactive"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && courses.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} courses</span>
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
          academicYearsMap={academicYearsMap}
          onClose={() => setDetailCourse(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Course"
          message={`Delete ${deleteTarget.name} (${deleteTarget.code})? This fails if it's used in curriculum units or has enrollments.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}