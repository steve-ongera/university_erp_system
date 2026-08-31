// src/pages/hr/HRDashboardPage.jsx
import React, { useEffect, useState } from "react";
import {
  Users, CalendarClock, Fingerprint, Wallet, UserCheck,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { hrApi } from "../../services/api";

const GREEN = "#1F5D4C";
const GOLD = "#C08A28";
const BRICK = "#B3402A";
const SLATE = "#5B6B66";
const PIE_COLORS = [GREEN, GOLD, "#4E8C7A", "#D9A94A"];

const CATEGORY_LABELS = {
  permanent: "Permanent",
  contract: "Contract",
  part_time: "Part-Time",
  casual: "Casual",
};

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 flex items-start justify-between">
      <div>
        <p className="text-sm text-stone-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-stone-900">{value}</p>
      </div>
      <div className="rounded-lg p-2.5" style={{ backgroundColor: `${tint}1A` }}>
        <Icon size={20} color={tint} />
      </div>
    </div>
  );
}

function formatKES(amount) {
  const n = Number(amount || 0);
  return `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function HRDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [payrollTrend, setPayrollTrend] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [recentLeave, setRecentLeave] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [s, cat, payroll, att, leave] = await Promise.all([
          hrApi.dashboard(),
          hrApi.staffByCategory(),
          hrApi.payrollTrend(6),
          hrApi.attendanceTrend(14),
          hrApi.leaveApplications({ ordering: "-applied_at" }),
        ]);
        if (cancelled) return;
        setSummary(s.data);
        setByCategory(cat.data.map((c) => ({ name: CATEGORY_LABELS[c.category] || c.category, value: c.count })));
        setPayrollTrend(payroll.data.map((p) => ({ ...p, net: Number(p.net), gross: Number(p.gross) })));
        setAttendanceTrend(att.data);
        setRecentLeave((leave.data.results || leave.data).slice(0, 6));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">HR & Payroll</h1>
        <p className="text-sm text-stone-500">Staffing, leave, attendance and payroll at a glance.</p>
      </div>

      {/* 5 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Active staff" value={loading ? "…" : summary?.total_staff ?? 0} tint={GREEN} />
        <StatCard icon={CalendarClock} label="On leave" value={loading ? "…" : summary?.staff_on_leave ?? 0} tint={GOLD} />
        <StatCard icon={CalendarClock} label="Pending leave requests" value={loading ? "…" : summary?.pending_leave_applications ?? 0} tint={BRICK} />
        <StatCard icon={UserCheck} label="Present today" value={loading ? "…" : summary?.present_today ?? 0} tint={GREEN} />
        <StatCard icon={Wallet} label="Latest payroll (net)" value={loading ? "…" : formatKES(summary?.latest_payroll_net_cost)} tint={GOLD} />
      </div>

      {/* 3 graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-2">
          <p className="text-sm font-medium text-stone-700 mb-3">Payroll cost — last 6 periods</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={payrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" />
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: SLATE }} />
              <YAxis tick={{ fontSize: 12, fill: SLATE }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatKES(v)} />
              <Line type="monotone" dataKey="gross" name="Gross" stroke={GOLD} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" name="Net" stroke={GREEN} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-medium text-stone-700 mb-3">Staff by category</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 12 }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-sm font-medium text-stone-700 mb-3">Attendance — last 14 days</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={attendanceTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE9E1" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: SLATE }} tickFormatter={(d) => d.slice(5)} />
            <YAxis tick={{ fontSize: 12, fill: SLATE }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="present" name="Present" fill={GREEN} radius={[3, 3, 0, 0]} />
            <Bar dataKey="late" name="Late" fill={GOLD} radius={[3, 3, 0, 0]} />
            <Bar dataKey="absent" name="Absent" fill={BRICK} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* minimal table */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-200">
          <p className="text-sm font-medium text-stone-700">Recent leave requests</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="px-5 py-2 font-medium">Staff</th>
              <th className="px-5 py-2 font-medium">Type</th>
              <th className="px-5 py-2 font-medium">Dates</th>
              <th className="px-5 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentLeave.map((l) => (
              <tr key={l.id} className="border-b border-stone-50 last:border-0">
                <td className="px-5 py-2.5 text-stone-800">{l.staff_name}</td>
                <td className="px-5 py-2.5 text-stone-600">{l.leave_type_name}</td>
                <td className="px-5 py-2.5 text-stone-600">{l.start_date} – {l.end_date}</td>
                <td className="px-5 py-2.5">
                  <StatusPill status={l.status} />
                </td>
              </tr>
            ))}
            {!loading && recentLeave.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-stone-400">No leave requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    cancelled: "bg-stone-100 text-stone-500",
    active: "bg-emerald-50 text-emerald-700",
    on_leave: "bg-amber-50 text-amber-700",
    suspended: "bg-red-50 text-red-700",
    terminated: "bg-stone-100 text-stone-500",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || "bg-stone-100 text-stone-600"}`}>
      {status?.replace("_", " ")}
    </span>
  );
}