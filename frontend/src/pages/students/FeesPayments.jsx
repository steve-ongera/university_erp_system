import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { feesApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function FeesPayments() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_outstanding: 0, wallet_credit: 0, open_invoices: [] });
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
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
    fetchData();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading your fees..." />;
  }

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
            <button className="mu-btn mu-btn-primary">
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
    </div>
  );
}