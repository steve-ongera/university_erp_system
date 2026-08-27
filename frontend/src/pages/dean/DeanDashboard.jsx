import { useEffect, useState } from "react";
import { deanApi } from "../../services/api";

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

  if (loading) return <DashboardLoader />;
  if (error) return <DashboardError message={error} />;

  const { faculty, stats, departments } = data;

  return (
    <div className="mu-page">
      <h2>{faculty.name} — Dean Dashboard</h2>

      <div className="mu-stat-grid">
        <StatCard label="Departments" value={stats.departments} icon="bi-diagram-3" />
        <StatCard label="Programmes" value={stats.programmes} icon="bi-mortarboard" />
        <StatCard label="Students" value={stats.students} icon="bi-people" />
        <StatCard label="Active Students" value={stats.active_students} icon="bi-person-check" />
        <StatCard label="Lecturers" value={stats.lecturers} icon="bi-person-video3" />
        <StatCard label="Pending Clearances" value={stats.pending_clearances} icon="bi-patch-check" />
      </div>

      <div className="mu-card">
        <h3>Departments</h3>
        <table className="mu-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Head of Department</th>
              <th>Students</th>
              <th>Programmes</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id}>
                <td>{dept.code}</td>
                <td>{dept.name}</td>
                <td>{dept.head_of_department || "—"}</td>
                <td>{dept.student_count}</td>
                <td>{dept.programme_count}</td>
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