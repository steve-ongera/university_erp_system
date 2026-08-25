// src/pages/admin/students_feepayment.jsx
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { financeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const PAGE_SIZE = 20;

const METHOD_OPTIONS = [
  { value: "bank", label: "Bank Transfer" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "helb", label: "HELB Disbursement" },
  { value: "bursary", label: "Bursary" },
  { value: "cash", label: "Cash" },
];

const inputSm = {
  width: "100%",
  padding: "3px 8px",
  fontSize: "var(--mu-font-size-xs)",
  minHeight: "auto",
  height: 30,
};

function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function studentName(user) {
  if (!user) return null;
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || null;
}

function fmtMoney(n) {
  const num = Number(n || 0);
  return `Ksh ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

// ------------------------------------------------------------------
// Printable receipt — opened in a new tab, browser's print dialog
// lets the user "Save as PDF" with zero extra dependencies.
// ------------------------------------------------------------------
function buildReceiptHtml(payment, allocations) {
  const student = payment.student_detail;
  const name = studentName(student?.user_detail) || payment.payer_name_on_slip;
  const regNo = student?.registration_number || payment.registration_number_on_slip;
  const programme = student?.programme_detail?.name || "";

  const rows = allocations
    .map((a) => {
      const label = a.invoice_detail?.description || a.invoice_detail?.invoice_type || "Invoice";
      return `<tr><td>${label}</td><td style="text-align:right">${fmtMoney(a.amount_applied)}</td></tr>`;
    })
    .join("");

  return `
    <html>
    <head>
      <title>Receipt ${payment.receipt_number || payment.bank_reference || ""}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #1a1a1a; }
        .header { display:flex; justify-content:space-between; align-items:flex-start;
                   border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 20px; margin: 0; }
        .muted { color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        td, th { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 13px; text-align: left; }
        .label-col { color: #666; width: 180px; }
        .total-row td { font-weight: bold; border-top: 2px solid #333; font-size: 15px; }
        .status-ok { color: #1a8a5a; font-weight: 600; }
        .status-pending { color: #c97d2a; font-weight: 600; }
        .footer { margin-top: 32px; font-size: 11px; color: #999; text-align: center; }
        @media print { body { padding: 12px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Muranga University</h1>
          <div class="muted">Official Fee Payment Receipt</div>
        </div>
        <div style="text-align:right">
          <div><strong>Receipt No:</strong> ${payment.receipt_number || "—"}</div>
          <div class="muted">${fmtDate(payment.payment_date)}</div>
        </div>
      </div>

      <table>
        <tr><td class="label-col">Student</td><td>${name || "—"}</td></tr>
        <tr><td class="label-col">Registration No.</td><td>${regNo || "—"}</td></tr>
        ${programme ? `<tr><td class="label-col">Programme</td><td>${programme}</td></tr>` : ""}
        <tr><td class="label-col">Payment Method</td><td>${(payment.method || "").toUpperCase()}</td></tr>
        <tr><td class="label-col">Bank / Reference</td><td>${payment.bank_name ? payment.bank_name + " · " : ""}${payment.bank_reference || "—"}</td></tr>
        <tr><td class="label-col">Status</td><td class="${payment.is_reconciled ? "status-ok" : "status-pending"}">
          ${payment.is_reconciled ? "Reconciled" : "Pending Reconciliation"}
        </td></tr>
      </table>

      ${allocations.length > 0 ? `
        <h3 style="margin-top:24px; font-size:14px;">Applied To</h3>
        <table>
          <thead><tr><th>Invoice</th><th style="text-align:right">Amount Applied</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      ` : ""}

      <table>
        <tr class="total-row"><td>Total Amount Paid</td><td style="text-align:right">${fmtMoney(payment.amount)}</td></tr>
      </table>

      <div class="footer">This is a system-generated receipt. For queries, contact the Finance Office.</div>
    </body>
    </html>
  `;
}

export default function StudentsFeePayment() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- filters ---
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [methodFilter, setMethodFilter] = useState("");
  const [reconciledFilter, setReconciledFilter] = useState(""); // "", "true", "false"

  // --- pagination ---
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // --- page-level summary ---
  const pageTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // --- receipt modal ---
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptAllocations, setReceiptAllocations] = useState([]);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptBusyId, setReceiptBusyId] = useState(null);

  // --- resolve-flag action ---
  const [resolveBusyId, setResolveBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (methodFilter) params.method = methodFilter;
      if (reconciledFilter) params.is_reconciled = reconciledFilter;

      const { data } = await financeApi.payments(params);
      const list = Array.isArray(data) ? data : (data.results || []);
      const total = Array.isArray(data) ? data.length : (data.count ?? list.length);
      setPayments(list);
      setTotalCount(total);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load fee payments.");
      setPayments([]); setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, methodFilter, reconciledFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, methodFilter, reconciledFilter]);

  const resetFilters = () => {
    setSearch(""); setMethodFilter(""); setReconciledFilter(""); setPage(1);
  };

  // ---------------------------------------------------------------
  // Receipt: preview modal
  // ---------------------------------------------------------------
  const openReceipt = async (payment) => {
    setReceiptPayment(payment);
    setReceiptAllocations([]);
    setReceiptLoading(true);
    try {
      const { data } = await financeApi.paymentAllocations(payment.id);
      setReceiptAllocations(data.results ?? data ?? []);
    } catch {
      setReceiptAllocations([]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const printCurrentReceipt = () => {
    if (!receiptPayment) return;
    const html = buildReceiptHtml(receiptPayment, receiptAllocations);
    const win = window.open("", "_blank", "width=760,height=920");
    if (!win) {
      setError("Please allow pop-ups for this site to download the receipt.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // Quick download straight from the table row, no preview.
  const quickDownloadReceipt = async (payment) => {
    setReceiptBusyId(payment.id);
    try {
      let allocations = [];
      try {
        const { data } = await financeApi.paymentAllocations(payment.id);
        allocations = data.results ?? data ?? [];
      } catch { /* proceed without allocation breakdown */ }
      const html = buildReceiptHtml(payment, allocations);
      const win = window.open("", "_blank", "width=760,height=920");
      if (!win) {
        setError("Please allow pop-ups for this site to download the receipt.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    } finally {
      setReceiptBusyId(null);
    }
  };

  const handleResolve = async (payment) => {
    setResolveBusyId(payment.id);
    try {
      await financeApi.resolvePayment(payment.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not resolve this flag.");
    } finally {
      setResolveBusyId(null);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-cash-stack" /> Fee Payments</h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Fee Payments
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/finance" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" /> Back to Finance
          </Link>
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Total Records</div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>{totalCount}</div>
        </div>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>This Page's Total</div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>{fmtMoney(pageTotal)}</div>
        </div>
        <div className="mu-stat-card" style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>Flagged (this page)</div>
          <div style={{ fontSize: "var(--mu-font-size-xl)", fontWeight: "var(--mu-font-weight-bold)" }}>
            {payments.filter((p) => p.reconciliation_notes).length}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Search</div>
            <div style={{ position: "relative" }}>
              <i className="bi bi-search" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--mu-gray-400)" }} />
              <input
                type="text" className="mu-input" style={{ ...inputSm, paddingLeft: 26 }}
                placeholder="Reg no., payer name, bank ref, receipt no..."
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ width: 190 }}>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Payment Method</div>
            <select className="mu-select" style={inputSm} value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="">All Methods</option>
              {METHOD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div style={{ width: 190 }}>
            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginBottom: 4 }}>Reconciliation</div>
            <select className="mu-select" style={inputSm} value={reconciledFilter} onChange={(e) => setReconciledFilter(e.target.value)}>
              <option value="">All</option>
              <option value="true">Reconciled</option>
              <option value="false">Pending / Flagged</option>
            </select>
          </div>

          <button className="mu-btn mu-btn-secondary" style={{ height: 30 }} onClick={resetFilters}>
            <i className="bi bi-arrow-counterclockwise" /> Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mu-card">
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading fee payments..." /></div>
          ) : payments.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-receipt" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Payments Found</h3>
              <p style={{ margin: "8px 0 0" }}>No fee payments match your filters.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Receipt No.</th>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Bank / Reference</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const name = studentName(p.student_detail?.user_detail);
                    const flagged = !!p.reconciliation_notes;
                    return (
                      <tr key={p.id}>
                        <td><strong>{p.receipt_number || "—"}</strong></td>
                        <td>
                          <div>{p.registration_number_on_slip || p.student_detail?.registration_number || "—"}</div>
                          <div style={{ fontSize: 11, color: "var(--mu-gray-500)" }}>{name || p.payer_name_on_slip}</div>
                        </td>
                        <td><strong>{fmtMoney(p.amount)}</strong></td>
                        <td>
                          <span className="mu-badge mu-badge-primary" style={{ fontSize: "var(--mu-font-size-xs)" }}>
                            {(p.method || "").toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div>{p.bank_name || "—"}</div>
                          <div style={{ fontSize: 11, color: "var(--mu-gray-500)" }}>{p.bank_reference}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{fmtDate(p.payment_date)}</td>
                        <td>
                          {flagged ? (
                            <span className="mu-badge mu-badge-danger" title={p.reconciliation_notes} style={{ fontSize: "var(--mu-font-size-xs)" }}>
                              Flagged
                            </span>
                          ) : p.is_reconciled ? (
                            <span className="mu-badge mu-badge-success" style={{ fontSize: "var(--mu-font-size-xs)" }}>Reconciled</span>
                          ) : (
                            <span className="mu-badge mu-badge-gray" style={{ fontSize: "var(--mu-font-size-xs)" }}>Pending</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Preview receipt"
                                    onClick={() => openReceipt(p)}>
                              <i className="bi bi-eye" />
                            </button>
                            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" title="Download receipt"
                                    disabled={receiptBusyId === p.id} onClick={() => quickDownloadReceipt(p)}>
                              {receiptBusyId === p.id ? <i className="bi bi-arrow-repeat mu-animate-spin" /> : <i className="bi bi-download" />}
                            </button>
                            {flagged && (
                              <button className="mu-btn mu-btn-sm mu-btn-danger" title="Clear flag"
                                      disabled={resolveBusyId === p.id} onClick={() => handleResolve(p)}>
                                {resolveBusyId === p.id ? <i className="bi bi-arrow-repeat mu-animate-spin" /> : <i className="bi bi-check2" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && payments.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Page {page} of {totalPages} &middot; {totalCount} record(s)
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <i className="bi bi-chevron-left" /> Prev
              </button>
              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      <Modal
        isOpen={!!receiptPayment}
        onClose={() => setReceiptPayment(null)}
        title="Payment Receipt"
        size="md"
        confirmText="Print / Save as PDF"
        onConfirm={printCurrentReceipt}
        isLoading={false}
      >
        {receiptPayment && (
          <div>
            {receiptLoading ? (
              <LoadingSpinner text="Loading allocation details..." />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--mu-gray-500)" }}>Receipt No.</div>
                    <strong>{receiptPayment.receipt_number || "—"}</strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--mu-gray-500)" }}>Date</div>
                    <strong>{fmtDate(receiptPayment.payment_date)}</strong>
                  </div>
                </div>

                <div className="mu-table-wrapper">
                  <table className="mu-table">
                    <tbody>
                      <tr><td style={{ color: "var(--mu-gray-500)", width: 160 }}>Student</td>
                        <td>{studentName(receiptPayment.student_detail?.user_detail) || receiptPayment.payer_name_on_slip}</td></tr>
                      <tr><td style={{ color: "var(--mu-gray-500)" }}>Registration No.</td>
                        <td>{receiptPayment.student_detail?.registration_number || receiptPayment.registration_number_on_slip}</td></tr>
                      <tr><td style={{ color: "var(--mu-gray-500)" }}>Method</td>
                        <td>{(receiptPayment.method || "").toUpperCase()}</td></tr>
                      <tr><td style={{ color: "var(--mu-gray-500)" }}>Bank / Reference</td>
                        <td>{receiptPayment.bank_name} {receiptPayment.bank_reference}</td></tr>
                      <tr><td style={{ color: "var(--mu-gray-500)" }}>Amount</td>
                        <td><strong>{fmtMoney(receiptPayment.amount)}</strong></td></tr>
                      <tr><td style={{ color: "var(--mu-gray-500)" }}>Status</td>
                        <td>{receiptPayment.is_reconciled ? "Reconciled" : "Pending Reconciliation"}</td></tr>
                    </tbody>
                  </table>
                </div>

                {receiptAllocations.length > 0 && (
                  <>
                    <h5 style={{ margin: "16px 0 8px", fontSize: 13 }}>Applied To</h5>
                    <div className="mu-table-wrapper">
                      <table className="mu-table">
                        <thead><tr><th>Invoice</th><th style={{ textAlign: "right" }}>Amount Applied</th></tr></thead>
                        <tbody>
                          {receiptAllocations.map((a) => (
                            <tr key={a.id}>
                              <td>{a.invoice_detail?.description || a.invoice_detail?.invoice_type}</td>
                              <td style={{ textAlign: "right" }}>{fmtMoney(a.amount_applied)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}