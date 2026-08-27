import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deanApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function DeanDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deanApi
      .dashboard()
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load dashboard."))
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

  const { faculty, stats, departments } = data || {};

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

      {/* Stats Grid */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-diagram-3" />
          </div>
          <div className="mu-stat-label">Departments</div>
          <div className="mu-stat-value">{stats?.departments || 0}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-mortarboard" />
          </div>
          <div className="mu-stat-label">Programmes</div>
          <div className="mu-stat-value">{stats?.programmes || 0}</div>
        </div>
      
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-person-check" />
          </div>
          <div className="mu-stat-label">Active Students</div>
          <div className="mu-stat-value">{stats?.active_students || 0}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-person-video3" />
          </div>
          <div className="mu-stat-label">Lecturers</div>
          <div className="mu-stat-value">{stats?.lecturers || 0}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-patch-check" />
          </div>
          <div className="mu-stat-label">Pending Clearances</div>
          <div className="mu-stat-value">{stats?.pending_clearances || 0}</div>
          {stats?.pending_clearances > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-warning)" }}>
              <i className="bi bi-exclamation-triangle" />
              Requires attention
            </div>
          )}
        </div>
      </div>

      {/* Departments Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-diagram-3" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Departments
          </h4>
          <span className="mu-badge mu-badge-primary">
            {departments?.length || 0} Department(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {departments?.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-diagram-3" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Departments</h3>
              <p style={{ margin: "8px 0 0" }}>No departments found in this faculty.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Head of Department</th>
                    <th style={{ textAlign: "center" }}>Students</th>
                    <th style={{ textAlign: "center" }}>Programmes</th>
                  </tr>
                </thead>
                <tbody>
                  {departments?.map((dept) => (
                    <tr key={dept.id}>
                      <td>
                        <span className="mu-badge mu-badge-primary">{dept.code}</span>
                      </td>
                      <td>
                        <strong>{dept.name}</strong>
                      </td>
                      <td>
                        {dept.head_of_department ? (
                          <span style={{ fontWeight: 500 }}>{dept.head_of_department}</span>
                        ) : (
                          <span className="mu-badge mu-badge-gray">Not Assigned</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-success">
                          <i className="bi bi-people" style={{ marginRight: 4 }} />
                          {dept.student_count || 0}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-info">
                          <i className="bi bi-mortarboard" style={{ marginRight: 4 }} />
                          {dept.programme_count || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {departments?.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {departments.length} department(s)
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