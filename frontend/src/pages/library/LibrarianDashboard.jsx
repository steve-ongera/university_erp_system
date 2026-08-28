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
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { libraryApi } from "../../services/api";

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

function StatCard({ icon, label, value, tone }) {
  return (
    <div className={`lib-stat-card lib-stat-card--${tone}`}>
      <div className="lib-stat-card__icon">
        <i className={`bi ${icon}`} />
      </div>
      <div className="lib-stat-card__body">
        <div className="lib-stat-card__value">{value}</div>
        <div className="lib-stat-card__label">{label}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, empty }) {
  return (
    <div className="lib-chart-card">
      <h3 className="lib-chart-card__title">{title}</h3>
      {empty ? <p className="lib-empty">{empty}</p> : children}
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
    return (
      <div className="lib-dashboard__loading">
        <i className="bi bi-arrow-repeat lib-spin" />
        <span>Loading dashboard…</span>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger m-4">{error}</div>;
  }

  const { totals, loans_trend, category_distribution, fines_breakdown } = summary;

  return (
    <div className="lib-dashboard">
      <header className="lib-dashboard__header">
        <h1>Library Dashboard</h1>
        <p>Circulation, catalog and fines at a glance.</p>
      </header>

      {/* ---------------- 5 stat cards ---------------- */}
      <section className="lib-stat-grid">
        <StatCard icon="bi-journal-bookmark" label="Books in catalog" value={totals.books} tone="indigo" />
        <StatCard
          icon="bi-stack"
          label="Copies available"
          value={`${totals.available_copies}/${totals.copies}`}
          tone="sky"
        />
        <StatCard icon="bi-arrow-left-right" label="Active loans" value={totals.active_loans} tone="emerald" />
        <StatCard icon="bi-exclamation-triangle" label="Overdue loans" value={totals.overdue_loans} tone="amber" />
        <StatCard
          icon="bi-cash-coin"
          label="Outstanding fines"
          value={formatKES(totals.outstanding_fines)}
          tone="rose"
        />
      </section>

      {/* ---------------- 3 charts ---------------- */}
      <section className="lib-chart-grid">
        <ChartCard title="Circulation trend (last 14 days)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={loans_trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} width={30} />
              <Tooltip labelFormatter={(d) => `Date: ${d}`} formatter={(v) => [v, "Loans issued"]} />
              <Line type="monotone" dataKey="loans" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Catalog by category"
          empty={category_distribution.length === 0 ? "No categorised books yet." : null}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={category_distribution} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="name" width={100} fontSize={12} />
              <Tooltip formatter={(v) => [v, "Books"]} />
              <Bar dataKey="book_count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Outstanding fines by reason"
          empty={fines_breakdown.length === 0 ? "No outstanding fines right now." : null}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={fines_breakdown}
                dataKey="total"
                nameKey="reason"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry) => FINE_REASON_LABELS[entry.reason] || entry.reason}
              >
                {fines_breakdown.map((entry, i) => (
                  <Cell key={entry.reason} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, _n, item) => [formatKES(v), FINE_REASON_LABELS[item.payload.reason]]} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ---------------- 1 table ---------------- */}
      <section className="lib-table-card">
        <div className="lib-table-card__header">
          <h3>Most overdue loans</h3>
          <a href="/library-management/circulation">View all circulation →</a>
        </div>
        <table className="lib-table">
          <thead>
            <tr>
              <th>Borrower</th>
              <th>Book</th>
              <th>Accession #</th>
              <th>Due date</th>
              <th>Days overdue</th>
            </tr>
          </thead>
          <tbody>
            {topOverdue.length === 0 && (
              <tr>
                <td colSpan={5} className="lib-table__empty">
                  Nothing overdue right now.
                </td>
              </tr>
            )}
            {topOverdue.map((loan) => {
              const borrower = loan.member_detail?.user_detail;
              return (
                <tr key={loan.id}>
                  <td>
                    {borrower ? `${borrower.first_name} ${borrower.last_name}` : loan.member_detail?.library_card_number}
                  </td>
                  <td>{loan.book_detail?.title}</td>
                  <td>{loan.copy_detail?.accession_number}</td>
                  <td>{loan.due_date}</td>
                  <td>
                    <span className="lib-badge lib-badge--danger">{loan.days_overdue}d</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}