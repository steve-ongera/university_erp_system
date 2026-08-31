// src/pages/hr/LeavePage.jsx
import React, { useEffect, useState } from "react";
import { Check, X as XIcon, Plus } from "lucide-react";
import { hrApi } from "../../services/api";
import { StatusPill } from "./HRDashboardPage";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function LeavePage() {
  const [tab, setTab] = useState("pending");
  const [applications, setApplications] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await hrApi.leaveApplications({ status: tab, ordering: "-applied_at" });
      setApplications(res.data.results || res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    hrApi.leaveTypes().then((r) => setLeaveTypes(r.data.results || r.data));
    hrApi.staff({}).then((r) => setStaffList(r.data.results || r.data));
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  async function handleDecision(id, approve) {
    setBusyId(id);
    try {
      if (approve) await hrApi.approveLeave(id);
      else await hrApi.rejectLeave(id);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Leave</h1>
          <p className="text-sm text-stone-500">Applications, approvals and balances.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5D4C] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#184A3D]"
        >
          <Plus size={16} /> New application
        </button>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.value ? "border-[#1F5D4C] text-[#1F5D4C]" : "border-transparent text-stone-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="px-5 py-2.5 font-medium">Staff</th>
              <th className="px-5 py-2.5 font-medium">Type</th>
              <th className="px-5 py-2.5 font-medium">Dates</th>
              <th className="px-5 py-2.5 font-medium">Days</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              {tab === "pending" && <th className="px-5 py-2.5 font-medium text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id} className="border-b border-stone-50 last:border-0">
                <td className="px-5 py-2.5 text-stone-800">{a.staff_name} <span className="text-stone-400 text-xs">({a.staff_number})</span></td>
                <td className="px-5 py-2.5 text-stone-600">{a.leave_type_name}</td>
                <td className="px-5 py-2.5 text-stone-600">{a.start_date} – {a.end_date}</td>
                <td className="px-5 py-2.5 text-stone-600">{a.days_requested}</td>
                <td className="px-5 py-2.5"><StatusPill status={a.status} /></td>
                {tab === "pending" && (
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={busyId === a.id}
                        onClick={() => handleDecision(a.id, true)}
                        className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        title="Approve"
                      ><Check size={15} /></button>
                      <button
                        disabled={busyId === a.id}
                        onClick={() => handleDecision(a.id, false)}
                        className="p-1.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100"
                        title="Reject"
                      ><XIcon size={15} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!loading && applications.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-stone-400">No {tab} applications.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <NewLeaveModal
          leaveTypes={leaveTypes}
          staffList={staffList}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); setTab("pending"); load(); }}
        />
      )}
    </div>
  );
}

function NewLeaveModal({ leaveTypes, staffList, onClose, onCreated }) {
  const [form, setForm] = useState({ staff: "", leave_type: "", start_date: "", end_date: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await hrApi.applyLeave(form);
      onCreated();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not submit this application.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-5">
        <h2 className="text-base font-semibold text-stone-900 mb-4">New leave application</h2>
        <form onSubmit={submit} className="space-y-3">
          <select required value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Select staff member</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.staff_number})</option>)}
          </select>
          <select required value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Select leave type</option>
            {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" required value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
            <input type="date" required value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Reason (optional)" rows={3}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3.5 py-2 text-sm text-stone-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#1F5D4C] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}