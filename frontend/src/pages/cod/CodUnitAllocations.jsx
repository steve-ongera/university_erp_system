import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { codApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const emptyForm = {
  lecturer: "",
  course: "",
  semester: "",
  programme: "",
  year: "",
  programme_semester: "",
  is_supplementary_offering: false,
};

export default function CodUnitAllocations() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [allocations, setAllocations] = useState([]);

  const [lecturers, setLecturers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [programmes, setProgrammes] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const loadAllocations = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await codApi.unitAllocations();
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setAllocations(data);
    } catch (err) {
      console.error("Error fetching unit allocations:", err);
      setError(err.response?.data?.detail || "Failed to load unit allocations.");
    } finally {
      setLoading(false);
    }
  };

  const loadFormOptions = async () => {
    try {
      const [lecRes, courseRes, semRes, progRes] = await Promise.all([
        codApi.lecturers(),
        codApi.courses(),
        codApi.semesters(),
        codApi.programmes(),
      ]);
      setLecturers(lecRes.data?.results || lecRes.data || []);
      setCourses(courseRes.data?.results || courseRes.data || []);
      setSemesters(semRes.data?.results || semRes.data || []);
      setProgrammes(progRes.data?.results || progRes.data || []);
    } catch (err) {
      console.error("Error loading form options:", err);
    }
  };

  useEffect(() => {
    loadAllocations();
    loadFormOptions();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (allocation) => {
    setForm({
      lecturer: allocation.lecturer,
      course: allocation.course,
      semester: allocation.semester,
      programme: allocation.programme,
      year: allocation.year,
      programme_semester: allocation.programme_semester,
      is_supplementary_offering: allocation.is_supplementary_offering,
    });
    setEditingId(allocation.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      lecturer: form.lecturer,
      course: form.course,
      semester: form.semester,
      programme: form.programme,
      year: Number(form.year),
      programme_semester: Number(form.programme_semester),
      is_supplementary_offering: form.is_supplementary_offering,
    };

    try {
      if (editingId) {
        await codApi.updateUnitAllocation(editingId, payload);
        setSuccess("Allocation updated.");
      } else {
        await codApi.createUnitAllocation(payload);
        setSuccess("Lecturer assigned to unit.");
      }
      resetForm();
      await loadAllocations();
    } catch (err) {
      console.error("Error saving allocation:", err);
      setError(
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data) ||
        "Failed to save allocation."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await codApi.deleteUnitAllocation(deleteTarget);
      setSuccess("Allocation removed.");
      setDeleteTarget(null);
      setConfirmModalOpen(false);
      await loadAllocations();
    } catch (err) {
      console.error("Error deleting allocation:", err);
      setError(err.response?.data?.detail || "Failed to delete allocation.");
      setDeleteTarget(null);
      setConfirmModalOpen(false);
    }
  };

  const handleToggleActive = async (allocation) => {
    setError("");
    try {
      await codApi.updateUnitAllocation(allocation.id, { is_active: !allocation.is_active });
      await loadAllocations();
    } catch (err) {
      console.error("Error toggling allocation:", err);
      setError(err.response?.data?.detail || "Failed to update allocation.");
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading unit allocations..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-person-video3" />
            Unit Allocations
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> COD <span className="separator">/</span> Unit Allocations
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/cod/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
          <button
            className={`mu-btn ${showForm ? "mu-btn-secondary" : "mu-btn-primary"}`}
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
              }
            }}
          >
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-plus-circle"}`} />
            {showForm ? "Cancel" : "Assign Lecturer to Unit"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}
      {success && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-pencil-square" style={{ marginRight: 8 }} />
              {editingId ? "Edit Allocation" : "Assign Lecturer to Unit"}
            </h4>
          </div>
          <div className="mu-card-body">
            <form onSubmit={handleSubmit}>
              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Lecturer</label>
                  <select
                    className="mu-select"
                    value={form.lecturer}
                    onChange={(e) => handleChange("lecturer", e.target.value)}
                    required
                  >
                    <option value="">Select lecturer</option>
                    {lecturers.map((lec) => (
                      <option key={lec.id} value={lec.id}>
                        {lec.user_detail?.first_name} {lec.user_detail?.last_name} ({lec.employee_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mu-form-group">
                  <label>Course</label>
                  <select
                    className="mu-select"
                    value={form.course}
                    onChange={(e) => handleChange("course", e.target.value)}
                    required
                  >
                    <option value="">Select course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Semester</label>
                  <select
                    className="mu-select"
                    value={form.semester}
                    onChange={(e) => handleChange("semester", e.target.value)}
                    required
                  >
                    <option value="">Select semester</option>
                    {semesters.map((sem) => (
                      <option key={sem.id} value={sem.id}>
                        {sem.academic_year_detail?.year || sem.academic_year} S{sem.semester_number}
                        {sem.is_current ? " (Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mu-form-group">
                  <label>Programme</label>
                  <select
                    className="mu-select"
                    value={form.programme}
                    onChange={(e) => handleChange("programme", e.target.value)}
                    required
                  >
                    <option value="">Select programme</option>
                    {programmes.map((prog) => (
                      <option key={prog.id} value={prog.id}>
                        {prog.code} - {prog.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Programme Year</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    className="mu-input"
                    value={form.year}
                    onChange={(e) => handleChange("year", e.target.value)}
                    required
                  />
                </div>

                <div className="mu-form-group">
                  <label>Programme Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    className="mu-input"
                    value={form.programme_semester}
                    onChange={(e) => handleChange("programme_semester", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mu-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_supplementary_offering}
                  onChange={(e) => handleChange("is_supplementary_offering", e.target.checked)}
                  id="supp_offering"
                />
                <label htmlFor="supp_offering">This offering is specifically for supplementary students</label>
              </div>

              <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
                <button type="button" className="mu-btn mu-btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <i className="bi bi-arrow-repeat mu-animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? "Update Allocation" : "Create Allocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocations Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Existing Allocations</h4>
          <span className="mu-badge mu-badge-primary">
            {allocations.length} Allocation(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {allocations.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-person-video3" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Allocations</h3>
              <p style={{ margin: "8px 0 0" }}>No unit allocations yet for this department.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Lecturer</th>
                    <th>Course</th>
                    <th>Semester</th>
                    <th>Programme</th>
                    <th>Year.Sem</th>
                    <th style={{ textAlign: "center" }}>Supplementary</th>
                    <th style={{ textAlign: "center" }}>Students</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>
                          {a.lecturer_detail?.user_detail?.first_name} {a.lecturer_detail?.user_detail?.last_name}
                        </strong>
                      </td>
                      <td>
                        <div>{a.course_detail?.code}</div>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {a.course_detail?.name}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {a.semester_detail?.academic_year_detail?.year} S{a.semester_detail?.semester_number}
                        </span>
                      </td>
                      <td>{a.programme_detail?.code}</td>
                      <td>
                        <span className="mu-badge mu-badge-primary">Y{a.year}</span>
                        <span className="mu-badge mu-badge-info" style={{ marginLeft: 4 }}>S{a.programme_semester}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {a.is_supplementary_offering ? (
                          <span className="mu-badge mu-badge-warning">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Yes
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-gray">
                            <i className="bi bi-x-circle" style={{ marginRight: 4 }} />
                            No
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-success">
                          <i className="bi bi-people" style={{ marginRight: 4 }} />
                          {a.student_count || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge ${a.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                          {a.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            onClick={() => handleEdit(a)}
                            title="Edit"
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            className={`mu-btn mu-btn-sm ${a.is_active ? "mu-btn-outline-primary" : "mu-btn-primary"}`}
                            onClick={() => handleToggleActive(a)}
                            title={a.is_active ? "Deactivate" : "Activate"}
                          >
                            <i className={`bi ${a.is_active ? "bi-pause-circle" : "bi-play-circle"}`} />
                          </button>
                          <button
                            className="mu-btn mu-btn-sm mu-btn-danger"
                            onClick={() => {
                              setDeleteTarget(a.id);
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
        {allocations.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {allocations.length} allocation(s)
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
        title="Delete Allocation"
        size="sm"
        confirmText="Delete"
        onConfirm={handleDelete}
        danger={true}
      >
        <p style={{ marginTop: 0 }}>
          Remove this unit allocation?
          <br />
          <span style={{ color: "var(--mu-danger)", fontSize: "var(--mu-font-size-sm)" }}>
            This action cannot be undone.
          </span>
        </p>
      </Modal>
    </div>
  );
}