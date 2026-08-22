import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clearanceApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function GraduationClearance() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await clearanceApi.status();
      setStatus(res.data);
      if (res.data.clearance_types?.length > 0) {
        setSelectedType(res.data.clearance_types[0][0]);
      }
    } catch (err) {
      console.error("Error fetching clearance status:", err);
      setError("Failed to load clearance status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleRequest = async () => {
    if (!selectedType) {
      setError("Select a clearance type.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await clearanceApi.request(selectedType);
      setSuccess("Clearance request submitted successfully.");
      setConfirmModalOpen(false);
      await loadStatus();
    } catch (err) {
      console.error("Error requesting clearance:", err);
      setError(err.response?.data?.detail || "Failed to submit clearance request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { class: "mu-badge-warning", label: "Pending" },
      approved: { class: "mu-badge-success", label: "Approved" },
      rejected: { class: "mu-badge-danger", label: "Rejected" },
      requires_action: { class: "mu-badge-info", label: "Requires Action" },
    };
    return statusMap[status?.toLowerCase()] || { class: "mu-badge-gray", label: status || "Unknown" };
  };

  const getTypeLabel = (type) => {
    const typeMap = {
      library: "Library",
      finance: "Finance",
      department: "Department",
      hostel: "Hostel/Accommodation",
      graduation: "Graduation (Overall)",
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return <LoadingSpinner text="Loading clearance status..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-file-earmark-check" />
            Graduation Clearance
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Campus Life <span className="separator">/</span> Clearance
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/dashboard" className="mu-btn mu-btn-outline-primary">
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
      {success && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {success}
        </div>
      )}

      {/* Eligibility Info */}
      <div className={`mu-alert ${status?.is_eligible ? "mu-alert-success" : "mu-alert-warning"}`} style={{ marginBottom: 24 }}>
        <i className={`bi ${status?.is_eligible ? "bi-check-circle" : "bi-exclamation-triangle"}`} />
        <div>
          <strong>Eligibility Status:</strong> {status?.is_eligible ? "You are eligible for clearance" : "You are not eligible for clearance"}
          {!status?.is_eligible && (
            <div style={{ marginTop: 8 }}>
              You must be in your <strong>final year</strong> and <strong>final semester</strong> of your programme to request graduation clearance.
              {status?.reason && (
                <div style={{ marginTop: 4 }}>
                  <span className="mu-badge mu-badge-danger">
                    <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                    {status.reason}
                  </span>
                </div>
              )}
            </div>
          )}
          {status?.is_eligible && (
            <div style={{ marginTop: 8 }}>
              <span className="mu-badge mu-badge-success">
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                You can proceed with clearance requests
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-list-check" />
          </div>
          <div className="mu-stat-label">Total Requests</div>
          <div className="mu-stat-value">{status?.requests?.length || 0}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Approved</div>
          <div className="mu-stat-value">
            {status?.requests?.filter(r => r.status === "approved").length || 0}
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-clock" />
          </div>
          <div className="mu-stat-label">Pending</div>
          <div className="mu-stat-value">
            {status?.requests?.filter(r => r.status === "pending").length || 0}
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-x-circle" />
          </div>
          <div className="mu-stat-label">Rejected</div>
          <div className="mu-stat-value">
            {status?.requests?.filter(r => r.status === "rejected").length || 0}
          </div>
        </div>
      </div>

      {/* Request Form */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-plus-circle" style={{ marginRight: 8 }} />
            Request Clearance
          </h4>
          {status?.is_eligible && (
            <span className="mu-badge mu-badge-success">
              <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
              Eligible
            </span>
          )}
        </div>
        <div className="mu-card-body">
          <div className="mu-form-group" style={{ maxWidth: 400 }}>
            <label>Clearance Type</label>
            <select 
              className="mu-select" 
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
              disabled={!status?.is_eligible}
            >
              {status?.clearance_types?.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <div className="mu-help-text">Select the type of clearance you need</div>
          </div>

          <button 
            className="mu-btn mu-btn-primary" 
            onClick={() => setConfirmModalOpen(true)}
            disabled={submitting || !status?.is_eligible}
          >
            {submitting ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <i className="bi bi-send" />
                Submit Request
              </>
            )}
          </button>
        </div>
      </div>

      {/* Clearance Requests Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-clock-history" style={{ marginRight: 8 }} />
            Your Clearance Requests
          </h4>
          <span className="mu-badge mu-badge-primary">
            {status?.requests?.length || 0} Requests
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {status?.requests?.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {status.requests.map((request) => {
                    const statusBadge = getStatusBadge(request.status);
                    return (
                      <tr key={request.id}>
                        <td>
                          <span className="mu-badge mu-badge-primary">
                            {getTypeLabel(request.clearance_type)}
                          </span>
                        </td>
                        <td>
                          <span className={`mu-badge ${statusBadge.class}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td>{new Date(request.requested_at).toLocaleDateString()}</td>
                        <td>{request.remarks || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Clearance Requests</h3>
              <p style={{ margin: "8px 0 0" }}>You have not submitted any clearance requests yet.</p>
            </div>
          )}
        </div>
      </div>

    

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Clearance Request"
        size="md"
        confirmText="Submit Request"
        onConfirm={handleRequest}
        isLoading={submitting}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-file-earmark-check" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Submit Clearance Request</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to submit a clearance request.
            <br />
            <strong>Please confirm the details below:</strong>
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)" }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Clearance Type:</span>
              <span>
                {status?.clearance_types?.find(([value]) => value === selectedType)?.[1] || selectedType}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Eligibility:</span>
              <span className="mu-badge mu-badge-success">Eligible</span>
            </div>
          </div>
          <div className="mu-alert mu-alert-info" style={{ marginTop: 12, textAlign: "left" }}>
            <i className="bi bi-info-circle" />
            <div>
              <strong>Note:</strong> Your request will be reviewed by the relevant department.
              You will be notified once a decision is made.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}