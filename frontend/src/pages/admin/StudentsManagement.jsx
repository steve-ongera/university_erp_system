// src/pages/admin/StudentsManagement.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { adminApi, studentsApi, gradesApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

// ----------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------
const STATUS_OPTIONS = ["active", "deferred", "graduated", "suspended", "discontinued", "expelled"];
const SPONSOR_OPTIONS = ["government", "self", "employer", "scholarship", "bursary"];
const GENDER_OPTIONS = ["male", "female", "other"];
const PAGE_SIZE = 25;

const STATUS_BADGE = {
  active: "success",
  deferred: "warning",
  graduated: "info",
  suspended: "danger",
  discontinued: "danger",
  expelled: "danger",
};

// ----------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------
function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

function csvEscape(val) {
  const str = String(val ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(filename, rows, headers) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
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

function printReport({ title, subtitle, columns, rows }) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  const tableRows = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td style="padding:6px 10px;border:1px solid #ddd;">${r[c.key] ?? ""}</td>`).join("")}</tr>`
    )
    .join("");
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 18px; margin-bottom: 2px; }
          h2 { font-size: 13px; font-weight: 400; color: #555; margin-top: 0; }
          table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 12px; }
          th { text-align: left; padding: 6px 10px; border: 1px solid #ddd; background: #f2f4f8; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <h2>${subtitle}</h2>
        <table>
          <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
          <tbody>${tableRows || `<tr><td colspan="${columns.length}" style="padding:10px;">No results.</td></tr>`}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

// ----------------------------------------------------------------------
// Generic Modal shell
// ----------------------------------------------------------------------
function Modal({ title, onClose, children, width = 560 }) {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 16px", overflowY: "auto", zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 10, width: "100%", maxWidth: width,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)", maxHeight: "calc(100vh - 80px)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid #eee",
        }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} className="mu-btn mu-btn-sm mu-btn-outline-primary" type="button">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div style={{ padding: 20, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel = "Delete", onConfirm, onClose, danger = true }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} width={420}>
      <p style={{ marginTop: 0 }}>{message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button className="mu-btn mu-btn-outline-primary" onClick={onClose} type="button">Cancel</button>
        <button
          className={`mu-btn ${danger ? "mu-btn-danger" : "mu-btn-primary"}`}
          disabled={busy}
          type="button"
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Add / Edit Student modal (creates the User account too, on add)
// ----------------------------------------------------------------------
function StudentFormModal({ mode, student, programmes, intakes, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          first_name: student.user_detail?.first_name || "",
          last_name: student.user_detail?.last_name || "",
          gender: student.user_detail?.gender || "male",
          current_year: student.current_year || 1,
          current_semester: student.current_semester || 1,
          status: student.status || "active",
          sponsor_type: student.sponsor_type || "self",
          guardian_name: student.guardian_name || "",
          guardian_phone: student.guardian_phone || "",
          emergency_contact: student.emergency_contact || "",
        }
      : {
          first_name: "", last_name: "", gender: "male",
          programme: "", intake: "", curriculum_version: "",
          sponsor_type: "self",
        }
  );
  const [curriculumVersions, setCurriculumVersions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // When adding, fetch curriculum versions for the chosen programme.
  useEffect(() => {
    if (isEdit || !form.programme) return;
    adminApi
      .curriculumVersions()
      .then(({ data }) => {
        const list = data.results || data;
        setCurriculumVersions(list.filter((v) => v.programme === Number(form.programme) || v.programme === form.programme));
      })
      .catch(() => setCurriculumVersions([]));
  }, [form.programme, isEdit]);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (isEdit) {
        const { data } = await studentsApi.update(student.id, {
          current_year: Number(form.current_year),
          current_semester: Number(form.current_semester),
          status: form.status,
          sponsor_type: form.sponsor_type,
          guardian_name: form.guardian_name,
          guardian_phone: form.guardian_phone,
          emergency_contact: form.emergency_contact,
        });
        onSaved(data, "Student updated.");
      } else {
        if (!form.programme || !form.intake || !form.curriculum_version) {
          setError("Programme, intake and curriculum version are all required.");
          setSaving(false);
          return;
        }
        const { data } = await studentsApi.admit({
          first_name: form.first_name,
          last_name: form.last_name,
          gender: form.gender,
          programme: form.programme,
          intake: form.intake,
          curriculum_version: form.curriculum_version,
          sponsor_type: form.sponsor_type,
        });
        onSaved(data, `Student admitted. Registration No: ${data.registration_number}`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Check the form and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Student" : "Admit New Student"} onClose={onClose} width={620}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        {!isEdit && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="First Name">
                <input className="mu-input" required value={form.first_name} onChange={handleChange("first_name")} />
              </Field>
              <Field label="Last Name">
                <input className="mu-input" required value={form.last_name} onChange={handleChange("last_name")} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Field label="Gender">
                <select className="mu-input" value={form.gender} onChange={handleChange("gender")}>
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Sponsor Type">
                <select className="mu-input" value={form.sponsor_type} onChange={handleChange("sponsor_type")}>
                  {SPONSOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Programme">
                <select className="mu-input" required value={form.programme} onChange={handleChange("programme")}>
                  <option value="">Select programme...</option>
                  {programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Field label="Intake">
                <select className="mu-input" required value={form.intake} onChange={handleChange("intake")}>
                  <option value="">Select intake...</option>
                  {intakes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
              <Field label="Curriculum Version">
                <select className="mu-input" required value={form.curriculum_version} onChange={handleChange("curriculum_version")} disabled={!form.programme}>
                  <option value="">{form.programme ? "Select..." : "Pick a programme first"}</option>
                  {curriculumVersions.map((v) => <option key={v.id} value={v.id}>{v.effective_academic_year_detail?.year || `Version #${v.id}`}</option>)}
                </select>
              </Field>
            </div>
            <p style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
              A login account is created automatically (username = registration number,
              temporary password = registration number without slashes; the student
              must change it on first login).
            </p>
          </>
        )}

        {isEdit && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Current Year">
                <input type="number" min={1} max={8} className="mu-input" value={form.current_year} onChange={handleChange("current_year")} />
              </Field>
              <Field label="Current Semester">
                <input type="number" min={1} max={3} className="mu-input" value={form.current_semester} onChange={handleChange("current_semester")} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Field label="Status">
                <select className="mu-input" value={form.status} onChange={handleChange("status")}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Sponsor Type">
                <select className="mu-input" value={form.sponsor_type} onChange={handleChange("sponsor_type")}>
                  {SPONSOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Guardian Name">
                <input className="mu-input" value={form.guardian_name} onChange={handleChange("guardian_name")} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Field label="Guardian Phone">
                <input className="mu-input" value={form.guardian_phone} onChange={handleChange("guardian_phone")} />
              </Field>
              <Field label="Emergency Contact">
                <input className="mu-input" value={form.emergency_contact} onChange={handleChange("emergency_contact")} />
              </Field>
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Admit Student"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", fontSize: 13 }}>
      <span style={{ display: "block", marginBottom: 4, color: "#444", fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

// ----------------------------------------------------------------------
// Grade edit modal — used from inside a year's results table
// ----------------------------------------------------------------------
function GradeEditModal({ entry, student, onClose, onSaved }) {
  const [catMarks, setCatMarks] = useState(entry?.suggestedCat ?? "");
  const [examMarks, setExamMarks] = useState(entry?.suggestedExam ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Find the live Enrollment for this student/course/semester so we
      // can post to /grades/enter/. Requires EnrollmentViewSet to accept
      // ?student=&course=&semester= (see filterset_fields note).
      const { data: enrollments } = await studentsApi.enrollments({
        student: student.id,
        course: entry.course_detail.id,
      });
      const list = enrollments.results || enrollments;
      const match = list.find((en) => en.semester === entry.semester_id) || list[0];
      if (!match) {
        setError("No active enrollment record found for this unit — it may only exist as historical transcript data.");
        setSaving(false);
        return;
      }
      const { data } = await gradesApi.enter({
        enrollment: match.id,
        cat_marks: Number(catMarks),
        final_exam_marks: Number(examMarks),
      });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save marks.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Update Marks — ${entry.course_detail?.code}`} onClose={onClose} width={420}>
      <form onSubmit={handleSave}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        <p style={{ marginTop: 0, fontSize: 13, color: "#555" }}>
          {entry.course_detail?.name} &middot; Y{entry.programme_year} S{entry.semester_number}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="CAT Marks (/30)">
            <input type="number" step="0.01" min={0} max={100} required className="mu-input"
                   value={catMarks} onChange={(e) => setCatMarks(e.target.value)} />
          </Field>
          <Field label="Final Exam Marks (/70)">
            <input type="number" step="0.01" min={0} max={100} required className="mu-input"
                   value={examMarks} onChange={(e) => setExamMarks(e.target.value)} />
          </Field>
        </div>
        <p style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
          Total, letter grade and grade points are computed server-side (40/60 weighting)
          against the department's grading scheme.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Marks"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Student Detail modal — overview + per-year results tabs + fees
// ----------------------------------------------------------------------
function StudentDetailModal({ student, semesters, onClose, onEditRequest }) {
  const [transcript, setTranscript] = useState([]);
  const [feeSummary, setFeeSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingEntry, setEditingEntry] = useState(null);
  const [semesterFilter, setSemesterFilter] = useState("all");

  const duration = student.programme_detail?.duration_years || 4;
  const yearTabs = useMemo(() => Array.from({ length: duration }, (_, i) => i + 1), [duration]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, fRes] = await Promise.all([
        studentsApi.transcript(student.id),
        studentsApi.feeSummary(student.id),
      ]);
      setTranscript(tRes.data);
      setFeeSummary(fRes.data);
    } catch {
      setTranscript([]);
      setFeeSummary(null);
    } finally {
      setLoading(false);
    }
  }, [student.id]);

  useEffect(() => { load(); }, [load]);

  const entriesForYear = (year) =>
    transcript.filter((t) => t.programme_year === year &&
      (semesterFilter === "all" || String(t.semester_number) === String(semesterFilter)));

  const handleDownload = (year) => {
    const rows = entriesForYear(year);
    downloadCsv(
      `${student.registration_number}_Y${year}_results.csv`,
      rows.map((r) => ({
        course_code: r.course_detail?.code,
        course_name: r.course_detail?.name,
        semester: r.semester_number,
        credit_hours: r.credit_hours,
        letter_grade: r.letter_grade,
        grade_points: r.grade_points,
        quality_points: r.quality_points,
        supplementary: r.is_supplementary ? "Yes" : "No",
      })),
      ["course_code", "course_name", "semester", "credit_hours", "letter_grade", "grade_points", "quality_points", "supplementary"]
    );
  };

  const handlePrint = (year) => {
    const rows = entriesForYear(year);
    printReport({
      title: `Academic Results — Year ${year}`,
      subtitle: `${fullName(student.user_detail)} · ${student.registration_number} · ${student.programme_detail?.name || ""}`,
      columns: [
        { key: "code", label: "Code" },
        { key: "name", label: "Course" },
        { key: "sem", label: "Sem" },
        { key: "credits", label: "Credits" },
        { key: "grade", label: "Grade" },
        { key: "points", label: "Points" },
      ],
      rows: rows.map((r) => ({
        code: r.course_detail?.code, name: r.course_detail?.name,
        sem: r.semester_number, credits: r.credit_hours,
        grade: r.letter_grade, points: r.grade_points,
      })),
    });
  };

  return (
    <Modal title="Student Details" onClose={onClose} width={860}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>{fullName(student.user_detail)}</h2>
          <div style={{ color: "#666", fontSize: 13 }}>
            {student.registration_number} &middot; {student.programme_detail?.name}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`mu-badge mu-badge-${STATUS_BADGE[student.status] || "gray"}`}>{student.status}</span>
            <span className="mu-badge mu-badge-primary">Y{student.current_year} S{student.current_semester}</span>
            {student.cumulative_gpa && <span className="mu-badge mu-badge-info">GPA {student.cumulative_gpa}</span>}
          </div>
        </div>
        <button className="mu-btn mu-btn-outline-primary" onClick={() => onEditRequest(student)}>
          <i className="bi bi-pencil" /> Edit Bio Data
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #eee", marginTop: 20, flexWrap: "wrap" }}>
        {["overview", ...yearTabs.map((y) => `year${y}`), "fees"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="mu-btn mu-btn-sm"
            style={{
              border: "none", borderBottom: activeTab === tab ? "2px solid #3b6ce0" : "2px solid transparent",
              borderRadius: 0, background: "transparent",
              color: activeTab === tab ? "#3b6ce0" : "#666", fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === "overview" ? "Overview" : tab === "fees" ? "Fees" : `Year ${tab.replace("year", "")}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><LoadingSpinner text="Loading student record..." /></div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {activeTab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
              <InfoRow label="Sponsor Type" value={student.sponsor_type} />
              <InfoRow label="Admission Date" value={student.admission_date} />
              <InfoRow label="Guardian" value={student.guardian_name || "—"} />
              <InfoRow label="Guardian Phone" value={student.guardian_phone || "—"} />
              <InfoRow label="Emergency Contact" value={student.emergency_contact || "—"} />
              <InfoRow label="Total Credit Hours" value={student.total_credit_hours_earned} />
            </div>
          )}

          {yearTabs.map(
            (year) =>
              activeTab === `year${year}` && (
                <div key={year}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <select className="mu-input" style={{ width: 160 }} value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
                      <option value="all">All Semesters</option>
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                      <option value="3">Semester 3</option>
                    </select>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => handleDownload(year)}>
                        <i className="bi bi-download" /> CSV
                      </button>
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => handlePrint(year)}>
                        <i className="bi bi-printer" /> Print
                      </button>
                    </div>
                  </div>

                  <div className="mu-table-wrapper">
                    <table className="mu-table">
                      <thead>
                        <tr>
                          <th>Code</th><th>Course</th><th>Sem</th><th>Credits</th>
                          <th>Grade</th><th>Points</th><th>Type</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {entriesForYear(year).length === 0 && (
                          <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#999" }}>No results recorded yet.</td></tr>
                        )}
                        {entriesForYear(year).map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.course_detail?.code}</td>
                            <td>{entry.course_detail?.name}</td>
                            <td>S{entry.semester_number}</td>
                            <td>{entry.credit_hours}</td>
                            <td><strong>{entry.letter_grade}</strong></td>
                            <td>{entry.grade_points}</td>
                            <td>{entry.is_supplementary ? "Supplementary" : "Normal"}</td>
                            <td>
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary"
                                      onClick={() => setEditingEntry({ ...entry, semester_id: null })}>
                                <i className="bi bi-pencil" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
          )}

          {activeTab === "fees" && (
            <div>
              {feeSummary ? (
                <>
                  <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
                    <InfoRow label="Total Outstanding" value={`Ksh ${feeSummary.total_outstanding}`} />
                    <InfoRow label="Wallet Credit" value={`Ksh ${feeSummary.wallet_credit}`} />
                  </div>
                  <div className="mu-table-wrapper">
                    <table className="mu-table">
                      <thead><tr><th>Type</th><th>Semester</th><th>Amount Due</th><th>Balance</th></tr></thead>
                      <tbody>
                        {(feeSummary.open_invoices || []).length === 0 && (
                          <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "#999" }}>No open invoices.</td></tr>
                        )}
                        {(feeSummary.open_invoices || []).map((inv) => (
                          <tr key={inv.id}>
                            <td>{inv.invoice_type}</td>
                            <td>{inv.semester}</td>
                            <td>Ksh {inv.amount_due}</td>
                            <td>Ksh {inv.balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p style={{ color: "#999" }}>Fee summary unavailable.</p>
              )}
            </div>
          )}
        </div>
      )}

      {editingEntry && (
        <GradeEditModal
          entry={editingEntry}
          student={student}
          onClose={() => setEditingEntry(null)}
          onSaved={() => { setEditingEntry(null); load(); }}
        />
      )}
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "#999", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value ?? "—"}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function StudentsManagement() {
  const [students, setStudents] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" | "cards" ("tab form")

  const [programmes, setProgrammes] = useState([]);
  const [intakes, setIntakes] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [detailStudent, setDetailStudent] = useState(null);
  const [formModal, setFormModal] = useState(null); // { mode: "add" | "edit", student? }
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Static lookups (programmes/intakes/semesters) for filters + add form.
  useEffect(() => {
    Promise.all([adminApi.programmes(), adminApi.intakes(), adminApi.semesters()])
      .then(([pRes, iRes, sRes]) => {
        setProgrammes(pRes.data.results || pRes.data);
        setIntakes(iRes.data.results || iRes.data);
        setSemesters(sRes.data.results || sRes.data);
      })
      .catch(() => {});
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (programmeFilter) params.programme = programmeFilter;
      if (yearFilter) params.year = yearFilter;
      if (statusFilter) params.status = statusFilter;

      const { data } = await adminApi.students(params);
      // Handles both paginated ({count, results}) and plain-array responses.
      if (Array.isArray(data)) {
        setStudents(data);
        setCount(data.length);
      } else {
        setStudents(data.results || []);
        setCount(data.count ?? (data.results || []).length);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load students. Please try again.");
      setStudents([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, programmeFilter, yearFilter, statusFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { setPage(1); }, [debouncedSearch, programmeFilter, yearFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const handleDelete = async () => {
    try {
      await studentsApi.remove(deleteTarget.id);
      showToast(`${deleteTarget.registration_number} removed.`);
      setDeleteTarget(null);
      fetchStudents();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete student.");
      setDeleteTarget(null);
    }
  };

  const handleFormSaved = (_data, message) => {
    setFormModal(null);
    showToast(message);
    fetchStudents();
  };

  const handleDownloadAll = () => {
    downloadCsv(
      "students_export.csv",
      students.map((s) => ({
        registration_number: s.registration_number,
        name: fullName(s.user_detail),
        programme: s.programme_detail?.code,
        year: s.current_year,
        semester: s.current_semester,
        status: s.status,
        gpa: s.cumulative_gpa || "",
        admission_date: s.admission_date,
      })),
      ["registration_number", "name", "programme", "year", "semester", "status", "gpa", "admission_date"]
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-people" /> Students Management</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Students</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-outline-primary" onClick={handleDownloadAll}>
            <i className="bi bi-download" /> Export CSV
          </button>
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-person-plus" /> Admit Student
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      {/* Filters */}
      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px" }}>
            <Field label="Search">
              <input
                className="mu-input"
                placeholder="Reg no, first or last name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
          <div style={{ width: 200 }}>
            <Field label="Programme">
              <select className="mu-input" value={programmeFilter} onChange={(e) => setProgrammeFilter(e.target.value)}>
                <option value="">All Programmes</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 140 }}>
            <Field label="Year">
              <select className="mu-input" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">All Years</option>
                {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 160 }}>
            <Field label="Status">
              <select className="mu-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div>
            <button
              type="button"
              className="mu-btn mu-btn-outline-primary"
              onClick={() => { setSearch(""); setProgrammeFilter(""); setYearFilter(""); setStatusFilter(""); }}
            >
              Reset
            </button>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button
              className={`mu-btn mu-btn-sm ${viewMode === "table" ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
              onClick={() => setViewMode("table")}
              type="button"
            >
              <i className="bi bi-table" /> Table
            </button>
            <button
              className={`mu-btn mu-btn-sm ${viewMode === "cards" ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
              onClick={() => setViewMode("cards")}
              type="button"
            >
              <i className="bi bi-grid-3x3-gap" /> Cards
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Students</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: viewMode === "table" ? 0 : 16 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading students..." /></div>
          ) : students.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No students found</h3>
              <p>Try adjusting your filters, or admit a new student.</p>
            </div>
          ) : viewMode === "table" ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Registration</th><th>Name</th><th>Programme</th>
                    <th>Year/Sem</th><th>Status</th><th>GPA</th><th>Admission</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td><strong>{student.registration_number}</strong></td>
                      <td>{fullName(student.user_detail)}</td>
                      <td>{student.programme_detail?.code || "N/A"}</td>
                      <td>Y{student.current_year} S{student.current_semester}</td>
                      <td><span className={`mu-badge mu-badge-${STATUS_BADGE[student.status] || "gray"}`}>{student.status}</span></td>
                      <td>{student.cumulative_gpa ?? "—"}</td>
                      <td>{student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "N/A"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailStudent(student)} title="View">
                            <i className="bi bi-eye" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", student })} title="Edit">
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(student)} title="Delete">
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {students.map((student) => (
                <div key={student.id} className="mu-card" style={{ margin: 0 }}>
                  <div className="mu-card-body">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{student.registration_number}</strong>
                      <span className={`mu-badge mu-badge-${STATUS_BADGE[student.status] || "gray"}`}>{student.status}</span>
                    </div>
                    <div style={{ marginTop: 6 }}>{fullName(student.user_detail)}</div>
                    <div style={{ fontSize: 13, color: "#777" }}>{student.programme_detail?.name}</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Y{student.current_year} S{student.current_semester} · GPA {student.cumulative_gpa ?? "—"}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailStudent(student)}>View</button>
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", student })}>Edit</button>
                      <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(student)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && students.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>
              Page {page} of {totalPages} &middot; {count} students
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
      {detailStudent && (
        <StudentDetailModal
          student={detailStudent}
          semesters={semesters}
          onClose={() => setDetailStudent(null)}
          onEditRequest={(s) => { setDetailStudent(null); setFormModal({ mode: "edit", student: s }); }}
        />
      )}

      {formModal && (
        <StudentFormModal
          mode={formModal.mode}
          student={formModal.student}
          programmes={programmes}
          intakes={intakes}
          onClose={() => setFormModal(null)}
          onSaved={handleFormSaved}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Remove Student"
          message={`Delete ${deleteTarget.registration_number} (${fullName(deleteTarget.user_detail)})? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}