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
      <div>
        <h1>Fees & Payments</h1>
        <div>Home / Finance / Fees</div>
      </div>

      {error && <div>{error}</div>}

      <div>
        <div>Outstanding Balance: KES {Number(summary.total_outstanding).toLocaleString()}</div>
        <div>Wallet Credit: KES {Number(summary.wallet_credit).toLocaleString()}</div>
      </div>

      <div>
        <h4>Open Invoices</h4>
        {summary.open_invoices?.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Semester</th>
                <th>Amount Due</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {summary.open_invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_type}</td>
                  <td>{invoice.description || "-"}</td>
                  <td>
                    {invoice.semester_detail?.academic_year_detail?.year || "N/A"} S
                    {invoice.semester_detail?.semester_number || ""}
                  </td>
                  <td>KES {Number(invoice.amount_due).toLocaleString()}</td>
                  <td>KES {Number(invoice.balance).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No open invoices.</p>
        )}
      </div>

      <div>
        <h4>Payment History</h4>
        {payments.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Receipt No.</th>
                <th>Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : "N/A"}</td>
                  <td>{payment.method}</td>
                  <td>KES {Number(payment.amount).toLocaleString()}</td>
                  <td>{payment.bank_reference}</td>
                  <td>{payment.receipt_number || "-"}</td>
                  <td>{payment.is_reconciled ? "Yes" : "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No payment history found.</p>
        )}
      </div>

      <div>
        <Link to="/units">My Units</Link>
      </div>
    </div>
  );
}