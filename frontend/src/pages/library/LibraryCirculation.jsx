import { useEffect, useState } from "react";
import { libraryApi } from "../../services/api";
import LibraryNav from "./LibraryNav";
import "../../style/library.css";

function LoanStatusBadge({ loan }) {
  if (loan.status === "returned") return <span className="lib-badge lib-badge-gray">Returned</span>;
  if (loan.status === "lost") return <span className="lib-badge lib-badge-red">Lost</span>;
  if (loan.is_overdue) return <span className="lib-badge lib-badge-red">{loan.days_overdue}d overdue</span>;
  return <span className="lib-badge lib-badge-green">Active</span>;
}

export default function LibraryCirculation() {
  const [subTab, setSubTab] = useState("issue");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    const { data } = await libraryApi.loans({ status: "active" });
    setActiveLoans(data.results || data);
  };
  const loadOverdue = async () => {
    const { data } = await libraryApi.overdueLoans();
    setOverdueLoans(data.results || data);
  };

  useEffect(() => {
    setError(""); setNotice("");
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
    setError(""); setNotice("");
    try {
      await libraryApi.issueLoan(member.id, selectedCopy);
      const name = member.user_detail
        ? `${member.user_detail.first_name} ${member.user_detail.last_name}`
        : username;
      setNotice(`Book issued to ${name}.`);
      setSelectedCopy("");
      setAvailableCopies([]);
      setBookQuery("");
      // refresh member eligibility snapshot
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
      setNotice("Loan closed.");
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
      setNotice("Loan renewed.");
      if (subTab === "active") loadActive();
      if (subTab === "overdue") loadOverdue();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not renew this loan.");
    }
  };

  return (
    <div className="lib-page">
      <div className="lib-header">
        <div>
          <h1 className="lib-title"><i className="bi bi-arrow-left-right" /> Circulation</h1>
          <p className="lib-subtitle">Issue new loans and process returns.</p>
        </div>
      </div>

      <LibraryNav />

      {error && <div className="lib-alert lib-alert-error">{error}</div>}
      {notice && <div className="lib-alert lib-alert-success">{notice}</div>}

      <div className="lib-tabs-inline">
        {["issue", "active", "overdue"].map((t) => (
          <button key={t} className={`lib-tab-btn ${subTab === t ? "active" : ""}`} onClick={() => setSubTab(t)}>
            {t === "issue" ? "Issue a book" : t === "active" ? "Active loans" : "Overdue"}
          </button>
        ))}
      </div>

      {subTab === "issue" && (
        <div className="lib-card">
          <h2 className="lib-card-title"><i className="bi bi-person-check" /> 1. Find the member</h2>
          <form className="lib-toolbar" onSubmit={lookupMember}>
            <div className="lib-toolbar-left" style={{ flex: 1 }}>
              <input
                className="lib-input"
                style={{ minWidth: 240 }}
                placeholder="Registration / employee number"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <button className="lib-btn lib-btn-outline" type="submit">Look up</button>
            </div>
          </form>
          {memberLookupError && <div className="lib-alert lib-alert-error">{memberLookupError}</div>}
          {member && (
            <div className="lib-alert" style={{ background: "#eef1f3" }}>
              <strong>{member.user_detail?.first_name} {member.user_detail?.last_name}</strong> — card {member.library_card_number}
              {" · "}
              {member.eligibility?.eligible ? (
                <span className="lib-badge lib-badge-green">Eligible to borrow</span>
              ) : (
                <span className="lib-badge lib-badge-red">{member.eligibility?.reason}</span>
              )}
            </div>
          )}

          <h2 className="lib-card-title" style={{ marginTop: 20 }}><i className="bi bi-search" /> 2. Find an available copy</h2>
          <form className="lib-toolbar" onSubmit={searchAvailableCopies}>
            <div className="lib-toolbar-left" style={{ flex: 1 }}>
              <input
                className="lib-input"
                style={{ minWidth: 240 }}
                placeholder="Title or accession number"
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
              />
              <button className="lib-btn lib-btn-outline" type="submit">Search</button>
            </div>
          </form>
          {!!availableCopies.length && (
            <div className="lib-field">
              <label>Select copy</label>
              <select className="lib-select" value={selectedCopy} onChange={(e) => setSelectedCopy(e.target.value)}>
                <option value="">— Choose a copy —</option>
                {availableCopies.map((c) => (
                  <option key={c.id} value={c.id}>{c.accession_number} — {c.shelf_location || "no shelf set"}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              className="lib-btn lib-btn-primary"
              disabled={!member?.eligibility?.eligible || !selectedCopy || issuing}
              onClick={issueBook}
            >
              {issuing ? "Issuing…" : "Issue book"}
            </button>
          </div>
        </div>
      )}

      {subTab === "active" && (
        <div className="lib-card">
          <div className="lib-table-wrap">
            <table className="lib-table">
              <thead><tr><th>Member</th><th>Title</th><th>Due</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {activeLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.member_detail?.user_detail?.first_name} {loan.member_detail?.user_detail?.last_name}</td>
                    <td>{loan.book_detail?.title}</td>
                    <td>{loan.due_date}</td>
                    <td><LoanStatusBadge loan={loan} /></td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="lib-btn lib-btn-outline lib-btn-sm" onClick={() => renew(loan.id)}>Renew</button>
                      <button className="lib-btn lib-btn-primary lib-btn-sm" onClick={() => openReturn(loan)}>Return</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!activeLoans.length && <div className="lib-empty">No active loans.</div>}
          </div>
        </div>
      )}

      {subTab === "overdue" && (
        <div className="lib-card">
          <div className="lib-table-wrap">
            <table className="lib-table">
              <thead><tr><th>Member</th><th>Title</th><th>Due</th><th>Days overdue</th><th></th></tr></thead>
              <tbody>
                {overdueLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.member_detail?.user_detail?.first_name} {loan.member_detail?.user_detail?.last_name}</td>
                    <td>{loan.book_detail?.title}</td>
                    <td>{loan.due_date}</td>
                    <td><span className="lib-badge lib-badge-red">{loan.days_overdue}d</span></td>
                    <td>
                      <button className="lib-btn lib-btn-primary lib-btn-sm" onClick={() => openReturn(loan)}>Return</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!overdueLoans.length && <div className="lib-empty">Nothing overdue right now.</div>}
          </div>
        </div>
      )}

      {returnTarget && (
        <div className="lib-modal-backdrop" onClick={() => setReturnTarget(null)}>
          <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Return "{returnTarget.book_detail?.title}"</h3>
            <div className="lib-checkbox-row">
              <input
                type="checkbox"
                checked={returnTarget.is_lost}
                onChange={(e) => setReturnTarget({ ...returnTarget, is_lost: e.target.checked, is_damaged: false })}
              />
              Reported lost (replacement fine applies)
            </div>
            {!returnTarget.is_lost && (
              <div className="lib-checkbox-row">
                <input
                  type="checkbox"
                  checked={returnTarget.is_damaged}
                  onChange={(e) => setReturnTarget({ ...returnTarget, is_damaged: e.target.checked })}
                />
                Returned damaged (damage fine applies)
              </div>
            )}
            {returnTarget.is_damaged && (
              <div className="lib-field">
                <label>Condition notes</label>
                <textarea
                  className="lib-textarea"
                  value={returnTarget.condition_notes}
                  onChange={(e) => setReturnTarget({ ...returnTarget, condition_notes: e.target.value })}
                />
              </div>
            )}
            {returnTarget.is_overdue && (
              <div className="lib-alert lib-alert-error">
                This loan is {returnTarget.days_overdue} day(s) overdue — an overdue fine will be raised automatically.
              </div>
            )}
            <div className="lib-modal-actions">
              <button className="lib-btn lib-btn-outline" onClick={() => setReturnTarget(null)}>Cancel</button>
              <button className="lib-btn lib-btn-primary" onClick={submitReturn}>Confirm return</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}