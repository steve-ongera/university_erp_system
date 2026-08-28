import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

function LoanStatusBadge({ loan }) {
  if (loan.status === "returned") return <span className="mu-badge mu-badge-gray">Returned</span>;
  if (loan.status === "lost") return <span className="mu-badge mu-badge-danger">Lost</span>;
  if (loan.is_overdue) return <span className="mu-badge mu-badge-danger">{loan.days_overdue}d overdue</span>;
  return <span className="mu-badge mu-badge-success">Active</span>;
}

export default function LibraryCirculation() {
  const [subTab, setSubTab] = useState("issue");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // --- issue form state ---
  const [username, setUsername] = useState("");
  const [member, setMember] = useState(null);
  const [memberLookupError, setMemberLookupError] = useState("");
  const [bookQuery, setBookQuery] = useState("");
  const [availableCopies, setAvailableCopies] = useState([]);
  const [selectedCopy, setSelectedCopy] = useState("");
  const [issuing, setIssuing] = useState(false);

  // --- loans lists ---
  const [activeLoans, setActiveLoans] = useState([]);
  const [overdueLoans, setOverdueLoans] = useState([]);
  const [returnTarget, setReturnTarget] = useState(null);

  const loadActive = async () => {
    setLoading(true);
    try {
      const { data } = await libraryApi.loans({ status: "active" });
      setActiveLoans(data.results || data);
    } catch {
      setActiveLoans([]);
    } finally {
      setLoading(false);
    }
  };
  const loadOverdue = async () => {
    setLoading(true);
    try {
      const { data } = await libraryApi.overdueLoans();
      setOverdueLoans(data.results || data);
    } catch {
      setOverdueLoans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError("");
    setNotice("");
    if (subTab === "active") loadActive();
    if (subTab === "overdue") loadOverdue();
  }, [subTab]);

  const lookupMember = async (e) => {
    e.preventDefault();
    setMemberLookupError("");
    setMember(null);
    try {
      const { data } = await libraryApi.memberLookup(username.trim());
      setMember(data);
    } catch (e) {
      setMemberLookupError(e.response?.data?.detail || "Member not found.");
    }
  };

  const searchAvailableCopies = async (e) => {
    e.preventDefault();
    try {
      const { data } = await libraryApi.copies({ status: "available", search: bookQuery });
      setAvailableCopies(data.results || data);
    } catch {
      setAvailableCopies([]);
    }
  };

  const issueBook = async () => {
    if (!member?.id || !selectedCopy) return;
    setIssuing(true);
    setError("");
    setNotice("");
    try {
      await libraryApi.issueLoan(member.id, selectedCopy);
      const name = member.user_detail
        ? `${member.user_detail.first_name} ${member.user_detail.last_name}`
        : username;
      setNotice(` Book issued to ${name}.`);
      setSelectedCopy("");
      setAvailableCopies([]);
      setBookQuery("");
      lookupMember({ preventDefault: () => {} });
    } catch (e) {
      setError(e.response?.data?.detail || "Could not issue this book.");
    } finally {
      setIssuing(false);
    }
  };

  const openReturn = (loan) => setReturnTarget({ ...loan, is_lost: false, is_damaged: false, condition_notes: "" });

  const submitReturn = async () => {
    try {
      await libraryApi.returnLoan(returnTarget.id, {
        is_lost: returnTarget.is_lost,
        is_damaged: returnTarget.is_damaged,
        condition_notes: returnTarget.condition_notes,
      });
      setNotice(" Loan closed successfully.");
      setReturnTarget(null);
      if (subTab === "active") loadActive();
      if (subTab === "overdue") loadOverdue();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not process the return.");
    }
  };

  const renew = async (loanId) => {
    try {
      await libraryApi.renewLoan(loanId);
      setNotice(" Loan renewed successfully.");
      if (subTab === "active") loadActive();
      if (subTab === "overdue") loadOverdue();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not renew this loan.");
    }
  };

  // Tabs configuration
  const tabs = [
    { key: "issue", label: "Issue a Book", icon: "bi-arrow-left-right" },
    { key: "active", label: "Active Loans", icon: "bi-journal-bookmark" },
    { key: "overdue", label: "Overdue", icon: "bi-exclamation-triangle" },
  ];

  if (loading && subTab !== "issue") {
    return <LoadingSpinner text="Loading loans..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-arrow-left-right" />
            Circulation
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Library <span className="separator">/</span> Circulation
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/library/dashboard" className="mu-btn mu-btn-outline-primary">
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
      {notice && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--mu-border)", marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSubTab(tab.key)}
            style={{
              border: "none",
              borderBottom: subTab === tab.key ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
              borderRadius: 0,
              background: "transparent",
              padding: "8px 16px",
              cursor: "pointer",
              color: subTab === tab.key ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
              fontWeight: subTab === tab.key ? 600 : 400,
              fontSize: "var(--mu-font-size-sm)",
              transition: "all var(--mu-transition-fast)",
            }}
          >
            <i className={tab.icon} style={{ marginRight: 6 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Issue Tab */}
      {subTab === "issue" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-person-check" style={{ marginRight: 8 }} />
              Step 1: Find the Member
            </h4>
          </div>
          <div className="mu-card-body">
            <form onSubmit={lookupMember} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div style={{ flex: "1 1 240px" }}>
                <input
                  className="mu-input"
                  placeholder="Registration / employee number"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <button className="mu-btn mu-btn-outline-primary" type="submit">
                <i className="bi bi-search" />
                Look Up
              </button>
            </form>

            {memberLookupError && (
              <div className="mu-alert mu-alert-danger" style={{ marginTop: 12 }}>
                <i className="bi bi-exclamation-triangle" />
                {memberLookupError}
              </div>
            )}

            {member && (
              <div className="mu-alert mu-alert-info" style={{ marginTop: 12 }}>
                <i className="bi bi-person" />
                <div>
                  <strong>{member.user_detail?.first_name} {member.user_detail?.last_name}</strong>
                  <span style={{ margin: "0 8px" }}>·</span>
                  Card: {member.library_card_number}
                  <span style={{ margin: "0 8px" }}>·</span>
                  {member.eligibility?.eligible ? (
                    <span className="mu-badge mu-badge-success">Eligible to borrow</span>
                  ) : (
                    <span className="mu-badge mu-badge-danger">{member.eligibility?.reason}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "issue" && (
        <div className="mu-card" style={{ marginTop: 24 }}>
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-search" style={{ marginRight: 8 }} />
              Step 2: Find an Available Copy
            </h4>
          </div>
          <div className="mu-card-body">
            <form onSubmit={searchAvailableCopies} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div style={{ flex: "1 1 240px" }}>
                <input
                  className="mu-input"
                  placeholder="Title or accession number"
                  value={bookQuery}
                  onChange={(e) => setBookQuery(e.target.value)}
                />
              </div>
              <button className="mu-btn mu-btn-outline-primary" type="submit">
                <i className="bi bi-search" />
                Search
              </button>
            </form>

            {availableCopies.length > 0 && (
              <div className="mu-form-group" style={{ marginTop: 12 }}>
                <label>Select Copy</label>
                <select
                  className="mu-select"
                  value={selectedCopy}
                  onChange={(e) => setSelectedCopy(e.target.value)}
                >
                  <option value="">— Choose a copy —</option>
                  {availableCopies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.accession_number} — {c.shelf_location || "no shelf set"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="mu-btn mu-btn-primary"
              disabled={!member?.eligibility?.eligible || !selectedCopy || issuing}
              onClick={issueBook}
            >
              {issuing ? (
                <>
                  <i className="bi bi-arrow-repeat mu-animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle" />
                  Issue Book
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Active Loans Tab */}
      {subTab === "active" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-journal-bookmark" style={{ marginRight: 8 }} />
              Active Loans
            </h4>
            <span className="mu-badge mu-badge-primary">
              {activeLoans.length} Loan(s)
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {activeLoans.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Active Loans</h3>
                <p style={{ margin: "8px 0 0" }}>There are no active loans at the moment.</p>
              </div>
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Title</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLoans.map((loan) => (
                      <tr key={loan.id}>
                        <td>
                          {loan.member_detail?.user_detail?.first_name} {loan.member_detail?.user_detail?.last_name}
                        </td>
                        <td>{loan.book_detail?.title}</td>
                        <td>{loan.due_date}</td>
                        <td><LoanStatusBadge loan={loan} /></td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-outline-primary"
                              onClick={() => renew(loan.id)}
                            >
                              <i className="bi bi-arrow-repeat" />
                              Renew
                            </button>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-primary"
                              onClick={() => openReturn(loan)}
                            >
                              <i className="bi bi-arrow-return-left" />
                              Return
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {activeLoans.length > 0 && (
            <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                Total: {activeLoans.length} active loan(s)
              </span>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
                Last updated: {new Date().toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Overdue Tab */}
      {subTab === "overdue" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-exclamation-triangle" style={{ marginRight: 8 }} />
              Overdue Loans
            </h4>
            <span className="mu-badge mu-badge-danger">
              {overdueLoans.length} Overdue
            </span>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            {overdueLoans.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-check-circle" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-success)" }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>Nothing Overdue</h3>
                <p style={{ margin: "8px 0 0" }}>All loans are in good standing.</p>
              </div>
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Title</th>
                      <th>Due Date</th>
                      <th>Days Overdue</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueLoans.map((loan) => (
                      <tr key={loan.id}>
                        <td>
                          {loan.member_detail?.user_detail?.first_name} {loan.member_detail?.user_detail?.last_name}
                        </td>
                        <td>{loan.book_detail?.title}</td>
                        <td>{loan.due_date}</td>
                        <td>
                          <span className="mu-badge mu-badge-danger">
                            <i className="bi bi-clock" style={{ marginRight: 4 }} />
                            {loan.days_overdue}d
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="mu-btn mu-btn-sm mu-btn-primary"
                            onClick={() => openReturn(loan)}
                          >
                            <i className="bi bi-arrow-return-left" />
                            Return
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {overdueLoans.length > 0 && (
            <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                Total: {overdueLoans.length} overdue loan(s)
              </span>
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
                Last updated: {new Date().toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Return Modal */}
      {returnTarget && (
        <Modal
          isOpen={true}
          onClose={() => setReturnTarget(null)}
          title={`Return "${returnTarget.book_detail?.title}"`}
          size="md"
          confirmText="Confirm Return"
          onConfirm={submitReturn}
        >
          <div className="mu-checkbox" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={returnTarget.is_lost}
              onChange={(e) => setReturnTarget({ ...returnTarget, is_lost: e.target.checked, is_damaged: false })}
              id="is_lost"
            />
            <label htmlFor="is_lost">Reported lost (replacement fine applies)</label>
          </div>

          {!returnTarget.is_lost && (
            <div className="mu-checkbox" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={returnTarget.is_damaged}
                onChange={(e) => setReturnTarget({ ...returnTarget, is_damaged: e.target.checked })}
                id="is_damaged"
              />
              <label htmlFor="is_damaged">Returned damaged (damage fine applies)</label>
            </div>
          )}

          {returnTarget.is_damaged && (
            <div className="mu-form-group">
              <label>Condition Notes</label>
              <textarea
                className="mu-textarea"
                rows={3}
                value={returnTarget.condition_notes}
                onChange={(e) => setReturnTarget({ ...returnTarget, condition_notes: e.target.value })}
                placeholder="Describe the damage..."
              />
            </div>
          )}

          {returnTarget.is_overdue && (
            <div className="mu-alert mu-alert-danger">
              <i className="bi bi-exclamation-triangle" />
              This loan is <strong>{returnTarget.days_overdue}</strong> day(s) overdue — an overdue fine will be raised automatically.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}