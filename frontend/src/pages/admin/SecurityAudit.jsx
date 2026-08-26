// src/pages/admin/SecurityAudit.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

const TABS = [
  { key: "overview", label: "Overview", icon: "bi-shield-check" },
  { key: "locked", label: "Locked Accounts", icon: "bi-lock" },
  { key: "sessions", label: "Login Sessions", icon: "bi-laptop" },
  { key: "attempts", label: "Login Attempts", icon: "bi-key" },
  { key: "alerts", label: "Alerts", icon: "bi-exclamation-triangle" },
];

export default function SecurityAudit() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [toast, setToast] = useState("");
  const [unlockTarget, setUnlockTarget] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const loadDashboard = useCallback(() => {
    setLoadingDashboard(true);
    adminApi.securityDashboard()
      .then(({ data }) => setDashboard(data))
      .catch(() => setDashboard(null))
      .finally(() => setLoadingDashboard(false));
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleUnlock = async (notes) => {
    try {
      await adminApi.unlockUser(unlockTarget.id, notes);
      showToast(`${unlockTarget.username} unlocked.`);
      setUnlockTarget(null);
      loadDashboard();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not unlock account.");
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      await adminApi.resolveAlert(id);
      showToast("Alert resolved.");
      loadDashboard();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not resolve alert.");
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-shield-lock" /> Security Audit</h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Security Audit
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" /> Back to Dashboard
          </Link>
        </div>
      </div>

      {toast && (
        <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="Locked Accounts" value={dashboard?.stats?.locked_accounts ?? "—"} tone="danger" />
        <StatCard label="Unresolved Alerts" value={dashboard?.stats?.unresolved_alerts ?? "—"} tone="warning" />
        <StatCard label="Failed Logins Today" value={dashboard?.stats?.failed_logins_today ?? "—"} tone="warning" />
        <StatCard label="Sessions Today" value={dashboard?.stats?.active_sessions_today ?? "—"} tone="success" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--mu-border)", marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
              borderRadius: 0, background: "transparent", padding: "8px 16px", cursor: "pointer",
              color: activeTab === tab.key ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: "var(--mu-font-size-sm)",
            }}
          >
            <i className={`bi ${tab.icon}`} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        loadingDashboard ? <LoadingSpinner text="Loading security overview..." /> : (
          <div className="mu-dashboard-grid-2" style={{ gap: 16 }}>
            <div className="mu-card">
              <div className="mu-card-body">
                <h3 style={{ marginTop: 0 }}>Recent Failed Attempts</h3>
                <table className="mu-table">
                  <thead><tr><th>Username</th><th>IP</th><th>Reason</th><th>Time</th></tr></thead>
                  <tbody>
                    {(dashboard?.recent_failed_attempts || []).length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: "center", padding: 16, color: "var(--mu-gray-400)" }}>None recorded.</td></tr>
                    )}
                    {(dashboard?.recent_failed_attempts || []).map((a) => (
                      <tr key={a.id}>
                        <td>{a.username}</td>
                        <td>{a.ip_address}</td>
                        <td>{a.failure_reason}</td>
                        <td>{timeAgo(a.attempt_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mu-card">
              <div className="mu-card-body">
                <h3 style={{ marginTop: 0 }}>Recent Login Sessions</h3>
                <table className="mu-table">
                  <thead><tr><th>User</th><th>Device</th><th>IP</th><th>Time</th></tr></thead>
                  <tbody>
                    {(dashboard?.recent_sessions || []).length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: "center", padding: 16, color: "var(--mu-gray-400)" }}>None recorded.</td></tr>
                    )}
                    {(dashboard?.recent_sessions || []).map((sess) => (
                      <tr key={sess.id}>
                        <td>{fullName(sess.user_detail)}</td>
                        <td>{sess.device_label || "—"} {sess.otp_bypassed && <span className="mu-badge mu-badge-warning" style={{ fontSize: 10 }}>DEBUG bypass</span>}</td>
                        <td>{sess.ip_address}</td>
                        <td>{timeAgo(sess.login_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {activeTab === "locked" && (
        <div className="mu-card">
          <div className="mu-card-body" style={{ padding: 0 }}>
            <table className="mu-table">
              <thead>
                <tr><th>Username</th><th>Name</th><th>Role</th><th>Failed Attempts</th><th>Locked At</th><th style={{ textAlign: "center" }}>Action</th></tr>
              </thead>
              <tbody>
                {(dashboard?.locked_accounts || []).length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--mu-gray-400)" }}>
                    <i className="bi bi-shield-check" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                    No locked accounts.
                  </td></tr>
                )}
                {(dashboard?.locked_accounts || []).map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{fullName(u)}</td>
                    <td><span className="mu-badge mu-badge-primary">{u.user_type}</span></td>
                    <td>{u.failed_login_attempts}</td>
                    <td>{timeAgo(u.locked_at)}</td>
                    <td style={{ textAlign: "center" }}>
                      <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setUnlockTarget(u)}>
                        <i className="bi bi-unlock" /> Unlock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "sessions" && <SessionsTable />}
      {activeTab === "attempts" && <AttemptsTable />}
      {activeTab === "alerts" && (
        <AlertsTable onResolve={handleResolveAlert} />
      )}

      {unlockTarget && (
        <UnlockModal target={unlockTarget} onClose={() => setUnlockTarget(null)} onConfirm={handleUnlock} />
      )}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const colors = { danger: "var(--mu-danger)", warning: "var(--mu-warning, #c97d2a)", success: "var(--mu-success)" };
  return (
    <div className="mu-stat-card" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>{label}</div>
      <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: 700, color: colors[tone] || "inherit" }}>{value}</div>
    </div>
  );
}

function UnlockModal({ target, onClose, onConfirm }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen={true} onClose={onClose} title="Unlock Account" size="sm">
      <p>Unlock <strong>{target.username}</strong> ({fullName(target)})? Failed attempts will be reset to zero.</p>
      <div className="mu-form-group">
        <label>Notes (optional)</label>
        <textarea className="mu-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
        <button className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className="mu-btn mu-btn-primary"
          disabled={busy}
          onClick={async () => { setBusy(true); await onConfirm(notes); setBusy(false); }}
        >
          {busy ? <><i className="bi bi-arrow-repeat mu-animate-spin" /> Unlocking...</> : "Unlock Account"}
        </button>
      </div>
    </Modal>
  );
}

// --- Sessions tab: search + pagination, same filterScopeKey pattern used elsewhere ---
function SessionsTable() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await adminApi.loginSessions(params);
      setRows(data.results || data);
      setCount(data.count ?? (data.results || data).length);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const filterScopeKey = debouncedSearch;
  const prevKey = useRef(filterScopeKey);
  useEffect(() => {
    if (prevKey.current !== filterScopeKey) {
      prevKey.current = filterScopeKey;
      if (page !== 1) { setPage(1); return; }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, filterScopeKey]);

  return (
    <div className="mu-card">
      <div className="mu-card-body">
        <input
          className="mu-input" placeholder="Search by user, IP, device..."
          style={{ maxWidth: 320, marginBottom: 12 }}
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        {loading ? <LoadingSpinner text="Loading sessions..." /> : (
          <table className="mu-table">
            <thead><tr><th>User</th><th>Device</th><th>IP</th><th>2FA</th><th>Login At</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>No sessions found.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fullName(r.user_detail)} <span style={{ color: "var(--mu-gray-400)", fontSize: 12 }}>({r.user_detail?.username})</span></td>
                  <td>{r.device_label || "—"}</td>
                  <td>{r.ip_address}</td>
                  <td>{r.otp_bypassed ? <span className="mu-badge mu-badge-warning">Bypassed</span> : <span className="mu-badge mu-badge-success">Verified</span>}</td>
                  <td>{timeAgo(r.login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ fontSize: 12, color: "var(--mu-gray-500)" }}>{count} session(s)</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={rows.length < 20} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttemptsTable() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await adminApi.loginAttempts(params);
      setRows(data.results || data);
      setCount(data.count ?? (data.results || data).length);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const filterScopeKey = debouncedSearch;
  const prevKey = useRef(filterScopeKey);
  useEffect(() => {
    if (prevKey.current !== filterScopeKey) {
      prevKey.current = filterScopeKey;
      if (page !== 1) { setPage(1); return; }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, filterScopeKey]);

  return (
    <div className="mu-card">
      <div className="mu-card-body">
        <input
          className="mu-input" placeholder="Search by username, IP..."
          style={{ maxWidth: 320, marginBottom: 12 }}
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        {loading ? <LoadingSpinner text="Loading login attempts..." /> : (
          <table className="mu-table">
            <thead><tr><th>Username</th><th>IP</th><th>Result</th><th>Reason</th><th>Time</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>No attempts found.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.username}</td>
                  <td>{r.ip_address}</td>
                  <td>{r.success ? <span className="mu-badge mu-badge-success">Success</span> : <span className="mu-badge mu-badge-danger">Failed</span>}</td>
                  <td>{r.failure_reason || "—"}</td>
                  <td>{timeAgo(r.attempt_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ fontSize: 12, color: "var(--mu-gray-500)" }}>{count} attempt(s)</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={rows.length < 20} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertsTable({ onResolve }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page_size: 50 };
      if (!showResolved) params.is_resolved = false;
      const { data } = await adminApi.securityAlerts(params);
      setRows(data.results || data);
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mu-card">
      <div className="mu-card-body">
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13 }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show resolved alerts
        </label>
        {loading ? <LoadingSpinner text="Loading alerts..." /> : (
          <table className="mu-table">
            <thead><tr><th>Type</th><th>User</th><th>Message</th><th>Time</th><th style={{ textAlign: "center" }}>Action</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>No alerts.</td></tr>}
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><span className="mu-badge mu-badge-warning">{a.alert_type.replace("_", " ")}</span></td>
                  <td>{fullName(a.user_detail)}</td>
                  <td style={{ maxWidth: 400 }}>{a.message}</td>
                  <td>{timeAgo(a.created_at)}</td>
                  <td style={{ textAlign: "center" }}>
                    {a.is_resolved ? (
                      <span className="mu-badge mu-badge-success">Resolved</span>
                    ) : (
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => onResolve(a.id)}>
                        Mark Resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}