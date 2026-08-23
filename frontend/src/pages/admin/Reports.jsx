// src/pages/admin/Reports.jsx
import { useState, useEffect } from "react";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { TabBar, EmptyState, downloadCsv } from "../../components/ui/AdminUI";

function printSection(title, columns, rows) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  const body = rows.map((r) => `<tr>${columns.map((c) => `<td style="padding:6px 10px;border:1px solid #ddd;">${r[c.key] ?? ""}</td>`).join("")}</tr>`).join("");
  win.document.write(`
    <html><head><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;} table{border-collapse:collapse;width:100%;font-size:12px;margin-top:12px;}
    th{text-align:left;padding:6px 10px;border:1px solid #ddd;background:#f2f4f8;}</style></head>
    <body><h2>${title}</h2><table><thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
    <tbody>${body || `<tr><td colspan="${columns.length}">No data.</td></tr>`}</tbody></table></body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

const STATUS_COLORS = { active: "success", deferred: "warning", graduated: "info", suspended: "danger", discontinued: "gray", expelled: "danger" };

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    adminApi.reports()
      .then(({ data }) => setData(data))
      .catch(() => setError("Failed to load reports."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 48 }}><LoadingSpinner text="Building reports..." /></div>;
  if (error) return <div className="mu-alert mu-alert-danger">{error}</div>;
  if (!data) return <EmptyState icon="bi-bar-chart" label="No report data available" />;

  const statusRows = Object.entries(data.students_by_status || {}).map(([status, count]) => ({ status, count }));

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-bar-chart" /> Reports</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Reports</div>
        </div>
      </div>

      <TabBar
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "programmes", label: "Students by Programme" },
          { key: "academics", label: "Academic Performance" },
          { key: "fees", label: "Fee Collection" },
          { key: "exams", label: "Upcoming Examinations" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="mu-dashboard-grid">
          {statusRows.map((r) => (
            <div key={r.status} className="mu-stat-card">
              <div className={`mu-stat-icon ${STATUS_COLORS[r.status] === "danger" ? "red" : "blue"}`}>
                <i className="bi bi-people" />
              </div>
              <div className="mu-stat-label" style={{ textTransform: "capitalize" }}>{r.status}</div>
              <div className="mu-stat-value">{r.count}</div>
            </div>
          ))}
          <div className="mu-stat-card">
            <div className="mu-stat-icon gold"><i className="bi bi-pause-circle" /></div>
            <div className="mu-stat-label">Deferments Pending</div>
            <div className="mu-stat-value">{data.deferments_pending}</div>
          </div>
          <div className="mu-stat-card">
            <div className="mu-stat-icon purple"><i className="bi bi-patch-check" /></div>
            <div className="mu-stat-label">Clearances Pending</div>
            <div className="mu-stat-value">{data.clearances_pending}</div>
          </div>
        </div>
      )}

      {tab === "programmes" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Students by Programme</h4>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary"
                      onClick={() => downloadCsv("students_by_programme.csv",
                        data.students_by_programme.map((p) => ({ code: p.programme__code, name: p.programme__name, count: p.c })),
                        ["code", "name", "count"])}>
                <i className="bi bi-download" /> CSV
              </button>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary"
                      onClick={() => printSection("Students by Programme",
                        [{ key: "code", label: "Code" }, { key: "name", label: "Programme" }, { key: "count", label: "Students" }],
                        data.students_by_programme.map((p) => ({ code: p.programme__code, name: p.programme__name, count: p.c })))}>
                <i className="bi bi-printer" /> Print
              </button>
            </div>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            <div className="mu-table-wrapper">
              <table className="mu-table">
                <thead><tr><th>Code</th><th>Programme</th><th>Students</th></tr></thead>
                <tbody>
                  {data.students_by_programme.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: "center", padding: 20, color: "#999" }}>No data.</td></tr>
                  )}
                  {data.students_by_programme.map((p, i) => (
                    <tr key={i}><td>{p.programme__code}</td><td>{p.programme__name}</td><td>{p.c}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "academics" && (
        <div className="mu-card">
          <div className="mu-card-header"><h4>Academic Performance</h4></div>
          <div className="mu-card-body">
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Stat label="Grades Published" value={data.grades.published} />
              <Stat label="Passes" value={data.grades.pass} />
              <Stat label="Fails / Supplementary" value={data.grades.fail} />
              <Stat label="Pass Rate" value={data.grades.pass_rate !== null ? `${data.grades.pass_rate}%` : "—"} />
            </div>
          </div>
        </div>
      )}

      {tab === "fees" && (
        <div className="mu-card">
          <div className="mu-card-header"><h4>Fee Collection</h4></div>
          <div className="mu-card-body">
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Stat label="Total Invoiced" value={`Ksh ${data.fees.total_invoiced.toLocaleString()}`} />
              <Stat label="Total Collected" value={`Ksh ${data.fees.total_collected.toLocaleString()}`} />
              <Stat label="Total Outstanding" value={`Ksh ${data.fees.total_outstanding.toLocaleString()}`} />
            </div>
          </div>
        </div>
      )}

      {tab === "exams" && (
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Upcoming Examinations</h4>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary"
                    onClick={() => downloadCsv("upcoming_examinations.csv", data.upcoming_examinations, ["course", "type", "date", "venue"])}>
              <i className="bi bi-download" /> CSV
            </button>
          </div>
          <div className="mu-card-body" style={{ padding: 0 }}>
            <div className="mu-table-wrapper">
              <table className="mu-table">
                <thead><tr><th>Course</th><th>Type</th><th>Date</th><th>Venue</th></tr></thead>
                <tbody>
                  {data.upcoming_examinations.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "#999" }}>No upcoming exams.</td></tr>
                  )}
                  {data.upcoming_examinations.map((e, i) => (
                    <tr key={i}><td>{e.course}</td><td>{e.type}</td><td>{e.date}</td><td>{e.venue || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#999", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}