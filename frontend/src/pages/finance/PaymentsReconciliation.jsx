// src/pages/finance/PaymentsReconciliation.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi, financeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, Field, EmptyState, useDebouncedValue, unwrapList, fmtDate,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;

function fullName(user) {
  if (!user) return "N/A";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A";
}

// ----------------------------------------------------------------------
// Reassign modal — search a student, submit reassignment
// ----------------------------------------------------------------------
function ReassignModal({ payment, onClose, onSaved }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) { setResults([]); return; }
    setSearching(true);
    adminApi.students({ search: debouncedSearch, page_size: 8 })
      .then(({ data }) => setResults(unwrapList(data)))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  const handleSubmit = async () => {
    if (!selected) { setError("Select the correct student first."); return; }
    setSaving(true);
    setError("");
    try {
      const { data } = await financeApi.reassignPayment(payment.id, selected.id);
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not reassign payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Reassign Payment — ${payment.bank_reference}`} onClose={onClose} width={480}>
      {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      <p style={{ marginTop: 0, fontSize: 13, color: "#666" }}>
        Currently applied to <strong>{payment.registration_number_on_slip}</strong> ({fullName(payment.student_detail?.user_detail)}),
        Ksh {Number(payment.amount).toLocaleString()}.
      </p>
      <Field label="Correct Student" hint="Search by registration number or name">
        <input className="mu-input" value={search} onChange={(e) => { setSearch(e.target.value); setSelected(null); }} placeholder="Search..." />
      </Field>
      {search && !selected && (
        <div style={{ border: "1px solid #eee", borderRadius: 8, marginTop: 6, maxHeight: 200, overflowY: "auto" }}>
          {searching && <div style={{ padding: 10, fontSize: 13, color: "#999" }}>Searching...</div>}
          {!searching && results.length === 0 && debouncedSearch.length >= 2 && (
            <div style={{ padding: 10, fontSize: 13, color: "#999" }}>No matches.</div>
          )}
          {results.map((st) => (
            <button key={st.id} type="button" onClick={() => { setSelected(st); setSearch(""); setResults([]); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "transparent", borderBottom: "1px solid #f2f2f2", cursor: "pointer" }}>
              <strong>{st.registration_number}</strong> — {fullName(st.user_detail)}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div style={{ marginTop: 10, background: "#f4f6fb", padding: "8px 12px", borderRadius: 6, fontSize: 13 }}>
          Reassigning to: <strong>{selected.registration_number}</strong> — {fullName(selected.user_detail)}
        </div>
      )}
      <p style={{ fontSize: 11, color: "#999", marginTop: 10 }}>
        This removes the payment's current invoice allocations and re-applies it fresh against the
        correct student's open invoices. If part of the amount had already become wallet credit for
        the wrong student, verify their wallet balance manually afterwards.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
        <button className="mu-btn mu-btn-primary" disabled={saving || !selected} onClick={handleSubmit}>
          {saving ? "Reassigning..." : "Reassign Payment"}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Detail modal
// ----------------------------------------------------------------------
function DetailModal({ payment, onClose, onResolve, onReassign }) {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    financeApi.paymentAllocations(payment.id)
      .then(({ data }) => setAllocations(unwrapList(data)))
      .catch(() => setAllocations([]))
      .finally(() => setLoading(false));
  }, [payment.id]);

  return (
    <Modal title={`Payment — ${payment.bank_reference}`} onClose={onClose} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13, marginBottom: 16 }}>
        <Info label="Student" value={`${payment.registration_number_on_slip} — ${fullName(payment.student_detail?.user_detail)}`} full />
        <Info label="Payer Name on Slip" value={payment.payer_name_on_slip} />
        <Info label="Amount" value={`Ksh ${Number(payment.amount).toLocaleString()}`} />
        <Info label="Method" value={payment.method} />
        <Info label="Bank" value={payment.bank_name || "—"} />
        <Info label="Receipt No" value={payment.receipt_number} />
        <Info label="Payment Date" value={fmtDate(payment.payment_date)} />
        {payment.reconciliation_notes && <Info label="Flag" value={<span className="mu-badge mu-badge-warning">{payment.reconciliation_notes}</span>} full />}
      </div>

      <h4 style={{ margin: "0 0 10px" }}>Invoice Allocations</h4>
      {loading ? <LoadingSpinner text="Loading..." /> : (
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead><tr><th>Invoice</th><th>Type</th><th>Applied</th></tr></thead>
            <tbody>
              {allocations.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", padding: 16, color: "#999" }}>No allocations — funds may sit as wallet credit.</td></tr>}
              {allocations.map((a) => (
                <tr key={a.id}>
                  <td>{a.invoice_detail?.description || `Invoice #${a.invoice}`}</td>
                  <td>{a.invoice_detail?.invoice_type}</td>
                  <td>Ksh {Number(a.amount_applied).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button className="mu-btn mu-btn-outline-primary" onClick={onReassign}>
          <i className="bi bi-arrow-left-right" /> Reassign Student
        </button>
        {payment.reconciliation_notes && (
          <button className="mu-btn mu-btn-primary" onClick={onResolve}>
            <i className="bi bi-check-circle" /> Mark Reviewed
          </button>
        )}
      </div>
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

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function PaymentsReconciliation() {
  const [payments, setPayments] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [methodFilter, setMethodFilter] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const [detailTarget, setDetailTarget] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (methodFilter) params.method = methodFilter;

      const { data } = flaggedOnly
        ? await financeApi.flaggedPayments(params)
        : await financeApi.payments(params);

      const list = Array.isArray(data) ? data : data.results || [];
      const total = Array.isArray(data) ? data.length : data.count ?? list.length;
      setPayments(list);
      setCount(total);
    } catch (err) {
      console.error(err);
      setError("Failed to load payments.");
      setPayments([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, methodFilter, flaggedOnly]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { setPage(1); }, [debouncedSearch, methodFilter, flaggedOnly]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleResolve = async () => {
    try {
      await financeApi.resolvePayment(detailTarget.id);
      showToast("Marked as reviewed.");
      setDetailTarget(null);
      fetchPayments();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not resolve.");
    }
  };

  const handleReassigned = () => {
    showToast("Payment reassigned.");
    setReassignTarget(null);
    setDetailTarget(null);
    fetchPayments();
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-arrow-left-right" /> Payments Reconciliation</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Finance <span className="separator">/</span> Reconciliation</div>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 260px" }}>
            <Field label="Search"><input className="mu-input" placeholder="Reg no., payer, reference..." value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Method">
              <select className="mu-input" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                <option value="">All Methods</option>
                <option value="bank">Bank Transfer</option>
                <option value="mpesa">M-Pesa</option>
                <option value="helb">HELB</option>
                <option value="bursary">Bursary</option>
                <option value="cash">Cash</option>
              </select>
            </Field>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10 }}>
            <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
            Flagged only
          </label>
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setSearch(""); setMethodFilter(""); setFlaggedOnly(false); }}>Reset</button>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Payments</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : payments.length === 0 ? (
            <EmptyState icon="bi-inbox" label="No payments found" />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead><tr><th>Reg No / Payer</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.registration_number_on_slip}</strong><div style={{ fontSize: 12, color: "#777" }}>{p.payer_name_on_slip}</div></td>
                      <td>Ksh {Number(p.amount).toLocaleString()}</td>
                      <td>{p.method}</td>
                      <td>{p.bank_reference}</td>
                      <td>{fmtDate(p.payment_date)}</td>
                      <td>{p.reconciliation_notes ? <span className="mu-badge mu-badge-warning">Flagged</span> : <span className="mu-badge mu-badge-success">Clean</span>}</td>
                      <td>
                        <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setDetailTarget(p)}>
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

        {!loading && payments.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} payments</span>
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
        <DetailModal
          payment={detailTarget}
          onClose={() => setDetailTarget(null)}
          onResolve={handleResolve}
          onReassign={() => setReassignTarget(detailTarget)}
        />
      )}

      {reassignTarget && (
        <ReassignModal payment={reassignTarget} onClose={() => setReassignTarget(null)} onSaved={handleReassigned} />
      )}
    </div>
  );
}