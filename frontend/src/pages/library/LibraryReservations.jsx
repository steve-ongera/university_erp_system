import { useEffect, useState } from "react";
import { libraryApi } from "../../services/api";
import LibraryNav from "./LibraryNav";
import "../../style/library.css";

const STATUS_BADGE = {
  pending: "lib-badge-amber",
  fulfilled: "lib-badge-green",
  cancelled: "lib-badge-gray",
  expired: "lib-badge-red",
};

export default function LibraryReservations() {
  const [reservations, setReservations] = useState([]);
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const params = status ? { status } : {};
      const { data } = await libraryApi.reservations(params);
      setReservations(data.results || data);
    } catch {
      setError("Could not load reservations.");
    }
  };

  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async (id) => {
    setError(""); setNotice("");
    try {
      await libraryApi.cancelReservation(id);
      setNotice("Reservation cancelled.");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not cancel reservation.");
    }
  };

  return (
    <div className="lib-page">
      <div className="lib-header">
        <div>
          <h1 className="lib-title"><i className="bi bi-bookmark-star" /> Reservations</h1>
          <p className="lib-subtitle">Holds are fulfilled automatically, oldest first, when a copy is returned.</p>
        </div>
      </div>

      <LibraryNav />

      {error && <div className="lib-alert lib-alert-error">{error}</div>}
      {notice && <div className="lib-alert lib-alert-success">{notice}</div>}

      <div className="lib-card">
        <div className="lib-toolbar">
          <div className="lib-toolbar-left">
            <select className="lib-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
        <div className="lib-table-wrap">
          <table className="lib-table">
            <thead><tr><th>Member</th><th>Title</th><th>Reserved</th><th>Expires</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id}>
                  <td>{r.member_detail?.user_detail?.first_name} {r.member_detail?.user_detail?.last_name}</td>
                  <td>{r.book_detail?.title}</td>
                  <td>{new Date(r.reserved_at).toLocaleDateString()}</td>
                  <td>{new Date(r.expires_at).toLocaleDateString()}</td>
                  <td><span className={`lib-badge ${STATUS_BADGE[r.status] || "lib-badge-gray"}`}>{r.status}</span></td>
                  <td>
                    {r.status === "pending" && (
                      <button className="lib-btn lib-btn-danger lib-btn-sm" onClick={() => cancel(r.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reservations.length && <div className="lib-empty">No reservations for this filter.</div>}
        </div>
      </div>
    </div>
  );
}