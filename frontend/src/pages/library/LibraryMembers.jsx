import { useEffect, useState } from "react";
import { libraryApi } from "../../services/api";
import LibraryNav from "./LibraryNav";
import "../../style/library.css";

export default function LibraryMembers() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");

  // quick lookup / auto-create
  const [lookupUsername, setLookupUsername] = useState("");

  const load = async () => {
    try {
      const { data } = await libraryApi.members(search ? { search } : {});
      setMembers(data.results || data);
    } catch {
      setError("Could not load members.");
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = (e) => { e.preventDefault(); load(); };

  const lookup = async (e) => {
    e.preventDefault();
    setError(""); setNotice("");
    try {
      await libraryApi.memberLookup(lookupUsername.trim());
      setNotice(`Member record ready for ${lookupUsername.trim()}.`);
      setLookupUsername("");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "User not found.");
    }
  };

  const suspend = async () => {
    try {
      await libraryApi.suspendMember(suspendTarget.id, suspendReason);
      setSuspendTarget(null);
      setSuspendReason("");
      setNotice("Member suspended.");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not suspend member.");
    }
  };

  const reinstate = async (id) => {
    try {
      await libraryApi.reinstateMember(id);
      setNotice("Member reinstated.");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not reinstate member.");
    }
  };

  return (
    <div className="lib-page">
      <div className="lib-header">
        <div>
          <h1 className="lib-title"><i className="bi bi-people" /> Members</h1>
          <p className="lib-subtitle">Library membership records — created automatically on first visit.</p>
        </div>
      </div>

      <LibraryNav />

      {error && <div className="lib-alert lib-alert-error">{error}</div>}
      {notice && <div className="lib-alert lib-alert-success">{notice}</div>}

      <div className="lib-card">
        <h2 className="lib-card-title"><i className="bi bi-person-plus" /> Quick lookup / enroll</h2>
        <form className="lib-toolbar-left" onSubmit={lookup}>
          <input
            className="lib-input"
            style={{ minWidth: 260 }}
            placeholder="Registration / employee number"
            value={lookupUsername}
            onChange={(e) => setLookupUsername(e.target.value)}
          />
          <button className="lib-btn lib-btn-primary" type="submit">Look up / create</button>
        </form>
      </div>

      <div className="lib-card">
        <div className="lib-toolbar">
          <form className="lib-toolbar-left" onSubmit={runSearch}>
            <input className="lib-input" placeholder="Search name, card number, username" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="lib-btn lib-btn-outline" type="submit">Search</button>
          </form>
        </div>
        <div className="lib-table-wrap">
          <table className="lib-table">
            <thead><tr><th>Name</th><th>Card #</th><th>Active loans</th><th>Fines owed</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user_detail?.first_name} {m.user_detail?.last_name}</td>
                  <td>{m.library_card_number}</td>
                  <td>{m.active_loans_count}</td>
                  <td>Ksh {Number(m.outstanding_fines_total || 0).toLocaleString()}</td>
                  <td>
                    {m.is_suspended
                      ? <span className="lib-badge lib-badge-red">Suspended</span>
                      : <span className="lib-badge lib-badge-green">Active</span>}
                  </td>
                  <td>
                    {m.is_suspended ? (
                      <button className="lib-btn lib-btn-outline lib-btn-sm" onClick={() => reinstate(m.id)}>Reinstate</button>
                    ) : (
                      <button className="lib-btn lib-btn-danger lib-btn-sm" onClick={() => setSuspendTarget(m)}>Suspend</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!members.length && <div className="lib-empty">No members found.</div>}
        </div>
      </div>

      {suspendTarget && (
        <div className="lib-modal-backdrop" onClick={() => setSuspendTarget(null)}>
          <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Suspend {suspendTarget.user_detail?.first_name} {suspendTarget.user_detail?.last_name}</h3>
            <div className="lib-field">
              <label>Reason</label>
              <textarea className="lib-textarea" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
            </div>
            <div className="lib-modal-actions">
              <button className="lib-btn lib-btn-outline" onClick={() => setSuspendTarget(null)}>Cancel</button>
              <button className="lib-btn lib-btn-danger" onClick={suspend}>Suspend member</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}