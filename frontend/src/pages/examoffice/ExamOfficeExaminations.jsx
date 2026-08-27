import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { examOfficeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const emptyForm = {
  course: "", semester: "", exam_type: "final", exam_date: "",
  start_time: "", duration_minutes: 120, venue: "", is_published: false,
};

export default function ExamOfficeExaminations() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const load = () => {
    setLoading(true);
    examOfficeApi
      .examinations()
      .then((res) => setExams(res.data.results || res.data))
      .catch(() => setError("Could not load examinations."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    examOfficeApi.courses().then((res) => setCourses(res.data.results || res.data)).catch(() => {});
    examOfficeApi.semesters().then((res) => setSemesters(res.data.results || res.data)).catch(() => {});
  }, []);

  const startEdit = (exam) => {
    setEditingId(exam.id);
    setForm({
      course: exam.course, semester: exam.semester, exam_type: exam.exam_type,
      exam_date: exam.exam_date, start_time: exam.start_time,
      duration_minutes: exam.duration_minutes, venue: exam.venue, is_published: exam.is_published,
    });
    setShowForm(true);
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await examOfficeApi.updateExamination(editingId, form);
      else await examOfficeApi.createExamination(form);
      setShowForm(false);
      load();
    } catch {
      setError("Could not save the examination. Check required fields.");
    }
  };

  const togglePublish = async (exam) => {
    try {
      await examOfficeApi.updateExamination(exam.id, { is_published: !exam.is_published });
      load();
    } catch {
      setError("Could not update publish status.");
    }
  };

  const handleDelete = async () => {
    try {
      await examOfficeApi.deleteExamination(deleteTarget);
      setDeleteTarget(null);
      setConfirmModalOpen(false);
      load();
    } catch {
      setError("Could not delete the examination.");
      setDeleteTarget(null);
      setConfirmModalOpen(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading examinations..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-clipboard-check" />
            Examinations
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Exam Office <span className="separator">/</span> Examinations
          </div>
        </div>
        <div className="mu-page-header-actions">
          
          <button className="mu-btn mu-btn-primary" onClick={startCreate}>
            <i className="bi bi-plus-circle" />
            Schedule Exam
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-pencil-square" style={{ marginRight: 8 }} />
              {editingId ? "Edit Examination" : "Schedule New Examination"}
            </h4>
          </div>
          <div className="mu-card-body">
            <form onSubmit={handleSubmit}>
              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Course</label>
                  <select
                    required
                    className="mu-select"
                    value={form.course}
                    onChange={(e) => setForm({ ...form, course: e.target.value })}
                  >
                    <option value="">Select course…</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
                <div className="mu-form-group">
                  <label>Semester</label>
                  <select
                    required
                    className="mu-select"
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  >
                    <option value="">Select semester…</option>
                    {semesters.map((sem) => (
                      <option key={sem.id} value={sem.id}>
                        {sem.academic_year_detail?.year} S{sem.semester_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Exam Type</label>
                  <select
                    className="mu-select"
                    value={form.exam_type}
                    onChange={(e) => setForm({ ...form, exam_type: e.target.value })}
                  >
                    <option value="cat">CAT</option>
                    <option value="final">Final Examination</option>
                    <option value="supplementary">Supplementary Examination</option>
                  </select>
                </div>
                <div className="mu-form-group">
                  <label>Exam Date</label>
                  <input
                    required
                    type="date"
                    className="mu-input"
                    value={form.exam_date}
                    onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Start Time</label>
                  <input
                    required
                    type="time"
                    className="mu-input"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
                <div className="mu-form-group">
                  <label>Duration (minutes)</label>
                  <input
                    type="number"
                    className="mu-input"
                    placeholder="120"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  />
                </div>
              </div>

              <div className="mu-form-group">
                <label>Venue</label>
                <input
                  className="mu-input"
                  placeholder="e.g. LH 3"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                />
              </div>

              <div className="mu-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  id="publish_exam"
                />
                <label htmlFor="publish_exam">Publish immediately (students can see this exam)</label>
              </div>

              <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
                <button type="button" className="mu-btn mu-btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="mu-btn mu-btn-primary">
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Examinations Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-clipboard-check" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Scheduled Examinations
          </h4>
          <span className="mu-badge mu-badge-primary">
            {exams.length} Exam(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {exams.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-clipboard-check" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Examinations Scheduled</h3>
              <p style={{ margin: "8px 0 0" }}>Click "Schedule Exam" to create one.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Venue</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => (
                    <tr key={exam.id}>
                      <td>
                        <strong>{exam.course_detail?.code}</strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {exam.course_detail?.name}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {exam.exam_type}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {exam.exam_date}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {exam.start_time}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-gray">
                          <i className="bi bi-geo-alt" style={{ marginRight: 4 }} />
                          {exam.venue || "—"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`mu-btn mu-btn-sm ${exam.is_published ? "mu-btn-success" : "mu-btn-outline-primary"}`}
                          onClick={() => togglePublish(exam)}
                        >
                          {exam.is_published ? (
                            <>
                              <i className="bi bi-eye" style={{ marginRight: 4 }} />
                              Published
                            </>
                          ) : (
                            <>
                              <i className="bi bi-eye-slash" style={{ marginRight: 4 }} />
                              Draft
                            </>
                          )}
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            onClick={() => startEdit(exam)}
                            title="Edit"
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            className="mu-btn mu-btn-sm mu-btn-danger"
                            onClick={() => {
                              setDeleteTarget(exam.id);
                              setConfirmModalOpen(true);
                            }}
                            title="Delete"
                          >
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
        {exams.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {exams.length} exam(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setDeleteTarget(null);
        }}
        title="Delete Examination"
        size="sm"
        confirmText="Delete"
        onConfirm={handleDelete}
        danger={true}
      >
        <p style={{ marginTop: 0 }}>
          Delete this examination?
          <br />
          <span style={{ color: "var(--mu-danger)", fontSize: "var(--mu-font-size-sm)" }}>
            This action cannot be undone.
          </span>
        </p>
      </Modal>
    </div>
  );
}