import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const EMPTY_STATE = {
  stats: {
    totalStudents: 0,
    totalStaff: 0,
    totalProgrammes: 0,
    totalDepartments: 0,
    activeStudents: 0,
    graduatedStudents: 0,
  },
  recentStudents: [],
  enrollmentTrends: [],
  programmeDistribution: [],
  departmentStats: [],
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardData, setDashboardData] = useState(EMPTY_STATE);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError("");
      try {
        // Single call — the backend already computes stats, trends,
        // programme distribution and department stats server-side.
        const { data } = await adminApi.dashboard(); // GET /admin/dashboard/

        setDashboardData({
          stats: {
            totalStudents: data.stats.total_students,
            totalStaff: data.stats.total_staff,
            totalProgrammes: data.stats.total_programmes,
            totalDepartments: data.stats.total_departments,
            activeStudents: data.stats.active_students,
            graduatedStudents: data.stats.graduated_students,
          },
          recentStudents: data.recent_students || [],
          enrollmentTrends: data.enrollment_trends || [],
          programmeDistribution: data.programme_distribution || [],
          departmentStats: data.department_stats || [],
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        const status = err.response?.status;
        if (status === 401) {
          setError("Your session has expired. Please log in again.");
        } else if (status === 403) {
          setError("You don't have permission to view the admin dashboard.");
        } else {
          setError("Failed to load dashboard data. Please refresh the page.");
        }
        setDashboardData(EMPTY_STATE);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Chart Data Configurations
  const lineChartData = {
    labels: dashboardData.enrollmentTrends.map((d) => d.semester),
    datasets: [
      {
        label: "Total Students",
        data: dashboardData.enrollmentTrends.map((d) => d.total_students),
        borderColor: "#3b6ce0",
        backgroundColor: "rgba(59, 108, 224, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#3b6ce0",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
      {
        label: "New Students",
        data: dashboardData.enrollmentTrends.map((d) => d.new_students),
        borderColor: "#1a8a5a",
        backgroundColor: "rgba(26, 138, 90, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#1a8a5a",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const barChartData = {
    labels: dashboardData.departmentStats.map((d) => d.code || d.name?.substring(0, 10) || "N/A"),
    datasets: [
      {
        label: "Students per Department",
        data: dashboardData.departmentStats.map((d) => d.student_count || 0),
        backgroundColor: ["#3b6ce0", "#1a8a5a", "#c97d2a", "#7c3aed", "#c23b3b"],
        borderRadius: 6,
        barThickness: 40,
      },
    ],
  };

  const doughnutData = {
    labels: dashboardData.programmeDistribution.map((d) => d.name),
    datasets: [
      {
        data: dashboardData.programmeDistribution.map((d) => d.count || 1),
        backgroundColor: dashboardData.programmeDistribution.map((d) => d.color || "#3b6ce0"),
        borderColor: "#ffffff",
        borderWidth: 3,
        hoverOffset: 10,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { usePointStyle: true, padding: 20, font: { size: 12, weight: "500" } },
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
    },
    cutout: "60%",
  };

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

  if (loading) {
    return <LoadingSpinner text="Loading dashboard..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-speedometer2" />
            Admin Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Dashboard
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/reports" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-bar-chart" />
            View Reports
          </Link>
          <Link to="/students" className="mu-btn mu-btn-primary">
            <i className="bi bi-people" />
            Manage Students
          </Link>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-people" />
          </div>
          <div className="mu-stat-label">Total Students</div>
          <div className="mu-stat-value">{dashboardData.stats.totalStudents}</div>
          <div className="mu-stat-change up">
            <i className="bi bi-arrow-up" />
            {dashboardData.stats.activeStudents} Active
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-person-badge" />
          </div>
          <div className="mu-stat-label">Total Staff</div>
          <div className="mu-stat-value">{dashboardData.stats.totalStaff}</div>
          <div className="mu-stat-change up">
            <i className="bi bi-people" />
            Across {dashboardData.stats.totalDepartments} Departments
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-mortarboard" />
          </div>
          <div className="mu-stat-label">Programmes</div>
          <div className="mu-stat-value">{dashboardData.stats.totalProgrammes}</div>
          <div className="mu-stat-change up">
            <i className="bi bi-building" />
            {dashboardData.stats.totalDepartments} Departments
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon purple">
            <i className="bi bi-award" />
          </div>
          <div className="mu-stat-label">Graduated</div>
          <div className="mu-stat-value">{dashboardData.stats.graduatedStudents}</div>
          <div className="mu-stat-change up">
            <i className="bi bi-check-circle" />
            Total Graduates
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-clock" />
          </div>
          <div className="mu-stat-label">Deferred</div>
          <div className="mu-stat-value">
            {dashboardData.stats.totalStudents -
              dashboardData.stats.activeStudents -
              dashboardData.stats.graduatedStudents}
          </div>
          <div className="mu-stat-change down">
            <i className="bi bi-pause-circle" />
            Not Active
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="mu-dashboard-grid-3" style={{ marginBottom: 24 }}>
        <div className="mu-card" style={{ gridColumn: "span 2" }}>
          <div className="mu-card-header">
            <h4>Enrollment Trends</h4>
            <span className="mu-badge mu-badge-primary">6 Semesters</span>
          </div>
          <div className="mu-card-body" style={{ height: 280 }}>
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>

        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Programme Distribution</h4>
            <span className="mu-badge mu-badge-primary">Top 5</span>
          </div>
          <div className="mu-card-body" style={{ height: 280 }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>Students per Department</h4>
          <span className="mu-badge mu-badge-primary">
            {dashboardData.departmentStats.length} Departments
          </span>
        </div>
        <div className="mu-card-body" style={{ height: 280 }}>
          <Bar data={barChartData} options={barChartOptions} />
        </div>
      </div>

      {/* Recent Students Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Recent Student Admissions</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="mu-badge mu-badge-primary">
              {dashboardData.recentStudents.length} Students
            </span>
            <Link to="/students" className="mu-btn mu-btn-sm mu-btn-outline-primary">
              View All
              <i className="bi bi-chevron-right" />
            </Link>
          </div>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {dashboardData.recentStudents.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Registration</th>
                    <th>Name</th>
                    <th>Programme</th>
                    <th>Year</th>
                    <th>Status</th>
                    <th>Admission Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentStudents.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.registration_number || "N/A"}</strong>
                      </td>
                      <td>
                        {student.user_detail?.first_name || ""} {student.user_detail?.last_name || ""}
                      </td>
                      <td>{student.programme_detail?.code || "N/A"}</td>
                      <td>
                        Y{student.current_year || 1} S{student.current_semester || 1}
                      </td>
                      <td>
                        <span className={`mu-badge mu-badge-${getStatusBadge(student.status)}`}>
                          {student.status || "Active"}
                        </span>
                      </td>
                      <td>
                        {student.admission_date
                          ? new Date(student.admission_date).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td>
                        <Link
                          to={`/students/${student.id}`}
                          className="mu-btn mu-btn-sm mu-btn-outline-primary"
                        >
                          <i className="bi bi-eye" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Students Found</h3>
              <p style={{ margin: "8px 0 0" }}>Student records will appear here once they are admitted.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}