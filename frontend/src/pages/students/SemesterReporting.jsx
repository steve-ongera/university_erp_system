import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { reportingApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function SemesterReporting() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [reportingType, setReportingType] = useState("online");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await reportingApi.status();
      setStatus(res.data);
    } catch (err) {
      console.error("Error fetching reporting status:", err);
      setError("Failed to load reporting status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSubmit = async () => {
    if (!status?.semester?.id) {
      setError("No active semester found.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await reportingApi.submit(status.semester.id, reportingType);
      setSuccess("Reporting submitted successfully. Awaiting approval.");
      setConfirmModalOpen(false);
      await loadStatus();
    } catch (err) {
      console.error("Error submitting reporting:", err);
      setError(err.response?.data?.detail || "Failed to submit reporting.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading reporting status..." />;
  }

  const alreadyReported = !!status?.reporting;
  const canReport = status?.fee_outstanding === 0 || status?.fee_outstanding === null;

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-check2-square" />
            Semester Reporting
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Campus Life <span className="separator">/</span> Semester Reporting
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

      {/* Reporting Info */}
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 24 }}>
        <i className="bi bi-info-circle" />
        <div>
          <strong>Semester Reporting:</strong> All students must report at the beginning of each semester.
          This confirms your intention to continue with your studies.
          {alreadyReported && (
            <div style={{ marginTop: 8 }}>
              <span className="mu-badge mu-badge-success">
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                You have already reported for this semester
              </span>
            </div>
          )}
          {!canReport && (
            <div style={{ marginTop: 8 }}>
              <span className="mu-badge mu-badge-danger">
                <i className="bi bi-exclamation-triangle" style={{ marginRight: 4 }} />
                Outstanding fee balance detected. Please clear your fees first.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-calendar3" />
          </div>
          <div className="mu-stat-label">Current Semester</div>
          <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-lg)" }}>
            {status?.semester ? (
              <>
                {status.semester.academic_year_detail?.year || "N/A"} S{status.semester.semester_number}
              </>
            ) : (
              "No active semester"
            )}
          </div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-cash-coin" />
          </div>
          <div className="mu-stat-label">Outstanding Fee Balance</div>
          <div className="mu-stat-value" style={{ 
            color: status?.fee_outstanding > 0 ? "var(--mu-danger)" : "var(--mu-success)",
            fontSize: "var(--mu-font-size-lg)"
          }}>
            KES {Number(status?.fee_outstanding || 0).toLocaleString()}
          </div>
          {status?.fee_outstanding > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-danger)" }}>
              <i className="bi bi-exclamation-triangle" />
              Pay fees to report
            </div>
          )}
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check2-square" />
          </div>
          <div className="mu-stat-label">Reporting Status</div>
          <div className="mu-stat-value" style={{ fontSize: "var(--mu-font-size-lg)" }}>
            {alreadyReported ? (
              <span className="mu-badge mu-badge-success" style={{ fontSize: "var(--mu-font-size-base)" }}>
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                Completed
              </span>
            ) : (
              <span className="mu-badge mu-badge-warning" style={{ fontSize: "var(--mu-font-size-base)" }}>
                <i className="bi bi-clock" style={{ marginRight: 4 }} />
                Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reporting Form or Status */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            {alreadyReported ? (
              <>
                <i className="bi bi-check-circle" style={{ marginRight: 8, color: "var(--mu-success)" }} />
                Your Reporting Status
              </>
            ) : (
              <>
                <i className="bi bi-pencil-square" style={{ marginRight: 8 }} />
                Report for This Semester
              </>
            )}
          </h4>
        </div>
        <div className="mu-card-body">
          {alreadyReported ? (
            <div>
              <div className="mu-dashboard-grid-2" style={{ gap: 16 }}>
                <div className="mu-form-group">
                  <label>Reporting Type</label>
                  <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                    {status.reporting.reporting_type?.toUpperCase() || "N/A"}
                  </div>
                </div>
                <div className="mu-form-group">
                  <label>Status</label>
                  <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                    <span className={`mu-badge ${
                      status.reporting.status === "approved" ? "mu-badge-success" :
                      status.reporting.status === "pending" ? "mu-badge-warning" :
                      "mu-badge-danger"
                    }`}>
                      {status.reporting.status?.toUpperCase() || "PENDING"}
                    </span>
                  </div>
                </div>
                <div className="mu-form-group" style={{ gridColumn: "span 2" }}>
                  <label>Reporting Date</label>
                  <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                    {status.reporting.reporting_date
                      ? new Date(status.reporting.reporting_date).toLocaleString()
                      : "N/A"}
                  </div>
                </div>
                {status.reporting.status === "pending" && (
                  <div className="mu-alert mu-alert-warning" style={{ gridColumn: "span 2" }}>
                    <i className="bi bi-clock" />
                    Your reporting is pending approval. You will be notified once approved.
                  </div>
                )}
                {status.reporting.status === "approved" && (
                  <div className="mu-alert mu-alert-success" style={{ gridColumn: "span 2" }}>
                    <i className="bi bi-check-circle" />
                    Your reporting has been approved. You can now proceed with hostel booking.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {!canReport && (
                <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>
                  <i className="bi bi-exclamation-triangle" />
                  You have an outstanding fee balance. Please clear your fees before reporting.
                  <Link to="/fees" className="mu-btn mu-btn-sm mu-btn-primary" style={{ marginLeft: 8 }}>
                    <i className="bi bi-cash-coin" />
                    View Fees
                  </Link>
                </div>
              )}
              <div className="mu-form-group" style={{ maxWidth: 300 }}>
                <label>Reporting Type</label>
                <select 
                  className="mu-select" 
                  value={reportingType} 
                  onChange={(e) => setReportingType(e.target.value)}
                  disabled={!canReport}
                >
                  <option value="online">Online</option>
                  <option value="physical">Physical</option>
                </select>
                <div className="mu-help-text">Choose how you want to report</div>
              </div>

              <button 
                className="mu-btn mu-btn-primary" 
                onClick={() => setConfirmModalOpen(true)}
                disabled={submitting || !canReport}
              >
                {submitting ? (
                  <>
                    <i className="bi bi-arrow-repeat mu-animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send" />
                    Submit Reporting
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Semester Reporting"
        size="md"
        confirmText="Submit Reporting"
        onConfirm={handleSubmit}
        isLoading={submitting}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-check2-square" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Confirm Your Reporting</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to report for the current semester.
            <br />
            <strong>Reporting Type: {reportingType.toUpperCase()}</strong>
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)" }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Semester:</span>
              <span>{status?.semester?.academic_year_detail?.year || "N/A"} S{status?.semester?.semester_number}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Type:</span>
              <span>{reportingType.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}