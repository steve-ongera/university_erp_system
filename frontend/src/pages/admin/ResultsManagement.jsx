// src/pages/admin/ResultsManagement.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi, gradesApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState,
  useDebouncedValue, summarizeErrors, unwrapList,
} from "../../components/ui/AdminUI";

const CAT_WEIGHT = 0.4;
const EXAM_WEIGHT = 0.6;

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

function computeAverage(values) {
  const filled = values.filter((v) => v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v)));
  if (filled.length === 0) return null;
  const sum = filled.reduce((acc, v) => acc + Number(v), 0);
  return Math.round((sum / filled.length) * 100) / 100;
}

// ----------------------------------------------------------------------
// View Grade Modal (read-only)
// ----------------------------------------------------------------------
function ViewGradeModal({ registration, onClose }) {
  const g = registration.grade_detail;
  return (
    <Modal title={`Grade — ${registration.course_detail?.code}`} onClose={onClose} width={440}>
      {!g ? (
        <p style={{ color: "#999" }}>No grade has been entered for this unit yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
          <Info label="CAT Marks" value={g.cat_marks} />
          <Info label="Final Exam Marks" value={g.final_exam_marks} />
          <Info label="Total Marks" value={g.total_marks} />
          <Info label="Letter Grade" value={g.letter_grade} />
          <Info label="Grade Points" value={g.grade_points} />
          <Info label="Quality Points" value={g.quality_points} />
          <Info label="Pass?" value={g.is_pass ? "Yes" : "No"} />
          <Info label="Requires Supplementary?" value={g.requires_supplementary ? "Yes" : "No"} />
          <Info label="Supplementary Sitting?" value={g.is_supplementary_result ? "Yes" : "No"} />
          <Info label="Published" value={g.published_at ? new Date(g.published_at).toLocaleString() : "—"} />
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "#999" }}>{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Add / Edit Grade Modal
// ----------------------------------------------------------------------
function GradeFormModal({ registration, onClose, onSaved }) {
  const g = registration.grade_detail;
  const [cat1, setCat1] = useState("");
  const [cat2, setCat2] = useState("");
  const [cat3, setCat3] = useState("");
  const [useAggregate, setUseAggregate] = useState(!!g); // existing grade -> edit aggregate directly
  const [aggregate, setAggregate] = useState(g?.cat_marks ?? "");
  const [finalExam, setFinalExam] = useState(g?.final_exam_marks ?? "");
  const [examDate, setExamDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const catValue = useAggregate ? (aggregate === "" ? null : Number(aggregate)) : computeAverage([cat1, cat2, cat3]);
  const previewTotal = catValue !== null && finalExam !== ""
    ? Math.round((catValue * CAT_WEIGHT + Number(finalExam) * EXAM_WEIGHT) * 100) / 100
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (catValue === null || finalExam === "") {
      setError(useAggregate
        ? "Enter both the CAT marks and final exam marks."
        : "Enter at least one CAT score and the final exam marks.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await gradesApi.enter({
        enrollment: registration.enrollment_id,
        cat_marks: catValue,
        final_exam_marks: Number(finalExam),
        ...(examDate ? { exam_date: examDate } : {}),
      });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save grade.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`${g ? "Edit" : "Enter"} Grade — ${registration.course_detail?.code}`} onClose={onClose} width={460}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        <p style={{ marginTop: 0, fontSize: 13, color: "#666" }}>{registration.course_detail?.name}</p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>CAT Component</span>
          <button type="button" className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setUseAggregate((v) => !v)}>
            {useAggregate ? "Enter as CAT 1/2/3" : "Enter as single total"}
          </button>
        </div>

        {useAggregate ? (
          <Field label="CAT Marks (aggregate, /100)">
            <input type="number" step="0.01" min={0} max={100} className="mu-input" value={aggregate} onChange={(e) => setAggregate(e.target.value)} />
          </Field>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="CAT 1"><input type="number" step="0.01" min={0} max={100} className="mu-input" value={cat1} onChange={(e) => setCat1(e.target.value)} /></Field>
            <Field label="CAT 2"><input type="number" step="0.01" min={0} max={100} className="mu-input" value={cat2} onChange={(e) => setCat2(e.target.value)} /></Field>
            <Field label="CAT 3"><input type="number" step="0.01" min={0} max={100} className="mu-input" value={cat3} onChange={(e) => setCat3(e.target.value)} /></Field>
          </div>
        )}
        <p style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
          {useAggregate
            ? "This is the value stored directly as the unit's CAT marks."
            : `Averaged into a single CAT total: ${catValue ?? "—"}. Only the average is stored — component scores aren't kept individually.`}
        </p>

        <div style={{ marginTop: 14 }}>
          <Field label="Final Exam Marks (/100)">
            <input type="number" step="0.01" min={0} max={100} className="mu-input" required value={finalExam} onChange={(e) => setFinalExam(e.target.value)} />
          </Field>
        </div>

        <div style={{ marginTop: 12 }}>
          <Field label="Exam Date (optional)">
            <input type="date" className="mu-input" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </Field>
        </div>

        {previewTotal !== null && (
          <p style={{ fontSize: 13, marginTop: 12, background: "#f4f6fb", padding: "8px 12px", borderRadius: 6 }}>
            Preview total (40% CAT / 60% exam): <strong>{previewTotal}</strong> — letter grade and pass status are computed server-side against the department's grading scheme.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Grade"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function ResultsManagement() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  const [registrations, setRegistrations] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [viewTarget, setViewTarget] = useState(null);
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  useEffect(() => {
    adminApi.semesters().then(({ data }) => {
      const list = unwrapList(data).sort((a, b) =>
        `${b.academic_year_detail?.year}${b.semester_number}`.localeCompare(`${a.academic_year_detail?.year}${a.semester_number}`)
      );
      setSemesters(list);
      const current = list.find((s) => s.is_current);
      if (current) setSelectedSemesterId(current.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    adminApi.students({ search: debouncedSearch, page_size: 8 })
      .then(({ data }) => setSearchResults(unwrapList(data)))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  const loadRegistrations = useCallback(async () => {
    if (!selectedStudent || !selectedSemesterId) { setRegistrations([]); return; }
    setLoadingRegs(true);
    setError("");
    try {
      const { data } = await adminApi.unitRegistrations({ student: selectedStudent.id, semester: selectedSemesterId });
      setRegistrations(unwrapList(data));
    } catch (err) {
      console.error(err);
      setError("Failed to load unit registrations for this student/semester.");
      setRegistrations([]);
    } finally {
      setLoadingRegs(false);
    }
  }, [selectedStudent, selectedSemesterId]);

  useEffect(() => { loadRegistrations(); }, [loadRegistrations]);

  const handleDeleteGrade = async () => {
    try {
      await gradesApi.remove(deleteTarget.grade_detail.id);
      showToast("Grade deleted.");
      setDeleteTarget(null);
      loadRegistrations();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete grade.");
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-clipboard-check" /> Results Management</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Results</div>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      {/* Student search */}
      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 320px", position: "relative" }}>
              <Field label="Search Student" hint="By registration number or name">
                <input
                  className="mu-input"
                  placeholder="e.g. SC211/0530/2024 or Jane Wanjiru"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedStudent(null); }}
                />
              </Field>
              {search && !selectedStudent && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
                  border: "1px solid #eee", borderRadius: 8, marginTop: 4, boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
                  zIndex: 10, maxHeight: 260, overflowY: "auto",
                }}>
                  {searching && <div style={{ padding: 12, fontSize: 13, color: "#999" }}>Searching...</div>}
                  {!searching && searchResults.length === 0 && debouncedSearch.length >= 2 && (
                    <div style={{ padding: 12, fontSize: 13, color: "#999" }}>No students match.</div>
                  )}
                  {searchResults.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => { setSelectedStudent(st); setSearch(""); setSearchResults([]); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                        border: "none", background: "transparent", borderBottom: "1px solid #f2f2f2", cursor: "pointer",
                      }}
                    >
                      <strong>{st.registration_number}</strong> — {fullName(st.user_detail)}
                      <div style={{ fontSize: 12, color: "#888" }}>{st.programme_detail?.code}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: 260 }}>
              <Field label="Semester">
                <select className="mu-input" value={selectedSemesterId} onChange={(e) => setSelectedSemesterId(e.target.value)}>
                  <option value="">Select semester...</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.academic_year_detail?.year} — Semester {s.semester_number} {s.is_current ? "(current)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {selectedStudent && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, background: "#f4f6fb", padding: "10px 14px", borderRadius: 8 }}>
              <i className="bi bi-person-check" style={{ color: "#3b6ce0" }} />
              <div>
                <strong>{selectedStudent.registration_number}</strong> — {fullName(selectedStudent.user_detail)}
                <div style={{ fontSize: 12, color: "#777" }}>{selectedStudent.programme_detail?.name}</div>
              </div>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginLeft: "auto" }} onClick={() => setSelectedStudent(null)}>
                Change Student
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Registrations table */}
      {!selectedStudent || !selectedSemesterId ? (
        <div className="mu-card">
          <div className="mu-card-body">
            <EmptyState icon="bi-search" label="Search for a student and pick a semester" hint="Their registered units for that semester will appear here." />
          </div>
        </div>
      ) : (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Unit Registrations</h4>
            <span className="mu-badge mu-badge-primary">{registrations.length} units</span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {loadingRegs ? (
              <div style={{ padding: 40 }}><LoadingSpinner text="Loading registrations..." /></div>
            ) : registrations.length === 0 ? (
              <EmptyState icon="bi-inbox" label="No unit registrations" hint="This student has no units registered for the selected semester." />
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr><th>Code</th><th>Course</th><th>Type</th><th>CAT</th><th>Exam</th><th>Total</th><th>Grade</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {registrations.map((r) => {
                      const g = r.grade_detail;
                      return (
                        <tr key={r.id}>
                          <td><strong>{r.course_detail?.code}</strong></td>
                          <td>{r.course_detail?.name}</td>
                          <td>{r.registration_type}</td>
                          <td>{g?.cat_marks ?? "—"}</td>
                          <td>{g?.final_exam_marks ?? "—"}</td>
                          <td>{g?.total_marks ?? "—"}</td>
                          <td>{g?.letter_grade ? <strong>{g.letter_grade}</strong> : "—"}</td>
                          <td>
                            {g?.published_at
                              ? <span className="mu-badge mu-badge-success">Published</span>
                              : <span className="mu-badge mu-badge-gray">Not Entered</span>}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="View" onClick={() => setViewTarget(r)}>
                                <i className="bi bi-eye" />
                              </button>
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title={g ? "Edit" : "Enter marks"} onClick={() => setFormTarget(r)}>
                                <i className={`bi ${g ? "bi-pencil" : "bi-plus-circle"}`} />
                              </button>
                              {g && (
                                <button className="mu-btn mu-btn-sm mu-btn-danger" title="Delete" onClick={() => setDeleteTarget(r)}>
                                  <i className="bi bi-trash" />
                                </button>
                              )}
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

      {viewTarget && <ViewGradeModal registration={viewTarget} onClose={() => setViewTarget(null)} />}

      {formTarget && (
        <GradeFormModal
          registration={formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); showToast("Grade saved."); loadRegistrations(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Grade"
          message={`Delete the recorded grade for ${deleteTarget.course_detail?.code}? The student will show as ungraded for this unit again.`}
          onConfirm={handleDeleteGrade}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}