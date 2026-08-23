// src/pages/admin/ClearancesManagement.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, Field, EmptyState, useDebouncedValue, unwrapList, fmtDate,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;
const TYPES = [
  { value: "library", label: "Library" },
  { value: "finance", label: "Finance" },
  { value: "department", label: "Department" },
  { value: "hostel", label: "Hostel/Accommodation" },
  { value: "graduation", label: "Graduation (Overall)" },
];
const STATUS_BADGE = { pending: "warning", approved: "success", rejected: "danger", requires_action: "gray" };

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

function DetailModal({ clearance, onClose, onAction }) {
  const [remarks, setRemarks] = useState(clearance.remarks || "");
  const [busy, setBusy] = useState(false);
  const student = clearance.student_detail;

  const act = async (action) => {
    setBusy(true);
    try { await onAction(action, remarks); } finally { setBusy(false); }
  };

  return (
    <Modal title="Clearance Request" onClose={onClose} width={460}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13, marginBottom: 16 }}>
        <Info label="Student" value={`${student?.registration_number} — ${fullName(student?.user_detail)}`} full />
        <Info label="Type" value={TYPES.find((t) => t.value === clearance.clearance_type)?.label} />
        <Info label="Status" value={<span className={`mu-badge mu-badge-${STATUS_BADGE[clearance.status]}`}>{clearance.status}</span>} />
        <Info label="Requested" value={fmtDate(clearance.requested_at)} />
        <Info label="Processed" value={clearance.processed_at ? fmtDate(clearance.processed_at) : "—"} />
      </div>

      {clearance.status === "pending" ? (
        <>
          <Field label="Remarks">
            <textarea className="mu-input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes for the student" />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button className="mu-btn mu-btn-outline-primary" disabled={busy} onClick={() => act("reject")}>Reject</button>
            <button className="mu-btn mu-btn-primary" disabled={busy} onClick={() => act("approve")}>
              {busy ? "Working..." : "Approve"}
            </button>
          </div>
        </>
      ) : (
        clearance.remarks && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "#999" }}>Remarks</div>
            <div>{clearance.remarks}</div>
          </div>
        )
      )}
    </Modal>
  );
}
function Info({ label, value, full }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "#999" }}>{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}

export default function ClearancesManagement() {
  const [clearances, setClearances] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [detailTarget, setDetailTarget] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchClearances = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter) params.clearance_type = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const { data } = await adminApi.clearances(params);
      if (Array.isArray(data)) { setClearances(data); setCount(data.length); }
      else { setClearances(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load clearance requests.");
      setClearances([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, statusFilter]);

  useEffect(() => { fetchClearances(); }, [fetchClearances]);
  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleAction = async (action, remarks) => {
    try {
      if (action === "approve") await adminApi.approveClearance(detailTarget.id, remarks);
      else await adminApi.rejectClearance(detailTarget.id, remarks);
      showToast(`Clearance ${action}d.`);
      setDetailTarget(null);
      fetchClearances();
    } catch (err) {
      showToast(err.response?.data?.detail || "Action failed.");
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-patch-check" /> Clearances Management</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Clearances</div>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Registration number..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 200 }}>
            <Field label="Type">
              <select className="mu-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Status">
              <select className="mu-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="requires_action">Requires Action</option>
              </select>
            </Field>
          </div>
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); }}>Reset</button>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Clearance Requests</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : clearances.length === 0 ? (
            <EmptyState icon="bi-inbox" label="No clearance requests found" />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead><tr><th>Student</th><th>Type</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {clearances.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.student_detail?.registration_number}</strong><div style={{ fontSize: 12, color: "#777" }}>{fullName(c.student_detail?.user_detail)}</div></td>
                      <td>{TYPES.find((t) => t.value === c.clearance_type)?.label || c.clearance_type}</td>
                      <td>{fmtDate(c.requested_at)}</td>
                      <td><span className={`mu-badge mu-badge-${STATUS_BADGE[c.status] || "gray"}`}>{c.status}</span></td>
                      <td>
                        <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailTarget(c)}>
                          <i className="bi bi-eye" /> Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && clearances.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} requests</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <i className="bi bi-chevron-left" /> Prev
              </button>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {detailTarget && (
        <DetailModal clearance={detailTarget} onClose={() => setDetailTarget(null)} onAction={handleAction} />
      )}
    </div>
  );
}