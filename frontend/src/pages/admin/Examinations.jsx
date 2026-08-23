// src/pages/admin/Examinations.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState,
  useDebouncedValue, summarizeErrors, unwrapList, downloadCsv,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;
const EXAM_TYPES = [
  { value: "cat", label: "CAT" },
  { value: "final", label: "Final Examination" },
  { value: "supplementary", label: "Supplementary Examination" },
];

// ----------------------------------------------------------------------
// Add / Edit Examination modal
// ----------------------------------------------------------------------
function ExamFormModal({ mode, exam, courses, semesters, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    course: exam?.course || "",
    semester: exam?.semester || "",
    exam_type: exam?.exam_type || "final",
    exam_date: exam?.exam_date || "",
    start_time: exam?.start_time || "09:00",
    duration_minutes: exam?.duration_minutes || 120,
    venue: exam?.venue || "",
    is_published: exam?.is_published ?? false,
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
    if (!form.course || !form.semester || !form.exam_date) {
      setError("Course, semester and exam date are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, duration_minutes: Number(form.duration_minutes) };
      const data = isEdit
        ? (await adminApi.updateExamination(exam.id, payload)).data
        : (await adminApi.createExamination(payload)).data;
      onSaved(data, isEdit ? "Examination updated." : "Examination scheduled.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save examination.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Examination" : "Schedule Examination"} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <Field label="Course">
          <select className="mu-input" required value={form.course} onChange={handleChange("course")}>
            <option value="">Select course...</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Semester">
            <select className="mu-input" required value={form.semester} onChange={handleChange("semester")}>
              <option value="">Select semester...</option>
              {semesters.map((s) => <option key={s.id} value={s.id}>{s.academic_year_detail?.year} S{s.semester_number}</option>)}
            </select>
          </Field>
          <Field label="Exam Type">
            <select className="mu-input" value={form.exam_type} onChange={handleChange("exam_type")}>
              {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Exam Date">
            <input type="date" className="mu-input" required value={form.exam_date} onChange={handleChange("exam_date")} />
          </Field>
          <Field label="Start Time">
            <input type="time" className="mu-input" value={form.start_time} onChange={handleChange("start_time")} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Duration (minutes)">
            <input type="number" min={15} step={15} className="mu-input" value={form.duration_minutes} onChange={handleChange("duration_minutes")} />
          </Field>
          <Field label="Venue">
            <input className="mu-input" value={form.venue} onChange={handleChange("venue")} placeholder="e.g. Hall A" />
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_published} onChange={handleChange("is_published")} />
          Published (visible to students/lecturers)
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Schedule Exam"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function Examinations() {
  const [exams, setExams] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [typeFilter, setTypeFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("");

  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.courses(), adminApi.semesters()]).then(([cRes, sRes]) => {
      setCourses(unwrapList(cRes.data));
      setSemesters(unwrapList(sRes.data));
    }).catch(() => {});
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE, ordering: "exam_date" };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter) params.exam_type = typeFilter;
      if (semesterFilter) params.semester = semesterFilter;
      if (publishedFilter) params.is_published = publishedFilter === "published";

      const { data } = await adminApi.examinations(params);
      if (Array.isArray(data)) { setExams(data); setCount(data.length); }
      else { setExams(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load examinations.");
      setExams([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, semesterFilter, publishedFilter]);

  useEffect(() => { fetchExams(); }, [fetchExams]);
  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, semesterFilter, publishedFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleDelete = async () => {
    try {
      await adminApi.deleteExamination(deleteTarget.id);
      showToast("Examination removed.");
      setDeleteTarget(null);
      fetchExams();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete examination.");
      setDeleteTarget(null);
    }
  };

  const handleExport = () => {
    downloadCsv(
      "examinations_export.csv",
      exams.map((e) => ({
        course: e.course_detail?.code, type: e.exam_type, date: e.exam_date,
        time: e.start_time, duration: e.duration_minutes, venue: e.venue,
        published: e.is_published ? "yes" : "no",
      })),
      ["course", "type", "date", "time", "duration", "venue", "published"]
    );
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-calendar-event" /> Examinations</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Examinations</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-outline-primary" onClick={handleExport}>
            <i className="bi bi-download" /> Export CSV
          </button>
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Schedule Exam
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Course code or venue..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Type">
              <select className="mu-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
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
          <div style={{ width: 160 }}>
            <Field label="Published">
              <select className="mu-input" value={publishedFilter} onChange={(e) => setPublishedFilter(e.target.value)}>
                <option value="">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
          </div>
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setTypeFilter(""); setSemesterFilter(""); setPublishedFilter(""); }}>Reset</button>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Examinations</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : exams.length === 0 ? (
            <EmptyState icon="bi-calendar-x" label="No examinations found" hint="Try adjusting filters or schedule a new exam." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead><tr><th>Course</th><th>Type</th><th>Date</th><th>Time</th><th>Duration</th><th>Venue</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {exams.map((e) => (
                    <tr key={e.id}>
                      <td><strong>{e.course_detail?.code}</strong></td>
                      <td>{e.exam_type}</td>
                      <td>{e.exam_date}</td>
                      <td>{e.start_time}</td>
                      <td>{e.duration_minutes} min</td>
                      <td>{e.venue || "—"}</td>
                      <td><span className={`mu-badge ${e.is_published ? "mu-badge-success" : "mu-badge-gray"}`}>{e.is_published ? "Published" : "Draft"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", exam: e })}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(e)}>
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

        {!loading && exams.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} exams</span>
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
        <ExamFormModal
          mode={formModal.mode} exam={formModal.exam} courses={courses} semesters={semesters}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchExams(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Examination"
          message={`Delete the ${deleteTarget.exam_type} for ${deleteTarget.course_detail?.code} on ${deleteTarget.exam_date}?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}