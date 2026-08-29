import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const money = (v) => `Ksh ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function LoanStatusBadge({ loan }) {
  if (loan.status === "returned") return <span className="mu-badge mu-badge-gray">Returned</span>;
  if (loan.status === "lost") return <span className="mu-badge mu-badge-danger">Lost</span>;
  if (loan.is_overdue) return <span className="mu-badge mu-badge-danger">{loan.days_overdue}d overdue</span>;
  return <span className="mu-badge mu-badge-success">Active</span>;
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
      setNotice("✅ Reservation placed. You'll be notified when a copy is ready.");
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
      setNotice("✅ Loan renewed successfully.");
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

  if (loading) {
    return <LoadingSpinner text="Loading your library account..." />;
  }

  // Tabs configuration
  const tabs = [
    { key: "overview", label: "Overview", icon: "bi-speedometer2" },
    { key: "browse", label: "Browse & Reserve", icon: "bi-search" },
    { key: "history", label: "History", icon: "bi-clock-history" },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-book-half" />
            My Library
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Library <span className="separator">/</span> My Library
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Profile Info */}
      {profile && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "var(--mu-gray-900)" }}>
                  <i className="bi bi-person" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
                  {profile.member?.user_detail?.first_name} {profile.member?.user_detail?.last_name}
                </h3>
                <p style={{ margin: "4px 0 0", color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)" }}>
                  <span className="mu-badge mu-badge-primary">
                    <i className="bi bi-credit-card" style={{ marginRight: 4 }} />
                    Card: {profile.member?.library_card_number}
                  </span>
                  <span className="mu-badge mu-badge-info" style={{ marginLeft: 8 }}>
                    <i className="bi bi-journal-bookmark" style={{ marginRight: 4 }} />
                    {profile.active_loans?.length || 0} book(s) out
                  </span>
                </p>
              </div>
              <div>
                {profile?.eligibility?.eligible ? (
                  <span className="mu-badge mu-badge-success">
                    <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                    Eligible to borrow
                  </span>
                ) : (
                  <span className="mu-badge mu-badge-danger">
                    <i className="bi bi-exclamation-triangle" style={{ marginRight: 4 }} />
                    {profile?.eligibility?.reason || "Cannot borrow"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Eligibility Alert */}
      {profile?.eligibility && !profile.eligibility.eligible && (
        <div className="mu-alert mu-alert-danger" style={{ marginBottom: 24 }}>
          <i className="bi bi-exclamation-triangle" />
          <div>
            <strong>You currently can't borrow:</strong> {profile.eligibility.reason}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--mu-border)", marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => setTab(tabItem.key)}
            style={{
              border: "none",
              borderBottom: tab === tabItem.key ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
              borderRadius: 0,
              background: "transparent",
              padding: "8px 16px",
              cursor: "pointer",
              color: tab === tabItem.key ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
              fontWeight: tab === tabItem.key ? 600 : 400,
              fontSize: "var(--mu-font-size-sm)",
              transition: "all var(--mu-transition-fast)",
            }}
          >
            <i className={tabItem.icon} style={{ marginRight: 6 }} />
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <>
          {/* Active Loans */}
          <div className="mu-card" style={{ marginBottom: 24 }}>
            <div className="mu-card-header">
              <h4>
                <i className="bi bi-journal-check" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
                Active Loans
              </h4>
              <span className="mu-badge mu-badge-primary">
                {profile?.active_loans?.length || 0} Loan(s)
              </span>
            </div>
            <div className="mu-card-body" style={{ padding: 0 }}>
              {profile?.active_loans?.length ? (
                <div className="mu-table-wrapper">
                  <table className="mu-table mu-table-hover">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Due</th>
                        <th>Status</th>
                        <th style={{ textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.active_loans.map((loan) => (
                        <tr key={loan.id}>
                          <td>
                            <strong>{loan.book_detail?.title}</strong>
                          </td>
                          <td>{loan.due_date}</td>
                          <td><LoanStatusBadge loan={loan} /></td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-outline-primary"
                              onClick={() => handleRenew(loan.id)}
                            >
                              <i className="bi bi-arrow-repeat" />
                              Renew
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                  <i className="bi bi-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>No books currently borrowed.</p>
                </div>
              )}
            </div>
          </div>

          {/* Reservations */}
          <div className="mu-card" style={{ marginBottom: 24 }}>
            <div className="mu-card-header">
              <h4>
                <i className="bi bi-bookmark-star" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
                Reservations
              </h4>
              <span className="mu-badge mu-badge-primary">
                {profile?.reservations?.length || 0} Reservation(s)
              </span>
            </div>
            <div className="mu-card-body" style={{ padding: 0 }}>
              {profile?.reservations?.length ? (
                <div className="mu-table-wrapper">
                  <table className="mu-table mu-table-hover">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th style={{ textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.reservations.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.book_detail?.title}</strong>
                          </td>
                          <td>
                            <span className={`mu-badge ${
                              r.status === "pending" ? "mu-badge-warning" :
                              r.status === "fulfilled" ? "mu-badge-success" :
                              "mu-badge-gray"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td>{new Date(r.expires_at).toLocaleDateString()}</td>
                          <td style={{ textAlign: "center" }}>
                            {r.status === "pending" && (
                              <button
                                className="mu-btn mu-btn-sm mu-btn-danger"
                                onClick={() => handleCancelReservation(r.id)}
                              >
                                <i className="bi bi-x-circle" />
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
                <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                  <i className="bi bi-bookmark-star" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>No reservations.</p>
                </div>
              )}
            </div>
          </div>

          {/* Fines */}
          <div className="mu-card">
            <div className="mu-card-header">
              <h4>
                <i className="bi bi-cash-coin" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
                Fines
              </h4>
              <span className="mu-badge mu-badge-primary">
                {profile?.fines?.length || 0} Fine(s)
              </span>
            </div>
            <div className="mu-card-body" style={{ padding: 0 }}>
              {profile?.fines?.length ? (
                <div className="mu-table-wrapper">
                  <table className="mu-table mu-table-hover">
                    <thead>
                      <tr>
                        <th>Reason</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.fines.map((f) => (
                        <tr key={f.id}>
                          <td style={{ textTransform: "capitalize" }}>
                            <span className="mu-badge mu-badge-primary">{f.reason}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span className="mu-badge mu-badge-info">{money(f.amount)}</span>
                          </td>
                          <td>
                            {f.is_waived ? (
                              <span className="mu-badge mu-badge-gray">Waived</span>
                            ) : f.is_paid ? (
                              <span className="mu-badge mu-badge-success">
                                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                                Paid
                              </span>
                            ) : (
                              <span className="mu-badge mu-badge-danger">
                                <i className="bi bi-exclamation-triangle" style={{ marginRight: 4 }} />
                                Unpaid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                  <i className="bi bi-check-circle" style={{ fontSize: 24, display: "block", marginBottom: 8, color: "var(--mu-success)" }} />
                  <p style={{ margin: 0 }}>No fines on your account.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Browse Tab */}
      {tab === "browse" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-search" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
              Browse the Catalog
            </h4>
          </div>
          <div className="mu-card-body">
            <form onSubmit={runSearch} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div style={{ flex: "1 1 260px" }}>
                <input
                  className="mu-input"
                  placeholder="Search by title, author or ISBN"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button className="mu-btn mu-btn-primary" type="submit" disabled={searching}>
                {searching ? (
                  <>
                    <i className="bi bi-arrow-repeat mu-animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <i className="bi bi-search" />
                    Search
                  </>
                )}
              </button>
            </form>

            {books.length > 0 ? (
              <div className="mu-table-wrapper" style={{ marginTop: 16 }}>
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Author(s)</th>
                      <th style={{ textAlign: "center" }}>Available</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.title}</strong>
                        </td>
                        <td>{b.authors}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="mu-badge mu-badge-info">
                            {b.available_copies} / {b.total_copies}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {b.available_copies > 0 ? (
                            <span className="mu-badge mu-badge-success">
                              <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                              Borrow at the desk
                            </span>
                          ) : (
                            <button
                              className="mu-btn mu-btn-sm mu-btn-outline-primary"
                              onClick={() => handleReserve(b.id)}
                            >
                              <i className="bi bi-bookmark-star" />
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
              <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-search" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                <p style={{ margin: 0 }}>Search the catalog to see availability and place a reservation.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-clock-history" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
              Loan History
            </h4>
            <span className="mu-badge mu-badge-primary">
              {profile?.loan_history?.length || 0} Record(s)
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {profile?.loan_history?.length ? (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Borrowed</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.loan_history.map((loan) => (
                      <tr key={loan.id}>
                        <td>
                          <strong>{loan.book_detail?.title}</strong>
                        </td>
                        <td>{new Date(loan.borrowed_at).toLocaleDateString()}</td>
                        <td>{loan.due_date}</td>
                        <td><LoanStatusBadge loan={loan} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-clock-history" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No History</h3>
                <p style={{ margin: "8px 0 0" }}>No past loans yet.</p>
              </div>
            )}
          </div>
          {profile?.loan_history?.length > 0 && (
            <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                Total: {profile.loan_history.length} record(s)
              </span>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
                Last updated: {new Date().toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}