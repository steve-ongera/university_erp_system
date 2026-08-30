import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { hostelApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

function RoomBedGrid({ rooms, selectedBedId, onSelectBed }) {
  if (!rooms.length) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--mu-gray-400)" }}>
        <i className="bi bi-door-closed" style={{ fontSize: 36, display: "block", marginBottom: 8 }} />
        No rooms configured for this hostel yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {rooms.map((room) => (
        <div key={room.id} className="mu-card" style={{ margin: 0 }}>
          <div className="mu-card-body" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <strong>Room {room.room_number}</strong>
              <span style={{ fontSize: 12, color: "var(--mu-gray-500)" }}>Capacity: {room.capacity}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {room.beds.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--mu-gray-400)" }}>No beds set up for this room.</span>
              ) : (
                room.beds.map((bed) => {
                  const isSelected = String(bed.id) === String(selectedBedId);
                  const isFrozen = !bed.is_available;
                  return (
                    <button
                      key={bed.id}
                      type="button"
                      disabled={isFrozen}
                      onClick={() => onSelectBed(bed, room)}
                      title={isFrozen ? "Already booked" : `Bed ${bed.bed_number} — available`}
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 8,
                        border: isSelected ? "2px solid var(--mu-primary-500)" : "1px solid var(--mu-gray-200)",
                        background: isFrozen ? "var(--mu-gray-100)" : isSelected ? "var(--mu-primary-50)" : "#fff",
                        color: isFrozen ? "var(--mu-gray-400)" : "var(--mu-gray-700)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        fontSize: 11,
                        cursor: isFrozen ? "not-allowed" : "pointer",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                    >
                      <i className={`bi ${isFrozen ? "bi-lock-fill" : "bi-bed"}`} style={{ fontSize: 18 }} />
                      <span>{bed.bed_number}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--mu-gray-500)", marginTop: 4 }}>
        <span><i className="bi bi-bed" /> Available</span>
        <span><i className="bi bi-lock-fill" /> Already booked (frozen)</span>
        <span style={{ color: "var(--mu-primary-500)" }}><i className="bi bi-check-circle" /> Selected</span>
      </div>
    </div>
  );
}

export default function HostelBooking() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [hostels, setHostels] = useState([]);

  const [selectedHostelId, setSelectedHostelId] = useState("");
  const [layoutHostel, setLayoutHostel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [layoutLoading, setLayoutLoading] = useState(false);

  const [selectedBed, setSelectedBed] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusRes, hostelsRes] = await Promise.all([
        hostelApi.status(),
        hostelApi.hostels(),
      ]);
      setStatus(statusRes.data);
      // HostelViewSet already filters to gender-appropriate hostels
      // server-side for student accounts, so no client-side filtering needed.
      setHostels(Array.isArray(hostelsRes.data) ? hostelsRes.data : hostelsRes.data.results || []);
    } catch (err) {
      console.error("Error fetching hostel status:", err);
      setError("Failed to load hostel information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const loadLayout = async (hostelId) => {
    setSelectedHostelId(hostelId);
    setSelectedBed(null);
    setSelectedRoom(null);
    setRooms([]);
    setLayoutHostel(null);
    if (!hostelId) return;

    setLayoutLoading(true);
    setError("");
    try {
      const { data } = await hostelApi.layout(hostelId);
      setLayoutHostel(data.hostel);
      setRooms(data.rooms || []);
    } catch (err) {
      console.error("Error fetching hostel layout:", err);
      setError(err.response?.data?.detail || "Failed to load rooms for this hostel.");
    } finally {
      setLayoutLoading(false);
    }
  };

  const handleSelectBed = (bed, room) => {
    if (!bed.is_available) return; // frozen — should already be disabled, this is a belt-and-braces guard
    setSelectedBed(bed);
    setSelectedRoom(room);
  };

  const handleBook = async () => {
    if (!selectedBed) {
      setError("Select an available bed first.");
      return;
    }
    setBooking(true);
    setError("");
    setSuccess("");
    try {
      // Only `bed` is required now — the backend derives the current
      // semester itself, so there's no risk of a missing/undefined field
      // silently dropping out of the request body.
      await hostelApi.book({ bed: selectedBed.id });
      setSuccess("Hostel booking submitted successfully.");
      setConfirmModalOpen(false);
      await loadInitial();
      setSelectedHostelId("");
      setLayoutHostel(null);
      setRooms([]);
      setSelectedBed(null);
      setSelectedRoom(null);
    } catch (err) {
      console.error("Error booking bed:", err);
      setError(err.response?.data?.detail || "Failed to book bed. It may have just been taken by another student.");
      // Refresh the layout in case the bed we picked was booked by someone
      // else in the meantime — it should now show as frozen.
      if (selectedHostelId) loadLayout(selectedHostelId);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading hostel information..." />;
  }

  const hasBooking = !!status?.booking;
  const isEligible = !!status?.is_eligible;

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-building" />
            Hostel Booking
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Campus Life <span className="separator">/</span> Hostel Booking
          </div>
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

      {/* Eligibility banner */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          <strong>Hostel Booking:</strong> Only Year 1, Semester 1 students who have reported for the
          current semester can book a hostel bed.
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`mu-badge ${status?.is_year1_sem1 ? "mu-badge-success" : "mu-badge-gray"}`}>
              <i className={`bi ${status?.is_year1_sem1 ? "bi-check-circle" : "bi-x-circle"}`} style={{ marginRight: 4 }} />
              {status?.is_year1_sem1 ? "Year 1, Semester 1" : "Not Year 1 / Semester 1"}
            </span>
            <span className={`mu-badge ${status?.has_reported ? "mu-badge-success" : "mu-badge-warning"}`}>
              <i className={`bi ${status?.has_reported ? "bi-check-circle" : "bi-clock"}`} style={{ marginRight: 4 }} />
              {status?.has_reported ? "Reported for this semester" : "Reporting pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-calendar3" />
          </div>
          <div className="mu-stat-label">Academic Year</div>
          <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-lg)" }}>
            {status?.academic_year?.year || "N/A"}
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check2-square" />
          </div>
          <div className="mu-stat-label">Eligibility</div>
          <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-base)" }}>
            <span className={`mu-badge ${isEligible ? "mu-badge-success" : "mu-badge-warning"}`}>
              {isEligible ? "Eligible" : "Not Eligible"}
            </span>
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-building" />
          </div>
          <div className="mu-stat-label">Booking Status</div>
          <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-base)" }}>
            {hasBooking ? (
              <span className="mu-badge mu-badge-success">
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                Booked
              </span>
            ) : (
              <span className="mu-badge mu-badge-gray">
                <i className="bi bi-clock" style={{ marginRight: 4 }} />
                Not Booked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Booking Section */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            {hasBooking ? (
              <>
                <i className="bi bi-check-circle" style={{ marginRight: 8, color: "var(--mu-success)" }} />
                Your Current Booking
              </>
            ) : (
              <>
                <i className="bi bi-plus-circle" style={{ marginRight: 8 }} />
                Book a Bed
              </>
            )}
          </h4>
        </div>
        <div className="mu-card-body">
          {hasBooking ? (
            <div className="mu-dashboard-grid-2" style={{ gap: 16 }}>
              <div className="mu-form-group">
                <label>Hostel</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {status.booking.bed_detail?.room_detail?.hostel_detail?.name || "N/A"}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Room</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {status.booking.bed_detail?.room_detail?.room_number || "N/A"}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Bed Number</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {status.booking.bed_detail?.bed_number || "N/A"}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Status</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  <span className={`mu-badge ${
                    status.booking.status === "approved" ? "mu-badge-success" :
                    status.booking.status === "pending" ? "mu-badge-warning" :
                    status.booking.status === "checked_in" ? "mu-badge-info" :
                    "mu-badge-gray"
                  }`}>
                    {status.booking.status?.toUpperCase() || "PENDING"}
                  </span>
                </div>
              </div>
              {status.booking.status === "pending" && (
                <div className="mu-alert mu-alert-warning" style={{ gridColumn: "span 2" }}>
                  <i className="bi bi-clock" />
                  Your booking is pending approval. You will be notified once approved.
                </div>
              )}
              {status.booking.status === "approved" && (
                <div className="mu-alert mu-alert-success" style={{ gridColumn: "span 2" }}>
                  <i className="bi bi-check-circle" />
                  Your booking has been approved. You can check in at the hostel.
                </div>
              )}
            </div>
          ) : !isEligible ? (
            <div className="mu-alert mu-alert-warning">
              <i className="bi bi-exclamation-triangle" />
              {!status?.is_year1_sem1
                ? "Hostel booking is only open to Year 1, Semester 1 students."
                : "You must complete semester reporting before booking a hostel bed."}
              {status?.is_year1_sem1 && !status?.has_reported && (
                <Link to="/reporting" className="mu-btn mu-btn-sm mu-btn-primary" style={{ marginLeft: 8 }}>
                  <i className="bi bi-check2-square" />
                  Report Now
                </Link>
              )}
            </div>
          ) : (
            <div>
              <div className="mu-form-group" style={{ maxWidth: 400 }}>
                <label>Select Hostel</label>
                <select
                  className="mu-select"
                  value={selectedHostelId}
                  onChange={(e) => loadLayout(e.target.value)}
                >
                  <option value="">Select a hostel...</option>
                  {hostels.map((hostel) => (
                    <option key={hostel.id} value={hostel.id}>
                      {hostel.name} ({hostel.hostel_type})
                    </option>
                  ))}
                </select>
                {hostels.length === 0 && (
                  <div className="mu-help-text" style={{ color: "var(--mu-warning)" }}>
                    <i className="bi bi-exclamation-circle" />
                    No hostels are currently available for your gender.
                  </div>
                )}
              </div>

              {selectedHostelId && (
                <div style={{ marginTop: 16 }}>
                  <h5 style={{ marginBottom: 10 }}>
                    <i className="bi bi-grid-3x3-gap" style={{ marginRight: 6 }} />
                    Rooms &amp; Beds — {layoutHostel?.name}
                  </h5>
                  {layoutLoading ? (
                    <LoadingSpinner text="Loading room layout..." />
                  ) : (
                    <RoomBedGrid rooms={rooms} selectedBedId={selectedBed?.id} onSelectBed={handleSelectBed} />
                  )}
                </div>
              )}

              {selectedBed && (
                <div className="mu-card" style={{ background: "var(--mu-gray-50)", marginTop: 16, marginBottom: 16, padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "var(--mu-font-size-sm)" }}>
                    <div>
                      <span style={{ color: "var(--mu-gray-500)" }}>Hostel:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>{layoutHostel?.name || "N/A"}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--mu-gray-500)" }}>Room:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>{selectedRoom?.room_number || "N/A"}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--mu-gray-500)" }}>Bed:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>{selectedBed.bed_number || "N/A"}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--mu-gray-500)" }}>Capacity:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>{selectedRoom?.capacity || "N/A"}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                className="mu-btn mu-btn-primary"
                onClick={() => setConfirmModalOpen(true)}
                disabled={booking || !selectedBed}
              >
                {booking ? (
                  <>
                    <i className="bi bi-arrow-repeat mu-animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle" />
                    Book Bed
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Hostel Booking"
        size="md"
        confirmText="Book Now"
        onConfirm={handleBook}
        isLoading={booking}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-building" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Confirm Your Booking</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to book a hostel bed.
            <br />
            <strong>Please confirm the details below:</strong>
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)" }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Hostel:</span>
              <span>{layoutHostel?.name || "N/A"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Room:</span>
              <span>{selectedRoom?.room_number || "N/A"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Bed:</span>
              <span>{selectedBed?.bed_number || "N/A"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Academic Year:</span>
              <span>{status?.academic_year?.year || "N/A"}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}