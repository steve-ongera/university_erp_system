// src/pages/finance/FinanceDashboard.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { financeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/ui/AdminUI";

import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const PALETTE = ["#3b6ce0", "#1a8a5a", "#c97d2a", "#7c3aed", "#c23b3b"];

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

export default function FinanceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    financeApi.dashboard()
      .then(({ data }) => setData(data))
      .catch(() => setError("Failed to load the finance dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 48 }}><LoadingSpinner text="Loading finance dashboard..." /></div>;
  if (error) return <div className="mu-alert mu-alert-danger">{error}</div>;
  if (!data) return <EmptyState icon="bi-cash-coin" label="No financial data available" />;

  const trendLine = {
    labels: data.collections_trend.map((t) => t.month),
    datasets: [{
      label: "Collections", data: data.collections_trend.map((t) => t.total),
      borderColor: "#1a8a5a", backgroundColor: "rgba(26,138,90,0.1)", fill: true, tension: 0.4,
      pointBackgroundColor: "#1a8a5a", pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 4,
    }],
  };

  const methodDoughnut = {
    labels: data.payments_by_method.map((m) => m.method),
    datasets: [{ data: data.payments_by_method.map((m) => m.total), backgroundColor: PALETTE, borderColor: "#fff", borderWidth: 2 }],
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-cash-coin" /> Finance Dashboard</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Finance <span className="separator">/</span> Dashboard</div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/finance/reconciliation" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-flag" /> Review Flagged ({data.flagged_count})
          </Link>
        </div>
      </div>

      <div className="mu-dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue"><i className="bi bi-receipt" /></div>
          <div className="mu-stat-label">Total Invoiced</div>
          <div className="mu-stat-value">Ksh {data.totals.invoiced.toLocaleString()}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green"><i className="bi bi-cash" /></div>
          <div className="mu-stat-label">Total Collected</div>
          <div className="mu-stat-value">Ksh {data.totals.collected.toLocaleString()}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red"><i className="bi bi-exclamation-circle" /></div>
          <div className="mu-stat-label">Total Outstanding</div>
          <div className="mu-stat-value">Ksh {data.totals.outstanding.toLocaleString()}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold"><i className="bi bi-flag" /></div>
          <div className="mu-stat-label">Flagged Payments</div>
          <div className="mu-stat-value">{data.flagged_count}</div>
        </div>
      </div>

      <div className="mu-dashboard-grid-3" style={{ marginBottom: 20 }}>
        <div className="mu-card" style={{ gridColumn: "span 2" }}>
          <div className="mu-card-header"><h4>Monthly Collections</h4></div>
          <div className="mu-card-body" style={{ height: 280 }}>
            {data.collections_trend.length === 0
              ? <EmptyState icon="bi-graph-up" label="No payment history yet" />
              : <Line data={trendLine} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}
          </div>
        </div>
        <div className="mu-card">
          <div className="mu-card-header"><h4>Payments by Method</h4></div>
          <div className="mu-card-body" style={{ height: 280 }}>
            {data.payments_by_method.length === 0
              ? <EmptyState icon="bi-pie-chart" label="No payments yet" />
              : <Doughnut data={methodDoughnut} options={{ responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, font: { size: 11 } } } } }} />}
          </div>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Recent Payments</h4>
          <span className="mu-badge mu-badge-primary">{data.recent_payments.length}</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {data.recent_payments.length === 0 ? (
            <EmptyState icon="bi-inbox" label="No payments recorded yet" />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead><tr><th>Student</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {data.recent_payments.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.registration_number_on_slip}</strong><div style={{ fontSize: 12, color: "#777" }}>{fullName(p.student_detail?.user_detail)}</div></td>
                      <td>Ksh {Number(p.amount).toLocaleString()}</td>
                      <td>{p.method}</td>
                      <td>{p.bank_reference}</td>
                      <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td>
                        {p.reconciliation_notes
                          ? <span className="mu-badge mu-badge-warning">Flagged</span>
                          : <span className="mu-badge mu-badge-success">Clean</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}