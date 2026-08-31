import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { hostelApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

// RoomBedGrid stays exactly as before — unchanged.
function RoomBedGrid({ rooms, selectedBedId, onSelectBed }) {
  /* ...unchanged, see original file... */
}

const fmtKes = (amount) =>
  amount == null ? "N/A" : `KES ${Number(amount).toLocaleString()}`;

export default function HostelBooking() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [hostels, setHostels] = useState([]);

  const [selectedHostelId, setSelectedHostelId] = useState("");
  const [layoutHostel, setLayoutHostel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [feeAmount, setFeeAmount] = useState(null);
  const [layoutLoading, setLayoutLoading] = useState(false);

  const [selectedBed, setSelectedBed] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // --- payment state ---
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payPhone, setPayPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const loadInitial = useCallback(async () => {
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
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const loadLayout = async (hostelId) => {
    setSelectedHostelId(hostelId);
    setSelectedBed(null);
    setSelectedRoom(null);
    setRooms([]);
    setLayoutHostel(null);
    setFeeAmount(null);
    if (!hostelId) return;

    setLayoutLoading(true);
    setError("");
    try {
      const { data } = await hostelApi.layout(hostelId);
      setLayoutHostel(data.hostel);
      setRooms(data.rooms || []);
      setFeeAmount(data.fee_amount);
    } catch (err) {
      console.error("Error fetching hostel layout:", err);
      setError(err.response?.data?.detail || "Failed to load rooms for this hostel.");
    } finally {
      setLayoutLoading(false);
    }
  };

  const handleSelectBed = (bed, room) => {
    if (!bed.is_available) return;
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
      await hostelApi.book({ bed: selectedBed.id });
      setSuccess("Bed reserved. Complete payment to confirm your booking.");
      setConfirmModalOpen(false);
      await loadInitial();
      setSelectedHostelId("");
      setLayoutHostel(null);
      setRooms([]);
      setFeeAmount(null);
      setSelectedBed(null);
      setSelectedRoom(null);
    } catch (err) {
      console.error("Error booking bed:", err);
      setError(err.response?.data?.detail || "Failed to book bed. It may have just been taken by another student.");
      if (selectedHostelId) loadLayout(selectedHostelId);
    } finally {
      setBooking(false);
    }
  };

  const handlePay = async () => {
    if (!status?.booking?.id) return;
    setPaying(true);
    setPayError("");
    try {
      await hostelApi.payBooking(status.booking.id, payPhone);
      setPayModalOpen(false);
      setSuccess("Payment received. Your hostel booking is now confirmed.");
      await loadInitial();
    } catch (err) {
      console.error("Error paying hostel fee:", err);
      setPayError(err.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading hostel information..." />;
  }

  const hasBooking = !!status?.booking;
  const isEligible = !!status?.is_eligible;
  const bookingStatus = status?.booking?.status;
  const isPendingPayment = bookingStatus === "pending_payment";
  const isPaid = status?.booking?.is_paid;
  const invoiceDetail = status?.booking?.invoice_detail;

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
          current semester can book a hostel bed. A hostel fee applies and must be paid to confirm
          your booking.
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
              <span className={`mu-badge ${
                bookingStatus === "approved" || bookingStatus === "checked_in" ? "mu-badge-success" :
                bookingStatus === "pending_payment" ? "mu-badge-warning" :
                "mu-badge-gray"
              }`}>
                <i className={`bi ${isPendingPayment ? "bi-credit-card" : "bi-check-circle"}`} style={{ marginRight: 4 }} />
                {isPendingPayment ? "Payment Pending" : "Booked"}
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
                    bookingStatus === "approved" ? "mu-badge-success" :
                    bookingStatus === "pending_payment" ? "mu-badge-warning" :
                    bookingStatus === "pending" ? "mu-badge-warning" :
                    bookingStatus === "checked_in" ? "mu-badge-info" :
                    "mu-badge-gray"
                  }`}>
                    {bookingStatus?.replace("_", " ").toUpperCase() || "PENDING"}
                  </span>
                </div>
              </div>

              <div className="mu-form-group">
                <label>Hostel Fee</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {fmtKes(status.booking.booking_fee)}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Payment Status</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  <span className={`mu-badge ${isPaid ? "mu-badge-success" : "mu-badge-warning"}`}>
                    <i className={`bi ${isPaid ? "bi-check-circle" : "bi-exclamation-circle"}`} style={{ marginRight: 4 }} />
                    {isPaid ? "Paid" : `Balance: ${fmtKes(invoiceDetail?.balance)}`}
                  </span>
                </div>
              </div>

              {isPendingPayment && !isPaid && (
                <div className="mu-alert mu-alert-warning" style={{ gridColumn: "span 2" }}>
                  <i className="bi bi-credit-card" />
                  Your bed is reserved but the booking will not be confirmed until the hostel fee is
                  paid.
                  <button
                    className="mu-btn mu-btn-sm mu-btn-primary"
                    style={{ marginLeft: 8 }}
                    onClick={() => setPayModalOpen(true)}
                  >
                    <i className="bi bi-credit-card" />
                    Pay Hostel Fee
                  </button>
                </div>
              )}
              {bookingStatus === "approved" && (
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <h5 style={{ margin: 0, fontSize: "var(--mu-font-size-base)" }}>
                      <i className="bi bi-grid-3x3-gap" style={{ marginRight: 6 }} />
                      Rooms &amp; Beds — {layoutHostel?.name}
                    </h5>
                    <span className={`mu-badge ${feeAmount != null ? "mu-badge-info" : "mu-badge-gray"}`}>
                      <i className="bi bi-cash-stack" style={{ marginRight: 4 }} />
                      Hostel fee: {feeAmount != null ? fmtKes(feeAmount) : "Not set"}
                    </span>
                  </div>
                  {feeAmount == null && !layoutLoading && (
                    <div className="mu-alert mu-alert-warning" style={{ marginBottom: 12 }}>
                      <i className="bi bi-exclamation-triangle" />
                      No fee has been configured for this hostel this academic year yet — booking
                      will be blocked until the hostel office sets one.
                    </div>
                  )}
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
                      <span style={{ color: "var(--mu-gray-500)" }}>Hostel Fee:</span>
                      <span style={{ fontWeight: 500, marginLeft: 4 }}>{fmtKes(feeAmount)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                className="mu-btn mu-btn-primary"
                onClick={() => setConfirmModalOpen(true)}
                disabled={booking || !selectedBed || feeAmount == null}
              >
                {booking ? (
                  <>
                    <i className="bi bi-arrow-repeat mu-animate-spin" />
                    Reserving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle" />
                    Reserve Bed
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Reservation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Hostel Booking"
        size="md"
        confirmText="Reserve Bed"
        onConfirm={handleBook}
        isLoading={booking}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-building" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Confirm Your Booking</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            This reserves the bed immediately. You'll then need to pay the hostel fee to confirm it.
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4, fontWeight: 600 }}>
              <span>Hostel Fee:</span>
              <span>{fmtKes(feeAmount)}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Pay Hostel Fee Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Pay Hostel Fee"
        size="md"
        confirmText="Pay Now"
        onConfirm={handlePay}
        isLoading={paying}
      >
        <div>
          {payError && (
            <div className="mu-alert mu-alert-danger" style={{ marginBottom: 12 }}>
              <i className="bi bi-exclamation-triangle" />
              {payError}
            </div>
          )}
          <div style={{ marginBottom: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)" }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Amount Due:</span>
              <span style={{ fontWeight: 600 }}>{fmtKes(invoiceDetail?.balance ?? status?.booking?.booking_fee)}</span>
            </div>
          </div>
          <div className="mu-form-group">
            <label>M-Pesa Phone Number (optional)</label>
            <input
              type="text"
              className="mu-input"
              placeholder="07XX XXX XXX"
              value={payPhone}
              onChange={(e) => setPayPhone(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}