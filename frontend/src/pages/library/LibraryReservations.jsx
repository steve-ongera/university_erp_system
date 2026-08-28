import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const STATUS_BADGE = {
  pending: "mu-badge-warning",
  fulfilled: "mu-badge-success",
  cancelled: "mu-badge-gray",
  expired: "mu-badge-danger",
};

export default function LibraryReservations() {
  const [reservations, setReservations] = useState([]);
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = status ? { status } : {};
      const { data } = await libraryApi.reservations(params);
      setReservations(data.results || data);
    } catch {
      setError("Could not load reservations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const cancel = async (id) => {
    setError("");
    setNotice("");
    try {
      await libraryApi.cancelReservation(id);
      setNotice(" Reservation cancelled.");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not cancel reservation.");
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading reservations..." />;
  }

  // Calculate stats
  const stats = {
    total: reservations.length,
    pending: reservations.filter(r => r.status === "pending").length,
    fulfilled: reservations.filter(r => r.status === "fulfilled").length,
    cancelled: reservations.filter(r => r.status === "cancelled").length,
    expired: reservations.filter(r => r.status === "expired").length,
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-bookmark-star" />
            Reservations
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Library <span className="separator">/</span> Reservations
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/library/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          Holds are fulfilled automatically, oldest first, when a copy is returned.
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}
      {notice && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {notice}
        </div>
      )}

      {/* Stats Summary */}
      <div className="mu-dashboard-grid" style={{ marginBottom: 24, gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-bookmark-star" />
          </div>
          <div className="mu-stat-label">Total</div>
          <div className="mu-stat-value">{stats.total}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-clock" />
          </div>
          <div className="mu-stat-label">Pending</div>
          <div className="mu-stat-value">{stats.pending}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Fulfilled</div>
          <div className="mu-stat-value">{stats.fulfilled}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gray">
            <i className="bi bi-x-circle" />
          </div>
          <div className="mu-stat-label">Cancelled</div>
          <div className="mu-stat-value">{stats.cancelled}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-exclamation-triangle" />
          </div>
          <div className="mu-stat-label">Expired</div>
          <div className="mu-stat-value">{stats.expired}</div>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-bookmark-star" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Reservations
          </h4>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mu-badge mu-badge-primary">
              {reservations.length} Reservation(s)
            </span>
            <select
              className="mu-select"
              style={{ width: 140, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {reservations.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-bookmark-star" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Reservations</h3>
              <p style={{ margin: "8px 0 0" }}>No reservations found for this filter.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Title</th>
                    <th>Reserved</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>
                          {r.member_detail?.user_detail?.first_name} {r.member_detail?.user_detail?.last_name}
                        </strong>
                      </td>
                      <td>{r.book_detail?.title}</td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {new Date(r.reserved_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {new Date(r.expires_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge ${STATUS_BADGE[r.status] || "mu-badge-gray"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {r.status === "pending" && (
                          <button
                            className="mu-btn mu-btn-sm mu-btn-danger"
                            onClick={() => cancel(r.id)}
                          >
                            <i className="bi bi-x-circle" />
                            Cancel
                          </button>
                        )}
                        {r.status === "fulfilled" && (
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Completed
                          </span>
                        )}
                        {r.status === "cancelled" && (
                          <span className="mu-badge mu-badge-gray">—</span>
                        )}
                        {r.status === "expired" && (
                          <span className="mu-badge mu-badge-gray">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {reservations.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {reservations.length} reservation(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}