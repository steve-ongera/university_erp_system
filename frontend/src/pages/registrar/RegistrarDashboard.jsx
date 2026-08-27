import { useEffect, useState } from "react";
import { registrarApi } from "../../services/api";

export default function RegistrarDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registrarApi
      .dashboard()
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardLoader />;
  if (error) return <DashboardError message={error} />;

  const { stats, recent_admissions } = data;

  return (
    <div className="mu-page">
      <h2>Registrar Dashboard</h2>

      <div className="mu-stat-grid">
        <StatCard label="Total Students" value={stats.total_students} icon="bi-people" />
        <StatCard label="Active" value={stats.active_students} icon="bi-person-check" />
        <StatCard label="Graduated" value={stats.graduated_students} icon="bi-mortarboard" />
        <StatCard label="Deferred" value={stats.deferred_students} icon="bi-pause-circle" />
        <StatCard label="Pending Deferments" value={stats.pending_deferments} icon="bi-hourglass-split" />
        <StatCard label="Pending Reportings" value={stats.pending_reportings} icon="bi-clipboard-check" />
        <StatCard label="Pending Clearances" value={stats.pending_clearances} icon="bi-patch-check" />
      </div>

      <div className="mu-card">
        <h3>Recent Admissions</h3>
        <table className="mu-table">
          <thead>
            <tr>
              <th>Reg. No.</th>
              <th>Name</th>
              <th>Programme</th>
              <th>Admission Date</th>
            </tr>
          </thead>
          <tbody>
            {recent_admissions.map((row) => (
              <tr key={row.id}>
                <td>{row.registration_number}</td>
                <td>{row.full_name}</td>
                <td>{row.programme}</td>
                <td>{row.admission_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="mu-stat-card">
      <i className={`bi ${icon}`} />
      <div>
        <div className="mu-stat-value">{value}</div>
        <div className="mu-stat-label">{label}</div>
      </div>
    </div>
  );
}

function DashboardLoader() {
  return (
    <div className="mu-page-loader">
      <i className="bi bi-arrow-repeat mu-animate-spin" /> Loading dashboard...
    </div>
  );
}

function DashboardError({ message }) {
  return (
    <div className="mu-alert mu-alert-danger">
      <i className="bi bi-exclamation-triangle" /> {message}
    </div>
  );
}