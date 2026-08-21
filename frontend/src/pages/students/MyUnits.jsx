import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { unitsApi, studentsApi } from "../../services/api";

export default function MyUnits() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [currentSemester, setCurrentSemester] = useState(null);
  const [error, setError] = useState("");
  const [autoRegistering, setAutoRegistering] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    supplementary: 0,
    repeat: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch student profile
        const profileRes = await studentsApi.myProfile();
        setStudentProfile(profileRes.data);

        // Fetch registrations
        const regRes = await unitsApi.myRegistrations();
        const registrationsData = regRes.data || [];
        setRegistrations(registrationsData);

        // Calculate stats
        const statsData = {
          total: registrationsData.length,
          normal: registrationsData.filter(r => r.registration_type === 'normal').length,
          supplementary: registrationsData.filter(r => r.registration_type === 'supplementary').length,
          repeat: registrationsData.filter(r => r.registration_type === 'repeat').length,
        };
        setStats(statsData);

        // Extract semester info from first registration
        if (registrationsData.length > 0 && registrationsData[0].semester) {
          setCurrentSemester(registrationsData[0].semester);
        }

      } catch (err) {
        console.error("Error fetching units:", err);
        setError("Failed to load your registered units. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAutoRegister = async () => {
    setAutoRegistering(true);
    setError("");
    try {
      // Get current semester ID - you might want to fetch this from API
      // For now, we'll use a placeholder or you can add a semester selector
      const semesterId = currentSemester?.id || null;
      if (!semesterId) {
        setError("No active semester found. Please contact the registrar.");
        setAutoRegistering(false);
        return;
      }

      const response = await unitsApi.autoRegister(semesterId);
      
      // Refresh registrations
      const regRes = await unitsApi.myRegistrations();
      const registrationsData = regRes.data || [];
      setRegistrations(registrationsData);

      // Update stats
      setStats({
        total: registrationsData.length,
        normal: registrationsData.filter(r => r.registration_type === 'normal').length,
        supplementary: registrationsData.filter(r => r.registration_type === 'supplementary').length,
        repeat: registrationsData.filter(r => r.registration_type === 'repeat').length,
      });

    } catch (err) {
      console.error("Error auto-registering:", err);
      setError(err.response?.data?.detail || "Failed to register units. Please try again.");
    } finally {
      setAutoRegistering(false);
    }
  };

  // Get registration type badge
  const getTypeBadge = (type) => {
    const typeMap = {
      normal: { class: "mu-badge-primary", label: "Normal" },
      supplementary: { class: "mu-badge-warning", label: "Supplementary" },
      repeat: { class: "mu-badge-danger", label: "Repeat" },
      audit: { class: "mu-badge-gray", label: "Audit" },
    };
    return typeMap[type] || typeMap.normal;
  };

  // Get status badge based on registration
  const getStatusBadge = (registration) => {
    // Check if there's a grade
    if (registration.enrollment?.grade) {
      const grade = registration.enrollment.grade;
      if (grade.is_pass) {
        return { class: "mu-badge-success", icon: "bi-check-circle", label: "Passed" };
      } else if (grade.requires_supplementary) {
        return { class: "mu-badge-warning", icon: "bi-arrow-repeat", label: "Supplementary Required" };
      } else {
        return { class: "mu-badge-danger", icon: "bi-x-circle", label: "Failed" };
      }
    }
    
    // Check if active
    if (registration.is_active) {
      return { class: "mu-badge-info", icon: "bi-clock", label: "In Progress" };
    }
    
    return { class: "mu-badge-gray", icon: "bi-dash-circle", label: "Pending" };
  };

  if (loading) {
    return (
      <div className="mu-loader">
        <i className="bi bi-arrow-repeat mu-animate-spin" />
        <span>Loading your units...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-journal-bookmark" />
            My Units
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Academics <span className="separator">/</span> My Units
          </div>
        </div>
        <div className="mu-page-header-actions">
          <button 
            className="mu-btn mu-btn-primary" 
            onClick={handleAutoRegister}
            disabled={autoRegistering}
          >
            {autoRegistering ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <i className="bi bi-plus-circle" />
                Auto-Register Units
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Stats Summary */}
      <div className="mu-dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-journal-bookmark" />
          </div>
          <div className="mu-stat-label">Total Units</div>
          <div className="mu-stat-value">{stats.total}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Normal Units</div>
          <div className="mu-stat-value">{stats.normal}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-arrow-repeat" />
          </div>
          <div className="mu-stat-label">Supplementary</div>
          <div className="mu-stat-value">{stats.supplementary}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-exclamation-triangle" />
          </div>
          <div className="mu-stat-label">Repeat</div>
          <div className="mu-stat-value">{stats.repeat}</div>
        </div>
      </div>

      {/* Semester Info */}
      {currentSemester && (
        <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
          <i className="bi bi-calendar3" />
          <div>
            <strong>Current Semester:</strong> {currentSemester.academic_year?.year || "N/A"} - 
            Semester {currentSemester.semester_number}
            {currentSemester.is_current && (
              <span className="mu-badge mu-badge-success" style={{ marginLeft: 8 }}>
                <i className="bi bi-check-circle" />
                Current
              </span>
            )}
          </div>
        </div>
      )}

      {/* Units Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Registered Units</h4>
          <span className="mu-badge mu-badge-primary">
            {registrations.length} Units
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {registrations.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th>Type</th>
                    <th>Credit Hours</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => {
                    const typeBadge = getTypeBadge(reg.registration_type);
                    const statusBadge = getStatusBadge(reg);
                    
                    return (
                      <tr key={reg.id}>
                        <td>
                          <strong>{reg.course_detail?.code || "N/A"}</strong>
                        </td>
                        <td>{reg.course_detail?.name || "Unknown Course"}</td>
                        <td>
                          <span className={`mu-badge ${typeBadge.class}`}>
                            {typeBadge.label}
                          </span>
                        </td>
                        <td>{reg.course_detail?.credit_hours || "N/A"}</td>
                        <td>
                          <span className={`mu-badge ${statusBadge.class}`}>
                            <i className={`bi ${statusBadge.icon}`} style={{ marginRight: 4 }} />
                            {statusBadge.label}
                          </span>
                        </td>
                        <td>
                          <Link 
                            to={`/unit/${reg.course_detail?.id}`} 
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                          >
                            <i className="bi bi-eye" />
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-journal-bookmark" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Units Registered</h3>
              <p style={{ margin: "8px 0 16px" }}>
                You haven't registered for any units this semester.
                Click "Auto-Register Units" to register for your current semester units.
              </p>
              <button 
                className="mu-btn mu-btn-primary" 
                onClick={handleAutoRegister}
                disabled={autoRegistering}
              >
                {autoRegistering ? (
                  <>
                    <i className="bi bi-arrow-repeat mu-animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <i className="bi bi-plus-circle" />
                    Auto-Register Units
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mu-dashboard-grid-3" style={{ marginTop: 24 }}>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-calendar3" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>Timetable</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              View your class schedule
            </p>
            <Link to="/timetable" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              View Timetable
            </Link>
          </div>
        </div>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-award" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>Results</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              Check your grades and transcripts
            </p>
            <Link to="/grades" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              View Results
            </Link>
          </div>
        </div>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-arrow-repeat" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>Supplementary</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              Manage supplementary units
            </p>
            <Link to="/supplementary" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              View Supplementaries
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}