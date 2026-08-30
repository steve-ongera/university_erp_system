import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { ConfirmModal, EmptyState, downloadCsv } from "../../components/ui/AdminUI";

const ACTION_BADGE = {
  promoted: "success",
  graduated: "info",
  suspended: "danger",
  skipped: "gray",
  already_promoted: "gray",
};

export default function Promotions() {
  const [faculties, setFaculties] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [faculty, setFaculty] = useState("");
  const [programme, setProgramme] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [bypass, setBypass] = useState(false);
  const [bypassReason, setBypassReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [pastRuns, setPastRuns] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Each fetch is isolated so one failing endpoint doesn't blank the whole page.
  const loadInitialData = async () => {
    setLoading(true);
    setError("");

    const [facRes, progRes, ayRes, runsRes] = await Promise.allSettled([
      adminApi.faculties(),
      adminApi.programmes(),
      adminApi.academicYears(),
      adminApi.promotionRuns(),
    ]);

    const failed = [];

    if (facRes.status === "fulfilled") {
      setFaculties(facRes.value.data?.results || facRes.value.data || []);
    } else {
      failed.push("faculties");
      console.error("Failed to load faculties:", facRes.reason);
    }

    if (progRes.status === "fulfilled") {
      setProgrammes(progRes.value.data?.results || progRes.value.data || []);
    } else {
      failed.push("programmes");
      console.error("Failed to load programmes:", progRes.reason);
    }

    if (ayRes.status === "fulfilled") {
      setAcademicYears(ayRes.value.data?.results || ayRes.value.data || []);
    } else {
      failed.push("academic years");
      console.error("Failed to load academic years:", ayRes.reason);
    }

    if (runsRes.status === "fulfilled") {
      setPastRuns(runsRes.value.data?.results || runsRes.value.data || []);
    } else {
      failed.push("past promotion runs");
      console.error("Failed to load promotion runs:", runsRes.reason);
    }

    if (failed.length) {
      setError(`Some data failed to load: ${failed.join(", ")}. Check console for details.`);
    }

    setLoading(false);
  };

  const loadPastRuns = () => {
    adminApi.promotionRuns()
      .then(({ data }) => setPastRuns(data?.results || data || []))
      .catch((err) => console.error("Failed to refresh promotion runs:", err));
  };

  const handleRun = async () => {
    setRunning(true);
    setError("");
    try {
      const { data } = await adminApi.runPromotion({
        academic_year: academicYear,
        faculty: faculty || null,
        programme: programme || null,
        bypass_result_check: bypass,
        bypass_reason: bypassReason,
      });
      setResult(data);
      setConfirming(false);
      loadPastRuns();
    } catch (err) {
      setError(err.response?.data?.detail || "Promotion run failed.");
      setConfirming(false);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!result?.records?.length) return;
    downloadCsv(
      "promotion_run.csv",
      result.records.map((r) => ({
        registration_number: r.student_detail?.registration_number || "",
        action: r.action || "",
        reason: r.reason || "",
        bypassed: r.was_bypassed ? "Yes" : "No",
        invoice: r.invoice ? "Raised" : r.invoice_error || "—",
        email_sent: r.email_sent ? "Sent" : r.email_error || "Pending",
      })),
      ["registration_number", "action", "reason", "bypassed", "invoice", "email_sent"]
    );
  };

  if (loading) {
    return <LoadingSpinner text="Loading promotion data..." />;
  }

  const selectedAyLabel = academicYears.find((ay) => ay.id === Number(academicYear))?.year;
  const selectedFacultyLabel = faculties.find((f) => f.id === Number(faculty))?.name;
  const selectedProgrammeLabel = programmes.find((p) => p.id === Number(programme))?.name;

  const scopeLabel = programme
    ? " in the selected programme"
    : faculty
    ? " in the selected faculty"
    : " across all faculties";

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-arrow-up-circle" /> Promotions
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Promotions
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" /> Back to Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}

      {/* Promotion Form */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-gear" style={{ marginRight: 8 }} />
            Run Promotion
          </h4>
        </div>
        <div className="mu-card-body">
          <div className="mu-dashboard-grid-3" style={{ gap: 12, marginBottom: 0 }}>
            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Academic Year</label>
              <select
                className="mu-select"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                <option value="">Select Academic Year…</option>
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>{ay.year}</option>
                ))}
              </select>
            </div>

            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Faculty</label>
              <select
                className="mu-select"
                value={faculty}
                onChange={(e) => { setFaculty(e.target.value); setProgramme(""); }}
              >
                <option value="">All Faculties</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="mu-form-group" style={{ marginBottom: 0 }}>
              <label>Programme</label>
              <select
                className="mu-select"
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
              >
                <option value="">All Programmes {faculty ? "(in faculty)" : ""}</option>
                {programmes
                  .filter((p) => !faculty || p.faculty === Number(faculty))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="mu-checkbox" style={{ marginTop: 16 }}>
            <input
              type="checkbox"
              id="bypass_check"
              checked={bypass}
              onChange={(e) => setBypass(e.target.checked)}
            />
            <label htmlFor="bypass_check">
              Bypass results check (promote even with outstanding supplementaries — e.g. delayed results)
            </label>
          </div>

          {bypass && (
            <div className="mu-form-group" style={{ marginTop: 12 }}>
              <label>Reason for Bypassing</label>
              <textarea
                className="mu-textarea"
                rows={2}
                placeholder="Required: reason for bypassing (e.g. 'Y1S1 IT results delayed')"
                value={bypassReason}
                onChange={(e) => setBypassReason(e.target.value)}
              />
            </div>
          )}

          <button
            className="mu-btn mu-btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => setConfirming(true)}
            disabled={running || !academicYear}
          >
            {running ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" /> Running...
              </>
            ) : (
              <>
                <i className="bi bi-play-circle" /> Run Promotion
              </>
            )}
          </button>
        </div>
      </div>

      {/* Run Results */}
      {result && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-file-text" style={{ marginRight: 8 }} />
              Run Results — {result.records?.length || 0} students processed
            </h4>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={handleExport}>
              <i className="bi bi-download" /> Export CSV
            </button>
          </div>

          <div className="mu-card-body" style={{ padding: 0 }}>
            <div
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 16px",
                flexWrap: "wrap",
                borderBottom: "1px solid var(--mu-border)",
              }}
            >
              <span className="mu-badge mu-badge-success">
                <i className="bi bi-arrow-up" style={{ marginRight: 4 }} />
                {result.promoted_count || 0} promoted
              </span>
              <span className="mu-badge mu-badge-info">
                <i className="bi bi-award" style={{ marginRight: 4 }} />
                {result.graduated_count || 0} graduated
              </span>
              <span className="mu-badge mu-badge-danger">
                <i className="bi bi-pause-circle" style={{ marginRight: 4 }} />
                {result.suspended_count || 0} suspended
              </span>
              <span className="mu-badge mu-badge-gray">
                <i className="bi bi-skip-forward" style={{ marginRight: 4 }} />
                {result.skipped_count || 0} skipped
              </span>
            </div>

            {!result.records || result.records.length === 0 ? (
              <EmptyState icon="bi-inbox" label="No students matched this scope" />
            ) : (
              <div className="mu-table-wrapper">
                <table className="mu-table mu-table-hover">
                  <thead>
                    <tr>
                      <th>Reg No</th>
                      <th>Action</th>
                      <th>Detail</th>
                      <th>Bypassed</th>
                      <th>Invoice</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.records.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.student_detail?.registration_number || "N/A"}</strong>
                        </td>
                        <td>
                          <span className={`mu-badge mu-badge-${ACTION_BADGE[r.action] || "gray"}`}>
                            {r.action || "—"}
                          </span>
                        </td>
                        <td>{r.reason || "—"}</td>
                        <td>
                          {r.was_bypassed ? (
                            <span className="mu-badge mu-badge-warning">Yes — provisional</span>
                          ) : (
                            <span className="mu-badge mu-badge-gray">—</span>
                          )}
                        </td>
                        <td>
                          {r.invoice ? (
                            <span className="mu-badge mu-badge-success">Raised</span>
                          ) : (
                            <span className="mu-badge mu-badge-gray">{r.invoice_error || "—"}</span>
                          )}
                        </td>
                        <td>
                          {r.email_sent ? (
                            <span className="mu-badge mu-badge-success">Sent</span>
                          ) : (
                            <span className="mu-badge mu-badge-gray">{r.email_error || "Pending"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {result.records?.length > 0 && (
            <div
              className="mu-card-footer"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
                Total: {result.records.length} student(s) processed
              </span>
            </div>
          )}
        </div>
      )}

      {/* Past Runs */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-clock-history" style={{ marginRight: 8 }} />
            Past Promotion Runs
          </h4>
          <span className="mu-badge mu-badge-primary">{pastRuns.length} Runs</span>
        </div>

        <div className="mu-card-body" style={{ padding: 0 }}>
          {pastRuns.length === 0 ? (
            <EmptyState icon="bi-clock-history" label="No promotion runs have been recorded yet." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Scope</th>
                    <th>Bypassed</th>
                    <th style={{ textAlign: "center" }}>Promoted</th>
                    <th style={{ textAlign: "center" }}>Graduated</th>
                    <th style={{ textAlign: "center" }}>Suspended</th>
                    <th style={{ textAlign: "center" }}>Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {pastRuns.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {run.run_at ? new Date(run.run_at).toLocaleString() : "—"}
                        </span>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {run.programme_detail?.name || run.faculty_detail?.name || "All"}
                        </span>
                      </td>
                      <td>
                        {run.bypass_result_check ? (
                          <span className="mu-badge mu-badge-warning">
                            Yes — {run.bypass_reason || "No reason provided"}
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-gray">No</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-success">{run.promoted_count || 0}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-info">{run.graduated_count || 0}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-danger">{run.suspended_count || 0}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-gray">{run.skipped_count || 0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pastRuns.length > 0 && (
          <div
            className="mu-card-footer"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {pastRuns.length} run(s)
            </span>
          </div>
        )}
      </div>

      {/* Confirm Modal — uses the existing ConfirmModal from AdminUI (title/message/confirmLabel API) */}
      {confirming && (
        <ConfirmModal
          title="Confirm Promotion Run"
          message={
            <div>
              <p style={{ margin: "0 0 12px" }}>
                This will process active students{scopeLabel}
                {bypass ? " — BYPASSING the results check." : "."}
              </p>
              <div
                style={{
                  padding: 12,
                  background: "var(--mu-gray-50)",
                  borderRadius: "var(--mu-radius-sm)",
                  fontSize: "var(--mu-font-size-sm)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--mu-gray-500)" }}>Academic Year:</span>
                  <strong>{selectedAyLabel || "N/A"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ color: "var(--mu-gray-500)" }}>Faculty:</span>
                  <strong>{faculty ? selectedFacultyLabel || "Selected" : "All"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ color: "var(--mu-gray-500)" }}>Programme:</span>
                  <strong>{programme ? selectedProgrammeLabel || "Selected" : "All"}</strong>
                </div>
                {bypass && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--mu-border)" }}>
                    <div style={{ color: "var(--mu-gray-500)" }}>Bypass Reason:</div>
                    <div style={{ color: "var(--mu-gray-700)" }}>{bypassReason || "No reason provided"}</div>
                  </div>
                )}
              </div>
              {bypass && (
                <div className="mu-alert mu-alert-danger" style={{ marginTop: 12, textAlign: "left" }}>
                  <i className="bi bi-exclamation-triangle" />
                  <div>
                    <strong>Warning:</strong> You are bypassing the results check. Students with outstanding
                    supplementaries may be promoted provisionally. Use only when results are delayed.
                  </div>
                </div>
              )}
            </div>
          }
          confirmLabel={running ? "Running..." : "Run Promotion"}
          danger={bypass}
          onConfirm={handleRun}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}