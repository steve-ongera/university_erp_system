import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { defermentApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function Deferment() {
  const [loading, setLoading] = useState(true);
  const [deferments, setDeferments] = useState([]);
  const [reason, setReason] = useState("");
  const [supportingDocument, setSupportingDocument] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const loadDeferments = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await defermentApi.mine();
      setDeferments(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error("Error fetching deferments:", err);
      setError("Failed to load your deferment history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeferments();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Provide a reason for deferment.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("reason", reason);
      if (supportingDocument) {
        formData.append("supporting_document", supportingDocument);
      }
      await defermentApi.create(formData);
      setSuccess("Deferment request submitted successfully.");
      setReason("");
      setSupportingDocument(null);
      setConfirmModalOpen(false);
      await loadDeferments();
    } catch (err) {
      console.error("Error submitting deferment:", err);
      setError(err.response?.data?.detail || "Failed to submit deferment request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { class: "mu-badge-warning", label: "Pending Review" },
      approved: { class: "mu-badge-success", label: "Approved" },
      rejected: { class: "mu-badge-danger", label: "Rejected" },
      resumed: { class: "mu-badge-info", label: "Resumed" },
    };
    return statusMap[status?.toLowerCase()] || { class: "mu-badge-gray", label: status || "Unknown" };
  };

  if (loading) {
    return <LoadingSpinner text="Loading deferment history..." />;
  }

  const hasPending = deferments.some((d) => d.status === "pending");

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-pause-circle" />
            Deferment
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Campus Life <span className="separator">/</span> Deferment
          </div>
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

      {/* Deferment Info */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          <strong>Important:</strong> Deferment allows you to take a break from your studies for a valid reason.
          Your academic progress will be paused and you will resume at the same year and semester.
          {hasPending && (
            <div style={{ marginTop: 8 }}>
              <span className="mu-badge mu-badge-warning">
                <i className="bi bi-clock" style={{ marginRight: 4 }} />
                You have a pending deferment request
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Application Form */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-plus-circle" style={{ marginRight: 8 }} />
            Apply for Deferment
          </h4>
          {hasPending && (
            <span className="mu-badge mu-badge-warning">
              <i className="bi bi-clock" style={{ marginRight: 4 }} />
              Pending Request Exists
            </span>
          )}
        </div>
        <div className="mu-card-body">
          <form onSubmit={(e) => { e.preventDefault(); setConfirmModalOpen(true); }}>
            <div className="mu-form-group">
              <label>Reason for Deferment</label>
              <textarea
                className="mu-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Please provide a detailed reason for your deferment request..."
                required
              />
              <div className="mu-help-text">Explain why you need to defer your studies</div>
            </div>

            <div className="mu-form-group">
              <label>Supporting Document (optional)</label>
              <input
                type="file"
                className="mu-input"
                onChange={(e) => setSupportingDocument(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <div className="mu-help-text">Accepted formats: PDF, DOC, DOCX, JPG, PNG</div>
            </div>

            <button
              type="submit"
              className="mu-btn mu-btn-primary"
              disabled={submitting || hasPending}
            >
              {submitting ? (
                <>
                  <i className="bi bi-arrow-repeat mu-animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <i className="bi bi-send" />
                  Submit Deferment Request
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Deferment History */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-clock-history" style={{ marginRight: 8 }} />
            Deferment History
          </h4>
          <span className="mu-badge mu-badge-primary">
            {deferments.length} Records
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {deferments.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Reason</th>
                    <th>Year/Sem</th>
                    <th>Status</th>
                    <th>Applied</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {deferments.map((d) => {
                    const status = getStatusBadge(d.status);
                    return (
                      <tr key={d.id}>
                        <td>
                          <div style={{ maxWidth: 200 }}>
                            {d.reason}
                          </div>
                        </td>
                        <td>
                          <span className="mu-badge mu-badge-primary">
                            Y{d.year_at_deferment} S{d.semester_at_deferment}
                          </span>
                        </td>
                        <td>
                          <span className={`mu-badge ${status.class}`}>
                            {status.label}
                          </span>
                        </td>
                        <td>{new Date(d.applied_at).toLocaleDateString()}</td>
                        <td>{d.admin_remarks || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Deferment History</h3>
              <p style={{ margin: "8px 0 0" }}>You have not submitted any deferment requests.</p>
            </div>
          )}
        </div>
      </div>

      
      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Deferment Request"
        size="md"
        confirmText="Submit Request"
        onConfirm={handleSubmit}
        isLoading={submitting}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-exclamation-triangle" style={{ fontSize: 48, color: "var(--mu-warning)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Are you sure you want to defer?</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            This will pause your academic progress. You will resume at the same year and semester.
            <br />
            <strong>Please ensure you have a valid reason for deferment.</strong>
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)", textAlign: "left" }}>
            <strong>Reason:</strong>
            <p style={{ margin: "4px 0 0", color: "var(--mu-gray-700)" }}>{reason}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}