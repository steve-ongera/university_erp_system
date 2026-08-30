import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Chart, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  BarController,
  LineController,
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
  reportingTrends: [],
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
          reportingTrends: data.reporting_trends || [],
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

  // ---- Chart 1: Student Reporting Trends — single line, real StudentReporting data ----
  const reportingChartData = {
    labels: dashboardData.reportingTrends.map((d) => d.semester),
    datasets: [
      {
        label: "Students Reported",
        data: dashboardData.reportingTrends.map((d) => d.total_reported),
        borderColor: "#3b6ce0",
        backgroundColor: "rgba(59, 108, 224, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#3b6ce0",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const reportingChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { usePointStyle: true, padding: 20, font: { size: 12, weight: "500" } } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  // ---- Chart 2: Programme Distribution ----
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

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
    },
    cutout: "60%",
  };

  // ---- Chart 3: Students per Department — bar (total) + line overlay (male/female) ----
  const departmentComboData = {
    labels: dashboardData.departmentStats.map((d) => d.code || d.name?.substring(0, 10) || "N/A"),
    datasets: [
      {
        type: "bar",
        label: "Total Students",
        data: dashboardData.departmentStats.map((d) => d.student_count || 0),
        backgroundColor: "#3b6ce0",
        borderRadius: 6,
        barThickness: 32,
        order: 2,
      },
      {
        type: "line",
        label: "Male",
        data: dashboardData.departmentStats.map((d) => d.male_count || 0),
        borderColor: "#1a8a5a",
        backgroundColor: "#1a8a5a",
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: "#1a8a5a",
        borderWidth: 2,
        order: 1,
      },
      {
        type: "line",
        label: "Female",
        data: dashboardData.departmentStats.map((d) => d.female_count || 0),
        borderColor: "#c23b3b",
        backgroundColor: "#c23b3b",
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: "#c23b3b",
        borderWidth: 2,
        order: 0,
      },
    ],
  };

  const departmentComboOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
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
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-speedometer2" /> Admin Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Dashboard
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/reports" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-bar-chart" /> View Reports
          </Link>
          <Link to="/students" className="mu-btn mu-btn-primary">
            <i className="bi bi-people" /> Manage Students
          </Link>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue"><i className="bi bi-people" /></div>
          <div className="mu-stat-label">Total Students</div>
          <div className="mu-stat-value">{dashboardData.stats.totalStudents}</div>
          <div className="mu-stat-change up">
            <i className="bi bi-arrow-up" /> {dashboardData.stats.activeStudents} Active
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green"><i className="bi bi-person-badge" /></div>
          <div className="mu-stat-label">Total Staff</div>
          <div className="mu-stat-value">{dashboardData.stats.totalStaff}</div>
          <div className="mu-stat-change up">
            <i className="bi bi-people" /> Across {dashboardData.stats.totalDepartments} Departments
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold"><i className="bi bi-mortarboard" /></div>
          <div className="mu-stat-label">Programmes</div>
          <div className="mu-stat-value">{dashboardData.stats.totalProgrammes}</div>
          <div className="mu-stat-change up">
            <i className="bi bi-building" /> {dashboardData.stats.totalDepartments} Departments
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon purple"><i className="bi bi-award" /></div>
          <div className="mu-stat-label">Graduated</div>
          <div className="mu-stat-value">{dashboardData.stats.graduatedStudents}</div>
          <div className="mu-stat-change up">
            <i className="bi bi-check-circle" /> Total Graduates
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red"><i className="bi bi-clock" /></div>
          <div className="mu-stat-label">Deferred</div>
          <div className="mu-stat-value">
            {dashboardData.stats.totalStudents -
              dashboardData.stats.activeStudents -
              dashboardData.stats.graduatedStudents}
          </div>
          <div className="mu-stat-change down">
            <i className="bi bi-pause-circle" /> Not Active
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="mu-dashboard-grid-3" style={{ marginBottom: 24 }}>
        <div className="mu-card" style={{ gridColumn: "span 2" }}>
          <div className="mu-card-header">
            <h4>Student Reporting Trends</h4>
            <span className="mu-badge mu-badge-primary">Last 3 Academic Years</span>
          </div>
          <div className="mu-card-body" style={{ height: 280 }}>
            {dashboardData.reportingTrends.length > 0 ? (
              <Line data={reportingChartData} options={reportingChartOptions} />
            ) : (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                No reporting data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Programme Distribution</h4>
            <span className="mu-badge mu-badge-primary">Top 5</span>
          </div>
          <div className="mu-card-body" style={{ height: 280 }}>
            {dashboardData.programmeDistribution.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                No programme data available yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department combo chart: total students (bar) + male/female split (lines) */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>Students per Department — Gender Split</h4>
          <span className="mu-badge mu-badge-primary">
            {dashboardData.departmentStats.length} Departments
          </span>
        </div>
        <div className="mu-card-body" style={{ height: 300 }}>
          {dashboardData.departmentStats.length > 0 ? (
            <Chart type="bar" data={departmentComboData} options={departmentComboOptions} />
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              No department data available yet.
            </div>
          )}
        </div>
      </div>

      {/* Recent Students Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Recent Student Admissions</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="mu-badge mu-badge-primary">{dashboardData.recentStudents.length} Students</span>
            <Link to="/students" className="mu-btn mu-btn-sm mu-btn-outline-primary">
              View All <i className="bi bi-chevron-right" />
            </Link>
          </div>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {dashboardData.recentStudents.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Registration</th><th>Name</th><th>Programme</th><th>Year</th>
                    <th>Status</th><th>Admission Date</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentStudents.map((student) => (
                    <tr key={student.id}>
                      <td><strong>{student.registration_number || "N/A"}</strong></td>
                      <td>{student.user_detail?.first_name || ""} {student.user_detail?.last_name || ""}</td>
                      <td>{student.programme_detail?.code || "N/A"}</td>
                      <td>Y{student.current_year || 1} S{student.current_semester || 1}</td>
                      <td>
                        <span className={`mu-badge mu-badge-${getStatusBadge(student.status)}`}>
                          {student.status || "Active"}
                        </span>
                      </td>
                      <td>{student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "N/A"}</td>
                      <td>
                        <Link to={`/students/${student.id}`} className="mu-btn mu-btn-sm mu-btn-outline-primary">
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