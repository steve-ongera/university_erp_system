import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { reportingApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function SemesterReporting() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [reportingType, setReportingType] = useState("online");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  return (
    <div>
      <div>
        <h1>Semester Reporting</h1>
        <div>Home / Academics / Semester Reporting</div>
      </div>

      {error && <div>{error}</div>}
      {success && <div>{success}</div>}

      {status?.semester && (
        <div>
          Current Semester: {status.semester.academic_year_detail?.year || "N/A"} - Semester{" "}
          {status.semester.semester_number}
        </div>
      )}

      <div>Outstanding Fee Balance: KES {Number(status?.fee_outstanding || 0).toLocaleString()}</div>

      {alreadyReported ? (
        <div>
          <h4>Your Reporting Status</h4>
          <div>Type: {status.reporting.reporting_type}</div>
          <div>Status: {status.reporting.status}</div>
          <div>
            Date:{" "}
            {status.reporting.reporting_date
              ? new Date(status.reporting.reporting_date).toLocaleString()
              : "N/A"}
          </div>
        </div>
      ) : (
        <div>
          <h4>Report for This Semester</h4>
          <label>Reporting Type</label>
          <select value={reportingType} onChange={(e) => setReportingType(e.target.value)}>
            <option value="online">Online</option>
            <option value="physical">Physical</option>
          </select>
          <button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Reporting"}
          </button>
        </div>
      )}

      <div>
        <Link to="/hostel-booking">Hostel Booking</Link>
        <Link to="/fees">View Fees</Link>
      </div>
    </div>
  );
}