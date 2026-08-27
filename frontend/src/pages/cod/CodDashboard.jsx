import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { codApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function CodDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await codApi.dashboard();
        setData(res.data);
      } catch (err) {
        console.error("Error loading COD dashboard:", err);
        setError(err.response?.data?.detail || "Failed to load department dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner text="Loading department dashboard..." />;

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-speedometer2" />
            COD Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> COD <span className="separator">/</span> Dashboard
          </div>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
            <i className="bi bi-building" />
            <div>
              <strong>{data.department.name}</strong> ({data.department.code})
            </div>
          </div>

          <div className="mu-dashboard-grid" style={{ marginBottom: 24 }}>
            <div className="mu-stat-card">
              <div className="mu-stat-icon blue"><i className="bi bi-people" /></div>
              <div className="mu-stat-label">Total Students</div>
              <div className="mu-stat-value">{data.stats.total_students}</div>
            </div>
            <div className="mu-stat-card">
              <div className="mu-stat-icon green"><i className="bi bi-person-check" /></div>
              <div className="mu-stat-label">Active Students</div>
              <div className="mu-stat-value">{data.stats.active_students}</div>
            </div>
            <div className="mu-stat-card">
              <div className="mu-stat-icon gold"><i className="bi bi-person-badge" /></div>
              <div className="mu-stat-label">Lecturers</div>
              <div className="mu-stat-value">{data.stats.total_lecturers}</div>
            </div>
            <div className="mu-stat-card">
              <div className="mu-stat-icon red"><i className="bi bi-journal-bookmark" /></div>
              <div className="mu-stat-label">Courses</div>
              <div className="mu-stat-value">{data.stats.total_courses}</div>
            </div>
          </div>

          <div className="mu-dashboard-grid" style={{ marginBottom: 24 }}>
            <div className="mu-stat-card">
              <div className="mu-stat-icon blue"><i className="bi bi-graph-up" /></div>
              <div className="mu-stat-label">Pass Rate</div>
              <div className="mu-stat-value">
                {data.stats.pass_rate !== null ? `${data.stats.pass_rate}%` : "N/A"}
              </div>
            </div>
            <div className="mu-stat-card">
              <div className="mu-stat-icon gold"><i className="bi bi-hourglass-split" /></div>
              <div className="mu-stat-label">Pending Verification</div>
              <div className="mu-stat-value">{data.stats.pending_verification}</div>
            </div>
          </div>

          {data.stats.pending_verification > 0 && (
            <div className="mu-alert mu-alert-warning" style={{ marginBottom: 24 }}>
              <i className="bi bi-exclamation-circle" />
              <div>
                You have <strong>{data.stats.pending_verification}</strong> entered grade(s) awaiting
                your verification.{" "}
                <Link to="/cod/verify-marks" className="mu-link">Review now</Link>
              </div>
            </div>
          )}

          <div className="mu-card">
            <div className="mu-card-header">
              <h4>Students by Programme</h4>
            </div>
            <div className="mu-card-body" style={{ padding: 0 }}>
              {data.students_by_programme.length > 0 ? (
                <div className="mu-table-wrapper">
                  <table className="mu-table">
                    <thead>
                      <tr>
                        <th>Programme</th>
                        <th>Code</th>
                        <th>Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.students_by_programme.map((row, i) => (
                        <tr key={i}>
                          <td>{row.programme__name}</td>
                          <td>{row.programme__code}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                  No students in this department yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}