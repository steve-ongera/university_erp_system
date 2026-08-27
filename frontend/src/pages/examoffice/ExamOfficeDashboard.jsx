import { useEffect, useState } from "react";
import { examOfficeApi } from "../../services/api";

export default function ExamOfficeDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    examOfficeApi
      .dashboard()
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardLoader />;
  if (error) return <DashboardError message={error} />;

  const { stats, upcoming_exams } = data;

  return (
    <div className="mu-page">
      <h2>Examinations Office Dashboard</h2>

      <div className="mu-stat-grid">
        <StatCard label="Upcoming Exams" value={stats.upcoming_exams} icon="bi-calendar-event" />
        <StatCard label="Unpublished Exams" value={stats.unpublished_exams} icon="bi-eye-slash" />
        <StatCard
          label="Pending Grade Verifications"
          value={stats.pending_grade_verifications}
          icon="bi-patch-question"
        />
        <StatCard
          label="Outstanding Supplementary Regs."
          value={stats.outstanding_supplementary_registrations}
          icon="bi-arrow-repeat"
        />
      </div>

      <div className="mu-card">
        <h3>Upcoming Examinations</h3>
        <table className="mu-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Type</th>
              <th>Date</th>
              <th>Time</th>
              <th>Venue</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {upcoming_exams.map((exam) => (
              <tr key={exam.id}>
                <td>{exam.course}</td>
                <td>{exam.exam_type}</td>
                <td>{exam.exam_date}</td>
                <td>{exam.start_time}</td>
                <td>{exam.venue || "—"}</td>
                <td>{exam.is_published ? "Yes" : "No"}</td>
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