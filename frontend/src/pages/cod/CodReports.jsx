import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { codApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function CodReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await codApi.reports();
        setData(res.data);
      } catch (err) {
        console.error("Error fetching department reports:", err);
        setError(err.response?.data?.detail || "Failed to load reports.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading reports..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-bar-chart" />
            Academic Reports
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> COD <span className="separator">/</span> Reports
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/cod/dashboard" className="mu-btn mu-btn-outline-primary">
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

      {/* Department Info */}
      {data && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "var(--mu-gray-900)" }}>
                  {data.department?.name || "Department"}
                </h3>
                <p style={{ margin: "4px 0 0", color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)" }}>
                  <span className="mu-badge mu-badge-primary">{data.department?.code || "N/A"}</span>
                </p>
              </div>
              <div>
                <span className="mu-badge mu-badge-info">
                  <i className="bi bi-calendar3" style={{ marginRight: 4 }} />
                  {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {data && (
        <div className="mu-dashboard-grid" style={{ marginBottom: 24 }}>
          <div className="mu-stat-card">
            <div className="mu-stat-icon blue">
              <i className="bi bi-people" />
            </div>
            <div className="mu-stat-label">Total Students</div>
            <div className="mu-stat-value">{data.stats?.total_students || 0}</div>
          </div>
          <div className="mu-stat-card">
            <div className="mu-stat-icon green">
              <i className="bi bi-person-check" />
            </div>
            <div className="mu-stat-label">Active Students</div>
            <div className="mu-stat-value">{data.stats?.active_students || 0}</div>
          </div>
          <div className="mu-stat-card">
            <div className="mu-stat-icon gold">
              <i className="bi bi-person-badge" />
            </div>
            <div className="mu-stat-label">Total Lecturers</div>
            <div className="mu-stat-value">{data.stats?.total_lecturers || 0}</div>
          </div>
          <div className="mu-stat-card">
            <div className="mu-stat-icon red">
              <i className="bi bi-journal-bookmark" />
            </div>
            <div className="mu-stat-label">Total Courses</div>
            <div className="mu-stat-value">{data.stats?.total_courses || 0}</div>
          </div>
          <div className="mu-stat-card">
            <div className="mu-stat-icon blue">
              <i className="bi bi-award" />
            </div>
            <div className="mu-stat-label">Graded Units</div>
            <div className="mu-stat-value">{data.stats?.graded_units || 0}</div>
          </div>
          <div className="mu-stat-card">
            <div className="mu-stat-icon green">
              <i className="bi bi-graph-up" />
            </div>
            <div className="mu-stat-label">Pass Rate</div>
            <div className="mu-stat-value">{data.stats?.pass_rate !== null ? `${data.stats.pass_rate}%` : "N/A"}</div>
          </div>
          <div className="mu-stat-card">
            <div className="mu-stat-icon gold">
              <i className="bi bi-clock" />
            </div>
            <div className="mu-stat-label">Pending Verification</div>
            <div className="mu-stat-value">{data.stats?.pending_verification || 0}</div>
          </div>
        </div>
      )}

      {/* Grade Distribution */}
      {data && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-pie-chart" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
              Grade Distribution
            </h4>
            <span className="mu-badge mu-badge-primary">
              {data.grade_distribution?.length || 0} Grades
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {data.grade_distribution?.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                <p style={{ margin: 0 }}>No published grades yet.</p>
              </div>
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Letter Grade</th>
                      <th style={{ textAlign: "center" }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.grade_distribution.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <span className="mu-badge mu-badge-primary">
                            {row.letter_grade || "N/A"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="mu-badge mu-badge-info">{row.count}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Students by Programme */}
      {data && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-mortarboard" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
              Students by Programme
            </h4>
            <span className="mu-badge mu-badge-primary">
              {data.students_by_programme?.length || 0} Programmes
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {data.students_by_programme?.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-people" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                <p style={{ margin: 0 }}>No students in this department yet.</p>
              </div>
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Programme</th>
                      <th>Code</th>
                      <th style={{ textAlign: "center" }}>Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students_by_programme.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{row.programme__name}</strong>
                        </td>
                        <td>
                          <span className="mu-badge mu-badge-primary">{row.programme__code}</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-people" style={{ marginRight: 4 }} />
                            {row.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {data.students_by_programme?.length > 0 && (
            <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                Total: {data.students_by_programme.reduce((sum, row) => sum + row.count, 0)} students
              </span>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
                Last updated: {new Date().toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}