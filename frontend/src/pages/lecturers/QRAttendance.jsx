import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { lecturerApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function QRAttendance() {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [duration, setDuration] = useState(15);
  const [activeSession, setActiveSession] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const pollRef = useRef(null);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await lecturerApi.myTimetable();
        setSlots(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch (err) {
        console.error("Error fetching timetable:", err);
        setError("Failed to load your timetable.");
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, []);

  useEffect(() => {
    if (!activeSession) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const res = await lecturerApi.attendanceSessionLive(activeSession.id);
        setLiveData(res.data);
        if (!res.data.is_open) {
          clearInterval(pollRef.current);
        }
      } catch (err) {
        console.error("Error polling attendance session:", err);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [activeSession]);

  const handleStart = async () => {
    if (!selectedSlotId) {
      setError("Select a class slot first.");
      return;
    }
    setStarting(true);
    setError("");
    setSuccess("");
    try {
      const res = await lecturerApi.startAttendanceSession(selectedSlotId, duration);
      setActiveSession(res.data);
      setLiveData(null);
      setSuccess(`Attendance session started successfully!`);
    } catch (err) {
      console.error("Error starting session:", err);
      setError(err.response?.data?.detail || "Failed to start attendance session.");
    } finally {
      setStarting(false);
    }
  };

  const handleClose = async () => {
    if (!activeSession) return;
    setClosing(true);
    setError("");
    setSuccess("");
    try {
      await lecturerApi.closeAttendanceSession(activeSession.id);
      const res = await lecturerApi.attendanceSessionLive(activeSession.id);
      setLiveData(res.data);
      setActiveSession(null);
      setSuccess("Attendance session closed successfully.");
    } catch (err) {
      console.error("Error closing session:", err);
      setError("Failed to close session.");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading timetable..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-qr-code" />
            QR Attendance
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Lecturer <span className="separator">/</span> QR Attendance
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/lecturer/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
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
      {success && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {success}
        </div>
      )}

      {!activeSession ? (
        /* Start Session Form */
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-play-circle" style={{ marginRight: 8 }} />
              Start a Session
            </h4>
          </div>
          <div className="mu-card-body">
            <div className="mu-form-group">
              <label>Select Class Slot</label>
              <select 
                className="mu-select" 
                value={selectedSlotId} 
                onChange={(e) => setSelectedSlotId(e.target.value)}
              >
                <option value="">Select a slot...</option>
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.course_detail?.code} — {slot.day_of_week} {slot.start_time}-{slot.end_time} @ {slot.venue}
                  </option>
                ))}
              </select>
            </div>

            <div className="mu-form-group" style={{ maxWidth: 200 }}>
              <label>Duration (minutes)</label>
              <input
                type="number"
                className="mu-input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={1}
              />
              <div className="mu-help-text">How long the QR code should remain active</div>
            </div>

            <button 
              className="mu-btn mu-btn-primary" 
              onClick={handleStart} 
              disabled={starting || !selectedSlotId}
            >
              {starting ? (
                <>
                  <i className="bi bi-arrow-repeat mu-animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <i className="bi bi-qr-code" />
                  Start QR Session
                </>
              )}
            </button>

            {slots.length === 0 && (
              <div className="mu-alert mu-alert-info" style={{ marginTop: 12 }}>
                <i className="bi bi-info-circle" />
                No timetable slots available. Please check your timetable.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Session */
        <div className="mu-card">
          <div className="mu-card-header" style={{ background: "var(--mu-success-light)" }}>
            <h4>
              <i className="bi bi-record-circle" style={{ color: "var(--mu-danger)", marginRight: 8 }} />
              Active Session
            </h4>
            <span className="mu-badge mu-badge-success">
              <i className="bi bi-circle-fill" style={{ marginRight: 4, fontSize: 10 }} />
              LIVE
            </span>
          </div>
          <div className="mu-card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="mu-form-group">
                <label>Course</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {activeSession.timetable_slot_detail?.course_detail?.code || "N/A"} - 
                  {activeSession.timetable_slot_detail?.course_detail?.name || "N/A"}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Expires At</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {new Date(activeSession.expires_at).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div className="mu-form-group">
              <label>QR Code Token</label>
              <div style={{ 
                background: "var(--mu-gray-50)", 
                padding: "12px 16px", 
                borderRadius: "var(--mu-radius-sm)",
                fontFamily: "monospace",
                fontSize: "var(--mu-font-size-sm)",
                wordBreak: "break-all",
                border: "1px dashed var(--mu-border)"
              }}>
                {activeSession.session_token}
              </div>
              <div className="mu-help-text">
                <i className="bi bi-info-circle" />
                Encode this token as a QR code for students to scan
              </div>
            </div>

            {liveData && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div className="mu-stat-card" style={{ padding: "12px 16px" }}>
                    <div className="mu-stat-label">Enrolled</div>
                    <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-xl)" }}>
                      {liveData.enrolled_count || 0}
                    </div>
                  </div>
                  <div className="mu-stat-card" style={{ padding: "12px 16px" }}>
                    <div className="mu-stat-label">Checked In</div>
                    <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-xl)", color: "var(--mu-success)" }}>
                      {liveData.checked_in_count || 0}
                    </div>
                  </div>
                  <div className="mu-stat-card" style={{ padding: "12px 16px" }}>
                    <div className="mu-stat-label">Status</div>
                    <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-base)" }}>
                      <span className={`mu-badge ${liveData.is_open ? "mu-badge-success" : "mu-badge-gray"}`}>
                        {liveData.is_open ? "Open" : "Closed"}
                      </span>
                    </div>
                  </div>
                </div>

                {liveData.records && liveData.records.length > 0 && (
                  <div className="mu-table-wrapper">
                    <table className="mu-table mu-table-hover">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Status</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveData.records.map((record) => (
                          <tr key={record.id}>
                            <td>{record.student}</td>
                            <td>
                              <span className={`mu-badge ${
                                record.status === "present" ? "mu-badge-success" :
                                record.status === "late" ? "mu-badge-warning" :
                                record.status === "excused" ? "mu-badge-info" :
                                "mu-badge-danger"
                              }`}>
                                {record.status || "Absent"}
                              </span>
                            </td>
                            <td>{new Date(record.marked_at).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button 
                className="mu-btn mu-btn-danger" 
                onClick={handleClose} 
                disabled={closing}
              >
                {closing ? (
                  <>
                    <i className="bi bi-arrow-repeat mu-animate-spin" />
                    Closing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-x-circle" />
                    Close Session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}