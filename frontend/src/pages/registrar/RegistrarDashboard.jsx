import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { registrarApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function RegistrarDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    registrarApi
      .dashboard()
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load the registrar dashboard."))
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

  const { stats, recent_deferments, recent_clearances } = data;

  const statCards = [
    { label: "Total Students", value: stats.total_students, icon: "bi-people", color: "blue" },
    { label: "Active Students", value: stats.active_students, icon: "bi-person-check", color: "green" },
    { label: "Deferred Students", value: stats.deferred_students, icon: "bi-pause-circle", color: "gold" },
    { label: "Graduated Students", value: stats.graduated_students, icon: "bi-award", color: "blue" },
    { label: "Pending Deferments", value: stats.pending_deferments, icon: "bi-clock", color: "gold" },
    { label: "Pending Clearances", value: stats.pending_clearances, icon: "bi-patch-check", color: "red" },
    { label: "Pending Reportings", value: stats.pending_reportings, icon: "bi-clipboard-check", color: "blue" },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-speedometer2" />
            Registrar Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Registrar <span className="separator">/</span> Dashboard
          </div>
        </div>
        
      </div>

      {/* Stats Grid - 7 Cards */}
      <div className="mu-dashboard-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
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

      {/* Two Column Layout - Recent Deferments & Recent Clearances */}
      <div className="mu-dashboard-grid-2" style={{ marginTop: 24 }}>
        {/* Recent Pending Deferments */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-pause-circle" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
              Recent Pending Deferments
            </h4>
            <span className="mu-badge mu-badge-warning">
              {recent_deferments?.length || 0} Pending
            </span>
          </div>
          <div className="mu-card-body">
            {recent_deferments?.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>
                <i className="bi bi-check-circle" style={{ fontSize: 32, display: "block", marginBottom: 8, color: "var(--mu-success)" }} />
                <p style={{ margin: 0 }}>No pending deferments.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recent_deferments.map((d) => (
                  <div
                    key={d.id}
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
                        {d.student_name}
                      </div>
                      <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                        <span style={{ marginRight: 8 }}>Reg: {d.student}</span>
                        <span className="mu-badge mu-badge-gray" style={{ fontSize: "0.6rem" }}>
                          {d.reason}
                        </span>
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
                        <span style={{ marginRight: 8 }}>Reg: {c.student}</span>
                        <span className="mu-badge mu-badge-primary" style={{ fontSize: "0.6rem" }}>
                          {c.clearance_type}
                        </span>
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