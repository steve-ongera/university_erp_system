import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const STATUS_OPTIONS = ["pending", "approved", "rejected"];

const STATUS_STYLES = {
  pending: "mu-badge-warning",
  approved: "mu-badge-success",
  rejected: "mu-badge-danger",
};

export default function AdminReportings() {
  const [reportings, setReportings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("approved");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await adminApi.reportings(params);
      setReportings(data.results ?? data ?? []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load reportings.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === reportings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reportings.map((r) => r.id)));
    }
  };

  const handleRowStatusChange = async (id, newStatus) => {
    setRowBusyId(id);
    try {
      await adminApi.updateReportingStatus(id, newStatus);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update status.");
    } finally {
      setRowBusyId(null);
    }
  };

  const handleBulkApply = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError("");
    try {
      await adminApi.bulkUpdateReportingStatus(Array.from(selected), bulkStatus);
      setSelected(new Set());
      setConfirmModalOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Bulk update failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  const openBulkConfirm = () => {
    if (selected.size === 0) return;
    setBulkAction({ type: "bulk", status: bulkStatus, count: selected.size });
    setConfirmModalOpen(true);
  };

  if (loading) {
    return <LoadingSpinner text="Loading semester reportings..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-clipboard-check" />
            Semester Reportings
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Reportings
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
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

      {/* Stats Summary - Compact */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Total</span>
            <span className="mu-badge mu-badge-primary" style={{ fontSize: "var(--mu-font-size-xs)" }}>{reportings.length}</span>
          </div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>{reportings.length}</div>
        </div>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Pending</span>
            <span className="mu-badge mu-badge-warning" style={{ fontSize: "var(--mu-font-size-xs)" }}>{reportings.filter(r => r.status === "pending").length}</span>
          </div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>
            {reportings.filter(r => r.status === "pending").length}
          </div>
        </div>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Approved</span>
            <span className="mu-badge mu-badge-success" style={{ fontSize: "var(--mu-font-size-xs)" }}>{reportings.filter(r => r.status === "approved").length}</span>
          </div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>
            {reportings.filter(r => r.status === "approved").length}
          </div>
        </div>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Rejected</span>
            <span className="mu-badge mu-badge-danger" style={{ fontSize: "var(--mu-font-size-xs)" }}>{reportings.filter(r => r.status === "rejected").length}</span>
          </div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>
            {reportings.filter(r => r.status === "rejected").length}
          </div>
        </div>
      </div>

      {/* Table with Filters Above Header */}
      <div className="mu-card">
        <div className="mu-card-body" style={{ padding: 0 }}>
          {reportings.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Reportings Found</h3>
              <p style={{ margin: "8px 0 0" }}>No semester reportings match your filters.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table">
                <thead>
                  {/* Filter Row */}
                  <tr style={{ background: "var(--mu-gray-50)" }}>
                    <th colSpan={8} style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        {/* Search - First */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 220px" }}>
                          <div style={{ position: "relative", width: "100%" }}>
                            <i className="bi bi-search" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--mu-gray-400)" }} />
                            <input
                              type="text"
                              className="mu-input"
                              placeholder="Search by reg no. or name..."
                              style={{ 
                                width: "100%", 
                                padding: "3px 8px 3px 26px", 
                                fontSize: "var(--mu-font-size-xs)",
                                minHeight: "auto",
                                height: 28
                              }}
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Status Filter - After Search */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Status:</span>
                          <select
                            className="mu-select"
                            style={{ 
                              width: 110, 
                              padding: "3px 8px", 
                              fontSize: "var(--mu-font-size-xs)",
                              minHeight: "auto",
                              height: 28
                            }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                          >
                            <option value="">All</option>
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                            ))}
                          </select>
                        </div>

                        {/* Reset */}
                        <button
                          className="mu-btn mu-btn-secondary"
                          style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                          onClick={() => {
                            setStatusFilter("");
                            setSearch("");
                            setSelected(new Set());
                          }}
                        >
                          <i className="bi bi-arrow-counterclockwise" />
                          Reset
                        </button>

                        {/* Bulk Actions - Only shown when items selected */}
                        {selected.size > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                              {selected.size} selected
                            </span>
                            <select
                              className="mu-select"
                              style={{ 
                                width: 100, 
                                padding: "2px 6px", 
                                fontSize: "var(--mu-font-size-xs)",
                                minHeight: "auto",
                                height: 28
                              }}
                              value={bulkStatus}
                              onChange={(e) => setBulkStatus(e.target.value)}
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                              ))}
                            </select>
                            <button
                              onClick={openBulkConfirm}
                              disabled={bulkBusy}
                              className="mu-btn mu-btn-primary"
                              style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                            >
                              {bulkBusy ? (
                                <i className="bi bi-arrow-repeat mu-animate-spin" />
                              ) : (
                                <>
                                  <i className="bi bi-check2" />
                                  Apply
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  </tr>
                  {/* Column Headers */}
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        className="mu-checkbox-input"
                        checked={reportings.length > 0 && selected.size === reportings.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>Registration No.</th>
                    <th>Student</th>
                    <th>Semester</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Change Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportings.map((r) => (
                    <tr key={r.id}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          className="mu-checkbox-input"
                          checked={selected.has(r.id)}
                          onChange={() => toggleRow(r.id)}
                        />
                      </td>
                      <td>
                        <strong>{r.student_detail?.registration_number || r.student || "N/A"}</strong>
                      </td>
                      <td>
                        {r.student_detail?.user_detail
                          ? `${r.student_detail.user_detail.first_name} ${r.student_detail.user_detail.last_name}`
                          : "—"}
                      </td>
                      <td>
                        {r.semester_detail
                          ? `${r.semester_detail.academic_year_detail?.year || "N/A"} S${r.semester_detail.semester_number}`
                          : r.semester || "N/A"}
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary" style={{ fontSize: "var(--mu-font-size-xs)" }}>
                          {r.reporting_type || "online"}
                        </span>
                      </td>
                      <td>
                        {r.reporting_date ? new Date(r.reporting_date).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        <span className={`mu-badge ${STATUS_STYLES[r.status] || "mu-badge-gray"}`} style={{ fontSize: "var(--mu-font-size-xs)" }}>
                          {r.status || "pending"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <select
                          className="mu-select"
                          style={{ 
                            width: 110, 
                            padding: "2px 6px", 
                            fontSize: "var(--mu-font-size-xs)",
                            minHeight: "auto",
                            height: 28
                          }}
                          value={r.status || "pending"}
                          disabled={rowBusyId === r.id}
                          onChange={(e) => handleRowStatusChange(r.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {reportings.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 16px" }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              {reportings.length} record(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Bulk Confirm Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setBulkAction(null);
        }}
        title="Confirm Bulk Status Update"
        size="md"
        confirmText="Apply to All"
        onConfirm={handleBulkApply}
        isLoading={bulkBusy}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-check2-square" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Bulk Status Update</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to update the status of <strong>{bulkAction?.count}</strong> reporting(s) to:
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)" }}>
            <span className={`mu-badge ${STATUS_STYLES[bulkAction?.status] || "mu-badge-gray"}`} style={{ fontSize: "1rem", padding: "4px 16px" }}>
              {bulkAction?.status?.charAt(0).toUpperCase() + bulkAction?.status?.slice(1)}
            </span>
          </div>
          <div className="mu-alert mu-alert-warning" style={{ marginTop: 12, textAlign: "left" }}>
            <i className="bi bi-exclamation-triangle" />
            <div>
              <strong>Warning:</strong> This action will update all selected reportings. This cannot be undone.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}