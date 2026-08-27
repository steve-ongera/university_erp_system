import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

import "../../style/library.css";

export default function LibrarianDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    libraryApi
      .dashboard()
      .then(({ data }) => mounted && setData(data))
      .catch(() => mounted && setError("Could not load the library dashboard."))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const totals = data?.totals || {};

  return (
    <div className="lib-page">
      <div className="lib-header">
        <div>
          <h1 className="lib-title"><i className="bi bi-book" /> Library Dashboard</h1>
          <p className="lib-subtitle">
            {user?.first_name ? `Welcome back, ${user.first_name}.` : "Welcome back."} Here's what's happening at the desk today.
          </p>
        </div>
      </div>

      {error && <div className="lib-alert lib-alert-error">{error}</div>}

      {loading ? (
        <p className="lib-loading">Loading dashboard…</p>
      ) : (
        <>
          <div className="lib-stats-grid">
            <div className="lib-stat-card">
              <div className="lib-stat-value">{totals.books ?? "—"}</div>
              <div className="lib-stat-label">Titles</div>
            </div>
            <div className="lib-stat-card">
              <div className="lib-stat-value">{totals.available_copies ?? "—"} / {totals.copies ?? "—"}</div>
              <div className="lib-stat-label">Copies available</div>
            </div>
            <div className="lib-stat-card">
              <div className="lib-stat-value">{totals.active_loans ?? "—"}</div>
              <div className="lib-stat-label">Active loans</div>
            </div>
            <div className={`lib-stat-card ${totals.overdue_loans ? "danger" : ""}`}>
              <div className="lib-stat-value">{totals.overdue_loans ?? "—"}</div>
              <div className="lib-stat-label">Overdue loans</div>
            </div>
            <div className={`lib-stat-card ${totals.pending_reservations ? "warn" : ""}`}>
              <div className="lib-stat-value">{totals.pending_reservations ?? "—"}</div>
              <div className="lib-stat-label">Pending reservations</div>
            </div>
            <div className={`lib-stat-card ${totals.outstanding_fines ? "danger" : ""}`}>
              <div className="lib-stat-value">Ksh {Number(totals.outstanding_fines || 0).toLocaleString()}</div>
              <div className="lib-stat-label">Outstanding fines</div>
            </div>
          </div>

          <div className="lib-card">
            <h2 className="lib-card-title"><i className="bi bi-lightning-charge" /> Quick actions</h2>
            <div className="lib-quick-links">
              <Link className="lib-quick-link" to="/library-management/circulation">
                <i className="bi bi-arrow-left-right" /> Issue / return a book
              </Link>
              <Link className="lib-quick-link" to="/library-management/members">
                <i className="bi bi-people" /> Look up a member
              </Link>
              <Link className="lib-quick-link" to="/library-management/catalog">
                <i className="bi bi-journal-plus" /> Add a book / copy
              </Link>
              <Link className="lib-quick-link" to="/library-management/reservations">
                <i className="bi bi-bookmark-star" /> Manage reservations
              </Link>
              <Link className="lib-quick-link" to="/library-management/fines">
                <i className="bi bi-cash-coin" /> Collect fines
              </Link>
            </div>
          </div>

          <div className="lib-card">
            <h2 className="lib-card-title"><i className="bi bi-graph-up" /> Most borrowed titles</h2>
            {data?.popular_books?.length ? (
              <div className="lib-table-wrap">
                <table className="lib-table">
                  <thead><tr><th>Title</th><th>Times borrowed</th></tr></thead>
                  <tbody>
                    {data.popular_books.map((b, i) => (
                      <tr key={i}>
                        <td>{b.title}</td>
                        <td>{b.loan_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="lib-empty">No circulation activity yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}