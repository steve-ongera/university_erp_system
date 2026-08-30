import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { feesApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

function ReceiptRow({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "var(--mu-font-size-sm)" }}>
      <span style={{ color: "var(--mu-gray-500)" }}>{label}:</span>
      <span style={{ fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}

export default function FeesPayments() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_outstanding: 0, wallet_credit: 0, open_invoices: [] });
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");

  // Pay modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payTargetInvoiceId, setPayTargetInvoiceId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  // Receipt modal
  const [receipt, setReceipt] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, paymentsRes] = await Promise.all([
        feesApi.myFeeSummary(),
        feesApi.payments(),
      ]);
      setSummary(summaryRes.data || { total_outstanding: 0, wallet_credit: 0, open_invoices: [] });
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
    } catch (err) {
      console.error("Error fetching fees:", err);
      setError("Failed to load your fee information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openPayModal = (invoiceId = "") => {
    const defaultId = invoiceId || summary.open_invoices?.[0]?.id || "";
    setPayTargetInvoiceId(defaultId ? String(defaultId) : "");
    setPhoneNumber("");
    setPayError("");
    setPayModalOpen(true);
  };

  const selectedInvoice = summary.open_invoices?.find(
    (inv) => String(inv.id) === String(payTargetInvoiceId)
  );

  const handlePay = async () => {
    if (!payTargetInvoiceId) {
      setPayError("Select an invoice to pay.");
      return;
    }
    if (!phoneNumber.trim()) {
      setPayError("Enter the M-Pesa phone number to receive the STK push.");
      return;
    }
    setPaying(true);
    setPayError("");
    try {
      const { data } = await feesApi.payInvoice(payTargetInvoiceId, phoneNumber.trim());
      setPayModalOpen(false);
      setReceipt(data);
      setReceiptModalOpen(true);
      await fetchData();
    } catch (err) {
      console.error("Error paying invoice:", err);
      setPayError(err.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const viewReceipt = async (paymentId) => {
    setError("");
    try {
      const { data } = await feesApi.paymentReceipt(paymentId);
      setReceipt(data);
      setReceiptModalOpen(true);
    } catch (err) {
      console.error("Error fetching receipt:", err);
      setError("Failed to load receipt for this payment.");
    }
  };

  const handlePrintReceipt = () => window.print();

  if (loading) {
    return <LoadingSpinner text="Loading your fees..." />;
  }

  const hasOpenInvoices = (summary.open_invoices?.length || 0) > 0;

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-cash-coin" />
            Fees & Payments
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Campus Life <span className="separator">/</span> Fees & Payments
          </div>
        </div>
        <div className="mu-page-header-actions">
          {summary.total_outstanding > 0 && (
            <button className="mu-btn mu-btn-primary" onClick={() => openPayModal()} disabled={!hasOpenInvoices}>
              <i className="bi bi-credit-card" />
              Pay Now
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-cash-coin" />
          </div>
          <div className="mu-stat-label">Outstanding Balance</div>
          <div className="mu-stat-value" style={{ color: summary.total_outstanding > 0 ? "var(--mu-danger)" : "var(--mu-success)" }}>
            KES {Number(summary.total_outstanding).toLocaleString()}
          </div>
          {summary.total_outstanding > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-danger)" }}>
              <i className="bi bi-exclamation-triangle" />
              Payment required
            </div>
          )}
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-wallet2" />
          </div>
          <div className="mu-stat-label">Wallet Credit</div>
          <div className="mu-stat-value" style={{ color: summary.wallet_credit > 0 ? "var(--mu-success)" : "var(--mu-gray-500)" }}>
            KES {Number(summary.wallet_credit).toLocaleString()}
          </div>
          {summary.wallet_credit > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-success)" }}>
              <i className="bi bi-check-circle" />
              Credit available
            </div>
          )}
        </div>
      </div>

      {/* Open Invoices */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>Open Invoices</h4>
          <span className="mu-badge mu-badge-primary">
            {summary.open_invoices?.length || 0} Invoices
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {summary.open_invoices && summary.open_invoices.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Semester</th>
                    <th style={{ textAlign: "right" }}>Amount Due</th>
                    <th style={{ textAlign: "right" }}>Balance</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.open_invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <span className="mu-badge mu-badge-info">
                          {invoice.invoice_type?.replace("_", " ")}
                        </span>
                      </td>
                      <td>{invoice.description || "-"}</td>
                      <td>
                        {invoice.semester_detail?.academic_year_detail?.year || "N/A"} 
                        S{invoice.semester_detail?.semester_number || ""}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        KES {Number(invoice.amount_due).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: invoice.balance > 0 ? "var(--mu-danger)" : "var(--mu-success)" }}>
                        KES {Number(invoice.balance).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {invoice.balance > 0 ? (
                          <button
                            className="mu-btn mu-btn-sm mu-btn-primary"
                            onClick={() => openPayModal(invoice.id)}
                          >
                            <i className="bi bi-phone" />
                            Pay
                          </button>
                        ) : (
                          <span className="mu-badge mu-badge-success">Paid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-check-circle" style={{ fontSize: 36, display: "block", marginBottom: 8, color: "var(--mu-success)" }} />
              <p style={{ margin: 0 }}>No open invoices. All fees are paid!</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment History */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Payment History</h4>
          <span className="mu-badge mu-badge-primary">
            {payments.length} Payments
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {payments.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Reference</th>
                    <th>Receipt No.</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : "N/A"}
                      </td>
                      <td>
                        <span className={`mu-badge ${
                          payment.method === "mpesa" ? "mu-badge-success" :
                          payment.method === "bank" ? "mu-badge-primary" :
                          payment.method === "helb" ? "mu-badge-info" :
                          payment.method === "bursary" ? "mu-badge-warning" :
                          "mu-badge-gray"
                        }`}>
                          {payment.method?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        KES {Number(payment.amount).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {payment.bank_reference}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {payment.receipt_number || "-"}
                        </span>
                      </td>
                      <td>
                        {payment.is_reconciled ? (
                          <span className="mu-badge mu-badge-success">
                            <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                            Reconciled
                          </span>
                        ) : (
                          <span className="mu-badge mu-badge-warning">
                            <i className="bi bi-clock" style={{ marginRight: 4 }} />
                            Pending
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {payment.receipt_number && (
                          <button
                            className="mu-btn mu-btn-sm mu-btn-outline"
                            onClick={() => viewReceipt(payment.id)}
                          >
                            <i className="bi bi-receipt" />
                            Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 36, display: "block", marginBottom: 8 }} />
              <p style={{ margin: 0 }}>No payment history found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pay Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Pay Invoice via M-Pesa"
        size="md"
        confirmText={paying ? "Sending..." : "Send STK Push"}
        onConfirm={handlePay}
        isLoading={paying}
      >
        <div>
          <div className="mu-alert mu-alert-info" style={{ marginBottom: 16 }}>
            <i className="bi bi-info-circle" />
            M-Pesa integration is in test mode — this payment will be marked
            as completed immediately without a real STK push being sent.
          </div>

          {payError && (
            <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>
              <i className="bi bi-exclamation-triangle" />
              {payError}
            </div>
          )}

          <div className="mu-form-group">
            <label>Invoice</label>
            <select
              className="mu-select"
              value={payTargetInvoiceId}
              onChange={(e) => setPayTargetInvoiceId(e.target.value)}
            >
              <option value="">Select an invoice...</option>
              {summary.open_invoices?.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.description || inv.invoice_type} — KES {Number(inv.balance).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div className="mu-form-group">
            <label>M-Pesa Phone Number</label>
            <input
              type="tel"
              className="mu-input"
              placeholder="07XXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          {selectedInvoice && (
            <div style={{ background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)", padding: 12, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Amount to pay:</span>
                <span style={{ fontWeight: 700 }}>KES {Number(selectedInvoice.balance).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title="Payment Receipt"
        size="md"
        confirmText="Print Receipt"
        onConfirm={handlePrintReceipt}
      >
        {receipt && (
          <div style={{ textAlign: "center" }}>
            <i className="bi bi-check-circle-fill" style={{ fontSize: 48, color: "var(--mu-success)", display: "block", marginBottom: 12 }} />
            <h4 style={{ margin: "0 0 4px" }}>Payment Successful</h4>
            <p style={{ color: "var(--mu-gray-500)", margin: "0 0 16px" }}>
              Receipt No. <strong>{receipt.receipt_number}</strong>
            </p>

            <img
              src={receipt.qr_code}
              alt="Receipt QR Code"
              style={{ width: 140, height: 140, margin: "0 auto 16px", display: "block" }}
            />

            <div style={{ textAlign: "left", background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)", padding: 12 }}>
              <ReceiptRow label="Student" value={`${receipt.student_name} (${receipt.registration_number})`} />
              <ReceiptRow label="Invoice" value={receipt.invoice_description} />
              <ReceiptRow label="Method" value={receipt.method?.toUpperCase()} />
              <ReceiptRow label="Amount Paid" value={`KES ${Number(receipt.amount).toLocaleString()}`} bold />
              <ReceiptRow label="Balance After" value={`KES ${Number(receipt.balance_after).toLocaleString()}`} />
              <ReceiptRow
                label="Date"
                value={receipt.payment_date ? new Date(receipt.payment_date).toLocaleString() : "N/A"}
              />
            </div>

            <p style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-400)", marginTop: 12 }}>
              Scan the QR code to verify this receipt at the Finance Office.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}