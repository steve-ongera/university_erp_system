// src/pages/admin/LecturersStaff.jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const PAGE_SIZE = 20;
const GENDERS = ["male", "female", "other"];

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

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

// ----------------------------------------------------------------------
// Add / Edit Lecturer modal
// ----------------------------------------------------------------------
function LecturerFormModal({ mode, lecturer, departments, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    first_name: "", last_name: "", gender: "male",
    department: lecturer?.department || "",
    academic_rank: lecturer?.academic_rank || "Lecturer",
    is_active: lecturer?.is_active ?? true,
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
    setSaving(true);
    try {
      if (isEdit) {
        const { data } = await adminApi.updateLecturer(lecturer.id, {
          department: form.department, academic_rank: form.academic_rank, is_active: form.is_active,
        });
        onSaved(data, "Lecturer updated.");
      } else {
        if (!form.first_name || !form.last_name || !form.department) {
          setError("First name, last name and department are required.");
          setSaving(false);
          return;
        }
        const { data } = await adminApi.admitLecturer({
          first_name: form.first_name, last_name: form.last_name, gender: form.gender,
          department: form.department, academic_rank: form.academic_rank,
        });
        onSaved(data, `Lecturer added. Employee No: ${data.employee_number}`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save lecturer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEdit ? "Edit Lecturer" : "Add Lecturer"} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        {!isEdit && (
          <>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>First Name</label>
                <input className="mu-input" required value={form.first_name} onChange={handleChange("first_name")} />
              </div>
              <div className="mu-form-group">
                <label>Last Name</label>
                <input className="mu-input" required value={form.last_name} onChange={handleChange("last_name")} />
              </div>
            </div>
            <div className="mu-form-group">
              <label>Gender</label>
              <select className="mu-input" value={form.gender} onChange={handleChange("gender")}>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="mu-alert mu-alert-info" style={{ marginTop: 12 }}>
              <i className="bi bi-info-circle" />
              A login account is created automatically (username = employee number, temporary password = same, must be changed on first login).
            </div>
          </>
        )}

        <div className="mu-form-group">
          <label>Department</label>
          <select className="mu-input" required value={form.department} onChange={handleChange("department")}>
            <option value="">Select department...</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="mu-form-group">
          <label>Academic Rank</label>
          <select className="mu-input" value={form.academic_rank} onChange={handleChange("academic_rank")}>
            {["Assistant Lecturer", "Lecturer", "Senior Lecturer", "Associate Professor", "Professor"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {isEdit && (
          <div className="mu-checkbox">
            <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} id="lecturer_active" />
            <label htmlFor="lecturer_active">Active</label>
          </div>
        )}

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Add Lecturer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Add / Edit Staff modal
// ----------------------------------------------------------------------
function StaffFormModal({ mode, staffMember, departments, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    first_name: "", last_name: "", gender: "male",
    department: staffMember?.department || "",
    designation: staffMember?.designation || "",
    user_type: "staff",
    is_active: staffMember?.is_active ?? true,
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
    setSaving(true);
    try {
      if (isEdit) {
        const { data } = await adminApi.updateStaffMember(staffMember.id, {
          department: form.department || null, designation: form.designation, is_active: form.is_active,
        });
        onSaved(data, "Staff record updated.");
      } else {
        if (!form.first_name || !form.last_name) {
          setError("First and last name are required.");
          setSaving(false);
          return;
        }
        const { data } = await adminApi.admitStaff({
          first_name: form.first_name, last_name: form.last_name, gender: form.gender,
          department: form.department || null, designation: form.designation, user_type: form.user_type,
        });
        onSaved(data, `Staff added. Employee No: ${data.employee_number}`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save staff record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEdit ? "Edit Staff" : "Add Staff"} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        {!isEdit && (
          <>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>First Name</label>
                <input className="mu-input" required value={form.first_name} onChange={handleChange("first_name")} />
              </div>
              <div className="mu-form-group">
                <label>Last Name</label>
                <input className="mu-input" required value={form.last_name} onChange={handleChange("last_name")} />
              </div>
            </div>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Gender</label>
                <select className="mu-input" value={form.gender} onChange={handleChange("gender")}>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="mu-form-group">
                <label>Role</label>
                <select className="mu-input" value={form.user_type} onChange={handleChange("user_type")}>
                  <option value="staff">General Staff</option>
                  <option value="registrar">Registrar</option>
                  <option value="finance">Finance Officer</option>
                  <option value="exam_office">Examinations Office</option>
                  <option value="hostel_warden">Hostel Warden</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div className="mu-form-group">
          <label>Department (optional)</label>
          <select className="mu-input" value={form.department} onChange={handleChange("department")}>
            <option value="">— None —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="mu-form-group">
          <label>Designation</label>
          <input className="mu-input" value={form.designation} onChange={handleChange("designation")} placeholder="e.g. Senior Finance Officer" />
        </div>

        {isEdit && (
          <div className="mu-checkbox">
            <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} id="staff_active" />
            <label htmlFor="staff_active">Active</label>
          </div>
        )}

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Add Staff"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Lecturer detail — shows their allocations
// ----------------------------------------------------------------------
function LecturerDetailModal({ lecturer, onClose }) {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.lecturerAllocations({ lecturer: lecturer.id })
      .then(({ data }) => setAllocations(unwrapList(data)))
      .catch(() => setAllocations([]))
      .finally(() => setLoading(false));
  }, [lecturer.id]);

  return (
    <Modal isOpen={true} onClose={onClose} title={fullName(lecturer.user_detail)} size="lg">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="mu-form-group">
          <label>Employee No</label>
          <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{lecturer.employee_number}</div>
        </div>
        <div className="mu-form-group">
          <label>Department</label>
          <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{lecturer.department_detail?.name || "—"}</div>
        </div>
        <div className="mu-form-group">
          <label>Rank</label>
          <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{lecturer.academic_rank || "—"}</div>
        </div>
      </div>
      <h4 style={{ margin: "0 0 10px" }}>Unit Allocations</h4>
      {loading ? <LoadingSpinner text="Loading..." /> : (
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead><tr><th>Course</th><th>Semester</th><th>Y/S</th><th>Status</th></tr></thead>
            <tbody>
              {allocations.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 16, color: "var(--mu-gray-400)" }}>No allocations.</td></tr>}
              {allocations.map((a) => (
                <tr key={a.id}>
                  <td>{a.course_detail?.code}</td>
                  <td>{a.semester_detail?.academic_year_detail?.year} S{a.semester_detail?.semester_number}</td>
                  <td>Y{a.year} S{a.programme_semester}</td>
                  <td><span className={`mu-badge ${a.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>{a.is_active ? "Active" : "Inactive"}</span></td>
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
// Tab Bar
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// Confirm Modal
// ----------------------------------------------------------------------
function ConfirmModal({ title, message, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="sm">
      <p style={{ marginTop: 0 }}>{message}</p>
      <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
        <button className="mu-btn mu-btn-secondary" onClick={onClose} type="button">Cancel</button>
        <button
          className="mu-btn mu-btn-danger"
          disabled={busy}
          type="button"
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
        >
          {busy ? (
            <>
              <i className="bi bi-arrow-repeat mu-animate-spin" />
              Deleting...
            </>
          ) : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function LecturersStaff() {
  const [tab, setTab] = useState("lecturers");
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [departments, setDepartments] = useState([]);
  const [formModal, setFormModal] = useState(null);
  const [detailLecturer, setDetailLecturer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    adminApi.departments().then(({ data }) => setDepartments(unwrapList(data))).catch(() => {});
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (departmentFilter) params.department = departmentFilter;
      if (statusFilter) params.is_active = statusFilter === "active";

      const { data } = tab === "lecturers" ? await adminApi.lecturers(params) : await adminApi.staff(params);
      if (Array.isArray(data)) { setItems(data); setCount(data.length); }
      else { setItems(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError(`Failed to load ${tab}.`);
      setItems([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [tab, page, debouncedSearch, departmentFilter, statusFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setPage(1); }, [tab, debouncedSearch, departmentFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleDelete = async () => {
    try {
      if (tab === "lecturers") await adminApi.deleteLecturer(deleteTarget.id);
      else await adminApi.deleteStaffMember(deleteTarget.id);
      showToast("Record deleted.");
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete — likely has active allocations or dependent records.");
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-person-badge" />
            Lecturers &amp; Staff
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Lecturers &amp; Staff
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" />
            Add {tab === "lecturers" ? "Lecturer" : "Staff"}
          </button>
        </div>
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

      <TabBar
        tabs={[{ key: "lecturers", label: `Lecturers (${count || 0})` }, { key: "staff", label: "Staff" }]}
        active={tab}
        onChange={setTab}
      />

      {/* Table with Filters Above Header */}
      <div className="mu-card">
        <div className="mu-card-body" style={{ padding: 0 }}>
          <div className="mu-table-wrapper">
            <table className="mu-table">
              <thead>
                {/* Filter Row */}
                <tr style={{ background: "var(--mu-gray-50)" }}>
                  <th colSpan={6} style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {/* Search - First */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 220px" }}>
                        <div style={{ position: "relative", width: "100%" }}>
                          <i className="bi bi-search" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--mu-gray-400)" }} />
                          <input
                            type="text"
                            className="mu-input"
                            placeholder="Search by employee no. or name..."
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
                          style={{ 
                            width: 130, 
                            padding: "3px 8px", 
                            fontSize: "var(--mu-font-size-xs)",
                            minHeight: "auto",
                            height: 28
                          }}
                          value={departmentFilter}
                          onChange={(e) => setDepartmentFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
                        </select>
                      </div>

                      {/* Status Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Status:</span>
                        <select
                          className="mu-select"
                          style={{ 
                            width: 100, 
                            padding: "3px 8px", 
                            fontSize: "var(--mu-font-size-xs)",
                            minHeight: "auto",
                            height: 28
                          }}
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>

                      {/* Reset */}
                      <button
                        className="mu-btn mu-btn-secondary"
                        style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        onClick={() => { setSearch(""); setDepartmentFilter(""); setStatusFilter(""); }}
                      >
                        <i className="bi bi-arrow-counterclockwise" />
                        Reset
                      </button>

                      {/* Results count */}
                      <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginLeft: "auto" }}>
                        {count} record(s)
                      </span>
                    </div>
                  </th>
                </tr>
                {/* Column Headers */}
                <tr>
                  <th>Employee No</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>{tab === "lecturers" ? "Rank" : "Designation"}</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: "center" }}><LoadingSpinner text="Loading..." /></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                    <i className="bi bi-person-x" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                    <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No {tab} found</h3>
                    <p style={{ margin: "8px 0 0" }}>Try adjusting filters or add a new record.</p>
                  </td></tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id}>
                      <td><strong>{it.employee_number}</strong></td>
                      <td>{fullName(it.user_detail)}</td>
                      <td>{it.department_detail?.code || departments.find((d) => d.id === it.department)?.code || "—"}</td>
                      <td>{tab === "lecturers" ? it.academic_rank : it.designation}</td>
                      <td>
                        <span className={`mu-badge ${it.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                          {it.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          {tab === "lecturers" && (
                            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="View" onClick={() => setDetailLecturer(it)}>
                              <i className="bi bi-eye" />
                            </button>
                          )}
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Edit" onClick={() => setFormModal({ mode: "edit", item: it })}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" title="Delete" onClick={() => setDeleteTarget(it)}>
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
        {!loading && items.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              Page {page} of {totalPages} &middot; {count} records
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

      {/* Modals */}
      {formModal && tab === "lecturers" && (
        <LecturerFormModal
          mode={formModal.mode} lecturer={formModal.item} departments={departments}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchItems(); }}
        />
      )}
      {formModal && tab === "staff" && (
        <StaffFormModal
          mode={formModal.mode} staffMember={formModal.item} departments={departments}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchItems(); }}
        />
      )}

      {detailLecturer && <LecturerDetailModal lecturer={detailLecturer} onClose={() => setDetailLecturer(null)} />}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Record"
          message={`Delete ${fullName(deleteTarget.user_detail)} (${deleteTarget.employee_number})?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}