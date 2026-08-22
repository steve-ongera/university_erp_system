import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { lecturerApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function LecturerDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await lecturerApi.dashboard();
        setData(res.data);
      } catch (err) {
        console.error("Error fetching lecturer dashboard:", err);
        setError("Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-speedometer2" />
            Lecturer Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Lecturer <span className="separator">/</span> Dashboard
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/lecturer/units" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-journal-bookmark" />
            My Units
          </Link>
          <Link to="/lecturer/attendance" className="mu-btn mu-btn-primary">
            <i className="bi bi-qr-code" />
            QR Attendance
          </Link>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>
              Welcome, {data.lecturer?.user_detail?.first_name} {data.lecturer?.user_detail?.last_name}
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-calendar3" style={{ marginRight: 4 }} />
              {data.current_semester ? (
                <>
                  Current Semester: {data.current_semester.academic_year_detail?.year || "N/A"} - 
                  Semester {data.current_semester.semester_number}
                </>
              ) : (
                "No active semester"
              )}
            </p>
          </div>
          <div>
            <span className="mu-badge mu-badge-primary">
              <i className="bi bi-mortarboard" style={{ marginRight: 4 }} />
              {data.lecturer?.department || "Department"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-journal-bookmark" />
          </div>
          <div className="mu-stat-label">Allocated Units</div>
          <div className="mu-stat-value">{data.stats?.total_allocations || 0}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-people" />
          </div>
          <div className="mu-stat-label">Total Students</div>
          <div className="mu-stat-value">{data.stats?.total_students || 0}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-clock" />
          </div>
          <div className="mu-stat-label">Ungraded Enrollments</div>
          <div className="mu-stat-value">{data.stats?.ungraded_enrollments || 0}</div>
          {data.stats?.ungraded_enrollments > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-warning)" }}>
              <i className="bi bi-exclamation-triangle" />
              Needs attention
            </div>
          )}
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-pencil-square" />
          </div>
          <div className="mu-stat-label">Open CAT Windows</div>
          <div className="mu-stat-value">{data.stats?.open_cats || 0}</div>
        </div>
      </div>

      {/* My Allocated Units Table */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>My Allocated Units</h4>
          <span className="mu-badge mu-badge-primary">
            {data.allocations?.length || 0} Units
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {data.allocations && data.allocations.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Programme</th>
                    <th>Year/Sem</th>
                    <th style={{ textAlign: "center" }}>Students</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.allocations.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.course_detail?.code}</strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {a.course_detail?.name}
                        </div>
                      </td>
                      <td>{a.programme}</td>
                      <td>Year {a.year} / Semester {a.programme_semester}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-primary">{a.student_count || 0}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Link 
                          to={`/lecturer/enter-marks/${a.id}`} 
                          className="mu-btn mu-btn-sm mu-btn-primary"
                        >
                          <i className="bi bi-pencil" />
                          Enter Marks
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
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Units Allocated</h3>
              <p style={{ margin: "8px 0 0" }}>You have no units allocated for the current semester.</p>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout - Upcoming Classes & Open CATs */}
      <div className="mu-dashboard-grid-2">
        {/* Upcoming Classes */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Upcoming Classes</h4>
            <span className="mu-badge mu-badge-primary">
              {data.upcoming_classes?.length || 0}
            </span>
          </div>
          <div className="mu-card-body">
            {data.upcoming_classes && data.upcoming_classes.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.upcoming_classes.map((slot) => (
                  <div key={slot.id} style={{ 
                    padding: 12, 
                    background: "var(--mu-gray-50)", 
                    borderRadius: "var(--mu-radius-sm)",
                    borderLeft: "3px solid var(--mu-primary-500)"
                  }}>
                    <div style={{ fontWeight: 600 }}>{slot.course_detail?.code}</div>
                    <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                      <i className="bi bi-calendar3" style={{ marginRight: 4 }} />
                      {slot.day_of_week} {slot.start_time} - {slot.end_time}
                    </div>
                    <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                      <i className="bi bi-geo-alt" style={{ marginRight: 4 }} />
                      {slot.venue}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>
                <i className="bi bi-calendar" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                No upcoming classes
              </div>
            )}
          </div>
        </div>

        {/* Open CAT Windows */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Open CAT Windows</h4>
            <span className="mu-badge mu-badge-primary">
              {data.open_cat_windows?.length || 0}
            </span>
          </div>
          <div className="mu-card-body">
            {data.open_cat_windows && data.open_cat_windows.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.open_cat_windows.map((cat) => (
                  <div key={cat.id} style={{ 
                    padding: 12, 
                    background: "var(--mu-gray-50)", 
                    borderRadius: "var(--mu-radius-sm)",
                    borderLeft: "3px solid var(--mu-success)"
                  }}>
                    <div style={{ fontWeight: 600 }}>
                      <i className="bi bi-pencil-square" style={{ marginRight: 4, color: "var(--mu-primary-500)" }} />
                      {cat.title}
                    </div>
                    <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                      CAT {cat.cat_number} • Max Marks: {cat.max_marks}
                    </div>
                    <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                      <i className="bi bi-clock" style={{ marginRight: 4 }} />
                      Closes: {new Date(cat.closes_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>
                <i className="bi bi-clock" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                No open CAT windows
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending CAT Grading */}
      <div className="mu-card" style={{ marginTop: 24 }}>
        <div className="mu-card-header">
          <h4>Pending CAT Grading</h4>
          <span className="mu-badge mu-badge-warning">
            {data.pending_cat_grading?.length || 0} Pending
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {data.pending_cat_grading && data.pending_cat_grading.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>CAT Title</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pending_cat_grading.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.student_name}</td>
                      <td>{sub.cat_title}</td>
                      <td>{new Date(sub.submitted_at).toLocaleString()}</td>
                      <td style={{ textAlign: "center" }}>
                        <Link 
                          to={`/lecturer/grade-cat/${sub.id}`} 
                          className="mu-btn mu-btn-sm mu-btn-primary"
                        >
                          <i className="bi bi-check2-circle" />
                          Grade
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-check-circle" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Pending Submissions</h3>
              <p style={{ margin: "8px 0 0" }}>All CAT submissions have been graded.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}