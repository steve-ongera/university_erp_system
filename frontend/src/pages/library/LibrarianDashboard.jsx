// src/pages/library/LibrarianDashboard.jsx
//
// Requires recharts (npm install recharts) — not currently referenced
// elsewhere in the codebase, so confirm it's installed before dropping
// this in. bootstrap-icons is already a project dependency (see App.jsx).
//
// Data comes from two existing endpoints — no new backend routes needed:
//   - libraryApi.dashboard()      -> GET /library/dashboard/   (stats + chart data)
//   - libraryApi.overdueLoans()   -> GET /library/loans/overdue/ (table)

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { libraryApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const CHART_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const FINE_REASON_LABELS = {
  overdue: "Overdue return",
  lost: "Lost book",
  damaged: "Damaged book",
};

const formatKES = (value) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);

function StatCard({ icon, label, value, color }) {
  const iconColorMap = {
    indigo: "blue",
    sky: "blue",
    emerald: "green",
    amber: "gold",
    rose: "red",
  };
  return (
    <div className="mu-stat-card">
      <div className={`mu-stat-icon ${iconColorMap[color] || "blue"}`}>
        <i className={`bi ${icon}`} />
      </div>
      <div className="mu-stat-label">{label}</div>
      <div className="mu-stat-value">{value}</div>
    </div>
  );
}

export default function LibrarianDashboard() {
  const [summary, setSummary] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [dashboardRes, overdueRes] = await Promise.all([
          libraryApi.dashboard(),
          libraryApi.overdueLoans(),
        ]);
        if (cancelled) return;
        setSummary(dashboardRes.data);
        setOverdue(overdueRes.data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || "Couldn't load the library dashboard. Try refreshing.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const topOverdue = useMemo(
    () => [...overdue].sort((a, b) => b.days_overdue - a.days_overdue).slice(0, 10),
    [overdue]
  );

  if (loading) {
    return <LoadingSpinner text="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="mu-alert mu-alert-danger">
        <i className="bi bi-exclamation-triangle" />
        {error}
      </div>
    );
  }

  const { totals, loans_trend, category_distribution, fines_breakdown } = summary || {};

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-speedometer2" />
            Library Dashboard
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Library <span className="separator">/</span> Dashboard
          </div>
        </div>
      </div>

      {/* Stats Grid - 5 Cards */}
      <div className="mu-dashboard-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <StatCard
          icon="bi-journal-bookmark"
          label="Books in Catalog"
          value={totals?.books || 0}
          color="indigo"
        />
        <StatCard
          icon="bi-stack"
          label="Copies Available"
          value={`${totals?.available_copies || 0}/${totals?.copies || 0}`}
          color="sky"
        />
        <StatCard
          icon="bi-arrow-left-right"
          label="Active Loans"
          value={totals?.active_loans || 0}
          color="emerald"
        />
        <StatCard
          icon="bi-exclamation-triangle"
          label="Overdue Loans"
          value={totals?.overdue_loans || 0}
          color="amber"
        />
        <StatCard
          icon="bi-cash-coin"
          label="Outstanding Fines"
          value={formatKES(totals?.outstanding_fines || 0)}
          color="rose"
        />
      </div>

      {/* Three Column Charts */}
      <div className="mu-dashboard-grid-3" style={{ marginBottom: 24 }}>
        {/* Line Chart */}
        <div className="mu-card" style={{ gridColumn: "span 1" }}>
          <div className="mu-card-header">
            <h4>Circulation Trend (Last 14 Days)</h4>
          </div>
          <div className="mu-card-body" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loans_trend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--mu-gray-200)" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => d?.slice(5) || ""} 
                  fontSize={11} 
                  stroke="var(--mu-gray-400)"
                />
                <YAxis 
                  allowDecimals={false} 
                  fontSize={11} 
                  width={30} 
                  stroke="var(--mu-gray-400)"
                />
                <Tooltip 
                  labelFormatter={(d) => `Date: ${d}`} 
                  formatter={(v) => [v, "Loans issued"]}
                  contentStyle={{ 
                    background: "var(--mu-white)", 
                    border: "1px solid var(--mu-border)",
                    borderRadius: "var(--mu-radius-sm)",
                    boxShadow: "var(--mu-shadow-sm)"
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="loans" 
                  stroke="#4f46e5" 
                  strokeWidth={2.5} 
                  dot={{ fill: "#4f46e5", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart - Category Distribution */}
        <div className="mu-card" style={{ gridColumn: "span 1" }}>
          <div className="mu-card-header">
            <h4>Catalog by Category</h4>
          </div>
          <div className="mu-card-body" style={{ height: 280 }}>
            {category_distribution?.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-inbox" style={{ fontSize: 24, marginRight: 8 }} />
                No categorised books yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={category_distribution || []} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--mu-gray-200)" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} stroke="var(--mu-gray-400)" />
                  <YAxis type="category" dataKey="name" width={100} fontSize={11} stroke="var(--mu-gray-400)" />
                  <Tooltip 
                    formatter={(v) => [v, "Books"]}
                    contentStyle={{ 
                      background: "var(--mu-white)", 
                      border: "1px solid var(--mu-border)",
                      borderRadius: "var(--mu-radius-sm)",
                      boxShadow: "var(--mu-shadow-sm)"
                    }}
                  />
                  <Bar dataKey="book_count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart - Fines Breakdown */}
        <div className="mu-card" style={{ gridColumn: "span 1" }}>
          <div className="mu-card-header">
            <h4>Outstanding Fines by Reason</h4>
          </div>
          <div className="mu-card-body" style={{ height: 280 }}>
            {fines_breakdown?.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-check-circle" style={{ fontSize: 24, marginRight: 8, color: "var(--mu-success)" }} />
                No outstanding fines right now.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fines_breakdown || []}
                    dataKey="total"
                    nameKey="reason"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => FINE_REASON_LABELS[entry.reason] || entry.reason}
                    labelLine={{ stroke: "var(--mu-gray-300)" }}
                  >
                    {(fines_breakdown || []).map((entry, i) => (
                      <Cell key={entry.reason} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(v, _n, item) => [formatKES(v), FINE_REASON_LABELS[item?.payload?.reason] || "Fine"]}
                    contentStyle={{ 
                      background: "var(--mu-white)", 
                      border: "1px solid var(--mu-border)",
                      borderRadius: "var(--mu-radius-sm)",
                      boxShadow: "var(--mu-shadow-sm)"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Most Overdue Loans Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-exclamation-triangle" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
            Most Overdue Loans
          </h4>
          <Link to="/library/circulation" className="mu-btn mu-btn-sm mu-btn-outline-primary">
            View All <i className="bi bi-chevron-right" />
          </Link>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {topOverdue.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-check-circle" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "var(--mu-success)" }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>Nothing Overdue</h3>
              <p style={{ margin: "8px 0 0" }}>All loans are in good standing.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th>Book</th>
                    <th>Accession #</th>
                    <th>Due Date</th>
                    <th style={{ textAlign: "center" }}>Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {topOverdue.map((loan) => {
                    const borrower = loan.member_detail?.user_detail;
                    return (
                      <tr key={loan.id}>
                        <td>
                          <strong>
                            {borrower ? `${borrower.first_name} ${borrower.last_name}` : loan.member_detail?.library_card_number || "N/A"}
                          </strong>
                        </td>
                        <td>{loan.book_detail?.title}</td>
                        <td>
                          <span className="mu-badge mu-badge-primary">
                            {loan.copy_detail?.accession_number}
                          </span>
                        </td>
                        <td>{loan.due_date}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="mu-badge mu-badge-danger">
                            <i className="bi bi-clock" style={{ marginRight: 4 }} />
                            {loan.days_overdue}d
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {topOverdue.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Showing {topOverdue.length} most overdue loan(s)
            </span>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-clock-history" style={{ marginRight: 4 }} />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}