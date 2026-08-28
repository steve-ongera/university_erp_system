import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function LibraryMembers() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");

  // quick lookup / auto-create
  const [lookupUsername, setLookupUsername] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await libraryApi.members(search ? { search } : {});
      setMembers(data.results || data);
    } catch {
      setError("Could not load members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runSearch = (e) => {
    e.preventDefault();
    load();
  };

  const lookup = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await libraryApi.memberLookup(lookupUsername.trim());
      setNotice(` Member record ready for ${lookupUsername.trim()}.`);
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
      setNotice(" Member suspended successfully.");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not suspend member.");
    }
  };

  const reinstate = async (id) => {
    try {
      await libraryApi.reinstateMember(id);
      setNotice(" Member reinstated successfully.");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not reinstate member.");
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading members..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-people" />
            Members
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Library <span className="separator">/</span> Members
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
          Library membership records — created automatically on first visit.
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

      {/* Quick Lookup Card */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-person-plus" style={{ marginRight: 8 }} />
            Quick Lookup / Enroll
          </h4>
        </div>
        <div className="mu-card-body">
          <form onSubmit={lookup} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ flex: "1 1 260px" }}>
              <input
                className="mu-input"
                placeholder="Registration / employee number"
                value={lookupUsername}
                onChange={(e) => setLookupUsername(e.target.value)}
              />
            </div>
            <button className="mu-btn mu-btn-primary" type="submit">
              <i className="bi bi-search" />
              Look up / Create
            </button>
          </form>
        </div>
      </div>

      {/* Members Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-people" style={{ marginRight: 8 }} />
            All Members
          </h4>
          <span className="mu-badge mu-badge-primary">
            {members.length} Member(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {/* Search inside table */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mu-border)", background: "var(--mu-gray-50)" }}>
            <form onSubmit={runSearch} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div style={{ flex: "1 1 240px" }}>
                <input
                  className="mu-input"
                  placeholder="Search name, card number, username"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="mu-btn mu-btn-outline-primary" type="submit">
                <i className="bi bi-search" />
                Search
              </button>
            </form>
          </div>

          {members.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-people" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Members Found</h3>
              <p style={{ margin: "8px 0 0" }}>Use the lookup above to enroll a member.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Card #</th>
                    <th style={{ textAlign: "center" }}>Active Loans</th>
                    <th style={{ textAlign: "right" }}>Fines Owed</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>
                          {m.user_detail?.first_name} {m.user_detail?.last_name}
                        </strong>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {m.library_card_number}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-info">
                          {m.active_loans_count}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`mu-badge ${m.outstanding_fines_total > 0 ? "mu-badge-danger" : "mu-badge-success"}`}>
                          Ksh {Number(m.outstanding_fines_total || 0).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        {m.is_suspended ? (
                          <span className="mu-badge mu-badge-danger">
                            <i className="bi bi-pause-circle" style={{ marginRight: 4 }} />
                            Suspended
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Active
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {m.is_suspended ? (
                          <button
                            className="mu-btn mu-btn-sm mu-btn-success"
                            onClick={() => reinstate(m.id)}
                          >
                            <i className="bi bi-arrow-counterclockwise" />
                            Reinstate
                          </button>
                        ) : (
                          <button
                            className="mu-btn mu-btn-sm mu-btn-danger"
                            onClick={() => setSuspendTarget(m)}
                          >
                            <i className="bi bi-pause-circle" />
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {members.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {members.length} member(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Suspend Modal */}
      {suspendTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSuspendTarget(null);
            setSuspendReason("");
          }}
          title={`Suspend ${suspendTarget.user_detail?.first_name} ${suspendTarget.user_detail?.last_name}`}
          size="md"
          confirmText="Suspend Member"
          onConfirm={suspend}
          danger={true}
        >
          <div className="mu-form-group">
            <label>Reason for Suspension</label>
            <textarea
              className="mu-textarea"
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter reason for suspension..."
            />
          </div>
          <div className="mu-alert mu-alert-warning" style={{ marginTop: 12 }}>
            <i className="bi bi-exclamation-triangle" />
            <div>
              <strong>Warning:</strong> Suspended members cannot borrow books until reinstated.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}