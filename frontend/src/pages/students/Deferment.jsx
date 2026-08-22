import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { defermentApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function Deferment() {
  const [loading, setLoading] = useState(true);
  const [deferments, setDeferments] = useState([]);
  const [reason, setReason] = useState("");
  const [supportingDocument, setSupportingDocument] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      await defermentApi.create({
        reason,
        supporting_document: supportingDocument,
      });
      setSuccess("Deferment request submitted.");
      setReason("");
      setSupportingDocument(null);
      await loadDeferments();
    } catch (err) {
      console.error("Error submitting deferment:", err);
      setError(err.response?.data?.detail || "Failed to submit deferment request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading deferment history..." />;
  }

  const hasPending = deferments.some((d) => d.status === "pending");

  return (
    <div>
      <div>
        <h1>Deferment</h1>
        <div>Home / Academics / Deferment</div>
      </div>

      {error && <div>{error}</div>}
      {success && <div>{success}</div>}

      <div>
        <h4>Apply for Deferment</h4>
        {hasPending && <div>You already have a pending deferment request.</div>}
        <form onSubmit={handleSubmit}>
          <label>Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />

          <label>Supporting Document (optional)</label>
          <input
            type="file"
            onChange={(e) => setSupportingDocument(e.target.files?.[0] || null)}
          />

          <button type="submit" disabled={submitting || hasPending}>
            {submitting ? "Submitting..." : "Submit Deferment Request"}
          </button>
        </form>
      </div>

      <div>
        <h4>Your Deferment History</h4>
        {deferments.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th>Year/Sem at Deferment</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {deferments.map((d) => (
                <tr key={d.id}>
                  <td>{d.reason}</td>
                  <td>
                    Y{d.year_at_deferment} S{d.semester_at_deferment}
                  </td>
                  <td>{d.status}</td>
                  <td>{new Date(d.applied_at).toLocaleDateString()}</td>
                  <td>{d.admin_remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No deferment history.</p>
        )}
      </div>

      <div>
        <Link to="/units">My Units</Link>
      </div>
    </div>
  );
}