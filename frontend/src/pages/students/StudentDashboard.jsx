import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { studentsApi } from "../../services/api";
import { Link } from "react-router-dom";

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await studentsApi.myDashboard();
        setDashboardData(data);
      } catch (err) {
        console.error("Error fetching dashboard:", err);
        setError("Failed to load dashboard data. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="mu-loader">
        <i className="bi bi-arrow-repeat mu-animate-spin" />
        <span>Loading your dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mu-alert mu-alert-danger">
        <i className="bi bi-exclamation-triangle" />
        {error}
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="mu-alert mu-alert-warning">
        <i className="bi bi-info-circle" />
        No dashboard data available.
      </div>
    );
  }

  const { student, stats, recent_grades, upcoming_exams, quick_actions } = dashboardData;
  const fullName = user ? `${user.first_name} ${user.last_name}` : "Student";
  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || user.username[0].toUpperCase()
    : "?";

  // Get student status badge color
  const getStatusBadge = (status) => {
    const statusMap = {
      active: "success",
      deferred: "warning",
      graduated: "info",
      suspended: "danger",
      discontinued: "danger",
      expelled: "danger",
    };
    return statusMap[status?.toLowerCase()] || "gray";
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-speedometer2" />
            Student Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Dashboard
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/me/profile" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-person" />
            View Profile
          </Link>
          <Link to="/reporting" className="mu-btn mu-btn-primary">
            <i className="bi bi-check2-square" />
            Report Semester
          </Link>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-body" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div className="mu-avatar" style={{ width: 64, height: 64, fontSize: 24, background: "var(--mu-primary-500)" }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>Welcome back, {fullName}!</h2>
            <p style={{ margin: "4px 0 0", color: "var(--mu-gray-500)" }}>
              {student?.programme_detail?.name || "No programme assigned"} • 
              Year {student?.current_year || 1}, Semester {student?.current_semester || 1} • 
              <span className={`mu-badge mu-badge-${getStatusBadge(student?.status)}`} style={{ marginLeft: 8 }}>
                {student?.status || "Active"}
              </span>
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              Registration Number
            </div>
            <div style={{ fontWeight: "var(--mu-font-weight-bold)", color: "var(--mu-gray-900)" }}>
              {student?.registration_number || user.username}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-journal-bookmark" />
          </div>
          <div className="mu-stat-label">Units This Semester</div>
          <div className="mu-stat-value">{stats?.total_units || 0}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-award" />
          </div>
          <div className="mu-stat-label">Completed Units</div>
          <div className="mu-stat-value">{stats?.completed_units || 0}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-star" />
          </div>
          <div className="mu-stat-label">Current GPA</div>
          <div className="mu-stat-value">{stats?.current_gpa?.toFixed(2) || "N/A"}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-bell" />
          </div>
          <div className="mu-stat-label">Notifications</div>
          <div className="mu-stat-value">{stats?.notifications || 0}</div>
        </div>
      </div>

      {/* Second row - Fee Stats */}
      <div className="mu-dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-cash-coin" />
          </div>
          <div className="mu-stat-label">Fee Balance</div>
          <div className="mu-stat-value" style={{ color: stats?.fee_balance > 0 ? "var(--mu-danger)" : "var(--mu-success)" }}>
            KES {stats?.fee_balance?.toFixed(2) || "0.00"}
          </div>
          {stats?.fee_balance > 0 && (
            <div className="mu-stat-change up" style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-danger)" }}>
              <i className="bi bi-exclamation-triangle" />
              Outstanding balance
            </div>
          )}
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-wallet2" />
          </div>
          <div className="mu-stat-label">Wallet Credit</div>
          <div className="mu-stat-value" style={{ color: stats?.wallet_credit > 0 ? "var(--mu-success)" : "var(--mu-gray-500)" }}>
            KES {stats?.wallet_credit?.toFixed(2) || "0.00"}
          </div>
          {stats?.wallet_credit > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-success)" }}>
              <i className="bi bi-check-circle" />
              Credit available
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>Quick Actions</h4>
        </div>
        <div className="mu-card-body">
          <div className="mu-quick-actions">
            {!quick_actions?.has_reported && (
              <Link to="/reporting" className="mu-quick-action">
                <i className="bi bi-check2-square" />
                <span>Report Semester</span>
                <span className="mu-badge mu-badge-warning" style={{ fontSize: "var(--mu-font-size-xs)" }}>Required</span>
              </Link>
            )}
            {!quick_actions?.has_hostel && student?.current_year === 1 && student?.current_semester === 1 && (
              <Link to="/hostel" className="mu-quick-action">
                <i className="bi bi-building" />
                <span>Book Hostel</span>
                <span className="mu-badge mu-badge-primary" style={{ fontSize: "var(--mu-font-size-xs)" }}>Available</span>
              </Link>
            )}
            {quick_actions?.has_outstanding_fees && (
              <Link to="/fees" className="mu-quick-action">
                <i className="bi bi-cash-coin" />
                <span>Pay Fees</span>
                <span className="mu-badge mu-badge-danger" style={{ fontSize: "var(--mu-font-size-xs)" }}>Overdue</span>
              </Link>
            )}
            {quick_actions?.is_eligible_for_clearance && (
              <Link to="/clearance" className="mu-quick-action">
                <i className="bi bi-file-earmark-check" />
                <span>Apply Clearance</span>
                <span className="mu-badge mu-badge-info" style={{ fontSize: "var(--mu-font-size-xs)" }}>Eligible</span>
              </Link>
            )}
            <Link to="/units" className="mu-quick-action">
              <i className="bi bi-journal-bookmark" />
              <span>View Units</span>
            </Link>
            <Link to="/grades" className="mu-quick-action">
              <i className="bi bi-award" />
              <span>Check Results</span>
            </Link>
            <Link to="/timetable" className="mu-quick-action">
              <i className="bi bi-calendar3" />
              <span>Timetable</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Two Column Layout - Recent Grades & Upcoming Exams */}
      <div className="mu-dashboard-grid-2">
        {/* Recent Grades */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Recent Grades</h4>
            <Link to="/grades" style={{ fontSize: "var(--mu-font-size-sm)" }}>
              View All <i className="bi bi-chevron-right" />
            </Link>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {recent_grades && recent_grades.length > 0 ? (
              <div className="mu-table-wrapper">
                <table className="mu-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Grade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_grades.map((grade) => (
                      <tr key={grade.id}>
                        <td>{grade.enrollment?.course?.code || "N/A"}</td>
                        <td>
                          <span className="mu-badge mu-badge-primary">
                            {grade.letter_grade || "N/A"}
                          </span>
                        </td>
                        <td>
                          {grade.is_pass ? (
                            <span className="mu-badge mu-badge-success">
                              <i className="bi bi-check-circle" />
                              Pass
                            </span>
                          ) : grade.requires_supplementary ? (
                            <span className="mu-badge mu-badge-warning">
                              <i className="bi bi-arrow-repeat" />
                              Supplementary
                            </span>
                          ) : (
                            <span className="mu-badge mu-badge-danger">
                              <i className="bi bi-x-circle" />
                              Fail
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                No grades published yet
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Exams */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Upcoming Exams</h4>
            <Link to="/timetable" style={{ fontSize: "var(--mu-font-size-sm)" }}>
              View All <i className="bi bi-chevron-right" />
            </Link>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {upcoming_exams && upcoming_exams.length > 0 ? (
              <div className="mu-table-wrapper">
                <table className="mu-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Date</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming_exams.map((exam) => (
                      <tr key={exam.id}>
                        <td>{exam.course?.code || "N/A"}</td>
                        <td>{new Date(exam.exam_date).toLocaleDateString()}</td>
                        <td>{exam.start_time || "TBD"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-calendar-check" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                No upcoming exams
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}