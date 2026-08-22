import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clearanceApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function GraduationClearance() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setSuccess("Clearance request submitted.");
      await loadStatus();
    } catch (err) {
      console.error("Error requesting clearance:", err);
      setError(err.response?.data?.detail || "Failed to submit clearance request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading clearance status..." />;
  }

  return (
    <div>
      <div>
        <h1>Graduation Clearance</h1>
        <div>Home / Academics / Clearance</div>
      </div>

      {error && <div>{error}</div>}
      {success && <div>{success}</div>}

      <div>Eligible for Clearance: {status?.is_eligible ? "Yes" : "No"}</div>
      {!status?.is_eligible && (
        <div>
          You must be in your final year and final semester of your programme to request graduation
          clearance.
        </div>
      )}

      <div>
        <h4>Request Clearance</h4>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
          {status?.clearance_types?.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button onClick={handleRequest} disabled={submitting || !status?.is_eligible}>
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>

      <div>
        <h4>Your Clearance Requests</h4>
        {status?.requests?.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {status.requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.clearance_type}</td>
                  <td>{request.status}</td>
                  <td>{new Date(request.requested_at).toLocaleDateString()}</td>
                  <td>{request.remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No clearance requests yet.</p>
        )}
      </div>

      <div>
        <Link to="/grades">View Results</Link>
        <Link to="/fees">View Fees</Link>
      </div>
    </div>
  );
}