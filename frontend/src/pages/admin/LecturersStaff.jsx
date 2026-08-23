// src/pages/admin/LecturersStaff.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, TabBar, EmptyState,
  useDebouncedValue, summarizeErrors, unwrapList,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;
const GENDERS = ["male", "female", "other"];

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
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
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save lecturer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Lecturer" : "Add Lecturer"} onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        {!isEdit && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="First Name"><input className="mu-input" required value={form.first_name} onChange={handleChange("first_name")} /></Field>
              <Field label="Last Name"><input className="mu-input" required value={form.last_name} onChange={handleChange("last_name")} /></Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Gender">
                <select className="mu-input" value={form.gender} onChange={handleChange("gender")}>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
            </div>
            <p style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
              A login account is created automatically (username = employee number, temporary password = same, must be changed on first login).
            </p>
          </>
        )}

        <div style={{ marginTop: 12 }}>
          <Field label="Department">
            <select className="mu-input" required value={form.department} onChange={handleChange("department")}>
              <option value="">Select department...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 12 }}>
          <Field label="Academic Rank">
            <select className="mu-input" value={form.academic_rank} onChange={handleChange("academic_rank")}>
              {["Assistant Lecturer", "Lecturer", "Senior Lecturer", "Associate Professor", "Professor"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>

        {isEdit && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
            <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} />
            Active
          </label>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Lecturer"}
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
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save staff record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Staff" : "Add Staff"} onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        {!isEdit && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="First Name"><input className="mu-input" required value={form.first_name} onChange={handleChange("first_name")} /></Field>
              <Field label="Last Name"><input className="mu-input" required value={form.last_name} onChange={handleChange("last_name")} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Field label="Gender">
                <select className="mu-input" value={form.gender} onChange={handleChange("gender")}>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Role">
                <select className="mu-input" value={form.user_type} onChange={handleChange("user_type")}>
                  <option value="staff">General Staff</option>
                  <option value="registrar">Registrar</option>
                  <option value="finance">Finance Officer</option>
                  <option value="exam_office">Examinations Office</option>
                  <option value="hostel_warden">Hostel Warden</option>
                </select>
              </Field>
            </div>
          </>
        )}

        <div style={{ marginTop: 12 }}>
          <Field label="Department (optional)">
            <select className="mu-input" value={form.department} onChange={handleChange("department")}>
              <option value="">— None —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Designation"><input className="mu-input" value={form.designation} onChange={handleChange("designation")} placeholder="e.g. Senior Finance Officer" /></Field>
        </div>

        {isEdit && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
            <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} />
            Active
          </label>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Staff"}
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
    <Modal title={fullName(lecturer.user_detail)} onClose={onClose} width={600}>
      <div style={{ display: "flex", gap: 20, marginBottom: 16, fontSize: 13 }}>
        <Info label="Employee No" value={lecturer.employee_number} />
        <Info label="Department" value={lecturer.department_detail?.name} />
        <Info label="Rank" value={lecturer.academic_rank} />
      </div>
      <h4 style={{ margin: "0 0 10px" }}>Unit Allocations</h4>
      {loading ? <LoadingSpinner text="Loading..." /> : (
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead><tr><th>Course</th><th>Semester</th><th>Y/S</th><th>Status</th></tr></thead>
            <tbody>
              {allocations.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 16, color: "#999" }}>No allocations.</td></tr>}
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
function Info({ label, value }) {
  return <div><div style={{ fontSize: 11, textTransform: "uppercase", color: "#999" }}>{label}</div><div>{value ?? "—"}</div></div>;
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
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-person-badge" /> Lecturers &amp; Staff</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Lecturers &amp; Staff</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add {tab === "lecturers" ? "Lecturer" : "Staff"}
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <TabBar
        tabs={[{ key: "lecturers", label: "Lecturers" }, { key: "staff", label: "Staff" }]}
        active={tab}
        onChange={setTab}
      />

      {/* Filters */}
      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Employee no. or name..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 200 }}>
            <Field label="Department">
              <select className="mu-input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
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
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setDepartmentFilter(""); setStatusFilter(""); }}>Reset</button>
        </div>
      </div>

      {/* Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>{tab === "lecturers" ? "Lecturers" : "Staff"}</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : items.length === 0 ? (
            <EmptyState icon="bi-person-x" label={`No ${tab} found`} hint="Try adjusting filters or add a new record." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Employee No</th><th>Name</th><th>Department</th>
                    <th>{tab === "lecturers" ? "Rank" : "Designation"}</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td><strong>{it.employee_number}</strong></td>
                      <td>{fullName(it.user_detail)}</td>
                      <td>{it.department_detail?.code || departments.find((d) => d.id === it.department)?.code || "—"}</td>
                      <td>{tab === "lecturers" ? it.academic_rank : it.designation}</td>
                      <td><span className={`mu-badge ${it.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>{it.is_active ? "Active" : "Inactive"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} records</span>
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