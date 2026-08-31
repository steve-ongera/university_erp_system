// src/pages/hr/AttendancePage.jsx
import React, { useEffect, useState } from "react";
import { QrCode, Fingerprint, UserX } from "lucide-react";
import { hrApi } from "../../services/api";
import { StatusPill } from "./HRDashboardPage";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [date, setDate] = useState(today());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(null);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await hrApi.attendance({ date });
      setRecords(res.data.results || res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  async function handleGenerateQR() {
    setBusyAction("qr");
    setNotice("");
    try {
      const now = new Date();
      const closes = new Date(now.getTime() + 60 * 60 * 1000);
      await hrApi.createQrSession({
        valid_date: date,
        opens_at: now.toTimeString().slice(0, 8),
        closes_at: closes.toTimeString().slice(0, 8),
      });
      setNotice("New QR check-in session generated for the next hour.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFoldBiometric() {
    setBusyAction("fold");
    setNotice("");
    try {
      const res = await hrApi.foldBiometricLogs(date);
      setNotice(`Folded biometric punches into ${res.data.updated} attendance record(s).`);
      load();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMarkAbsentees() {
    setBusyAction("absent");
    setNotice("");
    try {
      const res = await hrApi.markAbsentees(date);
      setNotice(`Marked ${res.data.marked_absent} staff member(s) absent for ${date}.`);
      load();
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Attendance</h1>
          <p className="text-sm text-stone-500">Biometric, QR and manual attendance in one place.</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ActionCard icon={QrCode} label="Generate QR session"
          description="Opens a 1-hour self-check-in window."
          busy={busyAction === "qr"} onClick={handleGenerateQR} />
        <ActionCard icon={Fingerprint} label="Fold biometric punches"
          description="Turns raw device logs into attendance rows."
          busy={busyAction === "fold"} onClick={handleFoldBiometric} />
        <ActionCard icon={UserX} label="Mark absentees"
          description="Flags active staff with no record today."
          busy={busyAction === "absent"} onClick={handleMarkAbsentees} />
      </div>

      {notice && (
        <div className="rounded-lg bg-emerald-50 text-emerald-700 text-sm px-4 py-2.5">{notice}</div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="px-5 py-2.5 font-medium">Staff</th>
              <th className="px-5 py-2.5 font-medium">Department</th>
              <th className="px-5 py-2.5 font-medium">Check-in</th>
              <th className="px-5 py-2.5 font-medium">Check-out</th>
              <th className="px-5 py-2.5 font-medium">Source</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-stone-50 last:border-0">
                <td className="px-5 py-2.5 text-stone-800">{r.staff_name} <span className="text-stone-400 text-xs">({r.staff_number})</span></td>
                <td className="px-5 py-2.5 text-stone-600">{r.department_name || "—"}</td>
                <td className="px-5 py-2.5 text-stone-600">{r.check_in_time || "—"}</td>
                <td className="px-5 py-2.5 text-stone-600">{r.check_out_time || "—"}</td>
                <td className="px-5 py-2.5 text-stone-500 capitalize">{r.source}</td>
                <td className="px-5 py-2.5">
                  <StatusPill status={r.status} />
                  {r.status === "late" && r.late_minutes > 0 && (
                    <span className="ml-1.5 text-xs text-stone-400">+{r.late_minutes}m</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && records.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-stone-400">No attendance records for {date} yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, label, description, busy, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-left rounded-xl border border-stone-200 bg-white p-4 hover:border-[#1F5D4C]/40 disabled:opacity-60"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={17} className="text-[#1F5D4C]" />
        <span className="text-sm font-medium text-stone-800">{busy ? "Working…" : label}</span>
      </div>
      <p className="text-xs text-stone-500">{description}</p>
    </button>
  );
}