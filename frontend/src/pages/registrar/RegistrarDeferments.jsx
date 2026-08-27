import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { registrarApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function RegistrarDeferments() {
  const [deferments, setDeferments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    registrarApi
      .deferments({ status: statusFilter || undefined })
      .then((res) => setDeferments(res.data.results || res.data))
      .catch(() => setError("Could not load deferments."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      if (action === "approve") await registrarApi.approveDeferment(id);
      else if (action === "resume") await registrarApi.resumeDeferment(id);
      else if (action === "reject") {
        const remarks = window.prompt("Reason for rejection (optional):", "");
        await registrarApi.rejectDeferment(id, remarks || "");
      }
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
      resumed: "mu-badge-info",
    };
    return statusMap[status?.toLowerCase()] || "mu-badge-gray";
  };

  if (loading) {
    return <LoadingSpinner text="Loading deferments..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-pause-circle" />
            Student Deferments
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Registrar <span className="separator">/</span> Deferments
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

      {/* Deferments Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-pause-circle" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Deferment Requests
          </h4>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mu-badge mu-badge-primary">
              {deferments.length} Request(s)
            </span>
            <select
              className="mu-select"
              style={{ width: 160, padding: "3px 8px", fontSize: "var(--mu-font-size-xs)", minHeight: "auto", height: 28 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="resumed">Resumed</option>
            </select>
          </div>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {deferments.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-pause-circle" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Deferment Requests</h3>
              <p style={{ margin: "8px 0 0" }}>No deferment requests found.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Reason</th>
                    <th>Year/Sem</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deferments.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>
                          {d.student_detail?.user_detail?.first_name} {d.student_detail?.user_detail?.last_name}
                        </strong>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          {d.student_detail?.registration_number}
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: 200, wordBreak: "break-word" }} title={d.reason}>
                          {d.reason}
                        </div>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          Y{d.year_at_deferment} S{d.semester_at_deferment}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge ${getStatusBadge(d.status)}`}>
                          {d.status || "Pending"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {d.status === "pending" && (
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-success"
                              onClick={() => act(d.id, "approve")}
                              disabled={busyId === d.id}
                            >
                              {busyId === d.id ? (
                                <i className="bi bi-arrow-repeat mu-animate-spin" />
                              ) : (
                                <i className="bi bi-check2" />
                              )}
                              Approve
                            </button>
                            <button
                              className="mu-btn mu-btn-sm mu-btn-danger"
                              onClick={() => act(d.id, "reject")}
                              disabled={busyId === d.id}
                            >
                              {busyId === d.id ? (
                                <i className="bi bi-arrow-repeat mu-animate-spin" />
                              ) : (
                                <i className="bi bi-x" />
                              )}
                              Reject
                            </button>
                          </div>
                        )}
                        {d.status === "approved" && (
                          <button
                            className="mu-btn mu-btn-sm mu-btn-primary"
                            onClick={() => act(d.id, "resume")}
                            disabled={busyId === d.id}
                          >
                            {busyId === d.id ? (
                              <i className="bi bi-arrow-repeat mu-animate-spin" />
                            ) : (
                              <i className="bi bi-arrow-clockwise" />
                            )}
                            Resume Student
                          </button>
                        )}
                        {d.status === "rejected" && (
                          <span className="mu-badge mu-badge-gray">—</span>
                        )}
                        {d.status === "resumed" && (
                          <span className="mu-badge mu-badge-info">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Resumed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {deferments.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {deferments.length} request(s)
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