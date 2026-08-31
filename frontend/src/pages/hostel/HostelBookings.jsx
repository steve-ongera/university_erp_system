// src/pages/hostel/HostelBookings.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi, hostelWardenApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState,
  useDebouncedValue, unwrapList, fmtDate,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;
const STATUS_BADGE = {
  pending: "warning",
  pending_payment: "warning",
  approved: "success",
  checked_in: "info",
  checked_out: "gray",
  cancelled: "danger",
};

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

const fmtKes = (amount) =>
  amount == null ? "N/A" : `KES ${Number(amount).toLocaleString()}`;

/**
 * Derives amount-paid + a payment-status label/badge from a booking row.
 * - booking.invoice_detail carries amount_due / balance (see InvoiceSerializer).
 * - booking.is_paid is computed server-side (balance <= 0, or true for
 *   legacy/manual bookings created without an invoice).
 */
function paymentInfo(booking) {
  const invoice = booking.invoice_detail;

  if (!invoice) {
    // No fee invoice attached at all (legacy or staff manual booking with no fee configured).
    return { amountPaid: null, label: "No Fee", badge: "gray" };
  }

  const amountDue = Number(invoice.amount_due || 0);
  const balance = Number(invoice.balance ?? amountDue);
  const amountPaid = Math.max(amountDue - balance, 0);

  if (balance <= 0) {
    return { amountPaid, label: "Paid", badge: "success" };
  }
  if (amountPaid > 0) {
    return { amountPaid, label: "Partially Paid", badge: "warning" };
  }
  return { amountPaid, label: "Unpaid", badge: "danger" };
}

// ----------------------------------------------------------------------
// Manual booking modal
// ----------------------------------------------------------------------
function ManualBookingModal({ hostels, academicYears, onClose, onSaved }) {
  const [studentSearch, setStudentSearch] = useState("");
  const debouncedStudentSearch = useDebouncedValue(studentSearch, 350);
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [hostelId, setHostelId] = useState("");
  const [beds, setBeds] = useState([]);
  const [bedId, setBedId] = useState("");
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!debouncedStudentSearch || debouncedStudentSearch.length < 2) { setStudentResults([]); return; }
    adminApi.students({ search: debouncedStudentSearch, page_size: 8 })
      .then(({ data }) => setStudentResults(unwrapList(data)))
      .catch(() => setStudentResults([]));
  }, [debouncedStudentSearch]);

  useEffect(() => {
    if (!hostelId) { setBeds([]); return; }
    setLoadingBeds(true);
    hostelWardenApi.beds({ is_available: true, room__hostel: hostelId })
      .then(({ data }) => setBeds(unwrapList(data)))
      .catch(() => setBeds([]))
      .finally(() => setLoadingBeds(false));
  }, [hostelId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!selectedStudent || !bedId) { setError("Select a student and an available bed."); return; }
    setSaving(true);
    try {
      const { data } = await hostelWardenApi.manualBook({ student: selectedStudent.id, bed: bedId, status: "approved" });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create booking.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Manual Booking" onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <Field label="Student">
          <input className="mu-input" value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); setSelectedStudent(null); }} placeholder="Search reg no. or name..." />
        </Field>
        {studentSearch && !selectedStudent && (
          <div style={{ border: "1px solid #eee", borderRadius: 8, marginTop: 6, maxHeight: 160, overflowY: "auto" }}>
            {studentResults.map((st) => (
              <button key={st.id} type="button" onClick={() => { setSelectedStudent(st); setStudentSearch(""); setStudentResults([]); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "transparent", borderBottom: "1px solid #f2f2f2", cursor: "pointer" }}>
                <strong>{st.registration_number}</strong> — {fullName(st.user_detail)}
              </button>
            ))}
          </div>
        )}
        {selectedStudent && (
          <div style={{ marginTop: 6, background: "#f4f6fb", padding: "6px 10px", borderRadius: 6, fontSize: 13 }}>
            {selectedStudent.registration_number} — {fullName(selectedStudent.user_detail)}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <Field label="Hostel">
            <select className="mu-input" value={hostelId} onChange={(e) => { setHostelId(e.target.value); setBedId(""); }}>
              <option value="">Select hostel...</option>
              {hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 12 }}>
          <Field label="Available Bed">
            <select className="mu-input" value={bedId} onChange={(e) => setBedId(e.target.value)} disabled={!hostelId || loadingBeds}>
              <option value="">{loadingBeds ? "Loading..." : "Select bed..."}</option>
              {beds.map((b) => (
                <option key={b.id} value={b.id}>
                  Room {b.room_detail?.room_number} — Bed {b.bed_number} ({b.academic_year_detail?.year || ""})
                </option>
              ))}
            </select>
          </Field>
          {hostelId && !loadingBeds && beds.length === 0 && (
            <p style={{ fontSize: 12, color: "#999", marginTop: 6 }}>No available beds in this hostel right now.</p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>{saving ? "Booking..." : "Create Booking"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function HostelBookings() {
  const [bookings, setBookings] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [hostelFilter, setHostelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [academicYearFilter, setAcademicYearFilter] = useState("");

  const [hostels, setHostels] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    Promise.all([hostelWardenApi.hostels(), adminApi.academicYears()]).then(([hRes, yRes]) => {
      setHostels(unwrapList(hRes.data));
      const years = unwrapList(yRes.data);
      setAcademicYears(years);
      const current = years.find((y) => y.is_current);
      if (current) setAcademicYearFilter(current.id);
    }).catch(() => {});
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (hostelFilter) params.bed__room__hostel = hostelFilter;
      if (statusFilter) params.status = statusFilter;
      if (academicYearFilter) params.academic_year = academicYearFilter;

      const { data } = await hostelWardenApi.bookings(params);
      if (Array.isArray(data)) { setBookings(data); setCount(data.length); }
      else { setBookings(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load bookings.");
      setBookings([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, hostelFilter, statusFilter, academicYearFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { setPage(1); }, [debouncedSearch, hostelFilter, statusFilter, academicYearFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleAction = async (booking, action) => {
    try {
      if (action === "check_in") await hostelWardenApi.checkIn(booking.id);
      else if (action === "check_out") await hostelWardenApi.checkOut(booking.id);
      else if (action === "cancel") await hostelWardenApi.cancelBooking(booking.id);
      showToast("Booking updated.");
      setCancelTarget(null);
      fetchBookings();
    } catch (err) {
      showToast(err.response?.data?.detail || "Action failed.");
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-house-check" /> Hostel Bookings</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Hostel <span className="separator">/</span> Bookings</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-primary" onClick={() => setManualBookingOpen(true)}>
            <i className="bi bi-plus-circle" /> Manual Booking
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Registration number..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Hostel">
              <select className="mu-input" value={hostelFilter} onChange={(e) => setHostelFilter(e.target.value)}>
                <option value="">All Hostels</option>
                {hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 160 }}>
            <Field label="Academic Year">
              <select className="mu-input" value={academicYearFilter} onChange={(e) => setAcademicYearFilter(e.target.value)}>
                <option value="">All Years</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 160 }}>
            <Field label="Status">
              <select className="mu-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="approved">Approved</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </div>
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setHostelFilter(""); setStatusFilter(""); }}>Reset</button>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Bookings</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : bookings.length === 0 ? (
            <EmptyState icon="bi-inbox" label="No bookings found" />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Phone</th>
                    <th>Room / Bed</th>
                    <th>Booked</th>
                    <th>Amount Paid</th>
                    <th>Payment Status</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const { amountPaid, label: paymentLabel, badge: paymentBadge } = paymentInfo(b);
                    return (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.student_detail?.registration_number}</strong>
                          <div style={{ fontSize: 12, color: "#777" }}>{fullName(b.student_detail?.user_detail)}</div>
                        </td>
                        <td>{b.student_detail?.user_detail?.phone || "N/A"}</td>
                        <td>{b.bed_detail?.room_detail?.hostel_detail?.name} / {b.bed_detail?.room_detail?.room_number} / {b.bed_detail?.bed_number}</td>
                        <td>{fmtDate(b.booked_at)}</td>
                        <td>{fmtKes(amountPaid)}</td>
                        <td><span className={`mu-badge mu-badge-${paymentBadge}`}>{paymentLabel}</span></td>
                        <td><span className={`mu-badge mu-badge-${STATUS_BADGE[b.status] || "gray"}`}>{b.status?.replace("_", " ")}</span></td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            {(b.status === "approved") && (
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => handleAction(b, "check_in")}>
                                <i className="bi bi-box-arrow-in-right" /> Check In
                              </button>
                            )}
                            {b.status === "checked_in" && (
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => handleAction(b, "check_out")}>
                                <i className="bi bi-box-arrow-right" /> Check Out
                              </button>
                            )}
                            {["pending", "pending_payment", "approved"].includes(b.status) && (
                              <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setCancelTarget(b)}>
                                <i className="bi bi-x-circle" /> Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && bookings.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} bookings</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <i className="bi bi-chevron-left" /> Prev
              </button>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {manualBookingOpen && (
        <ManualBookingModal
          hostels={hostels} academicYears={academicYears}
          onClose={() => setManualBookingOpen(false)}
          onSaved={() => { setManualBookingOpen(false); showToast("Booking created."); fetchBookings(); }}
        />
      )}

      {cancelTarget && (
        <ConfirmModal
          title="Cancel Booking"
          message={`Cancel the booking for ${cancelTarget.student_detail?.registration_number}? The bed will be freed up.`}
          onConfirm={() => handleAction(cancelTarget, "cancel")}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}