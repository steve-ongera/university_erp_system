// src/pages/lecturer/ResultsEntry.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { lecturerApi, gradesApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, EmptyState, TabBar, unwrapList,
} from "../../components/ui/AdminUI";

const AUTOSAVE_DELAY = 700;

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
// Spreadsheet input cell — small, borderless, click-to-edit feel
// ----------------------------------------------------------------------
function Cell({ value, onChange, onCommit, disabled, width = 64 }) {
  return (
    <input
      type="number"
      step="0.01"
      min={0}
      max={100}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      style={{
        width, padding: "6px 8px", border: "1px solid #e3e6ee", borderRadius: 6,
        textAlign: "center", fontSize: 13, background: disabled ? "#f7f8fb" : "#fff",
      }}
    />
  );
}

function StatusPill({ status }) {
  const map = {
    saved: { bg: "#e7f7ee", color: "#1a8a5a", label: "Saved" },
    saving: { bg: "#fff7e6", color: "#c97d2a", label: "Saving..." },
    draft: { bg: "#f1f3f9", color: "#777", label: "Draft" },
    error: { bg: "#fdecec", color: "#c23b3b", label: "Error" },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: s.bg, color: s.color, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

// ----------------------------------------------------------------------
// View grade detail modal
// ----------------------------------------------------------------------
function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "#999" }}>{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}

function ViewGradeModal({ row, onClose }) {
  const g = row.grade;
  return (
    <Modal title={`Grade Detail — ${row.student?.registration_number}`} onClose={onClose} width={420}>
      {!g ? (
        <p style={{ color: "#999" }}>No grade saved yet for this student.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
          <Info label="CAT Marks" value={g.cat_marks} />
          <Info label="Final Exam Marks" value={g.final_exam_marks} />
          <Info label="Total Marks" value={g.total_marks} />
          <Info label="Letter Grade" value={g.letter_grade} />
          <Info label="Grade Points" value={g.grade_points} />
          <Info label="Pass?" value={g.is_pass ? "Yes" : "No"} />
          <Info label="Requires Supplementary?" value={g.requires_supplementary ? "Yes" : "No"} />
          <Info label="Published" value={g.published_at ? new Date(g.published_at).toLocaleString() : "—"} />
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function ResultsEntry() {
  const [allocations, setAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [semesterId, setSemesterId] = useState("");
  const [selectedAllocationId, setSelectedAllocationId] = useState(null);

  const [rows, setRows] = useState([]); // spreadsheet rows
  const [loadingRoster, setLoadingRoster] = useState(false);

  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  const timers = useRef({}); // enrollmentId -> setTimeout handle

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  // Load lecturer's own allocations.
  useEffect(() => {
    lecturerApi.myAllocations()
      .then(({ data }) => {
        const list = unwrapList(data).filter((a) => a.is_active);
        setAllocations(list);
        const current = list.find((a) => a.semester_detail?.is_current);
        setSemesterId(current ? current.semester : list[0]?.semester || "");
      })
      .catch(() => setError("Failed to load your unit allocations."))
      .finally(() => setLoadingAllocations(false));
  }, []);

  const semesterOptions = useMemo(() => {
    const map = new Map();
    allocations.forEach((a) => {
      if (a.semester_detail) map.set(a.semester, a.semester_detail);
    });
    return Array.from(map.entries())
      .map(([id, detail]) => ({ id, detail }))
      .sort((a, b) => `${b.detail.academic_year_detail?.year}${b.detail.semester_number}`
        .localeCompare(`${a.detail.academic_year_detail?.year}${a.detail.semester_number}`));
  }, [allocations]);

  const unitsForSemester = useMemo(
    () => allocations.filter((a) => String(a.semester) === String(semesterId)),
    [allocations, semesterId]
  );

  useEffect(() => {
    setSelectedAllocationId(unitsForSemester[0]?.id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesterId]);

  const selectedAllocation = allocations.find((a) => a.id === selectedAllocationId);

  const loadRoster = useCallback(async () => {
    if (!selectedAllocation) { setRows([]); return; }
    setLoadingRoster(true);
    setError("");
    try {
      const [rosterRes, gradesRes] = await Promise.all([
        lecturerApi.roster(selectedAllocation.id),
        gradesApi.list({ enrollment__course: selectedAllocation.course, enrollment__semester: selectedAllocation.semester }),
      ]);
      const enrollments = unwrapList(rosterRes.data);
      const grades = unwrapList(gradesRes.data);
      const gradeByEnrollment = Object.fromEntries(grades.map((g) => [g.enrollment, g]));

      setRows(enrollments.map((en) => {
        const grade = gradeByEnrollment[en.id] || null;
        return {
          enrollmentId: en.id,
          student: en.student_detail,
          grade,
          mode: grade ? "aggregate" : "components",
          cat1: "", cat2: "", cat3: "",
          aggregate: grade?.cat_marks ?? "",
          finalExam: grade?.final_exam_marks ?? "",
          status: grade?.published_at ? "saved" : "draft",
        };
      }));
    } catch (err) {
      console.error(err);
      setError("Failed to load the class roster.");
      setRows([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedAllocation]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const updateRow = (enrollmentId, patch) => {
    setRows((prev) => prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, ...patch } : r)));
  };

  const scheduleSave = (enrollmentId) => {
    clearTimeout(timers.current[enrollmentId]);
    timers.current[enrollmentId] = setTimeout(() => commitSave(enrollmentId), AUTOSAVE_DELAY);
  };

  const commitSave = async (enrollmentId) => {
    setRows((currentRows) => {
      const row = currentRows.find((r) => r.enrollmentId === enrollmentId);
      if (!row) return currentRows;

      const catValue = row.mode === "aggregate"
        ? (row.aggregate === "" ? null : Number(row.aggregate))
        : computeAverage([row.cat1, row.cat2, row.cat3]);

      if (catValue === null || row.finalExam === "") {
        return currentRows.map((r) => (r.enrollmentId === enrollmentId ? { ...r, status: "draft" } : r));
      }

      // Fire the actual save async; mark as "saving" synchronously now.
      (async () => {
        updateRow(enrollmentId, { status: "saving" });
        try {
          const { data } = await gradesApi.enter({
            enrollment: enrollmentId,
            cat_marks: catValue,
            final_exam_marks: Number(row.finalExam),
          });
          updateRow(enrollmentId, { grade: data, status: "saved" });
        } catch (err) {
          console.error(err);
          updateRow(enrollmentId, { status: "error" });
        }
      })();

      return currentRows;
    });
  };

  const handleDelete = async () => {
    try {
      await gradesApi.remove(deleteRow.grade.id);
      updateRow(deleteRow.enrollmentId, {
        grade: null, mode: "components", cat1: "", cat2: "", cat3: "",
        aggregate: "", finalExam: "", status: "draft",
      });
      showToast(`Grade cleared for ${deleteRow.student?.registration_number}.`);
      setDeleteRow(null);
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete grade.");
      setDeleteRow(null);
    }
  };

  if (loadingAllocations) {
    return <div style={{ padding: 48 }}><LoadingSpinner text="Loading your units..." /></div>;
  }

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-clipboard-data" /> Results Entry</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Lecturer <span className="separator">/</span> Results</div>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      {allocations.length === 0 ? (
        <div className="mu-card"><div className="mu-card-body">
          <EmptyState icon="bi-journal-x" label="No units allocated" hint="You have no active unit allocations yet — contact your COD or the registrar." />
        </div></div>
      ) : (
        <>
          {/* Semester tabs */}
          <TabBar
            tabs={semesterOptions.map((s) => ({
              key: s.id,
              label: `${s.detail.academic_year_detail?.year} S${s.detail.semester_number}${s.detail.is_current ? " •" : ""}`,
            }))}
            active={semesterId}
            onChange={setSemesterId}
          />

          {/* Unit picker */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {unitsForSemester.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAllocationId(a.id)}
                className="mu-card"
                style={{
                  margin: 0, padding: "12px 16px", cursor: "pointer", textAlign: "left", minWidth: 220,
                  border: a.id === selectedAllocationId ? "2px solid #3b6ce0" : "1px solid #eee",
                }}
              >
                <strong>{a.course_detail?.code}</strong>
                <div style={{ fontSize: 12, color: "#777" }}>{a.course_detail?.name}</div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                  Y{a.year} S{a.programme_semester}{" "}
                  {a.is_supplementary_offering && (
                    <span className="mu-badge mu-badge-warning" style={{ marginLeft: 4 }}>Supp</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Spreadsheet */}
          {!selectedAllocation ? (
            <EmptyState icon="bi-table" label="Select a unit above" />
          ) : (
            <div className="mu-card">
              <div className="mu-card-header">
                <h4>{selectedAllocation.course_detail?.code} — {selectedAllocation.course_detail?.name}</h4>
                <span className="mu-badge mu-badge-primary">{rows.length} students</span>
              </div>
              <div className="mu-card-body" style={{ padding: 0 }}>
                {loadingRoster ? (
                  <div style={{ padding: 40 }}><LoadingSpinner text="Loading roster..." /></div>
                ) : rows.length === 0 ? (
                  <EmptyState icon="bi-people" label="No students enrolled" hint="No one has registered for this unit yet." />
                ) : (
                  <div className="mu-table-wrapper">
                    <table className="mu-table">
                      <thead>
                        <tr>
                          <th>Reg No</th><th>Name</th><th>CAT</th>
                          <th>Final Exam</th><th>Total</th><th>Grade</th><th>Status</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.enrollmentId}>
                            <td><strong>{row.student?.registration_number}</strong></td>
                            <td>{fullName(row.student?.user_detail)}</td>
                            <td>
                              {row.mode === "components" ? (
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <Cell value={row.cat1} onChange={(v) => { updateRow(row.enrollmentId, { cat1: v }); scheduleSave(row.enrollmentId); }} onCommit={() => commitSave(row.enrollmentId)} />
                                  <Cell value={row.cat2} onChange={(v) => { updateRow(row.enrollmentId, { cat2: v }); scheduleSave(row.enrollmentId); }} onCommit={() => commitSave(row.enrollmentId)} />
                                  <Cell value={row.cat3} onChange={(v) => { updateRow(row.enrollmentId, { cat3: v }); scheduleSave(row.enrollmentId); }} onCommit={() => commitSave(row.enrollmentId)} />
                                  <button
                                    type="button" title="Switch to single total"
                                    className="mu-btn mu-btn-sm mu-btn-outline-primary"
                                    onClick={() => updateRow(row.enrollmentId, { mode: "aggregate", aggregate: computeAverage([row.cat1, row.cat2, row.cat3]) ?? "" })}
                                  >
                                    <i className="bi bi-arrows-collapse" />
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <Cell width={80} value={row.aggregate} onChange={(v) => { updateRow(row.enrollmentId, { aggregate: v }); scheduleSave(row.enrollmentId); }} onCommit={() => commitSave(row.enrollmentId)} />
                                  <button
                                    type="button" title="Break into CAT 1/2/3"
                                    className="mu-btn mu-btn-sm mu-btn-outline-primary"
                                    onClick={() => updateRow(row.enrollmentId, { mode: "components", cat1: "", cat2: "", cat3: "" })}
                                  >
                                    <i className="bi bi-arrows-expand" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td>
                              <Cell width={80} value={row.finalExam} onChange={(v) => { updateRow(row.enrollmentId, { finalExam: v }); scheduleSave(row.enrollmentId); }} onCommit={() => commitSave(row.enrollmentId)} />
                            </td>
                            <td>{row.grade?.total_marks ?? "—"}</td>
                            <td>{row.grade?.letter_grade ? <strong>{row.grade.letter_grade}</strong> : "—"}</td>
                            <td><StatusPill status={row.status} /></td>
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="View" onClick={() => setViewRow(row)}>
                                  <i className="bi bi-eye" />
                                </button>
                                {row.grade && (
                                  <button className="mu-btn mu-btn-sm mu-btn-danger" title="Clear grade" onClick={() => setDeleteRow(row)}>
                                    <i className="bi bi-trash" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div style={{ padding: "10px 20px", borderTop: "1px solid #eee", fontSize: 12, color: "#999" }}>
                Cells save automatically ~{AUTOSAVE_DELAY / 1000}s after you stop typing, or when you click away.
                A grade only commits once both a CAT value and the final exam mark are filled in.
              </div>
            </div>
          )}
        </>
      )}

      {viewRow && <ViewGradeModal row={viewRow} onClose={() => setViewRow(null)} />}

      {deleteRow && (
        <ConfirmModal
          title="Clear Grade"
          message={`Clear the saved grade for ${deleteRow.student?.registration_number}? They'll show as ungraded again.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteRow(null)}
        />
      )}
    </div>
  );
}