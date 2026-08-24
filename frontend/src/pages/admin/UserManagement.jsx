// src/pages/admin/UserManagement.jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const PAGE_SIZE = 20;

// Roles that already have a dedicated admit flow (creates a linked
// Student/Lecturer profile) — creating them here would leave that
// profile missing, so they're excluded from the "create user" dropdown.
const CREATABLE_ROLES = [
  { value: "admin", label: "System Admin" },
  { value: "registrar", label: "Registrar" },
  { value: "dean", label: "Dean" },
  { value: "cod", label: "Chairman of Department" },
  { value: "exam_office", label: "Examinations Office" },
  { value: "finance", label: "Finance Officer" },
  { value: "hostel_warden", label: "Hostel Warden" },
  { value: "staff", label: "Staff" },
];

const ALL_ROLES = [
  ...CREATABLE_ROLES,
  { value: "student", label: "Student" },
  { value: "lecturer", label: "Lecturer" },
];

const roleLabel = (value) => ALL_ROLES.find((r) => r.value === value)?.label || value;

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

function CreateUserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    username: "", first_name: "", last_name: "", email: "", phone: "",
    gender: "", user_type: "", password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username || !form.first_name || !form.last_name || !form.user_type) {
      setError("Username, first name, last name and role are required.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await adminApi.createUser(form);
      setCreated(data);
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not create user.");
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Modal isOpen={true} onClose={() => { onSaved("User created."); onClose(); }} title="User Created" size="md">
        <div className="mu-alert mu-alert-success" style={{ marginBottom: 16 }}>
          <i className="bi bi-check-circle" /> {created.first_name} {created.last_name} was created as {roleLabel(created.user_type)}.
        </div>
        <div style={{ background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-md)", padding: 14, fontSize: 14 }}>
          <div style={{ marginBottom: 6 }}>Username: <strong>{created.username}</strong></div>
          <div>Temporary password: <strong>{created.temporary_password}</strong></div>
        </div>
        <div className="mu-help-text" style={{ marginTop: 12 }}>
          Share this password with the user securely — they'll be required to change it on first login.
          It won't be shown again.
        </div>
        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button className="mu-btn mu-btn-primary" onClick={() => { onSaved("User created."); onClose(); }}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Create User" size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

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
          <label>Username (login ID)</label>
          <input className="mu-input" required value={form.username} onChange={handleChange("username")} />
        </div>

        <div className="mu-form-group">
          <label>Role</label>
          <select className="mu-select" required value={form.user_type} onChange={handleChange("user_type")}>
            <option value="">Select role...</option>
            {CREATABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <div className="mu-help-text">
            Students and lecturers are created from the Students / Lecturers pages instead, so their profile records are set up correctly.
          </div>
        </div>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Email (optional)</label>
            <input type="email" className="mu-input" value={form.email} onChange={handleChange("email")} />
          </div>
          <div className="mu-form-group">
            <label>Phone (optional)</label>
            <input className="mu-input" value={form.phone} onChange={handleChange("phone")} />
          </div>
        </div>

        <div className="mu-form-group">
          <label>Gender (optional)</label>
          <select className="mu-select" value={form.gender} onChange={handleChange("gender")}>
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="mu-form-group">
          <label>Password (optional — leave blank to auto-generate)</label>
          <input className="mu-input" value={form.password} onChange={handleChange("password")} />
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Creating...
              </>
            ) : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
    phone: user.phone || "",
    gender: user.gender || "",
    address: user.address || "",
    is_active: user.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field) => (e) => {
    const value = field === "is_active" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data } = await adminApi.updateUser(user.id, form);
      onSaved(data, "User updated.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not update user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Edit User — ${user.username}`} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Username</label>
            <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{user.username}</div>
          </div>
          <div className="mu-form-group">
            <label>Role</label>
            <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{roleLabel(user.user_type)}</div>
          </div>
        </div>

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
            <label>Email</label>
            <input type="email" className="mu-input" value={form.email} onChange={handleChange("email")} />
          </div>
          <div className="mu-form-group">
            <label>Phone</label>
            <input className="mu-input" value={form.phone} onChange={handleChange("phone")} />
          </div>
        </div>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Gender</label>
            <select className="mu-select" value={form.gender} onChange={handleChange("gender")}>
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="mu-form-group" style={{ display: "flex", alignItems: "center", paddingTop: 24 }}>
            <div className="mu-checkbox">
              <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} id="edit_active" />
              <label htmlFor="edit_active">Active</label>
            </div>
          </div>
        </div>

        <div className="mu-form-group">
          <label>Address</label>
          <textarea className="mu-textarea" rows={2} value={form.address} onChange={handleChange("address")} />
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ViewUserModal({ user, onClose }) {
  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--mu-border)", fontSize: 14 }}>
      <span style={{ color: "var(--mu-gray-500)" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value || "—"}</span>
    </div>
  );
  return (
    <Modal isOpen={true} onClose={onClose} title="User Details" size="md" showFooter={false}>
      {row("Username", user.username)}
      {row("Full Name", `${user.first_name} ${user.last_name}`)}
      {row("Role", roleLabel(user.user_type))}
      {row("Email", user.email)}
      {row("Phone", user.phone)}
      {row("Gender", user.gender)}
      {row("Address", user.address)}
      {row("Status", user.is_active ? "Active" : "Inactive")}
      {row("Must Change Password", user.must_change_password ? "Yes" : "No")}
      {row("2FA Enrolled", user.is_2fa_enrolled ? "Yes" : "No")}
      {row("Joined", user.date_joined ? new Date(user.date_joined).toLocaleDateString() : "—")}
      <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
        <button className="mu-btn mu-btn-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function SetPasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await adminApi.setUserPassword(user.id, password, forceChange);
      onSaved("Password updated.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Set Password — ${user.username}`} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-form-group">
          <label>New Password</label>
          <input type="text" className="mu-input" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="mu-form-group">
          <label>Confirm Password</label>
          <input type="text" className="mu-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>

        <div className="mu-checkbox" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={forceChange} onChange={(e) => setForceChange(e.target.checked)} id="force_change" />
          <label htmlFor="force_change">Require password change on next login</label>
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : "Set Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function UserManagement() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedFilters = useDebouncedValue(`${roleFilter}|${statusFilter}`, 200);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter) params.user_type = roleFilter;
      if (statusFilter) params.is_active = statusFilter;

      const { data } = await adminApi.users(params);
      if (Array.isArray(data)) { setItems(data); setCount(data.length); }
      else { setItems(unwrapList(data)); setCount(data.count ?? unwrapList(data).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load users.");
      setItems([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setPage(1); }, [debouncedSearch, debouncedFilters]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleDelete = async () => {
    try {
      await adminApi.deleteUser(deleteTarget.id);
      showToast("User deleted.");
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete — this account may have linked records (e.g. a student or lecturer profile).");
      setDeleteTarget(null);
    }
  };

  const resetFilters = () => { setSearch(""); setRoleFilter(""); setStatusFilter(""); };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-person-gear" />
            User Management
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Users
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
          <button className="mu-btn mu-btn-primary" onClick={() => setCreateModalOpen(true)}>
            <i className="bi bi-person-plus" /> Create User
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
                      {/* Search - First */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 220px" }}>
                        <div style={{ position: "relative", width: "100%" }}>
                          <i className="bi bi-search" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--mu-gray-400)" }} />
                          <input
                            type="text"
                            className="mu-input"
                            placeholder="Search by name, username, email..."
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

                      {/* Role Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Role:</span>
                        <select
                          className="mu-select"
                          style={{ 
                            width: 140, 
                            padding: "3px 8px", 
                            fontSize: "var(--mu-font-size-xs)",
                            minHeight: "auto",
                            height: 28
                          }}
                          value={roleFilter}
                          onChange={(e) => setRoleFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
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
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
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
                        {count} user(s)
                      </span>
                    </div>
                  </th>
                </tr>
                {/* Column Headers */}
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: "center" }}><LoadingSpinner text="Loading users..." /></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                    <i className="bi bi-people" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                    <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No users found</h3>
                    <p style={{ margin: "8px 0 0" }}>Try adjusting your search or filters.</p>
                  </td></tr>
                ) : (
                  items.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.username}</strong></td>
                      <td>{u.first_name} {u.last_name}</td>
                      <td>
                        <span className="mu-badge mu-badge-primary">{roleLabel(u.user_type)}</span>
                      </td>
                      <td>{u.email || "—"}</td>
                      <td>{u.phone || "—"}</td>
                      <td>
                        <span className={`mu-badge ${u.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setViewTarget(u)} title="View">
                            <i className="bi bi-eye" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setEditTarget(u)} title="Edit">
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setPasswordTarget(u)} title="Set Password">
                            <i className="bi bi-key" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(u)} title="Delete">
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
      {createModalOpen && (
        <CreateUserModal
          onClose={() => setCreateModalOpen(false)}
          onSaved={(msg) => { showToast(msg); fetchItems(); }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(_d, msg) => { setEditTarget(null); showToast(msg); fetchItems(); }}
        />
      )}

      {viewTarget && (
        <ViewUserModal user={viewTarget} onClose={() => setViewTarget(null)} />
      )}

      {passwordTarget && (
        <SetPasswordModal
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={(msg) => { setPasswordTarget(null); showToast(msg); }}
        />
      )}

      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete User"
          size="sm"
          confirmText="Delete"
          onConfirm={handleDelete}
          danger={true}
        >
          <p style={{ marginTop: 0 }}>
            Delete {deleteTarget.first_name} {deleteTarget.last_name} ({deleteTarget.username})?
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