import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const money = (v) => `Ksh ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function LibraryFines() {
  const [fines, setFines] = useState([]);
  const [filter, setFilter] = useState("unpaid");
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [waiveReason, setWaiveReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === "unpaid") { params.is_paid = false; params.is_waived = false; }
      if (filter === "paid") params.is_paid = true;
      if (filter === "waived") params.is_waived = true;
      const { data } = await libraryApi.fines(params);
      setFines(data.results || data);
      setSelected([]);
    } catch {
      setError("Could not load fines.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const payable = fines.filter((f) => !f.is_paid && !f.is_waived);
  const selectedTotal = fines
    .filter((f) => selected.includes(f.id))
    .reduce((sum, f) => sum + Number(f.amount), 0);

  const payFines = async () => {
    if (!selected.length) return;
    setError("");
    setNotice("");
    try {
      const { data } = await libraryApi.payFines(selected);
      setNotice(` Recorded payment for ${data.paid} fine(s).`);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not record payment.");
    }
  };

  const waive = async () => {
    try {
      await libraryApi.waiveFine(waiveTarget.id, waiveReason);
      setWaiveTarget(null);
      setWaiveReason("");
      setNotice(" Fine waived successfully.");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not waive fine.");
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading fines..." />;
  }

  // Calculate stats
  const stats = {
    total: fines.length,
    unpaid: fines.filter(f => !f.is_paid && !f.is_waived).length,
    paid: fines.filter(f => f.is_paid).length,
    waived: fines.filter(f => f.is_waived).length,
    totalAmount: fines.reduce((sum, f) => sum + Number(f.amount), 0),
    unpaidAmount: fines.filter(f => !f.is_paid && !f.is_waived).reduce((sum, f) => sum + Number(f.amount), 0),
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-cash-coin" />
            Fines
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Library <span className="separator">/</span> Fines
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
          Overdue, lost and damage fines. Once raised a fine is never edited — only paid or waived.
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
      <div className="mu-dashboard-grid" style={{ marginBottom: 24, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-cash-coin" />
          </div>
          <div className="mu-stat-label">Total Fines</div>
          <div className="mu-stat-value">{stats.total}</div>
          <div className="mu-stat-change up" style={{ color: "var(--mu-gray-500)" }}>
            Total: {money(stats.totalAmount)}
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-exclamation-triangle" />
          </div>
          <div className="mu-stat-label">Unpaid</div>
          <div className="mu-stat-value">{stats.unpaid}</div>
          <div className="mu-stat-change down" style={{ color: "var(--mu-danger)" }}>
            {money(stats.unpaidAmount)}
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Paid</div>
          <div className="mu-stat-value">{stats.paid}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gray">
            <i className="bi bi-slash-circle" />
          </div>
          <div className="mu-stat-label">Waived</div>
          <div className="mu-stat-value">{stats.waived}</div>
        </div>
      </div>

      {/* Fines Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-cash-coin" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Fines
          </h4>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="mu-badge mu-badge-primary">
              {fines.length} Fine(s)
            </span>
            <select
              className="mu-select"
              style={{ width: 120, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="waived">Waived</option>
              <option value="all">All</option>
            </select>
            {filter === "unpaid" && (
              <button
                className="mu-btn mu-btn-sm mu-btn-primary"
                disabled={!selected.length}
                onClick={payFines}
              >
                <i className="bi bi-check2-circle" />
                Pay ({selected.length ? money(selectedTotal) : "select"})
              </button>
            )}
          </div>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {fines.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-cash-coin" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Fines Found</h3>
              <p style={{ margin: "8px 0 0" }}>No fines for this filter.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    {filter === "unpaid" && <th style={{ width: 40 }}></th>}
                    <th>Member</th>
                    <th>Reason</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Raised</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((f) => (
                    <tr key={f.id}>
                      {filter === "unpaid" && (
                        <td>
                          <input
                            type="checkbox"
                            className="mu-checkbox-input"
                            checked={selected.includes(f.id)}
                            onChange={() => toggleSelect(f.id)}
                          />
                        </td>
                      )}
                      <td>
                        <strong>
                          {f.member_detail?.user_detail?.first_name} {f.member_detail?.user_detail?.last_name}
                        </strong>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary" style={{ textTransform: "capitalize" }}>
                          {f.reason}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="mu-badge mu-badge-info">
                          {money(f.amount)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {new Date(f.created_at).toLocaleDateString()}
                        </span>
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
                      <td style={{ textAlign: "center" }}>
                        {!f.is_paid && !f.is_waived && (
                          <button
                            className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            onClick={() => setWaiveTarget(f)}
                          >
                            <i className="bi bi-slash-circle" />
                            Waive
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
        {fines.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {fines.length} fine(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Waive Modal */}
      {waiveTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            setWaiveTarget(null);
            setWaiveReason("");
          }}
          title={`Waive ${money(waiveTarget.amount)} Fine`}
          size="md"
          confirmText="Waive Fine"
          onConfirm={waive}
        >
          <div className="mu-form-group">
            <label>Reason for Waiving</label>
            <textarea
              className="mu-textarea"
              rows={3}
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              placeholder="Enter reason for waiving this fine..."
            />
          </div>
          <div className="mu-alert mu-alert-warning" style={{ marginTop: 12 }}>
            <i className="bi bi-exclamation-triangle" />
            <div>
              <strong>Warning:</strong> This action cannot be undone. The fine will be marked as waived.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}