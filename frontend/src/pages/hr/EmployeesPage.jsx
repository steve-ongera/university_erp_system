// src/pages/hr/EmployeesPage.jsx
import React, { useEffect, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { hrApi } from "../../services/api";
import { StatusPill } from "./HRDashboardPage";

const CATEGORIES = [
  { value: "permanent", label: "Permanent & Pensionable" },
  { value: "contract", label: "Contract" },
  { value: "part_time", label: "Part-Time" },
  { value: "casual", label: "Casual" },
];

export default function EmployeesPage() {
  const [staff, setStaff] = useState([]);
  const [positions, setPositions] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const res = await hrApi.staff(params);
      setStaff(res.data.results || res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { hrApi.positions().then((r) => setPositions(r.data.results || r.data)); }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Employees</h1>
          <p className="text-sm text-stone-500">All staff on the university payroll.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5D4C] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#184A3D]"
        >
          <Plus size={16} /> Add employee
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-2.5 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or staff number…"
            className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5D4C]/30"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="px-5 py-2.5 font-medium">Staff No.</th>
              <th className="px-5 py-2.5 font-medium">Name</th>
              <th className="px-5 py-2.5 font-medium">Department</th>
              <th className="px-5 py-2.5 font-medium">Position</th>
              <th className="px-5 py-2.5 font-medium">Category</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                <td className="px-5 py-2.5 text-stone-800 font-mono text-xs">{s.staff_number}</td>
                <td className="px-5 py-2.5 text-stone-800">{s.full_name}</td>
                <td className="px-5 py-2.5 text-stone-600">{s.department_name || "—"}</td>
                <td className="px-5 py-2.5 text-stone-600">{s.position_title || "—"}</td>
                <td className="px-5 py-2.5 text-stone-600">
                  {CATEGORIES.find((c) => c.value === s.category)?.label || s.category}
                </td>
                <td className="px-5 py-2.5"><StatusPill status={s.employment_status} /></td>
              </tr>
            ))}
            {!loading && staff.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-stone-400">No employees match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <NewEmployeeModal
          positions={positions}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function NewEmployeeModal({ positions, onClose, onCreated }) {
  const [form, setForm] = useState({
    staff_number: "", user: "", department: "", position: "",
    category: "permanent", date_of_joining: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await hrApi.createStaff(form);
      onCreated();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create employee — check the fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-stone-900">Add employee</h2>
          <button onClick={onClose}><X size={18} className="text-stone-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Staff number">
            <input required value={form.staff_number}
              onChange={(e) => setForm({ ...form, staff_number: e.target.value })}
              className="input" />
          </Field>
          <Field label="Linked user ID">
            <input required value={form.user}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
              placeholder="Existing portal_api User ID"
              className="input" />
          </Field>
          <Field label="Position">
            <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="input">
              <option value="">Select position</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Date of joining">
            <input type="date" required value={form.date_of_joining}
              onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} className="input" />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3.5 py-2 text-sm text-stone-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#1F5D4C] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save employee"}
            </button>
          </div>
        </form>
      </div>
      <style>{`.input { width:100%; border:1px solid #E7E2D8; border-radius:0.5rem; padding:0.5rem 0.75rem; font-size:0.875rem; }`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}