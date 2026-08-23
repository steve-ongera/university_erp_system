// src/pages/admin/DefermentsManagement.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState,
  useDebouncedValue, unwrapList, fmtDate,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;
const STATUS_BADGE = { pending: "warning", approved: "success", rejected: "danger", resumed: "info" };

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

function DetailModal({ deferment, onClose, onAction }) {
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const student = deferment.student_detail;

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <Modal title="Deferment Request" onClose={onClose} width={480}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13, marginBottom: 16 }}>
        <Info label="Student" value={`${student?.registration_number} — ${fullName(student?.user_detail)}`} full />
        <Info label="Applied" value={fmtDate(deferment.applied_at)} />
        <Info label="Status" value={<span className={`mu-badge mu-badge-${STATUS_BADGE[deferment.status]}`}>{deferment.status}</span>} />
        <Info label="At Time of Deferment" value={`Year ${deferment.year_at_deferment}, Semester ${deferment.semester_at_deferment}`} full />
        <Info label="Reason" value={deferment.reason} full />
        {deferment.admin_remarks && <Info label="Admin Remarks" value={deferment.admin_remarks} full />}
      </div>

      {deferment.status === "pending" && (
        <>
          <Field label="Remarks (optional, for rejection)">
            <textarea className="mu-input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button className="mu-btn mu-btn-outline-primary" disabled={busy} onClick={() => act(() => onAction("reject", remarks))}>
              Reject
            </button>
            <button className="mu-btn mu-btn-primary" disabled={busy} onClick={() => act(() => onAction("approve"))}>
              {busy ? "Working..." : "Approve"}
            </button>
          </div>
        </>
      )}

      {deferment.status === "approved" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="mu-btn mu-btn-primary" disabled={busy} onClick={() => act(() => onAction("resume"))}>
            {busy ? "Working..." : "Resume Student"}
          </button>
        </div>
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

export default function DefermentsManagement() {
  const [deferments, setDeferments] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState("");

  const [detailTarget, setDetailTarget] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchDeferments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;

      const { data } = await adminApi.deferments(params);
      if (Array.isArray(data)) { setDeferments(data); setCount(data.length); }
      else { setDeferments(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load deferments.");
      setDeferments([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { fetchDeferments(); }, [fetchDeferments]);
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleAction = async (action, remarks) => {
    try {
      if (action === "approve") await adminApi.approveDeferment(detailTarget.id);
      else if (action === "reject") await adminApi.rejectDeferment(detailTarget.id, remarks);
      else if (action === "resume") await adminApi.resumeDeferment(detailTarget.id);
      showToast(`Deferment ${action === "resume" ? "resumed" : action + "d"}.`);
      setDetailTarget(null);
      fetchDeferments();
    } catch (err) {
      showToast(err.response?.data?.detail || "Action failed.");
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-pause-circle" /> Deferments Management</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Admin <span className="separator">/</span> Deferments</div>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 260px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Reg no. or name..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Status">
              <select className="mu-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="resumed">Resumed</option>
              </select>
            </Field>
          </div>
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setStatusFilter(""); }}>Reset</button>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Deferment Requests</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : deferments.length === 0 ? (
            <EmptyState icon="bi-inbox" label="No deferment requests found" />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead><tr><th>Student</th><th>Reason</th><th>At</th><th>Applied</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {deferments.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.student_detail?.registration_number}</strong><div style={{ fontSize: 12, color: "#777" }}>{fullName(d.student_detail?.user_detail)}</div></td>
                      <td style={{ maxWidth: 260 }}>{d.reason?.slice(0, 80)}{d.reason?.length > 80 ? "…" : ""}</td>
                      <td>Y{d.year_at_deferment} S{d.semester_at_deferment}</td>
                      <td>{fmtDate(d.applied_at)}</td>
                      <td><span className={`mu-badge mu-badge-${STATUS_BADGE[d.status] || "gray"}`}>{d.status}</span></td>
                      <td>
                        <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailTarget(d)}>
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

        {!loading && deferments.length > 0 && (
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
        <DetailModal deferment={detailTarget} onClose={() => setDetailTarget(null)} onAction={handleAction} />
      )}
    </div>
  );
}