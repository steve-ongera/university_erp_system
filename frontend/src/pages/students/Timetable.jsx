import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { timetableApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function Timetable() {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [semester, setSemester] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await timetableApi.mine();
        setSemester(res.data.semester);
        setSlots(Array.isArray(res.data.slots) ? res.data.slots : []);
      } catch (err) {
        console.error("Error fetching timetable:", err);
        setError("Failed to load your timetable.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const groupByDay = () => {
    const groups = {};
    slots.forEach((slot) => {
      const day = (slot.day_of_week || "unknown").toLowerCase();
      if (!groups[day]) groups[day] = [];
      groups[day].push(slot);
    });
    Object.keys(groups).forEach((day) => {
      groups[day].sort((a, b) => (a.start_time > b.start_time ? 1 : -1));
    });
    return groups;
  };

  const dayGroups = groupByDay();
  const orderedDays = [
    ...DAY_ORDER.filter((d) => dayGroups[d]),
    ...Object.keys(dayGroups).filter((d) => !DAY_ORDER.includes(d)),
  ];

  // Helper to format day name
  const formatDay = (day) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  if (loading) {
    return <LoadingSpinner text="Loading your timetable..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-calendar3" />
            Class Timetable
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Academics <span className="separator">/</span> Timetable
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/units" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            My Units
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Semester Info */}
      {semester && (
        <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
          <i className="bi bi-calendar3" />
          <div>
            <strong>Current Semester:</strong> {semester.academic_year_detail?.year || "N/A"} - 
            Semester {semester.semester_number}
            {semester.is_current && (
              <span className="mu-badge mu-badge-success" style={{ marginLeft: 8 }}>
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                Active
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timetable Grid */}
      {orderedDays.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {orderedDays.map((day) => (
            <div key={day} className="mu-card">
              <div className="mu-card-header" style={{ background: "var(--mu-primary-50)" }}>
                <h4>
                  <i className="bi bi-calendar-day" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
                  {formatDay(day)}
                </h4>
                <span className="mu-badge mu-badge-primary">
                  {dayGroups[day].length} Classes
                </span>
              </div>
              <div className="mu-card-body" style={{ padding: 0 }}>
                <div className="mu-table-wrapper">
                  <table className="mu-table mu-table-hover">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th>Lecturer</th>
                        <th>Venue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayGroups[day].map((slot) => (
                        <tr key={slot.id}>
                          <td>
                            <span className="mu-badge mu-badge-info" style={{ fontWeight: 500 }}>
                              <i className="bi bi-clock" style={{ marginRight: 4 }} />
                              {slot.start_time} - {slot.end_time}
                            </span>
                          </td>
                          <td>
                            <strong>{slot.course_detail?.code || "N/A"}</strong>
                          </td>
                          <td>{slot.course_detail?.name || "Unknown"}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div className="mu-avatar-sm" style={{ 
                                width: 24, 
                                height: 24, 
                                fontSize: 10,
                                background: "var(--mu-primary-500)",
                                color: "#fff",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 600
                              }}>
                                {slot.lecturer_detail?.user_detail?.first_name?.[0] || "L"}
                              </div>
                              <span>
                                {slot.lecturer_detail?.user_detail?.first_name || ""}{" "}
                                {slot.lecturer_detail?.user_detail?.last_name || ""}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="mu-badge mu-badge-gray">
                              <i className="bi bi-geo-alt" style={{ marginRight: 4 }} />
                              {slot.venue}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 48, textAlign: "center" }}>
            <i className="bi bi-calendar-x" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-gray-400)" }} />
            <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Timetable Available</h3>
            <p style={{ margin: "8px 0 0", color: "var(--mu-gray-400)" }}>
              No timetable slots found for your programme/year/semester yet.
            </p>
            <Link to="/units" className="mu-btn mu-btn-outline-primary" style={{ marginTop: 16 }}>
              <i className="bi bi-arrow-left" style={{ marginRight: 8 }} />
              Back to My Units
            </Link>
          </div>
        </div>
      )}

     
    </div>
  );
}