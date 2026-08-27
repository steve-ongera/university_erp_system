import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deanApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function DeanClearances() {
  const [clearances, setClearances] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    deanApi
      .clearances({ status: statusFilter || undefined })
      .then((res) => setClearances(res.data.results || res.data))
      .catch(() => setError("Could not load clearances."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const act = async (id, action, clearanceType) => {
    if (!["department", "graduation"].includes(clearanceType)) {
      setError("Deans can only act on department/graduation clearances.");
      return;
    }
    setBusyId(id);
    try {
      const remarks = window.prompt(`Remarks for ${action} (optional):`, "") || "";
      if (action === "approve") await deanApi.approveClearance(id, remarks);
      else await deanApi.rejectClearance(id, remarks);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Action failed.");
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
            Home <span className="separator">/</span> Dean <span className="separator">/</span> Clearances
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/dean/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          Scoped to your faculty. You can act on <strong>Department</strong> and <strong>Graduation</strong> clearances only.
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mu-badge mu-badge-primary">
              {clearances.length} Request(s)
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
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {clearances.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-patch-check" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Clearance Requests</h3>
              <p style={{ margin: "8px 0 0" }}>No clearance requests found for your faculty.</p>
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
                  {clearances.map((c) => {
                    const actionable = ["department", "graduation"].includes(c.clearance_type);
                    return (
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
                          {c.status === "pending" && actionable ? (
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button
                                className="mu-btn mu-btn-sm mu-btn-success"
                                onClick={() => act(c.id, "approve", c.clearance_type)}
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
                                onClick={() => act(c.id, "reject", c.clearance_type)}
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
                          ) : c.status === "pending" ? (
                            <span className="mu-badge mu-badge-gray">Outside dean scope</span>
                          ) : (
                            <span className="mu-badge mu-badge-gray">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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