import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { codApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function CodVerifyMarks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [grades, setGrades] = useState([]);
  const [verifyingId, setVerifyingId] = useState(null);

  const loadPending = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await codApi.gradesPendingVerification();
      setGrades(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching pending grades:", err);
      setError(err.response?.data?.detail || "Failed to load pending marks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleVerify = async (gradeId) => {
    setVerifyingId(gradeId);
    setError("");
    setSuccess("");
    try {
      await codApi.verifyGrade(gradeId);
      setSuccess("Grade verified successfully.");
      setGrades((prev) => prev.filter((g) => g.id !== gradeId));
    } catch (err) {
      console.error("Error verifying grade:", err);
      setError(err.response?.data?.detail || "Failed to verify this grade.");
    } finally {
      setVerifyingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading pending marks..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-check2-circle" />
            Verify Entered Marks
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> COD <span className="separator">/</span> Verify Marks
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/cod/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
          <button className="mu-btn mu-btn-outline-primary" onClick={loadPending}>
            <i className="bi bi-arrow-repeat" />
            Refresh
          </button>
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

      {/* Stats Summary */}
      <div className="mu-dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-clock" />
          </div>
          <div className="mu-stat-label">Pending Verification</div>
          <div className="mu-stat-value">{grades.length}</div>
          {grades.length > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-warning)" }}>
              <i className="bi bi-exclamation-triangle" />
              Awaiting review
            </div>
          )}
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Status</div>
          <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-base)" }}>
            {grades.length === 0 ? (
              <span className="mu-badge mu-badge-success">
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                All Caught Up
              </span>
            ) : (
              <span className="mu-badge mu-badge-warning">
                <i className="bi bi-clock" style={{ marginRight: 4 }} />
                {grades.length} Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grades Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-list-check" style={{ marginRight: 8 }} />
            Pending Verification
          </h4>
          <span className="mu-badge mu-badge-primary">
            {grades.length} Grade(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {grades.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-check-circle" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-success)" }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>Nothing to Verify</h3>
              <p style={{ margin: "8px 0 0" }}>You're all caught up — no grades pending verification.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Reg. Number</th>
                    <th>Course</th>
                    <th>Semester</th>
                    <th style={{ textAlign: "center" }}>CAT</th>
                    <th style={{ textAlign: "center" }}>Exam</th>
                    <th style={{ textAlign: "center" }}>Total</th>
                    <th>Grade</th>
                    <th style={{ textAlign: "center" }}>Points</th>
                    <th>Status</th>
                    <th>Entered By</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade) => (
                    <tr key={grade.id}>
                      <td>
                        <strong>{grade.enrollment_detail?.student_detail?.registration_number || "N/A"}</strong>
                      </td>
                      <td>
                        <div>{grade.enrollment_detail?.course_detail?.code}</div>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {grade.enrollment_detail?.course_detail?.name}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {grade.enrollment_detail?.semester_detail?.academic_year_detail?.year} S
                          {grade.enrollment_detail?.semester_detail?.semester_number}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-primary">{grade.cat_marks || "N/A"}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-primary">{grade.final_exam_marks || "N/A"}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-info" style={{ fontWeight: 700 }}>
                          {grade.total_marks || "N/A"}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {grade.letter_grade || "N/A"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-gray">
                          {grade.grade_points || "N/A"}
                        </span>
                      </td>
                      <td>
                        {grade.is_pass ? (
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Pass
                          </span>
                        ) : grade.requires_supplementary ? (
                          <span className="mu-badge mu-badge-warning">
                            <i className="bi bi-arrow-repeat" style={{ marginRight: 4 }} />
                            Supplementary
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-danger">
                            <i className="bi bi-x-circle" style={{ marginRight: 4 }} />
                            Fail
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {grade.entered_by || "N/A"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="mu-btn mu-btn-sm mu-btn-primary"
                          onClick={() => handleVerify(grade.id)}
                          disabled={verifyingId === grade.id}
                        >
                          {verifyingId === grade.id ? (
                            <>
                              <i className="bi bi-arrow-repeat mu-animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-check2" />
                              Verify
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {grades.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {grades.length} grade(s) pending verification
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}