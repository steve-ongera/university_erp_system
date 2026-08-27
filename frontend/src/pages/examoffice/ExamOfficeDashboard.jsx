import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { examOfficeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function ExamOfficeDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    examOfficeApi
      .dashboard()
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load the exam office dashboard."))
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

  const { stats, upcoming_exams } = data;

  const statCards = [
    { label: "Upcoming Exams", value: stats.upcoming_exams, icon: "bi-calendar-event", color: "blue" },
    { label: "Unpublished Exams", value: stats.unpublished_exams, icon: "bi-eye-slash", color: "gold" },
    { label: "Pending Grade Verifications", value: stats.pending_grade_verifications, icon: "bi-clock", color: "gold" },
    { label: "Outstanding Supplementary", value: stats.outstanding_supplementary, icon: "bi-arrow-repeat", color: "red" },
    { label: "Unpaid Supp. Invoices", value: stats.unpaid_supplementary_invoices, icon: "bi-cash-coin", color: "red" },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-clipboard-check" />
            Examinations Office Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Exam Office <span className="separator">/</span> Dashboard
          </div>
        </div>
        
      </div>

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

      {/* Upcoming Exams Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-calendar-event" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Upcoming Published Exams
          </h4>
          <span className="mu-badge mu-badge-primary">
            {upcoming_exams?.length || 0} Exam(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {upcoming_exams?.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-calendar-event" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Upcoming Exams</h3>
              <p style={{ margin: "8px 0 0" }}>There are no upcoming published exams.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Venue</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming_exams.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.course}</strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {e.course_name}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {e.exam_type}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {e.exam_date}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {e.start_time}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-gray">
                          <i className="bi bi-geo-alt" style={{ marginRight: 4 }} />
                          {e.venue || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {upcoming_exams?.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {upcoming_exams.length} exam(s)
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