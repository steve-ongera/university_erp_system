// src/pages/hr/PayrollPage.jsx
import React, { useEffect, useState } from "react";
import { PlayCircle, CheckCircle2, Plus } from "lucide-react";
import { hrApi } from "../../services/api";

function formatKES(amount) {
  const n = Number(amount || 0);
  return `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_LABEL = {
  open: "Open", processing: "Processing", closed: "Payslips generated", paid: "Paid",
};
const STATUS_TINT = {
  open: "bg-stone-100 text-stone-600",
  processing: "bg-amber-50 text-amber-700",
  closed: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
};

export default function PayrollPage() {
  const [periods, setPeriods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await hrApi.payrollPeriods();
      const data = res.data.results || res.data;
      setPeriods(data);
      if (data.length && !selected) setSelected(data[0]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (!selected) return;
    hrApi.periodPayslips(selected.id).then((r) => setPayslips(r.data));
  }, [selected]);

  async function handleRun(period) {
    setBusyId(period.id);
    try {
      await hrApi.runPayroll(period.id);
      await load();
      const refreshed = (await hrApi.payrollPeriods()).data.results.find((p) => p.id === period.id);
      setSelected(refreshed || period);
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkPaid(period) {
    setBusyId(period.id);
    try {
      await hrApi.markPayrollPaid(period.id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const totalNet = payslips.reduce((sum, p) => sum + Number(p.net_pay), 0);
  const totalPaye = payslips.reduce((sum, p) => sum + Number(p.paye), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Payroll</h1>
          <p className="text-sm text-stone-500">Process pay periods and review payslips.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5D4C] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#184A3D]"
        >
          <Plus size={16} /> New pay period
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden lg:col-span-1">
          <div className="px-4 py-2.5 border-b border-stone-100 text-sm font-medium text-stone-700">Pay periods</div>
          <ul className="divide-y divide-stone-50 max-h-[520px] overflow-y-auto">
            {periods.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelected(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-stone-50/70 ${selected?.id === p.id ? "bg-stone-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-800">{String(p.month).padStart(2, "0")}/{p.year}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_TINT[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{p.payslip_count || 0} payslip(s)</p>
                  <div className="mt-2 flex gap-2">
                    {p.status === "open" && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleRun(p); }}
                        className="inline-flex items-center gap-1 text-xs text-[#1F5D4C] font-medium"
                      >
                        <PlayCircle size={13} /> {busyId === p.id ? "Running…" : "Run payroll"}
                      </span>
                    )}
                    {p.status === "closed" && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleMarkPaid(p); }}
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium"
                      >
                        <CheckCircle2 size={13} /> {busyId === p.id ? "Marking…" : "Mark paid"}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {!loading && periods.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-stone-400">No pay periods yet.</li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selected && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SummaryTile label="Payslips" value={payslips.length} />
              <SummaryTile label="Total net pay" value={formatKES(totalNet)} />
              <SummaryTile label="Total PAYE" value={formatKES(totalPaye)} />
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <div className="px-5 py-2.5 border-b border-stone-100 text-sm font-medium text-stone-700">
              Payslips {selected ? `— ${String(selected.month).padStart(2, "0")}/${selected.year}` : ""}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-500 border-b border-stone-100">
                  <th className="px-5 py-2.5 font-medium">Staff</th>
                  <th className="px-5 py-2.5 font-medium text-right">Gross</th>
                  <th className="px-5 py-2.5 font-medium text-right">PAYE</th>
                  <th className="px-5 py-2.5 font-medium text-right">Deductions</th>
                  <th className="px-5 py-2.5 font-medium text-right">Net pay</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.id} className="border-b border-stone-50 last:border-0">
                    <td className="px-5 py-2.5 text-stone-800">{p.staff_name} <span className="text-stone-400 text-xs">({p.staff_number})</span></td>
                    <td className="px-5 py-2.5 text-right text-stone-600">{formatKES(p.gross_pay)}</td>
                    <td className="px-5 py-2.5 text-right text-stone-600">{formatKES(p.paye)}</td>
                    <td className="px-5 py-2.5 text-right text-stone-600">{formatKES(p.total_deductions)}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-stone-900">{formatKES(p.net_pay)}</td>
                  </tr>
                ))}
                {selected && payslips.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-stone-400">No payslips generated for this period yet — run payroll first.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <NewPeriodModal onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function NewPeriodModal({ onClose, onCreated }) {
  const now = new Date();
  const [form, setForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), pay_date: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await hrApi.createPayrollPeriod(form);
      onCreated();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create this pay period (it may already exist).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-5">
        <h2 className="text-base font-semibold text-stone-900 mb-4">New pay period</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min={1} max={12} required value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              placeholder="Month" className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" required value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              placeholder="Year" className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-stone-500 mb-1">Pay date</span>
            <input type="date" value={form.pay_date}
              onChange={(e) => setForm({ ...form, pay_date: e.target.value })}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3.5 py-2 text-sm text-stone-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#1F5D4C] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? "Creating…" : "Create period"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}