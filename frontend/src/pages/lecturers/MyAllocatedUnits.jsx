import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { lecturerApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

// ----------------------------------------------------------------------
// Roster modal — read-only list of enrolled students for one allocation
// ----------------------------------------------------------------------
function RosterModal({ allocation, onClose }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    lecturerApi
      .roster(allocation.id)
      .then(({ data }) => setRoster(Array.isArray(data) ? data : data.results || []))
      .catch(() => setError("Failed to load roster."))
      .finally(() => setLoading(false));
  }, [allocation.id]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Roster — ${allocation.course_detail?.code}`}
      size="md"
      showFooter={false}
    >
      {loading ? (
        <LoadingSpinner text="Loading roster..." />
      ) : error ? (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      ) : roster.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--mu-gray-400)" }}>
          <i className="bi bi-people" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
          No students enrolled yet.
        </div>
      ) : (
        <div className="mu-table-wrapper">
          <table className="mu-table mu-table-hover">
            <thead>
              <tr>
                <th>Reg No</th>
                <th>Name</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((en) => (
                <tr key={en.id}>
                  <td>{en.student_detail?.registration_number}</td>
                  <td>
                    {en.student_detail?.user_detail?.first_name} {en.student_detail?.user_detail?.last_name}
                  </td>
                  <td>
                    <span className="mu-badge mu-badge-primary">
                      {en.registration?.registration_type || "normal"}
                    </span>
                  </td>
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
// Marks modal — grading sheet for one allocation, editable per student
// ----------------------------------------------------------------------
function MarksModal({ allocation, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    lecturerApi
      .gradingSheet(allocation.id)
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load grading sheet."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [allocation.id]);

  const draftFor = (row) => ({
    cat_marks: drafts[row.enrollment_id]?.cat_marks ?? row.grade?.cat_marks ?? "",
    final_exam_marks: drafts[row.enrollment_id]?.final_exam_marks ?? row.grade?.final_exam_marks ?? "",
  });

  const setDraft = (enrollmentId, field, value) => {
    setDrafts((d) => ({
      ...d,
      [enrollmentId]: { ...draftFor({ enrollment_id: enrollmentId, grade: null }), ...d[enrollmentId], [field]: value },
    }));
  };

  const saveRow = async (row) => {
    const draft = draftFor(row);
    if (draft.cat_marks === "" || draft.final_exam_marks === "") {
      alert("Both CAT marks and final exam marks are required to save.");
      return;
    }
    setSavingId(row.enrollment_id);
    try {
      await lecturerApi.enterGrades({
        enrollment: row.enrollment_id,
        cat_marks: draft.cat_marks,
        final_exam_marks: draft.final_exam_marks,
      });
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not save marks for this student.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Enter Marks — ${allocation.course_detail?.code}`}
      size="lg"
      showFooter={false}
    >
      {loading ? (
        <LoadingSpinner text="Loading students..." />
      ) : error ? (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--mu-gray-400)" }}>
          <i className="bi bi-journal-bookmark" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
          No students to grade for this unit yet.
        </div>
      ) : (
        <div className="mu-table-wrapper">
          <table className="mu-table mu-table-hover">
            <thead>
              <tr>
                <th>Student</th>
                <th>Type</th>
                <th style={{ width: 110 }}>CAT Marks</th>
                <th style={{ width: 110 }}>Exam Marks</th>
                <th>Status</th>
                <th style={{ width: 90, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = draftFor(row);
                return (
                  <tr key={row.enrollment_id}>
                    <td>
                      <strong>
                        {row.student?.user_detail?.first_name} {row.student?.user_detail?.last_name}
                      </strong>
                      <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                        {row.student?.registration_number}
                      </div>
                    </td>
                    <td>
                      <span className="mu-badge mu-badge-primary">{row.registration_type}</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="mu-input"
                        value={draft.cat_marks}
                        onChange={(e) => setDraft(row.enrollment_id, "cat_marks", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="mu-input"
                        value={draft.final_exam_marks}
                        onChange={(e) => setDraft(row.enrollment_id, "final_exam_marks", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      {row.grade ? (
                        row.grade.is_pass ? (
                          <span className="mu-badge mu-badge-success">{row.grade.letter_grade || "Pass"}</span>
                        ) : row.grade.requires_supplementary ? (
                          <span className="mu-badge mu-badge-warning">Supplementary</span>
                        ) : (
                          <span className="mu-badge mu-badge-danger">{row.grade.letter_grade || "Fail"}</span>
                        )
                      ) : (
                        <span className="mu-badge mu-badge-gray">Ungraded</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="mu-btn mu-btn-sm mu-btn-primary"
                        onClick={() => saveRow(row)}
                        disabled={savingId === row.enrollment_id}
                      >
                        {savingId === row.enrollment_id ? (
                          <i className="bi bi-arrow-repeat mu-animate-spin" />
                        ) : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function MyAllocatedUnits() {
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);
  const [error, setError] = useState("");

  const [yearFilter, setYearFilter] = useState("");
  const [semNumberFilter, setSemNumberFilter] = useState("");

  const [rosterAllocation, setRosterAllocation] = useState(null);
  const [marksAllocation, setMarksAllocation] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await lecturerApi.myAllocations();
        setAllocations(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch (err) {
        console.error("Error fetching allocations:", err);
        setError("Failed to load your allocated units.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const academicYearOptions = useMemo(() => {
    const years = new Set(
      allocations.map((a) => a.semester_detail?.academic_year_detail?.year).filter(Boolean)
    );
    return Array.from(years).sort().reverse();
  }, [allocations]);

  const semesterNumberOptions = useMemo(() => {
    const nums = new Set(
      allocations.map((a) => a.semester_detail?.semester_number).filter((n) => n !== undefined && n !== null)
    );
    return Array.from(nums).sort();
  }, [allocations]);

  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      if (yearFilter && a.semester_detail?.academic_year_detail?.year !== yearFilter) return false;
      if (semNumberFilter && String(a.semester_detail?.semester_number) !== String(semNumberFilter)) return false;
      return true;
    });
  }, [allocations, yearFilter, semNumberFilter]);

  if (loading) {
    return <LoadingSpinner text="Loading your allocated units..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-journal-bookmark" />
            My Allocated Units
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Lecturer <span className="separator">/</span> My Units
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/lecturer/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Allocations Table with Filters Inside */}
      {filteredAllocations.length > 0 ? (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 0 }}>
            <div className="mu-table-wrapper">
              <table className="mu-table">
                <thead>
                  {/* Filter Row */}
                  <tr style={{ background: "var(--mu-gray-50)" }}>
                    <th colSpan={7} style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>
                            <i className="bi bi-calendar3" style={{ marginRight: 4 }} />
                            Year:
                          </span>
                          <select
                            className="mu-select"
                            style={{ width: 120, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                          >
                            <option value="">All</option>
                            {academicYearOptions.map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>
                            <i className="bi bi-layers" style={{ marginRight: 4 }} />
                            Sem:
                          </span>
                          <select
                            className="mu-select"
                            style={{ width: 100, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                            value={semNumberFilter}
                            onChange={(e) => setSemNumberFilter(e.target.value)}
                          >
                            <option value="">All</option>
                            {semesterNumberOptions.map((n) => (
                              <option key={n} value={n}>S{n}</option>
                            ))}
                          </select>
                        </div>

                        {(yearFilter || semNumberFilter) && (
                          <button
                            className="mu-btn mu-btn-secondary"
                            style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                            onClick={() => { setYearFilter(""); setSemNumberFilter(""); }}
                          >
                            <i className="bi bi-arrow-counterclockwise" />
                            Reset
                          </button>
                        )}

                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginLeft: "auto" }}>
                          {filteredAllocations.length} of {allocations.length} unit(s)
                        </span>
                      </div>
                    </th>
                  </tr>
                  {/* Column Headers */}
                  <tr>
                    <th>Course</th>
                    <th>Programme</th>
                    <th>Year/Sem</th>
                    <th>Semester</th>
                    <th style={{ textAlign: "center" }}>Students</th>
                    <th style={{ textAlign: "center" }}>Supplementary</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllocations.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.course_detail?.code}</strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {a.course_detail?.name}
                        </div>
                      </td>
                      <td>{a.programme_detail?.name || a.programme_detail?.code || "—"}</td>
                      <td>
                        <span className="mu-badge mu-badge-primary" style={{ marginRight: 4 }}>
                          Y{a.year}
                        </span>
                        <span className="mu-badge mu-badge-info">
                          S{a.programme_semester}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: "var(--mu-font-size-sm)" }}>
                          <span style={{ color: "var(--mu-gray-500)" }}>
                            {a.semester_detail?.academic_year_detail?.year || "N/A"}
                          </span>
                          <br />
                          <span className="mu-badge mu-badge-gray">
                            S{a.semester_detail?.semester_number}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-success">
                          <i className="bi bi-people" style={{ marginRight: 4 }} />
                          {a.student_count || 0}
                        </span>
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
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button
                            className="mu-btn mu-btn-sm mu-btn-primary"
                            onClick={() => setMarksAllocation(a)}
                          >
                            <i className="bi bi-pencil-square" />
                            Marks
                          </button>
                          <button
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            onClick={() => setRosterAllocation(a)}
                          >
                            <i className="bi bi-people" />
                            Roster
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {filteredAllocations.length} unit(s)
              {filteredAllocations.length !== allocations.length && ` (of ${allocations.length})`}
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
      ) : (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 48, textAlign: "center" }}>
            <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-gray-400)" }} />
            <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>
              {allocations.length === 0 ? "No Allocated Units" : "No Units Match Your Filters"}
            </h3>
            <p style={{ margin: "8px 0 16px", color: "var(--mu-gray-400)" }}>
              {allocations.length === 0
                ? "You have no units allocated for this semester."
                : "Try resetting the academic year / semester filters."}
            </p>
            <Link to="/lecturer/dashboard" className="mu-btn mu-btn-primary">
              <i className="bi bi-arrow-left" style={{ marginRight: 8 }} />
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}

      {rosterAllocation && (
        <RosterModal allocation={rosterAllocation} onClose={() => setRosterAllocation(null)} />
      )}
      {marksAllocation && (
        <MarksModal allocation={marksAllocation} onClose={() => setMarksAllocation(null)} />
      )}
    </div>
  );
}