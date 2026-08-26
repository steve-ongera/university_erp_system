import { useEffect, useState } from "react";
import { timetableApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00"
];

const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday"
};

const DAY_SHORT = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri"
};

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

  const handleDownloadPdf = () => {
    window.print();
  };

  const getSlotAt = (day, time) => {
    const timeStr = time.slice(0, 5);
    return slots.find(slot => {
      const slotDay = slot.day_of_week?.toLowerCase();
      const slotStart = slot.start_time?.slice(0, 5);
      return slotDay === day && slotStart === timeStr;
    });
  };

  const getTimeRange = () => {
    if (slots.length === 0) return TIME_SLOTS;
    const times = slots.map(s => s.start_time?.slice(0, 5)).filter(Boolean);
    if (times.length === 0) return TIME_SLOTS;
    times.sort();
    const minTime = times[0];
    const maxTime = times[times.length - 1];
    const minHour = parseInt(minTime.split(":")[0]);
    const maxHour = parseInt(maxTime.split(":")[0]);
    const timeSlotsResult = [];
    for (let i = minHour; i <= maxHour + 1; i++) {
      const hour = i.toString().padStart(2, "0");
      timeSlotsResult.push(`${hour}:00`);
    }
    return timeSlotsResult;
  };

  const timeSlots = getTimeRange();

  if (loading) {
    return <LoadingSpinner text="Loading your timetable..." />;
  }

  return (
    <div>
      {/* CSS Rules to format PDF export specifically */}
      <style type="text/css">{`
        @media print {
          body * {
            visibility: hidden;
          }
          .mu-printable-area, .mu-printable-area * {
            visibility: visible;
          }
          .mu-printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .mu-page-header-actions, .mu-breadcrumb {
            display: none !important;
          }
          @page {
            size: landscape;
            margin: 1cm;
          }
        }
      `}</style>

      <div className="mu-printable-area">
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
            <button 
              onClick={handleDownloadPdf} 
              className="mu-btn mu-btn-primary"
            >
              <i className="bi bi-download" style={{ marginRight: 8 }} />
              Download Timetable (PDF)
            </button>
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
        {slots.length > 0 ? (
          <div className="mu-card">
            <div className="mu-card-body" style={{ padding: 0, overflowX: "auto" }}>
              <table className="mu-timetable-grid-horizontal">
                <thead>
                  <tr>
                    <th className="mu-timetable-corner">Day / Time</th>
                    {timeSlots.map((time) => (
                      <th key={time} className="mu-timetable-time-header-h">
                        {time.slice(0, 5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAY_ORDER.map((day) => (
                    <tr key={day}>
                      <td className="mu-timetable-day-header-v">
                        <div className="mu-day-short">{DAY_SHORT[day]}</div>
                        <div className="mu-day-full">{DAY_LABELS[day]}</div>
                      </td>
                      {timeSlots.map((time) => {
                        const slot = getSlotAt(day, time);
                        return (
                          <td key={`${day}-${time}`} className="mu-timetable-cell-h">
                            {slot ? (
                              <div className={`mu-timetable-slot-h ${slot.course_detail?.course_type === "elective" ? "mu-timetable-slot-elective-h" : ""}`}>
                                <div className="mu-slot-code">{slot.course_detail?.code}</div>
                                <div className="mu-slot-name">{slot.course_detail?.name}</div>
                                <div className="mu-slot-venue">
                                  <i className="bi bi-geo-alt" />
                                  {slot.venue}
                                </div>
                                <div className="mu-slot-time">
                                  <i className="bi bi-clock" />
                                  {slot.start_time} - {slot.end_time}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mu-card">
            <div className="mu-card-body" style={{ padding: 48, textAlign: "center" }}>
              <i className="bi bi-calendar-x" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-gray-400)" }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Timetable Available</h3>
              <p style={{ margin: "8px 0 0", color: "var(--mu-gray-400)" }}>
                No timetable slots found for your programme/year/semester yet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}