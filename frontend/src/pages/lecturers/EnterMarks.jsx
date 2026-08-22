import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { lecturerApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function EnterMarks() {
  const { allocationId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);
  const [rows, setRows] = useState([]);
  const [marksInput, setMarksInput] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // No allocation selected yet -> show a picker.
  useEffect(() => {
    if (allocationId) return;
    const fetchAllocations = async () => {
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
    fetchAllocations();
  }, [allocationId]);

  const loadSheet = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await lecturerApi.gradingSheet(allocationId);
      const sheet = Array.isArray(res.data) ? res.data : [];
      setRows(sheet);

      const initialInputs = {};
      sheet.forEach((row) => {
        initialInputs[row.enrollment_id] = {
          cat_marks: row.grade?.cat_marks ?? "",
          final_exam_marks: row.grade?.final_exam_marks ?? "",
        };
      });
      setMarksInput(initialInputs);
    } catch (err) {
      console.error("Error fetching grading sheet:", err);
      setError("Failed to load grading sheet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allocationId) loadSheet();
  }, [allocationId]);

  const handleInputChange = (enrollmentId, field, value) => {
    setMarksInput((prev) => ({
      ...prev,
      [enrollmentId]: { ...prev[enrollmentId], [field]: value },
    }));
  };

  const handleSave = async (row) => {
    const input = marksInput[row.enrollment_id];
    if (input.cat_marks === "" || input.final_exam_marks === "") {
      setError(`Enter both CAT and exam marks for ${row.student.user_detail?.first_name}.`);
      return;
    }
    setSavingId(row.enrollment_id);
    setError("");
    setSuccess("");
    try {
      await lecturerApi.enterGrades({
        enrollment: row.enrollment_id,
        cat_marks: input.cat_marks,
        final_exam_marks: input.final_exam_marks,
      });
      setSuccess(`Saved marks for ${row.student.user_detail?.first_name} ${row.student.user_detail?.last_name}.`);
      await loadSheet();
    } catch (err) {
      console.error("Error saving marks:", err);
      setError(err.response?.data?.detail || "Failed to save marks.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading..." />;
  }

  // Picker view: no allocation chosen yet.
  if (!allocationId) {
    return (
      <div>
        {/* Page Header */}
        <div className="mu-page-header">
          <div>
            <h1>
              <i className="bi bi-check2-circle" />
              Enter Marks
            </h1>
            <div className="mu-breadcrumb">
              Home <span className="separator">/</span> Lecturer <span className="separator">/</span> Enter Marks
            </div>
          </div>
        </div>

        {error && (
          <div className="mu-alert mu-alert-danger">
            <i className="bi bi-exclamation-triangle" />
            {error}
          </div>
        )}

        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Select a Unit</h4>
            <span className="mu-badge mu-badge-primary">
              {allocations.length} Units
            </span>
          </div>
          <div className="mu-card-body">
            {allocations.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {allocations.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/lecturer/enter-marks/${a.id}`)}
                    className="mu-btn mu-btn-outline-primary"
                    style={{ justifyContent: "flex-start", padding: "12px 16px", height: "auto" }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 600 }}>
                        {a.course_detail?.code} - {a.course_detail?.name}
                      </div>
                      <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                        Year {a.year} / Semester {a.programme_semester} • {a.programme}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-inbox" style={{ fontSize: 36, display: "block", marginBottom: 12 }} />
                <p style={{ margin: 0 }}>You have no allocated units.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-check2-circle" />
            Enter Marks
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Lecturer <span className="separator">/</span> Enter Marks
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/lecturer/enter-marks" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Change Unit
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
      {success && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {success}
        </div>
      )}

      {/* Grading Sheet */}
      {rows.length > 0 ? (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Grading Sheet</h4>
            <span className="mu-badge mu-badge-primary">
              {rows.length} Students
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Reg No.</th>
                    <th>Student Name</th>
                    <th>Type</th>
                    <th>CAT Marks</th>
                    <th>Exam Marks</th>
                    <th>Current Grade</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.enrollment_id}>
                      <td>
                        <strong>{row.student.registration_number}</strong>
                      </td>
                      <td>
                        {row.student.user_detail?.first_name} {row.student.user_detail?.last_name}
                      </td>
                      <td>
                        <span className={`mu-badge ${
                          row.registration_type === "supplementary" 
                            ? "mu-badge-warning" 
                            : row.registration_type === "repeat" 
                            ? "mu-badge-danger" 
                            : "mu-badge-primary"
                        }`}>
                          {row.registration_type || "Normal"}
                        </span>
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="mu-input"
                          style={{ width: 100 }}
                          value={marksInput[row.enrollment_id]?.cat_marks ?? ""}
                          onChange={(e) => handleInputChange(row.enrollment_id, "cat_marks", e.target.value)}
                          placeholder="CAT"
                        />
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="mu-input"
                          style={{ width: 100 }}
                          value={marksInput[row.enrollment_id]?.final_exam_marks ?? ""}
                          onChange={(e) => handleInputChange(row.enrollment_id, "final_exam_marks", e.target.value)}
                          placeholder="Exam"
                        />
                      </td>
                      <td>
                        {row.grade?.letter_grade ? (
                          <span className="mu-badge mu-badge-primary">
                            {row.grade.letter_grade}
                          </span>
                        ) : (
                          <span style={{ color: "var(--mu-gray-400)", fontSize: "var(--mu-font-size-sm)" }}>
                            Not graded
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => handleSave(row)}
                          disabled={savingId === row.enrollment_id}
                          className={`mu-btn mu-btn-sm ${
                            savingId === row.enrollment_id ? "mu-btn-secondary" : "mu-btn-primary"
                          }`}
                        >
                          {savingId === row.enrollment_id ? (
                            <>
                              <i className="bi bi-arrow-repeat mu-animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-save" />
                              Save
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-people" style={{ marginRight: 4 }} />
              Total: {rows.length} student(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Enter marks and click Save for each student
            </span>
          </div>
        </div>
      ) : (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 48, textAlign: "center" }}>
            <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-gray-400)" }} />
            <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Students Enrolled</h3>
            <p style={{ margin: "8px 0 0", color: "var(--mu-gray-400)" }}>
              No students are enrolled for this unit.
            </p>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Link to="/lecturer/dashboard" className="mu-btn mu-btn-secondary">
          <i className="bi bi-arrow-left" style={{ marginRight: 8 }} />
          Back to Dashboard
        </Link>
        <Link to="/lecturer/enter-marks" className="mu-btn mu-btn-outline-primary">
          <i className="bi bi-arrow-left" style={{ marginRight: 8 }} />
          Change Unit
        </Link>
      </div>
    </div>
  );
}