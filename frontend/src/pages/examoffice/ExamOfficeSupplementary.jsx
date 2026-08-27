import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { examOfficeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function ExamOfficeSupplementary() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paidFilter, setPaidFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    examOfficeApi
      .supplementaryRegistrations()
      .then((res) => setRegistrations(res.data.results || res.data))
      .catch(() => setError("Could not load supplementary registrations."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = registrations.filter((r) => {
    if (paidFilter === "paid") return r.is_paid;
    if (paidFilter === "unpaid") return !r.is_paid;
    return true;
  });

  // Calculate stats
  const stats = {
    total: registrations.length,
    paid: registrations.filter(r => r.is_paid).length,
    unpaid: registrations.filter(r => !r.is_paid).length,
  };

  if (loading) {
    return <LoadingSpinner text="Loading supplementary registrations..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-arrow-repeat" />
            Supplementary Sittings
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Exam Office <span className="separator">/</span> Supplementary
          </div>
        </div>
        <div className="mu-page-header-actions">
          
          <button className="mu-btn mu-btn-outline-primary" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-repeat" />
            Refresh
          </button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          Institution-wide list of students registered to sit a supplementary exam.
        </div>
      </div>

      {/* Stats Summary */}
      <div className="mu-dashboard-grid" style={{ marginBottom: 24, gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-people" />
          </div>
          <div className="mu-stat-label">Total Registrations</div>
          <div className="mu-stat-value">{stats.total}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Fee Paid</div>
          <div className="mu-stat-value">{stats.paid}</div>
          {stats.paid > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-success)" }}>
              <i className="bi bi-check-circle" />
              Ready to sit
            </div>
          )}
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-exclamation-triangle" />
          </div>
          <div className="mu-stat-label">Fee Outstanding</div>
          <div className="mu-stat-value">{stats.unpaid}</div>
          {stats.unpaid > 0 && (
            <div className="mu-stat-change down" style={{ color: "var(--mu-danger)" }}>
              <i className="bi bi-exclamation-triangle" />
              Cannot sit
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Supplementary Registrations Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-arrow-repeat" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Supplementary Registrations
          </h4>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mu-badge mu-badge-primary">
              {filtered.length} Registration(s)
            </span>
            <select
              className="mu-select"
              style={{ width: 160, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
              value={paidFilter}
              onChange={(e) => setPaidFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="paid">Fee Paid</option>
              <option value="unpaid">Fee Outstanding</option>
            </select>
          </div>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-arrow-repeat" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Supplementary Registrations</h3>
              <p style={{ margin: "8px 0 0" }}>No supplementary registrations found.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Semester</th>
                    <th style={{ textAlign: "right" }}>Invoice Balance</th>
                    <th>Payment Status</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>
                          {r.student_detail?.user_detail?.first_name} {r.student_detail?.user_detail?.last_name}
                        </strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {r.student_detail?.registration_number}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.course_detail?.code}</div>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {r.course_detail?.name}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {r.semester_detail?.academic_year_detail?.year} S{r.semester_detail?.semester_number}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`mu-badge ${r.invoice_status?.balance > 0 ? "mu-badge-warning" : "mu-badge-success"}`}>
                          Ksh {r.invoice_status?.balance?.toFixed(2) || "0.00"}
                        </span>
                      </td>
                      <td>
                        {r.is_paid ? (
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Paid
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-danger">
                            <i className="bi bi-exclamation-triangle" style={{ marginRight: 4 }} />
                            Outstanding
                          </span>
                        )}
                      </td>
                      <td>
                        {r.grade_detail ? (
                          <span className="mu-badge mu-badge-primary">
                            {r.grade_detail.letter_grade || "Pending"}
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-gray">Not sat yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Showing {filtered.length} of {registrations.length} registration(s)
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