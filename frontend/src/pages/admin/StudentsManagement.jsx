// src/pages/admin/StudentsManagement.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { adminApi, studentsApi, gradesApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";
import muLogo from "../../assets/mut_logo.png";

// ----------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------
const STATUS_OPTIONS = ["active", "deferred", "graduated", "suspended", "discontinued", "expelled"];
const SPONSOR_OPTIONS = ["government", "self", "employer", "scholarship", "bursary"];
const GENDER_OPTIONS = ["male", "female", "other"];
const PAGE_SIZE = 25;
const DEFAULT_STUDENT_PASSWORD = "password123";

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
// PDF Transcript Generation
// ----------------------------------------------------------------------
function downloadTranscriptPDF(student, transcript, feeSummary) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;

  const getSemesterDisplay = (entry) => {
    if (entry.academic_year_detail?.year) {
      return `${entry.academic_year_detail.year} S${entry.semester_number}`;
    }
    return `Y${entry.programme_year} S${entry.semester_number}`;
  };

  const groups = {};
  transcript.forEach(entry => {
    const key = getSemesterDisplay(entry);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  });

  const calculateSemesterGPA = (entries) => {
    if (!entries || entries.length === 0) return null;
    let totalPoints = 0;
    let totalCredits = 0;
    entries.forEach(entry => {
      const points = parseFloat(entry.quality_points) || 0;
      const credits = parseFloat(entry.credit_hours) || 0;
      totalPoints += points;
      totalCredits += credits;
    });
    return totalCredits > 0 ? (totalPoints / totalCredits) : null;
  };

  const calculateCGPA = (entries) => {
    let totalPoints = 0;
    let totalCredits = 0;
    entries.forEach(entry => {
      const points = parseFloat(entry.quality_points) || 0;
      const credits = parseFloat(entry.credit_hours) || 0;
      totalPoints += points;
      totalCredits += credits;
    });
    return totalCredits > 0 ? (totalPoints / totalCredits) : null;
  };

  const cgpa = calculateCGPA(transcript);

  let semesterHTML = '';
  Object.keys(groups).forEach((semesterKey) => {
    const entries = groups[semesterKey];
    const semesterGPA = calculateSemesterGPA(entries);
    semesterHTML += `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="margin: 0; color: #1B5E20;">${semesterKey}</h4>
          ${semesterGPA !== null ? `<span style="background: #2E7D32; color: #fff; padding: 2px 12px; border-radius: 4px; font-size: 12px;">GPA: ${semesterGPA.toFixed(2)}</span>` : ''}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px;">
          <thead>
            <tr style="background: #E8F5E9;">
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: left;">Course Code</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: left;">Course Name</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">Credit Hrs</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">Grade</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">Grade Points</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">Quality Points</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(entry => `
              <tr>
                <td style="padding: 4px 10px; border: 1px solid #ddd;">${entry.course_detail?.code || 'N/A'}</td>
                <td style="padding: 4px 10px; border: 1px solid #ddd;">${entry.course_detail?.name || 'Unknown'}</td>
                <td style="padding: 4px 10px; border: 1px solid #ddd; text-align: center;">${entry.credit_hours || 'N/A'}</td>
                <td style="padding: 4px 10px; border: 1px solid #ddd; text-align: center;"><strong>${entry.letter_grade || 'N/A'}</strong></td>
                <td style="padding: 4px 10px; border: 1px solid #ddd; text-align: center;">${entry.grade_points?.toFixed(2) || 'N/A'}</td>
                <td style="padding: 4px 10px; border: 1px solid #ddd; text-align: center;">${entry.quality_points?.toFixed(2) || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  const studentName = `${student.user_detail?.first_name || ''} ${student.user_detail?.last_name || ''}`.trim() || 'N/A';
  const regNumber = student.registration_number || 'N/A';
  const programme = student.programme_detail?.name || 'N/A';
  const currentYear = student.current_year || 1;
  const currentSemester = student.current_semester || 1;

  win.document.write(`
    <html>
      <head>
        <title>Academic Transcript - ${studentName}</title>
        <style>
          body { font-family: 'Times New Roman', Arial, sans-serif; padding: 40px; color: #1a1a1a; max-width: 1000px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #2E7D32; padding-bottom: 16px; }
          .logo { width: 80px; height: 80px; object-fit: contain; }
          .university-name { font-size: 20px; font-weight: 700; color: #1B5E20; margin: 8px 0 2px; }
          .university-sub { font-size: 14px; color: #2E7D32; margin: 0; }
          .document-title { font-size: 18px; font-weight: 700; color: #1B5E20; margin: 16px 0 4px; text-transform: uppercase; letter-spacing: 2px; }
          .student-info { display: flex; flex-wrap: wrap; gap: 12px 24px; background: #f5f7fa; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; }
          .student-info .label { color: #666; font-weight: 600; }
          .student-info .value { font-weight: 500; }
          .cgpa-box { background: #E8F5E9; padding: 12px 16px; border-radius: 6px; text-align: center; margin-top: 16px; border: 2px solid #2E7D32; }
          .cgpa-box .label { font-size: 14px; font-weight: 600; color: #1B5E20; }
          .cgpa-box .value { font-size: 22px; font-weight: 700; color: #1B5E20; }
          .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #888; }
          @media print {
            body { padding: 20px; }
            .student-info { background: #f5f7fa; }
            .cgpa-box { background: #E8F5E9; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${muLogo}" alt="Muranga University" class="logo" />
          <div class="university-name">MURANG'A UNIVERSITY OF TECHNOLOGY</div>
          <div class="university-sub">Office of the Registrar</div>
          <div class="document-title">Academic Transcript</div>
        </div>

        <div class="student-info">
          <div><span class="label">Name:</span> <span class="value">${studentName}</span></div>
          <div><span class="label">Registration Number:</span> <span class="value">${regNumber}</span></div>
          <div><span class="label">Programme:</span> <span class="value">${programme}</span></div>
          <div><span class="label">Current Year:</span> <span class="value">${currentYear}</span></div>
          <div><span class="label">Current Semester:</span> <span class="value">${currentSemester}</span></div>
          <div><span class="label">Admission Date:</span> <span class="value">${student.admission_date || 'N/A'}</span></div>
        </div>

        ${semesterHTML}

        <div class="cgpa-box">
          <div class="label">Cumulative GPA (CGPA)</div>
          <div class="value">${cgpa !== null ? cgpa.toFixed(2) : 'N/A'}</div>
        </div>

        ${feeSummary ? `
          <div style="margin-top: 16px; font-size: 12px; border-top: 1px solid #ddd; padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
              <span><strong>Fee Status:</strong> ${feeSummary.total_outstanding > 0 ? 'Outstanding Balance: Ksh ' + feeSummary.total_outstanding : 'Fees Fully Paid'}</span>
              <span><strong>Wallet Credit:</strong> Ksh ${feeSummary.wallet_credit}</span>
            </div>
          </div>
        ` : ''}

        <div class="footer">
          <p>This is a computer-generated transcript. It is valid without signature.</p>
          <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
      </body>
    </html>
  `);

  win.document.close();
  win.focus();
  win.print();
}

// ----------------------------------------------------------------------
// Generic Modal shell (using the shared component)
// ----------------------------------------------------------------------
function CustomModal({ title, onClose, children, width = 560 }) {
  return (
    <Modal isOpen={true} onClose={onClose} title={title} size={width === 560 ? "md" : width === 720 ? "lg" : "xl"} showFooter={false}>
      {children}
    </Modal>
  );
}

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
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
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
// Add / Edit Student modal
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
          kcse_index_number: student.kcse_index_number || "",
          previous_school: student.previous_school || "",
          kcse_mean_grade: student.kcse_mean_grade || "",
          kcse_points: student.kcse_points ?? "",
        }
      : {
          first_name: "", last_name: "", gender: "male",
          programme: "", intake: "", curriculum_version: "",
          sponsor_type: "self",
          kcse_index_number: "", previous_school: "",
          kcse_mean_grade: "", kcse_points: "",
        }
  );
  const [curriculumVersions, setCurriculumVersions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
          kcse_index_number: form.kcse_index_number,
          previous_school: form.previous_school,
          kcse_mean_grade: form.kcse_mean_grade,
          kcse_points: form.kcse_points === "" ? null : Number(form.kcse_points),
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
          kcse_index_number: form.kcse_index_number,
          previous_school: form.previous_school,
          kcse_mean_grade: form.kcse_mean_grade,
          kcse_points: form.kcse_points === "" ? null : Number(form.kcse_points),
        });
        onSaved(
          data,
          `Student admitted. Registration No: ${data.registration_number}. Default password: ${DEFAULT_STUDENT_PASSWORD} (must change on first login). Fee invoice raised automatically.`
        );
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Check the form and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEdit ? "Edit Student" : "Admit New Student"} size="lg">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}><i className="bi bi-exclamation-triangle" /> {error}</div>}

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
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="mu-form-group">
                <label>Sponsor Type</label>
                <select className="mu-input" value={form.sponsor_type} onChange={handleChange("sponsor_type")}>
                  {SPONSOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mu-form-group">
              <label>Programme</label>
              <select className="mu-input" required value={form.programme} onChange={handleChange("programme")}>
                <option value="">Select programme...</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Intake</label>
                <select className="mu-input" required value={form.intake} onChange={handleChange("intake")}>
                  <option value="">Select intake...</option>
                  {intakes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="mu-form-group">
                <label>Curriculum Version</label>
                <select className="mu-input" required value={form.curriculum_version} onChange={handleChange("curriculum_version")} disabled={!form.programme}>
                  <option value="">{form.programme ? "Select..." : "Pick a programme first"}</option>
                  {curriculumVersions.map((v) => <option key={v.id} value={v.id}>{v.effective_academic_year_detail?.year || `Version #${v.id}`}</option>)}
                </select>
              </div>
            </div>

            {/* --- KCSE / prior school record --- */}
            <div style={{ margin: "16px 0 8px", fontWeight: 600, fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-600)" }}>
              <i className="bi bi-mortarboard" style={{ marginRight: 6 }} />
              Prior Academic Record (KCSE)
            </div>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>KCSE Index Number</label>
                <input className="mu-input" placeholder="e.g. 12345678001/2024"
                       value={form.kcse_index_number} onChange={handleChange("kcse_index_number")} />
              </div>
              <div className="mu-form-group">
                <label>Previous School</label>
                <input className="mu-input" placeholder="School name"
                       value={form.previous_school} onChange={handleChange("previous_school")} />
              </div>
            </div>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>KCSE Mean Grade</label>
                <input className="mu-input" placeholder="e.g. B+"
                       value={form.kcse_mean_grade} onChange={handleChange("kcse_mean_grade")} />
              </div>
              <div className="mu-form-group">
                <label>KCSE Mean Points</label>
                <input type="number" step="0.01" min={0} max={12} className="mu-input" placeholder="e.g. 9.50"
                       value={form.kcse_points} onChange={handleChange("kcse_points")} />
              </div>
            </div>

            <div className="mu-alert mu-alert-info" style={{ marginTop: 12 }}>
              <i className="bi bi-info-circle" />
              A login account is created automatically (username = registration number, default password ={" "}
              <strong>{DEFAULT_STUDENT_PASSWORD}</strong>; the student must change it on first login). A
              Year&nbsp;1&nbsp;/&nbsp;Semester&nbsp;1 fee invoice is raised automatically — if no fee structure is
              configured for this programme/year/semester yet, admission will be cancelled and an error shown below.
            </div>
          </>
        )}

        {isEdit && (
          <>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Current Year</label>
                <input type="number" min={1} max={8} className="mu-input" value={form.current_year} onChange={handleChange("current_year")} />
              </div>
              <div className="mu-form-group">
                <label>Current Semester</label>
                <input type="number" min={1} max={3} className="mu-input" value={form.current_semester} onChange={handleChange("current_semester")} />
              </div>
            </div>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Status</label>
                <select className="mu-input" value={form.status} onChange={handleChange("status")}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="mu-form-group">
                <label>Sponsor Type</label>
                <select className="mu-input" value={form.sponsor_type} onChange={handleChange("sponsor_type")}>
                  {SPONSOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mu-form-group">
              <label>Guardian Name</label>
              <input className="mu-input" value={form.guardian_name} onChange={handleChange("guardian_name")} />
            </div>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Guardian Phone</label>
                <input className="mu-input" value={form.guardian_phone} onChange={handleChange("guardian_phone")} />
              </div>
              <div className="mu-form-group">
                <label>Emergency Contact</label>
                <input className="mu-input" value={form.emergency_contact} onChange={handleChange("emergency_contact")} />
              </div>
            </div>

            <div style={{ margin: "16px 0 8px", fontWeight: 600, fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-600)" }}>
              <i className="bi bi-mortarboard" style={{ marginRight: 6 }} />
              Prior Academic Record (KCSE)
            </div>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>KCSE Index Number</label>
                <input className="mu-input" value={form.kcse_index_number} onChange={handleChange("kcse_index_number")} />
              </div>
              <div className="mu-form-group">
                <label>Previous School</label>
                <input className="mu-input" value={form.previous_school} onChange={handleChange("previous_school")} />
              </div>
            </div>
            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>KCSE Mean Grade</label>
                <input className="mu-input" value={form.kcse_mean_grade} onChange={handleChange("kcse_mean_grade")} />
              </div>
              <div className="mu-form-group">
                <label>KCSE Mean Points</label>
                <input type="number" step="0.01" min={0} max={12} className="mu-input"
                       value={form.kcse_points} onChange={handleChange("kcse_points")} />
              </div>
            </div>
          </>
        )}

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Admit Student"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Grade edit modal
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
    <Modal isOpen={true} onClose={onClose} title={`Update Marks — ${entry.course_detail?.code}`} size="md">
      <form onSubmit={handleSave}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}><i className="bi bi-exclamation-triangle" /> {error}</div>}
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--mu-gray-500)" }}>
          {entry.course_detail?.name} &middot; Y{entry.programme_year} S{entry.semester_number}
        </p>
        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>CAT Marks (/30)</label>
            <input type="number" step="0.01" min={0} max={100} required className="mu-input"
                   value={catMarks} onChange={(e) => setCatMarks(e.target.value)} />
          </div>
          <div className="mu-form-group">
            <label>Final Exam Marks (/70)</label>
            <input type="number" step="0.01" min={0} max={100} required className="mu-input"
                   value={examMarks} onChange={(e) => setExamMarks(e.target.value)} />
          </div>
        </div>
        <div className="mu-alert mu-alert-info" style={{ marginTop: 12 }}>
          <i className="bi bi-info-circle" />
          Total, letter grade and grade points are computed server-side (40/60 weighting) against the department's grading scheme.
        </div>
        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : "Save Marks"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Student Detail modal
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

  const handleDownloadFullTranscriptPDF = () => {
    downloadTranscriptPDF(student, transcript, feeSummary);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Student Details" size="xl">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>{fullName(student.user_detail)}</h2>
          <div style={{ color: "var(--mu-gray-500)", fontSize: 13 }}>
            {student.registration_number} &middot; {student.programme_detail?.name}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`mu-badge mu-badge-${STATUS_BADGE[student.status] || "gray"}`}>{student.status}</span>
            <span className="mu-badge mu-badge-primary">Y{student.current_year} S{student.current_semester}</span>
            {student.cumulative_gpa && <span className="mu-badge mu-badge-info">GPA {student.cumulative_gpa}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {transcript && transcript.length > 0 && (
            <button className="mu-btn mu-btn-primary" onClick={handleDownloadFullTranscriptPDF}>
              <i className="bi bi-file-pdf" />
              Download Full Transcript (PDF)
            </button>
          )}
          <button className="mu-btn mu-btn-outline-primary" onClick={() => onEditRequest(student)}>
            <i className="bi bi-pencil" /> Edit Bio Data
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--mu-border)", marginBottom: 16, flexWrap: "wrap" }}>
        {["overview", ...yearTabs.map((y) => `year${y}`), "fees"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
              borderRadius: 0,
              background: "transparent",
              padding: "8px 16px",
              cursor: "pointer",
              color: activeTab === tab ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: "var(--mu-font-size-sm)",
              transition: "all var(--mu-transition-fast)",
            }}
          >
            {tab === "overview" ? "Overview" : tab === "fees" ? "Fees" : `Year ${tab.replace("year", "")}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><LoadingSpinner text="Loading student record..." /></div>
      ) : (
        <div>
          {activeTab === "overview" && (
            <div className="mu-dashboard-grid-2" style={{ gap: 16 }}>
              <div className="mu-form-group"><label>Sponsor Type</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.sponsor_type || "—"}</div></div>
              <div className="mu-form-group"><label>Admission Date</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.admission_date || "—"}</div></div>
              <div className="mu-form-group"><label>Guardian</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.guardian_name || "—"}</div></div>
              <div className="mu-form-group"><label>Guardian Phone</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.guardian_phone || "—"}</div></div>
              <div className="mu-form-group"><label>Emergency Contact</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.emergency_contact || "—"}</div></div>
              <div className="mu-form-group"><label>Total Credit Hours</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.total_credit_hours_earned || 0}</div></div>

              {/* --- KCSE / prior school record --- */}
              <div className="mu-form-group"><label>KCSE Index No.</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.kcse_index_number || "—"}</div></div>
              <div className="mu-form-group"><label>Previous School</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.previous_school || "—"}</div></div>
              <div className="mu-form-group"><label>KCSE Mean Grade</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.kcse_mean_grade || "—"}</div></div>
              <div className="mu-form-group"><label>KCSE Points</label><div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>{student.kcse_points ?? "—"}</div></div>
            </div>
          )}

          {yearTabs.map(
            (year) =>
              activeTab === `year${year}` && (
                <div key={year}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <select className="mu-input" style={{ width: 180 }} value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
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
                          <th>Grade</th><th>Points</th><th>Type</th><th style={{ textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entriesForYear(year).length === 0 && (
                          <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>No results recorded yet.</td></tr>
                        )}
                        {entriesForYear(year).map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.course_detail?.code}</td>
                            <td>{entry.course_detail?.name}</td>
                            <td>S{entry.semester_number}</td>
                            <td>{entry.credit_hours}</td>
                            <td><span className="mu-badge mu-badge-primary">{entry.letter_grade}</span></td>
                            <td>{entry.grade_points}</td>
                            <td>{entry.is_supplementary ? "Supplementary" : "Normal"}</td>
                            <td style={{ textAlign: "center" }}>
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
                  <div className="mu-dashboard-grid-2" style={{ gap: 16, marginBottom: 16 }}>
                    <div className="mu-stat-card">
                      <div className="mu-stat-label">Total Outstanding</div>
                      <div className="mu-stat-value" style={{ color: feeSummary.total_outstanding > 0 ? "var(--mu-danger)" : "var(--mu-success)" }}>
                        Ksh {feeSummary.total_outstanding}
                      </div>
                    </div>
                    <div className="mu-stat-card">
                      <div className="mu-stat-label">Wallet Credit</div>
                      <div className="mu-stat-value" style={{ color: feeSummary.wallet_credit > 0 ? "var(--mu-success)" : "var(--mu-gray-500)" }}>
                        Ksh {feeSummary.wallet_credit}
                      </div>
                    </div>
                  </div>
                  <div className="mu-table-wrapper">
                    <table className="mu-table">
                      <thead><tr><th>Type</th><th>Semester</th><th>Amount Due</th><th>Balance</th></tr></thead>
                      <tbody>
                        {(feeSummary.open_invoices || []).length === 0 && (
                          <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "var(--mu-gray-400)" }}>No open invoices.</td></tr>
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
                <p style={{ color: "var(--mu-gray-400)" }}>Fee summary unavailable.</p>
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
  const [viewMode, setViewMode] = useState("table");

  const [programmes, setProgrammes] = useState([]);
  const [intakes, setIntakes] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [detailStudent, setDetailStudent] = useState(null);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const filterScopeKey = [debouncedSearch, programmeFilter, yearFilter, statusFilter].join("|");
  const prevFilterScopeKey = useRef(filterScopeKey);

  useEffect(() => {
    if (prevFilterScopeKey.current !== filterScopeKey) {
      prevFilterScopeKey.current = filterScopeKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    fetchStudents();
  }, [fetchStudents, filterScopeKey]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 6000);
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
        kcse_index_number: s.kcse_index_number || "",
        previous_school: s.previous_school || "",
        kcse_mean_grade: s.kcse_mean_grade || "",
        kcse_points: s.kcse_points ?? "",
      })),
      ["registration_number", "name", "programme", "year", "semester", "status", "gpa", "admission_date",
       "kcse_index_number", "previous_school", "kcse_mean_grade", "kcse_points"]
    );
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-people" />
            Students Management
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Students
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
          <button className="mu-btn mu-btn-outline-primary" onClick={handleDownloadAll}>
            <i className="bi bi-download" /> Export CSV
          </button>
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-person-plus" /> Admit Student
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
                <tr style={{ background: "var(--mu-gray-50)" }}>
                  <th colSpan={8} style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 220px" }}>
                        <div style={{ position: "relative", width: "100%" }}>
                          <i className="bi bi-search" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--mu-gray-400)" }} />
                          <input
                            type="text"
                            className="mu-input"
                            placeholder="Search by reg no., name, KCSE index..."
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

                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Programme:</span>
                        <select
                          className="mu-select"
                          style={{ width: 130, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={programmeFilter}
                          onChange={(e) => setProgrammeFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {programmes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Year:</span>
                        <select
                          className="mu-select"
                          style={{ width: 90, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={yearFilter}
                          onChange={(e) => setYearFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Y{y}</option>)}
                        </select>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Status:</span>
                        <select
                          className="mu-select"
                          style={{ width: 100, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                      </div>

                      <button
                        className="mu-btn mu-btn-secondary"
                        style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        onClick={() => { setSearch(""); setProgrammeFilter(""); setYearFilter(""); setStatusFilter(""); }}
                      >
                        <i className="bi bi-arrow-counterclockwise" />
                        Reset
                      </button>

                      <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginLeft: "auto" }}>
                        {count} student(s)
                      </span>

                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className={`mu-btn mu-btn-sm ${viewMode === "table" ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
                          onClick={() => setViewMode("table")}
                          type="button"
                          style={{ padding: "2px 8px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        >
                          <i className="bi bi-table" /> Table
                        </button>
                        <button
                          className={`mu-btn mu-btn-sm ${viewMode === "cards" ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
                          onClick={() => setViewMode("cards")}
                          type="button"
                          style={{ padding: "2px 8px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        >
                          <i className="bi bi-grid-3x3-gap" /> Cards
                        </button>
                      </div>
                    </div>
                  </th>
                </tr>
                <tr>
                  <th>Registration</th>
                  <th>Name</th>
                  <th>Programme</th>
                  <th>Year/Sem</th>
                  <th>Status</th>
                  <th>GPA</th>
                  <th>Admission</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: 48, textAlign: "center" }}><LoadingSpinner text="Loading students..." /></td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                    <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                    <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No students found</h3>
                    <p>Try adjusting your filters, or admit a new student.</p>
                  </td></tr>
                ) : viewMode === "table" ? (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td><strong>{student.registration_number}</strong></td>
                      <td>{fullName(student.user_detail)}</td>
                      <td>{student.programme_detail?.code || "N/A"}</td>
                      <td>Y{student.current_year} S{student.current_semester}</td>
                      <td>
                        <span className={`mu-badge mu-badge-${STATUS_BADGE[student.status] || "gray"}`}>
                          {student.status}
                        </span>
                      </td>
                      <td>{student.cumulative_gpa ?? "—"}</td>
                      <td>{student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "N/A"}</td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
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
                  ))
                ) : (
                  <tr><td colSpan={8} style={{ padding: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                      {students.map((student) => (
                        <div key={student.id} className="mu-card" style={{ margin: 0 }}>
                          <div className="mu-card-body">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <strong>{student.registration_number}</strong>
                              <span className={`mu-badge mu-badge-${STATUS_BADGE[student.status] || "gray"}`}>
                                {student.status}
                              </span>
                            </div>
                            <div style={{ marginTop: 6, fontWeight: 500 }}>{fullName(student.user_detail)}</div>
                            <div style={{ fontSize: 13, color: "var(--mu-gray-500)" }}>{student.programme_detail?.name}</div>
                            <div style={{ fontSize: 13, marginTop: 6 }}>
                              Y{student.current_year} S{student.current_semester} · GPA {student.cumulative_gpa ?? "—"}
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailStudent(student)}>
                                <i className="bi bi-eye" /> View
                              </button>
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", student })}>
                                <i className="bi bi-pencil" /> Edit
                              </button>
                              <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(student)}>
                                <i className="bi bi-trash" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && students.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
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