import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { registrarApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function RegistrarClearances() {
  const [clearances, setClearances] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    registrarApi
      .clearances({ status: statusFilter || undefined, clearance_type: typeFilter || undefined })
      .then((res) => setClearances(res.data.results || res.data))
      .catch(() => setError("Could not load clearances."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter, typeFilter]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      const remarks = window.prompt(`Remarks for ${action} (optional):`, "") || "";
      if (action === "approve") await registrarApi.approveClearance(id, remarks);
      else await registrarApi.rejectClearance(id, remarks);
      load();
    } catch {
      setError("Action failed. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: "mu-badge-warning",
      approved: "mu-badge-success",
      rejected: "mu-badge-danger",
      requires_action: "mu-badge-info",
    };
    return statusMap[status?.toLowerCase()] || "mu-badge-gray";
  };

  if (loading) {
    return <LoadingSpinner text="Loading clearance requests..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-patch-check" />
            Clearance Requests
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Registrar <span className="separator">/</span> Clearances
          </div>
        </div>
        
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Clearances Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-patch-check" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Clearance Requests
          </h4>
          <span className="mu-badge mu-badge-primary">
            {clearances.length} Request(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {/* Filters inside table */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mu-border)", background: "var(--mu-gray-50)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>
                  <i className="bi bi-funnel" style={{ marginRight: 4 }} />
                  Status:
                </span>
                <select
                  className="mu-select"
                  style={{ width: 140, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="requires_action">Requires Action</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>
                  <i className="bi bi-tag" style={{ marginRight: 4 }} />
                  Type:
                </span>
                <select
                  className="mu-select"
                  style={{ width: 160, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">All types</option>
                  <option value="library">Library</option>
                  <option value="finance">Finance</option>
                  <option value="department">Department</option>
                  <option value="hostel">Hostel/Accommodation</option>
                  <option value="graduation">Graduation (Overall)</option>
                </select>
              </div>

              {(statusFilter !== "pending" || typeFilter) && (
                <button
                  className="mu-btn mu-btn-secondary"
                  style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                  onClick={() => {
                    setStatusFilter("pending");
                    setTypeFilter("");
                  }}
                >
                  <i className="bi bi-arrow-counterclockwise" />
                  Reset
                </button>
              )}

              <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginLeft: "auto" }}>
                {clearances.length} request(s) found
              </span>
            </div>
          </div>

          {clearances.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-patch-check" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Clearance Requests</h3>
              <p style={{ margin: "8px 0 0" }}>No clearance requests found matching your filters.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clearances.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>
                          {c.student_detail?.user_detail?.first_name} {c.student_detail?.user_detail?.last_name}
                        </strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {c.student_detail?.registration_number}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {c.clearance_type}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge ${getStatusBadge(c.status)}`}>
                          {c.status || "Pending"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {new Date(c.requested_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {c.status === "pending" ? (
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-success"
                              onClick={() => act(c.id, "approve")}
                              disabled={busyId === c.id}
                            >
                              {busyId === c.id ? (
                                <i className="bi bi-arrow-repeat mu-animate-spin" />
                              ) : (
                                <i className="bi bi-check2" />
                              )}
                              Approve
                            </button>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-danger"
                              onClick={() => act(c.id, "reject")}
                              disabled={busyId === c.id}
                            >
                              {busyId === c.id ? (
                                <i className="bi bi-arrow-repeat mu-animate-spin" />
                              ) : (
                                <i className="bi bi-x" />
                              )}
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="mu-badge mu-badge-gray">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {clearances.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {clearances.length} request(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}