import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hostelApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function HostelBooking() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState("");
  const [beds, setBeds] = useState([]);
  const [selectedBedId, setSelectedBedId] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);

  const loadInitial = async () => {
    setLoading(true);
    setError("");
    try {
      const [statusRes, hostelsRes] = await Promise.all([
        hostelApi.status(),
        hostelApi.hostels(),
      ]);
      setStatus(statusRes.data);
      setHostels(Array.isArray(hostelsRes.data) ? hostelsRes.data : hostelsRes.data.results || []);
    } catch (err) {
      console.error("Error fetching hostel status:", err);
      setError("Failed to load hostel information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  const loadBeds = async (hostelId) => {
    setSelectedHostel(hostelId);
    setSelectedBedId("");
    setSelectedBed(null);
    if (!hostelId) {
      setBeds([]);
      return;
    }
    try {
      const res = await hostelApi.beds({ room__hostel: hostelId });
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setBeds(data);
    } catch (err) {
      console.error("Error fetching beds:", err);
      setError("Failed to load available beds for this hostel.");
    }
  };

  const handleBook = async () => {
    if (!selectedBedId) {
      setError("Select a bed first.");
      return;
    }
    if (!status?.academic_year?.id) {
      setError("No active academic year found.");
      return;
    }
    setBooking(true);
    setError("");
    setSuccess("");
    try {
      await hostelApi.book({
        bed: selectedBedId,
        semester: status.semester?.id,
      });
      setSuccess("Hostel booking submitted successfully.");
      setConfirmModalOpen(false);
      await loadInitial();
      setBeds([]);
      setSelectedHostel("");
      setSelectedBedId("");
      setSelectedBed(null);
    } catch (err) {
      console.error("Error booking bed:", err);
      setError(err.response?.data?.detail || "Failed to book bed.");
    } finally {
      setBooking(false);
    }
  };

  const handleBedSelect = (bedId) => {
    const bed = beds.find(b => b.id === parseInt(bedId));
    setSelectedBed(bed);
    setSelectedBedId(bedId);
  };

  if (loading) {
    return <LoadingSpinner text="Loading hostel information..." />;
  }

  const hasBooking = !!status?.booking;

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

      {/* Hostel Info */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          <strong>Hostel Booking:</strong> Only students who have reported for the current semester can book a hostel bed.
          {status?.has_reported ? (
            <div style={{ marginTop: 8 }}>
              <span className="mu-badge mu-badge-success">
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                You have reported for this semester
              </span>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <span className="mu-badge mu-badge-warning">
                <i className="bi bi-clock" style={{ marginRight: 4 }} />
                Please complete semester reporting first
              </span>
            </div>
          )}
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
          <div className="mu-stat-label">Reporting Status</div>
          <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-base)" }}>
            <span className={`mu-badge ${status?.has_reported ? "mu-badge-success" : "mu-badge-warning"}`}>
              {status?.has_reported ? "Reported" : "Pending"}
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
            <div>
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
            </div>
          ) : (
            <div>
              {!status?.has_reported && (
                <div className="mu-alert mu-alert-warning" style={{ marginBottom: 16 }}>
                  <i className="bi bi-exclamation-triangle" />
                  You must complete semester reporting before booking a hostel bed.
                  <Link to="/reporting" className="mu-btn mu-btn-sm mu-btn-primary" style={{ marginLeft: 8 }}>
                    <i className="bi bi-check2-square" />
                    Report Now
                  </Link>
                </div>
              )}

              <div className="mu-form-group" style={{ maxWidth: 400 }}>
                <label>Select Hostel</label>
                <select 
                  className="mu-select" 
                  value={selectedHostel} 
                  onChange={(e) => loadBeds(e.target.value)}
                  disabled={!status?.has_reported}
                >
                  <option value="">Select a hostel...</option>
                  {hostels.map((hostel) => (
                    <option key={hostel.id} value={hostel.id}>
                      {hostel.name} ({hostel.hostel_type})
                    </option>
                  ))}
                </select>
              </div>

              {selectedHostel && (
                <div className="mu-form-group" style={{ maxWidth: 400 }}>
                  <label>Available Bed</label>
                  <select 
                    className="mu-select" 
                    value={selectedBedId} 
                    onChange={(e) => handleBedSelect(e.target.value)}
                    disabled={!status?.has_reported}
                  >
                    <option value="">Select a bed...</option>
                    {beds.map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        Room {bed.room_detail?.room_number} - Bed {bed.bed_number}
                      </option>
                    ))}
                  </select>
                  {beds.length === 0 && (
                    <div className="mu-help-text" style={{ color: "var(--mu-warning)" }}>
                      <i className="bi bi-exclamation-circle" />
                      No available beds in this hostel
                    </div>
                  )}
                </div>
              )}

              {selectedBed && (
                <div className="mu-card" style={{ background: "var(--mu-gray-50)", marginBottom: 16, padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "var(--mu-font-size-sm)" }}>
                    <div>
                      <span style={{ color: "var(--mu-gray-500)" }}>Hostel:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>
                        {selectedBed.room_detail?.hostel_detail?.name || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "var(--mu-gray-500)" }}>Room:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>
                        {selectedBed.room_detail?.room_number || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "var(--mu-gray-500)" }}>Bed:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>
                        {selectedBed.bed_number || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "var(--mu-gray-500)" }}>Capacity:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>
                        {selectedBed.room_detail?.capacity || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button 
                className="mu-btn mu-btn-primary" 
                onClick={() => setConfirmModalOpen(true)}
                disabled={booking || !status?.has_reported || !selectedBedId}
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
              <span>{selectedBed?.room_detail?.hostel_detail?.name || "N/A"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Room:</span>
              <span>{selectedBed?.room_detail?.room_number || "N/A"}</span>
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