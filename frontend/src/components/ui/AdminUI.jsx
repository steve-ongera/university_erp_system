// src/components/ui/AdminUI.jsx
import { useEffect, useState } from "react";

// ----------------------------------------------------------------------
// Modal shell
// ----------------------------------------------------------------------
export function Modal({ title, onClose, children, width = 560 }) {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 16px", overflowY: "auto", zIndex: 1000,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 10, width: "100%", maxWidth: width,
        boxShadow: "0 20px 50px rgba(0,0,0,0.25)", maxHeight: "calc(100vh - 80px)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid #eee",
        }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} className="mu-btn mu-btn-sm mu-btn-outline-primary" type="button">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div style={{ padding: 20, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = "Delete", onConfirm, onClose, danger = true }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} width={420}>
      <p style={{ marginTop: 0 }}>{message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button className="mu-btn mu-btn-outline-primary" onClick={onClose} type="button">Cancel</button>
        <button
          className={`mu-btn ${danger ? "mu-btn-danger" : "mu-btn-primary"}`}
          disabled={busy}
          type="button"
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
        >
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label style={{ display: "block", fontSize: 13 }}>
      <span style={{ display: "block", marginBottom: 4, color: "#444", fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 11, color: "#999", marginTop: 3 }}>{hint}</span>}
    </label>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #eee", marginBottom: 16, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="mu-btn mu-btn-sm"
          style={{
            border: "none", borderBottom: active === t.key ? "2px solid #3b6ce0" : "2px solid transparent",
            borderRadius: 0, background: "transparent",
            color: active === t.key ? "#3b6ce0" : "#666", fontWeight: active === t.key ? 600 : 400,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Compact secondary tab strip (used for the Semester submenu inside a Year tab)
export function SubTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="mu-btn mu-btn-sm"
          style={{
            borderRadius: 20,
            background: active === t.key ? "#3b6ce0" : "#f1f3f9",
            color: active === t.key ? "#fff" : "#555",
            border: "none",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon = "bi-inbox", label, hint }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--mu-gray-400)" }}>
      <i className={`bi ${icon}`} style={{ fontSize: 40, display: "block", marginBottom: 12 }} />
      <h4 style={{ margin: 0, color: "var(--mu-gray-500)" }}>{label}</h4>
      {hint && <p style={{ margin: "6px 0 0", fontSize: 13 }}>{hint}</p>}
    </div>
  );
}

export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function summarizeErrors(err) {
  const data = err?.response?.data;
  if (!data || typeof data !== "object") return null;
  return Object.entries(data)
    .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(" ") : msgs}`)
    .join(" ");
}

export function unwrapList(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

export function csvEscape(val) {
  const str = String(val ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function downloadCsv(filename, rows, headers) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}