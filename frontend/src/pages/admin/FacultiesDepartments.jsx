import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const emptyFaculty = { name: "", code: "", dean: "", is_active: true };
const emptyDepartment = { name: "", code: "", faculty: "", head_of_department: "", grading_scheme: "", is_active: true };

export default function FacultiesDepartments() {
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [gradingSchemes, setGradingSchemes] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [facRes, deptRes, schemeRes, lecRes] = await Promise.all([
        adminApi.faculties(),
        adminApi.departments(),
        adminApi.gradingSchemes(),
        adminApi.lecturers(),
      ]);
      setFaculties(facRes.data.results ?? facRes.data ?? []);
      setDepartments(deptRes.data.results ?? deptRes.data ?? []);
      setGradingSchemes(schemeRes.data.results ?? schemeRes.data ?? []);
      setLecturers(lecRes.data.results ?? lecRes.data ?? []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const facultyName = (id) => faculties.find((f) => f.id === id)?.name || "—";
  const schemeName = (id) => gradingSchemes.find((g) => g.id === id)?.name || "—";
  const lecturerName = (userId) => {
    const lec = lecturers.find((l) => l.user === userId);
    if (!lec) return "—";
    return `${lec.user_detail?.first_name || ""} ${lec.user_detail?.last_name || ""}`.trim() || "—";
  };

  const openCreate = (entity) => {
    setModalError("");
    setModal({ entity, mode: "create", form: entity === "faculty" ? { ...emptyFaculty } : { ...emptyDepartment } });
  };

  const openEdit = (entity, record) => {
    setModalError("");
    setModal({ entity, mode: "edit", id: record.id, form: { ...record } });
  };

  const openView = (entity, record) => {
    setModalError("");
    setModal({ entity, mode: "view", id: record.id, form: { ...record } });
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
    setModalError("");
  };

  const updateField = (key, value) => {
    setModal((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }));
  };

  const buildPayload = (entity, form) => {
    if (entity === "faculty") {
      return {
        name: form.name,
        code: form.code,
        dean: form.dean || null,
        is_active: !!form.is_active,
      };
    }
    return {
      name: form.name,
      code: form.code,
      faculty: form.faculty || null,
      head_of_department: form.head_of_department || null,
      grading_scheme: form.grading_scheme || null,
      is_active: !!form.is_active,
    };
  };

  const handleSave = async () => {
    if (!modal) return;
    const { entity, mode, id, form } = modal;
    setSaving(true);
    setModalError("");
    try {
      const payload = buildPayload(entity, form);
      if (entity === "faculty") {
        if (mode === "create") await adminApi.createFaculty(payload);
        else await adminApi.updateFaculty(id, payload);
      } else {
        if (mode === "create") await adminApi.createDepartment(payload);
        else await adminApi.updateDepartment(id, payload);
      }
      await loadAll();
      setModal(null);
    } catch (err) {
      const data = err.response?.data;
      const msg = data
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
        : "Save failed.";
      setModalError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entity, record) => {
    if (!window.confirm(`Delete "${record.name}"? This cannot be undone.`)) return;
    try {
      if (entity === "faculty") await adminApi.deleteFaculty(record.id);
      else await adminApi.deleteDepartment(record.id);
      await loadAll();
    } catch (err) {
      alert(err.response?.data?.detail || "Delete failed. It may still be referenced by other records.");
    }
  };

  const isView = modal?.mode === "view";

  if (loading) {
    return <LoadingSpinner text="Loading faculties & departments..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-diagram-3" />
            Faculties & Departments
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Faculties & Departments
          </div>
        </div>
        <div className="mu-page-header-actions">
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

      {/* ===== FACULTIES ===== */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-building" style={{ marginRight: 8 }} />
            Faculties
          </h4>
          <button
            onClick={() => openCreate("faculty")}
            className="mu-btn mu-btn-primary mu-btn-sm"
          >
            <i className="bi bi-plus-circle" />
            Add Faculty
          </button>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          <div className="mu-table-wrapper">
            <table className="mu-table mu-table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Dean</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faculties.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--mu-gray-400)" }}>
                      No faculties yet. Click "Add Faculty" to create one.
                    </td>
                  </tr>
                ) : (
                  faculties.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.name}</strong>
                      </td>
                      <td>{f.code}</td>
                      <td>{lecturerName(f.dean)}</td>
                      <td>
                        <span className={`mu-badge ${f.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                          {f.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button
                            onClick={() => openView("faculty", f)}
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            title="View"
                          >
                            <i className="bi bi-eye" />
                          </button>
                          <button
                            onClick={() => openEdit("faculty", f)}
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            title="Edit"
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            onClick={() => handleDelete("faculty", f)}
                            className="mu-btn mu-btn-sm mu-btn-danger"
                            title="Delete"
                          >
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
        {faculties.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {faculties.length} faculty(ies)
            </span>
          </div>
        )}
      </div>

      {/* ===== DEPARTMENTS ===== */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-grid" style={{ marginRight: 8 }} />
            Departments
          </h4>
          <button
            onClick={() => openCreate("department")}
            className="mu-btn mu-btn-primary mu-btn-sm"
          >
            <i className="bi bi-plus-circle" />
            Add Department
          </button>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          <div className="mu-table-wrapper">
            <table className="mu-table mu-table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Faculty</th>
                  <th>Head of Dept.</th>
                  <th>Grading Scheme</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--mu-gray-400)" }}>
                      No departments yet. Click "Add Department" to create one.
                    </td>
                  </tr>
                ) : (
                  departments.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.name}</strong>
                      </td>
                      <td>{d.code}</td>
                      <td>{facultyName(d.faculty)}</td>
                      <td>{lecturerName(d.head_of_department)}</td>
                      <td>
                        <span className="mu-badge mu-badge-primary">{schemeName(d.grading_scheme)}</span>
                      </td>
                      <td>
                        <span className={`mu-badge ${d.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button
                            onClick={() => openView("department", d)}
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            title="View"
                          >
                            <i className="bi bi-eye" />
                          </button>
                          <button
                            onClick={() => openEdit("department", d)}
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            title="Edit"
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            onClick={() => handleDelete("department", d)}
                            className="mu-btn mu-btn-sm mu-btn-danger"
                            title="Delete"
                          >
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
        {departments.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {departments.length} department(s)
            </span>
          </div>
        )}
      </div>

      {/* ===== MODAL ===== */}
      {modal && (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`${modal.mode === "create" ? "Add" : modal.mode === "edit" ? "Edit" : "View"} ${
            modal.entity === "faculty" ? "Faculty" : "Department"
          }`}
          size="md"
          confirmText={isView ? "Close" : "Save"}
          onConfirm={isView ? closeModal : handleSave}
          isLoading={saving}
          showFooter={!isView}
        >
          {modalError && (
            <div className="mu-alert mu-alert-danger">
              <i className="bi bi-exclamation-triangle" />
              {modalError}
            </div>
          )}

          <div className="mu-form-group">
            <label>Name</label>
            <input
              type="text"
              className="mu-input"
              disabled={isView}
              value={modal.form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Enter name"
            />
          </div>

          <div className="mu-form-group">
            <label>Code</label>
            <input
              type="text"
              className="mu-input"
              disabled={isView}
              value={modal.form.code}
              onChange={(e) => updateField("code", e.target.value)}
              placeholder="Enter code"
            />
          </div>

          {modal.entity === "faculty" && (
            <div className="mu-form-group">
              <label>Dean</label>
              <select
                className="mu-select"
                disabled={isView}
                value={modal.form.dean || ""}
                onChange={(e) => updateField("dean", e.target.value)}
              >
                <option value="">— None —</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.user}>
                    {l.user_detail?.first_name} {l.user_detail?.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {modal.entity === "department" && (
            <>
              <div className="mu-form-group">
                <label>Faculty</label>
                <select
                  className="mu-select"
                  disabled={isView}
                  value={modal.form.faculty || ""}
                  onChange={(e) => updateField("faculty", e.target.value)}
                >
                  <option value="">— Select —</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="mu-form-group">
                <label>Head of Department</label>
                <select
                  className="mu-select"
                  disabled={isView}
                  value={modal.form.head_of_department || ""}
                  onChange={(e) => updateField("head_of_department", e.target.value)}
                >
                  <option value="">— None —</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.user}>
                      {l.user_detail?.first_name} {l.user_detail?.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mu-form-group">
                <label>Grading Scheme</label>
                <select
                  className="mu-select"
                  disabled={isView}
                  value={modal.form.grading_scheme || ""}
                  onChange={(e) => updateField("grading_scheme", e.target.value)}
                >
                  <option value="">— Select —</option>
                  {gradingSchemes.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="mu-checkbox">
            <input
              type="checkbox"
              id="is_active"
              disabled={isView}
              checked={!!modal.form.is_active}
              onChange={(e) => updateField("is_active", e.target.checked)}
            />
            <label htmlFor="is_active">Active</label>
          </div>
        </Modal>
      )}
    </div>
  );
}