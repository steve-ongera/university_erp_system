import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deanApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function DeanDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    deanApi
      .dashboard()
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          setError(err.response.data?.detail || "You are not assigned as dean of any faculty.");
        } else {
          setError("Could not load the dean dashboard.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="mu-alert mu-alert-danger">
        <i className="bi bi-exclamation-triangle" />
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { faculty, stats, department_stats, recent_clearances } = data;

  const statCards = [
    { label: "Departments", value: stats.total_departments, icon: "bi-diagram-3", color: "blue" },
    { label: "Lecturers", value: stats.total_lecturers, icon: "bi-person-video3", color: "red" },
    { label: "Total Students", value: stats.total_students, icon: "bi-people", color: "blue" },
    { label: "Active Students", value: stats.active_students, icon: "bi-person-check", color: "green" },
    { label: "Pending Clearances", value: stats.pending_clearances, icon: "bi-patch-check", color: "gold" },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-speedometer2" />
            Dean Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Dean <span className="separator">/</span> Dashboard
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Faculty Info */}
      {faculty && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "var(--mu-gray-900)" }}>
                  <i className="bi bi-building" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
                  {faculty.name}
                </h3>
                <p style={{ margin: "4px 0 0", color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)" }}>
                  <span className="mu-badge mu-badge-primary">{faculty.code}</span>
                  <span className="mu-badge mu-badge-info" style={{ marginLeft: 8 }}>
                    <i className="bi bi-calendar3" style={{ marginRight: 4 }} />
                    {new Date().toLocaleDateString()}
                  </span>
                </p>
              </div>
              <div>
                <span className="mu-badge mu-badge-success">
                  <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - 5 Cards */}
      <div className="mu-dashboard-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {statCards.map((c) => (
          <div className="mu-stat-card" key={c.label}>
            <div className={`mu-stat-icon ${c.color}`}>
              <i className={`bi ${c.icon}`} />
            </div>
            <div className="mu-stat-label">{c.label}</div>
            <div className="mu-stat-value">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Two Column Layout - Departments & Recent Clearances */}
      <div className="mu-dashboard-grid-2" style={{ marginTop: 24 }}>
        {/* Departments Table */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-diagram-3" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
              Departments
            </h4>
            <span className="mu-badge mu-badge-primary">
              {department_stats?.length || 0} Department(s)
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {department_stats?.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-diagram-3" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                <p style={{ margin: 0 }}>No departments found.</p>
              </div>
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>HoD</th>
                      <th style={{ textAlign: "center" }}>Students</th>
                      <th style={{ textAlign: "center" }}>Lecturers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {department_stats.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.name}</strong>
                          <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                            {d.code}
                          </div>
                        </td>
                        <td>{d.head_of_department || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-people" style={{ marginRight: 4 }} />
                            {d.student_count || 0}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="mu-badge mu-badge-info">
                            <i className="bi bi-person-video3" style={{ marginRight: 4 }} />
                            {d.lecturer_count || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Pending Clearances */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-patch-check" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
              Recent Pending Clearances
            </h4>
            <span className="mu-badge mu-badge-warning">
              {recent_clearances?.length || 0} Pending
            </span>
          </div>
          <div className="mu-card-body">
            {recent_clearances?.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>
                <i className="bi bi-check-circle" style={{ fontSize: 32, display: "block", marginBottom: 8, color: "var(--mu-success)" }} />
                <p style={{ margin: 0 }}>No pending clearances.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recent_clearances.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      border: "1px solid var(--mu-border)",
                      borderRadius: "var(--mu-radius-sm)",
                      background: "var(--mu-white)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "var(--mu-font-size-sm)" }}>
                        {c.student_name}
                      </div>
                      <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                        <span className="mu-badge mu-badge-primary" style={{ fontSize: "0.6rem" }}>
                          {c.clearance_type}
                        </span>
                        <span style={{ marginLeft: 8 }}>Reg: {c.student}</span>
                      </div>
                    </div>
                    <span className="mu-badge mu-badge-warning" style={{ fontSize: "0.6rem" }}>
                      <i className="bi bi-clock" style={{ marginRight: 4 }} />
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}