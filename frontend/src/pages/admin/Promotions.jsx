// src/pages/admin/Promotions.jsx
import { useState, useEffect } from "react";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Modal, ConfirmModal, EmptyState, unwrapList, downloadCsv } from "../../components/ui/AdminUI";

const ACTION_BADGE = { promoted: "success", graduated: "info", suspended: "danger", skipped: "gray" };

export default function Promotions() {
  const [activeCount, setActiveCount] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.students({ status: "active", page_size: 1 })
      .then(({ data }) => setActiveCount(Array.isArray(data) ? data.length : data.count ?? 0))
      .catch(() => setActiveCount(null))
      .finally(() => setLoadingStats(false));
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setError("");
    try {
      const { data } = await adminApi.runPromotion();
      setResult(data);
      setConfirming(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Promotion run failed.");
      setConfirming(false);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    downloadCsv(
      "promotion_run_results.csv",
      result.results.map((r) => ({
        registration_number: r.registration_number, action: r.action, reason: r.reason,
        new_year: r.current_year, new_semester: r.current_semester, status: r.status,
      })),
      ["registration_number", "action", "reason", "new_year", "new_semester", "status"]
    );
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-arrow-up-circle" /> Promotions</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Promotions</div>
        </div>
      </div>

      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 20 }}>
        <div className="mu-card-body">
          <p style={{ marginTop: 0 }}>
            Running promotion advances every <strong>active</strong> student to the next year/semester of
            their programme. Students with more than 4 outstanding supplementary units are suspended
            instead; students completing their final semester are marked graduated. Deferred, suspended,
            graduated and discontinued students are skipped entirely.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#999", textTransform: "uppercase" }}>Active Students</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{loadingStats ? "…" : activeCount ?? "—"}</div>
            </div>
            <button className="mu-btn mu-btn-primary" onClick={() => setConfirming(true)} disabled={running}>
              <i className="bi bi-play-circle" /> Run Promotion
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Last Run Results</h4>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={handleExport}>
              <i className="bi bi-download" /> Export CSV
            </button>
          </div>
          <div className="mu-card-body">
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(result.summary).map(([action, n]) => (
                <div key={action} className={`mu-badge mu-badge-${ACTION_BADGE[action] || "gray"}`} style={{ padding: "8px 14px", fontSize: 13 }}>
                  {n} {action}
                </div>
              ))}
            </div>
            {result.results.length === 0 ? (
              <EmptyState icon="bi-inbox" label="No active students to process" />
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table">
                  <thead><tr><th>Reg No</th><th>Action</th><th>Detail</th><th>New Position</th><th>Status</th></tr></thead>
                  <tbody>
                    {result.results.map((r) => (
                      <tr key={r.student_id}>
                        <td><strong>{r.registration_number}</strong></td>
                        <td><span className={`mu-badge mu-badge-${ACTION_BADGE[r.action] || "gray"}`}>{r.action}</span></td>
                        <td>{r.reason}</td>
                        <td>Y{r.current_year} S{r.current_semester}</td>
                        <td>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmModal
          title="Run Promotion"
          message={`This will process all ${activeCount ?? ""} active students and permanently update their year/semester or status. Continue?`}
          confirmLabel={running ? "Running..." : "Run Promotion"}
          danger={false}
          onConfirm={handleRun}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}