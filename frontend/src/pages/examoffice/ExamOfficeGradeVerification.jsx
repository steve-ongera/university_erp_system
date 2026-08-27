import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { examOfficeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function ExamOfficeGradeVerification() {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    examOfficeApi
      .pendingGradeVerification()
      .then((res) => setGrades(res.data.results || res.data))
      .catch(() => setError("Could not load pending grade verifications."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const verify = async (id) => {
    setBusyId(id);
    try {
      await examOfficeApi.verifyGrade(id);
      load();
    } catch {
      setError("Could not verify this grade.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading pending verifications..." />;
  }

  // Calculate stats
  const stats = {
    total: grades.length,
    pending: grades.filter(g => !g.verified).length,
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-check2-circle" />
            Grade Verification Queue
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Exam Office <span className="separator">/</span> Grade Verification
          </div>
        </div>
        <div className="mu-page-header-actions">
          
          <button className="mu-btn mu-btn-outline-primary" onClick={load}>
            <i className="bi bi-arrow-repeat" />
            Refresh
          </button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          Entered-but-unverified grades, institution-wide.
          {grades.length > 0 && (
            <span className="mu-badge mu-badge-warning" style={{ marginLeft: 8 }}>
              {grades.length} pending
            </span>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="mu-dashboard-grid" style={{ marginBottom: 24, gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-clock" />
          </div>
          <div className="mu-stat-label">Pending Verification</div>
          <div className="mu-stat-value">{stats.total}</div>
          {stats.total > 0 && (
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
            {stats.total === 0 ? (
              <span className="mu-badge mu-badge-success">
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                All Caught Up
              </span>
            ) : (
              <span className="mu-badge mu-badge-warning">
                <i className="bi bi-clock" style={{ marginRight: 4 }} />
                {stats.total} Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Grades Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-list-check" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Pending Grades
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
              <p style={{ margin: "8px 0 0" }}>All grades have been verified.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th style={{ textAlign: "center" }}>CAT</th>
                    <th style={{ textAlign: "center" }}>Exam</th>
                    <th style={{ textAlign: "center" }}>Total</th>
                    <th>Grade</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <strong>
                          {g.enrollment_detail?.student_detail?.user_detail?.first_name}{" "}
                          {g.enrollment_detail?.student_detail?.user_detail?.last_name}
                        </strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {g.enrollment_detail?.student_detail?.registration_number}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {g.enrollment_detail?.course_detail?.code}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-info">
                          {g.cat_marks ?? "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-info">
                          {g.final_exam_marks ?? "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-primary" style={{ fontWeight: 700 }}>
                          {g.total_marks ?? "—"}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {g.letter_grade || "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="mu-btn mu-btn-sm mu-btn-success"
                          onClick={() => verify(g.id)}
                          disabled={busyId === g.id}
                        >
                          {busyId === g.id ? (
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
            <span style={{ fontSize: "var(--mu-font-size-sm", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}