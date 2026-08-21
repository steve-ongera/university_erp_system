// src/pages/admin/AcademicCalendar.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function summarizeErrors(err) {
  const data = err?.response?.data;
  if (!data || typeof data !== "object") return null;
  const parts = Object.entries(data).map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(" ") : msgs}`);
  return parts.join(" ");
}

// ----------------------------------------------------------------------
// Confirm Modal
// ----------------------------------------------------------------------
function ConfirmModal({ title, message, confirmLabel = "Delete", onConfirm, onClose, danger = true }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="sm">
      <p style={{ marginTop: 0 }}>{message}</p>
      <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
        <button className="mu-btn mu-btn-secondary" onClick={onClose} type="button">Cancel</button>
        <button
          className={`mu-btn ${danger ? "mu-btn-danger" : "mu-btn-primary"}`}
          disabled={busy}
          type="button"
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
        >
          {busy ? (
            <>
              <i className="bi bi-arrow-repeat mu-animate-spin" />
              Working...
            </>
          ) : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Field Component
// ----------------------------------------------------------------------
function Field({ label, children, hint }) {
  return (
    <div className="mu-form-group" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      {children}
      {hint && <div className="mu-help-text">{hint}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------
// Tab Bar Component
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
// Academic Year Form Modal
// ----------------------------------------------------------------------
function AcademicYearFormModal({ mode, year, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    year: year?.year || "",
    start_date: year?.start_date || "",
    end_date: year?.end_date || "",
    is_current: year?.is_current || false,
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
    if (!form.year || !form.start_date || !form.end_date) {
      setError("Year label, start date and end date are all required.");
      return;
    }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      setError("End date must be after the start date.");
      return;
    }
    setSaving(true);
    try {
      const data = isEdit
        ? (await adminApi.updateAcademicYear(year.id, form)).data
        : (await adminApi.createAcademicYear(form)).data;
      onSaved(data, isEdit ? "Academic year updated." : "Academic year created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save academic year.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEdit ? "Edit Academic Year" : "Add Academic Year"} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <Field label="Year Label" hint='e.g. "2026/2027"'>
          <input className="mu-input" required value={form.year} onChange={handleChange("year")} placeholder="2026/2027" />
        </Field>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <Field label="Start Date">
            <input type="date" className="mu-input" required value={form.start_date} onChange={handleChange("start_date")} />
          </Field>
          <Field label="End Date">
            <input type="date" className="mu-input" required value={form.end_date} onChange={handleChange("end_date")} />
          </Field>
        </div>

        <div className="mu-checkbox" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={form.is_current} onChange={handleChange("is_current")} id="is_current" />
          <label htmlFor="is_current">Make this the current academic year</label>
        </div>
        <div className="mu-help-text">Marking this current automatically un-marks any other academic year.</div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Create Academic Year"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Semester Form Modal
// ----------------------------------------------------------------------
function SemesterFormModal({ mode, semester, academicYear, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    semester_number: semester?.semester_number || 1,
    start_date: semester?.start_date || "",
    end_date: semester?.end_date || "",
    registration_start_date: semester?.registration_start_date || "",
    registration_end_date: semester?.registration_end_date || "",
    is_current: semester?.is_current || false,
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
    const required = ["start_date", "end_date", "registration_start_date", "registration_end_date"];
    if (required.some((f) => !form[f])) {
      setError("All dates are required.");
      return;
    }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      setError("Semester end date must be after the start date.");
      return;
    }
    if (new Date(form.registration_end_date) < new Date(form.registration_start_date)) {
      setError("Registration end date can't be before registration start date.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, semester_number: Number(form.semester_number), academic_year: academicYear.id };
      const data = isEdit
        ? (await adminApi.updateSemester(semester.id, payload)).data
        : (await adminApi.createSemester(payload)).data;
      onSaved(data, isEdit ? "Semester updated." : "Semester created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save semester.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEdit ? `Edit Semester — ${academicYear.year}` : `Add Semester — ${academicYear.year}`} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <Field label="Semester Number">
          <select className="mu-input" value={form.semester_number} onChange={handleChange("semester_number")}>
            <option value={1}>Semester 1</option>
            <option value={2}>Semester 2</option>
            <option value={3}>Semester 3 (trimester programmes)</option>
          </select>
        </Field>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <Field label="Semester Start">
            <input type="date" className="mu-input" required value={form.start_date} onChange={handleChange("start_date")} />
          </Field>
          <Field label="Semester End">
            <input type="date" className="mu-input" required value={form.end_date} onChange={handleChange("end_date")} />
          </Field>
        </div>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <Field label="Registration Opens">
            <input type="date" className="mu-input" required value={form.registration_start_date} onChange={handleChange("registration_start_date")} />
          </Field>
          <Field label="Registration Closes">
            <input type="date" className="mu-input" required value={form.registration_end_date} onChange={handleChange("registration_end_date")} />
          </Field>
        </div>

        <div className="mu-checkbox" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={form.is_current} onChange={handleChange("is_current")} id="sem_is_current" />
          <label htmlFor="sem_is_current">Make this the current (active) semester</label>
        </div>
        <div className="mu-help-text">Only one semester system-wide can be current — this is what drives unit registration, dashboards and fee invoicing everywhere else in the portal.</div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Create Semester"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Intake Form Modal
// ----------------------------------------------------------------------
function IntakeFormModal({ mode, intake, academicYears, semesters, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    name: intake?.name || "",
    academic_year: intake?.academic_year || "",
    starting_semester: intake?.starting_semester || "",
    application_deadline: intake?.application_deadline || "",
    is_active: intake?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const semesterOptions = useMemo(
    () => semesters.filter((s) => String(s.academic_year) === String(form.academic_year)),
    [semesters, form.academic_year]
  );

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === "academic_year" ? { starting_semester: "" } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.academic_year || !form.starting_semester) {
      setError("Name, academic year and starting semester are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        academic_year: form.academic_year,
        starting_semester: form.starting_semester,
        application_deadline: form.application_deadline || null,
        is_active: form.is_active,
      };
      const data = isEdit
        ? (await adminApi.updateIntake(intake.id, payload)).data
        : (await adminApi.createIntake(payload)).data;
      onSaved(data, isEdit ? "Intake updated." : "Intake created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save intake.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEdit ? "Edit Intake" : "Add Intake"} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <Field label="Intake Name" hint='e.g. "September 2026"'>
          <input className="mu-input" required value={form.name} onChange={handleChange("name")} placeholder="September 2026" />
        </Field>

        <Field label="Academic Year">
          <select className="mu-input" required value={form.academic_year} onChange={handleChange("academic_year")}>
            <option value="">Select academic year...</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
          </select>
        </Field>

        <Field label="Starting Semester" hint="Determines the Year-1/Sem-1 semester fresh students begin in.">
          <select className="mu-input" required value={form.starting_semester} onChange={handleChange("starting_semester")} disabled={!form.academic_year}>
            <option value="">{form.academic_year ? "Select semester..." : "Pick an academic year first"}</option>
            {semesterOptions.map((s) => <option key={s.id} value={s.id}>Semester {s.semester_number}</option>)}
          </select>
        </Field>

        <Field label="Application Deadline">
          <input type="date" className="mu-input" value={form.application_deadline || ""} onChange={handleChange("application_deadline")} />
        </Field>

        <div className="mu-checkbox" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={form.is_active} onChange={handleChange("is_active")} id="intake_is_active" />
          <label htmlFor="intake_is_active">Intake is active (open / valid for admissions)</label>
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Create Intake"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Academic Year Detail Modal
// ----------------------------------------------------------------------
function AcademicYearDetailModal({ year, semesters, intakes, onClose, onChanged, showToast }) {
  const [semesterForm, setSemesterForm] = useState(null);
  const [deleteSemester, setDeleteSemester] = useState(null);

  const yearSemesters = semesters
    .filter((s) => s.academic_year === year.id)
    .sort((a, b) => a.semester_number - b.semester_number);
  const yearIntakes = intakes.filter((i) => i.academic_year === year.id);

  const setSemesterCurrent = async (semester) => {
    try {
      await adminApi.updateSemester(semester.id, { is_current: true });
      showToast(`Semester ${semester.semester_number} of ${year.year} is now current.`);
      onChanged();
    } catch {
      showToast("Could not set semester as current.");
    }
  };

  const handleDeleteSemester = async () => {
    try {
      await adminApi.deleteSemester(deleteSemester.id);
      showToast("Semester deleted.");
      setDeleteSemester(null);
      onChanged();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete semester (it may have dependent records).");
      setDeleteSemester(null);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Academic Year — ${year.year}`} size="lg">
      {/* Year Info */}
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <div className="mu-text-muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Start</div>
            <div>{fmtDate(year.start_date)}</div>
          </div>
          <div>
            <div className="mu-text-muted" style={{ fontSize: 11, textTransform: "uppercase" }}>End</div>
            <div>{fmtDate(year.end_date)}</div>
          </div>
          <div>
            <div className="mu-text-muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Status</div>
            <span className={`mu-badge ${year.is_current ? "mu-badge-success" : "mu-badge-gray"}`}>
              {year.is_current ? "Current" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Semesters */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Semesters</h4>
        <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setSemesterForm({ mode: "add" })}>
          <i className="bi bi-plus-circle" /> Add Semester
        </button>
      </div>

      <div className="mu-table-wrapper">
        <table className="mu-table">
          <thead>
            <tr>
              <th>Sem</th><th>Dates</th><th>Registration Window</th><th>Status</th><th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {yearSemesters.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--mu-gray-400)" }}>No semesters added yet.</td></tr>
            )}
            {yearSemesters.map((sem) => (
              <tr key={sem.id}>
                <td>Semester {sem.semester_number}</td>
                <td>{fmtDate(sem.start_date)} → {fmtDate(sem.end_date)}</td>
                <td>{fmtDate(sem.registration_start_date)} → {fmtDate(sem.registration_end_date)}</td>
                <td>
                  {sem.is_current
                    ? <span className="mu-badge mu-badge-success">Current</span>
                    : <span className="mu-badge mu-badge-gray">Inactive</span>}
                </td>
                <td style={{ textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                    {!sem.is_current && (
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setSemesterCurrent(sem)} title="Set current">
                        <i className="bi bi-check-circle" />
                      </button>
                    )}
                    <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setSemesterForm({ mode: "edit", semester: sem })} title="Edit">
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteSemester(sem)} title="Delete">
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Intakes */}
      <div style={{ marginTop: 24 }}>
        <h4 style={{ margin: "0 0 10px" }}>Intakes in this Academic Year</h4>
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead>
              <tr><th>Name</th><th>Starting Semester</th><th>Deadline</th><th>Status</th></tr>
            </thead>
            <tbody>
              {yearIntakes.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 16, color: "var(--mu-gray-400)" }}>No intakes for this year yet.</td></tr>
              )}
              {yearIntakes.map((i) => {
                const sem = semesters.find((s) => s.id === i.starting_semester);
                return (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td>{sem ? `Semester ${sem.semester_number}` : "—"}</td>
                    <td>{fmtDate(i.application_deadline)}</td>
                    <td>
                      <span className={`mu-badge ${i.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                        {i.is_active ? "Active" : "Closed"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {semesterForm && (
        <SemesterFormModal
          mode={semesterForm.mode}
          semester={semesterForm.semester}
          academicYear={year}
          onClose={() => setSemesterForm(null)}
          onSaved={(_data, msg) => { setSemesterForm(null); showToast(msg); onChanged(); }}
        />
      )}

      {deleteSemester && (
        <ConfirmModal
          title="Delete Semester"
          message={`Delete Semester ${deleteSemester.semester_number} of ${year.year}? This cannot be undone.`}
          onConfirm={handleDeleteSemester}
          onClose={() => setDeleteSemester(null)}
        />
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Empty State
// ----------------------------------------------------------------------
function EmptyState({ label, hint }) {
  return (
    <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
      <i className="bi bi-calendar-x" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
      <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>{label}</h3>
      <p style={{ margin: "8px 0 0" }}>{hint}</p>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function AcademicCalendar() {
  const [topTab, setTopTab] = useState("years");
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const [yearFormModal, setYearFormModal] = useState(null);
  const [intakeFormModal, setIntakeFormModal] = useState(null);
  const [detailYear, setDetailYear] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [yRes, sRes, iRes] = await Promise.all([
        adminApi.academicYears(),
        adminApi.semesters(),
        adminApi.intakes(),
      ]);
      const unwrap = (d) => (Array.isArray(d) ? d : d.results || []);
      setAcademicYears(unwrap(yRes.data).sort((a, b) => b.year.localeCompare(a.year)));
      setSemesters(unwrap(sRes.data));
      setIntakes(unwrap(iRes.data));
    } catch (err) {
      console.error(err);
      setError("Failed to load the academic calendar. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (detailYear) {
      const fresh = academicYears.find((y) => y.id === detailYear.id);
      if (fresh) setDetailYear(fresh);
    }
  }, [academicYears]);

  const setYearCurrent = async (year) => {
    try {
      await adminApi.updateAcademicYear(year.id, { is_current: true });
      showToast(`${year.year} is now the current academic year.`);
      fetchAll();
    } catch {
      showToast("Could not set academic year as current.");
    }
  };

  const handleDelete = async () => {
    try {
      if (deleteTarget.type === "year") {
        await adminApi.deleteAcademicYear(deleteTarget.item.id);
        showToast(`${deleteTarget.item.year} deleted.`);
      } else {
        await adminApi.deleteIntake(deleteTarget.item.id);
        showToast(`Intake "${deleteTarget.item.name}" deleted.`);
      }
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete — it may have dependent records (semesters, intakes, students).");
      setDeleteTarget(null);
    }
  };

  const semesterCountFor = (yearId) => semesters.filter((s) => s.academic_year === yearId).length;

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-calendar3" />
            Academic Calendar
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Academic Calendar
          </div>
        </div>
        <div className="mu-page-header-actions">
          {topTab === "years" ? (
            <button className="mu-btn mu-btn-primary" onClick={() => setYearFormModal({ mode: "add" })}>
              <i className="bi bi-plus-circle" /> Add Academic Year
            </button>
          ) : (
            <button className="mu-btn mu-btn-primary" onClick={() => setIntakeFormModal({ mode: "add" })}>
              <i className="bi bi-plus-circle" /> Add Intake
            </button>
          )}
        </div>
      </div>

      {toastMsg && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {toastMsg}
        </div>
      )}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      <TabBar
        tabs={[
          { key: "years", label: `Academic Years (${academicYears.length})` },
          { key: "intakes", label: `Intakes (${intakes.length})` },
        ]}
        active={topTab}
        onChange={setTopTab}
      />

      {loading ? (
        <div style={{ padding: 48 }}><LoadingSpinner text="Loading academic calendar..." /></div>
      ) : topTab === "years" ? (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 0 }}>
            {academicYears.length === 0 ? (
              <EmptyState label="No academic years yet" hint="Add one to start setting up semesters and intakes." />
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Academic Year</th>
                      <th>Start</th>
                      <th>End</th>
                      <th style={{ textAlign: "center" }}>Semesters</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicYears.map((year) => (
                      <tr key={year.id}>
                        <td><strong>{year.year}</strong></td>
                        <td>{fmtDate(year.start_date)}</td>
                        <td>{fmtDate(year.end_date)}</td>
                        <td style={{ textAlign: "center" }}>{semesterCountFor(year.id)}</td>
                        <td>
                          {year.is_current
                            ? <span className="mu-badge mu-badge-success">Current</span>
                            : <span className="mu-badge mu-badge-gray">Inactive</span>}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailYear(year)} title="View / manage semesters">
                              <i className="bi bi-eye" />
                            </button>
                            {!year.is_current && (
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setYearCurrent(year)} title="Set current">
                                <i className="bi bi-check-circle" />
                              </button>
                            )}
                            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setYearFormModal({ mode: "edit", year })} title="Edit">
                              <i className="bi bi-pencil" />
                            </button>
                            <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget({ type: "year", item: year })} title="Delete">
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
        </div>
      ) : (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 0 }}>
            {intakes.length === 0 ? (
              <EmptyState label="No intakes yet" hint="Add an intake once you've set up an academic year and semester." />
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Intake</th>
                      <th>Academic Year</th>
                      <th>Starting Semester</th>
                      <th>Application Deadline</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intakes.map((intake) => {
                      const year = academicYears.find((y) => y.id === intake.academic_year);
                      const sem = semesters.find((s) => s.id === intake.starting_semester);
                      return (
                        <tr key={intake.id}>
                          <td><strong>{intake.name}</strong></td>
                          <td>{year?.year || "—"}</td>
                          <td>{sem ? `Semester ${sem.semester_number}` : "—"}</td>
                          <td>{fmtDate(intake.application_deadline)}</td>
                          <td>
                            <span className={`mu-badge ${intake.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>
                              {intake.is_active ? "Active" : "Closed"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setIntakeFormModal({ mode: "edit", intake })} title="Edit">
                                <i className="bi bi-pencil" />
                              </button>
                              <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget({ type: "intake", item: intake })} title="Delete">
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {yearFormModal && (
        <AcademicYearFormModal
          mode={yearFormModal.mode}
          year={yearFormModal.year}
          onClose={() => setYearFormModal(null)}
          onSaved={(_data, msg) => { setYearFormModal(null); showToast(msg); fetchAll(); }}
        />
      )}

      {intakeFormModal && (
        <IntakeFormModal
          mode={intakeFormModal.mode}
          intake={intakeFormModal.intake}
          academicYears={academicYears}
          semesters={semesters}
          onClose={() => setIntakeFormModal(null)}
          onSaved={(_data, msg) => { setIntakeFormModal(null); showToast(msg); fetchAll(); }}
        />
      )}

      {detailYear && (
        <AcademicYearDetailModal
          year={detailYear}
          semesters={semesters}
          intakes={intakes}
          onClose={() => setDetailYear(null)}
          onChanged={fetchAll}
          showToast={showToast}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={deleteTarget.type === "year" ? "Delete Academic Year" : "Delete Intake"}
          message={
            deleteTarget.type === "year"
              ? `Delete academic year ${deleteTarget.item.year}? This also fails if semesters, curriculum versions or students still reference it.`
              : `Delete intake "${deleteTarget.item.name}"? This fails if students were admitted under it.`
          }
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}