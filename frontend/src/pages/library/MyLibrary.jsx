import { useEffect, useState } from "react";
import { libraryApi } from "../../services/api";
import "../../style/library.css";

const money = (v) => `Ksh ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function LoanStatusBadge({ loan }) {
  if (loan.status === "returned") return <span className="lib-badge lib-badge-gray">Returned</span>;
  if (loan.status === "lost") return <span className="lib-badge lib-badge-red">Lost</span>;
  if (loan.is_overdue) return <span className="lib-badge lib-badge-red">{loan.days_overdue}d overdue</span>;
  return <span className="lib-badge lib-badge-green">Active</span>;
}

export default function MyLibrary() {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState(null);

  // Browse & reserve
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState([]);
  const [searching, setSearching] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await libraryApi.myProfile();
      setProfile(data);
    } catch (e) {
      setError(e.response?.data?.detail || "Could not load your library profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const runSearch = async (e) => {
    e?.preventDefault();
    setSearching(true);
    try {
      const { data } = await libraryApi.books({ search: query, is_active: true });
      setBooks(data.results || data);
    } catch {
      setNotice("");
      setError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleReserve = async (bookId) => {
    setNotice("");
    setError("");
    try {
      await libraryApi.reserve(bookId);
      setNotice("Reservation placed. You'll be notified when a copy is ready.");
      loadProfile();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not place reservation.");
    }
  };

  const handleRenew = async (loanId) => {
    setNotice("");
    setError("");
    try {
      await libraryApi.renewLoan(loanId);
      setNotice("Loan renewed.");
      loadProfile();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not renew this loan.");
    }
  };

  const handleCancelReservation = async (id) => {
    try {
      await libraryApi.cancelReservation(id);
      loadProfile();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not cancel reservation.");
    }
  };

  if (loading) return <div className="lib-page"><p className="lib-loading">Loading your library account…</p></div>;

  return (
    <div className="lib-page">
      <div className="lib-header">
        <div>
          <h1 className="lib-title"><i className="bi bi-book-half" /> My Library</h1>
          {profile && (
            <p className="lib-subtitle">
              Card {profile.member?.library_card_number} · {profile.active_loans?.length || 0} book(s) out
            </p>
          )}
        </div>
      </div>

      {error && <div className="lib-alert lib-alert-error">{error}</div>}
      {notice && <div className="lib-alert lib-alert-success">{notice}</div>}

      {profile?.eligibility && !profile.eligibility.eligible && (
        <div className="lib-alert lib-alert-error">
          <i className="bi bi-exclamation-triangle" /> You currently can't borrow: {profile.eligibility.reason}
        </div>
      )}

      <div className="lib-tabs-inline">
        {["overview", "browse", "history"].map((t) => (
          <button
            key={t}
            className={`lib-tab-btn ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "overview" ? "Overview" : t === "browse" ? "Browse & Reserve" : "History"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="lib-card">
            <h2 className="lib-card-title"><i className="bi bi-journal-check" /> Active loans</h2>
            {profile?.active_loans?.length ? (
              <div className="lib-table-wrap">
                <table className="lib-table">
                  <thead>
                    <tr><th>Title</th><th>Due</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {profile.active_loans.map((loan) => (
                      <tr key={loan.id}>
                        <td>{loan.book_detail?.title}</td>
                        <td>{loan.due_date}</td>
                        <td><LoanStatusBadge loan={loan} /></td>
                        <td>
                          <button className="lib-btn lib-btn-outline lib-btn-sm" onClick={() => handleRenew(loan.id)}>
                            Renew
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="lib-empty">No books currently borrowed.</div>
            )}
          </div>

          <div className="lib-card">
            <h2 className="lib-card-title"><i className="bi bi-bookmark-star" /> Reservations</h2>
            {profile?.reservations?.length ? (
              <div className="lib-table-wrap">
                <table className="lib-table">
                  <thead><tr><th>Title</th><th>Status</th><th>Expires</th><th></th></tr></thead>
                  <tbody>
                    {profile.reservations.map((r) => (
                      <tr key={r.id}>
                        <td>{r.book_detail?.title}</td>
                        <td>
                          <span className={`lib-badge ${r.status === "pending" ? "lib-badge-amber" : r.status === "fulfilled" ? "lib-badge-green" : "lib-badge-gray"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>{new Date(r.expires_at).toLocaleDateString()}</td>
                        <td>
                          {r.status === "pending" && (
                            <button className="lib-btn lib-btn-danger lib-btn-sm" onClick={() => handleCancelReservation(r.id)}>
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="lib-empty">No reservations.</div>
            )}
          </div>

          <div className="lib-card">
            <h2 className="lib-card-title"><i className="bi bi-cash-coin" /> Fines</h2>
            {profile?.fines?.length ? (
              <div className="lib-table-wrap">
                <table className="lib-table">
                  <thead><tr><th>Reason</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {profile.fines.map((f) => (
                      <tr key={f.id}>
                        <td style={{ textTransform: "capitalize" }}>{f.reason}</td>
                        <td>{money(f.amount)}</td>
                        <td>
                          {f.is_waived ? (
                            <span className="lib-badge lib-badge-gray">Waived</span>
                          ) : f.is_paid ? (
                            <span className="lib-badge lib-badge-green">Paid</span>
                          ) : (
                            <span className="lib-badge lib-badge-red">Unpaid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="lib-empty">No fines on your account.</div>
            )}
          </div>
        </>
      )}

      {tab === "browse" && (
        <div className="lib-card">
          <h2 className="lib-card-title"><i className="bi bi-search" /> Browse the catalog</h2>
          <form className="lib-toolbar" onSubmit={runSearch}>
            <div className="lib-toolbar-left" style={{ flex: 1 }}>
              <input
                className="lib-input"
                style={{ minWidth: 260 }}
                placeholder="Search by title, author or ISBN"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="lib-btn lib-btn-primary" type="submit" disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
          </form>
          {books.length ? (
            <div className="lib-table-wrap">
              <table className="lib-table">
                <thead><tr><th>Title</th><th>Author(s)</th><th>Available</th><th></th></tr></thead>
                <tbody>
                  {books.map((b) => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.authors}</td>
                      <td>{b.available_copies} / {b.total_copies}</td>
                      <td>
                        {b.available_copies > 0 ? (
                          <span className="lib-badge lib-badge-green">Borrow at the desk</span>
                        ) : (
                          <button className="lib-btn lib-btn-outline lib-btn-sm" onClick={() => handleReserve(b.id)}>
                            Reserve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="lib-empty">Search the catalog to see availability and place a reservation.</div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="lib-card">
          <h2 className="lib-card-title"><i className="bi bi-clock-history" /> Loan history</h2>
          {profile?.loan_history?.length ? (
            <div className="lib-table-wrap">
              <table className="lib-table">
                <thead><tr><th>Title</th><th>Borrowed</th><th>Due</th><th>Status</th></tr></thead>
                <tbody>
                  {profile.loan_history.map((loan) => (
                    <tr key={loan.id}>
                      <td>{loan.book_detail?.title}</td>
                      <td>{new Date(loan.borrowed_at).toLocaleDateString()}</td>
                      <td>{loan.due_date}</td>
                      <td><LoanStatusBadge loan={loan} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="lib-empty">No past loans yet.</div>
          )}
        </div>
      )}
    </div>
  );
}