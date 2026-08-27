import { useEffect, useState } from "react";
import { libraryApi } from "../../services/api";
import LibraryNav from "./LibraryNav";
import "../../style/library.css";

const money = (v) => `Ksh ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function LibraryFines() {
  const [fines, setFines] = useState([]);
  const [filter, setFilter] = useState("unpaid"); // unpaid | paid | waived | all
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [waiveReason, setWaiveReason] = useState("");

  const load = async () => {
    try {
      const params = {};
      if (filter === "unpaid") { params.is_paid = false; params.is_waived = false; }
      if (filter === "paid") params.is_paid = true;
      if (filter === "waived") params.is_waived = true;
      const { data } = await libraryApi.fines(params);
      setFines(data.results || data);
      setSelected([]);
    } catch {
      setError("Could not load fines.");
    }
  };

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const payable = fines.filter((f) => !f.is_paid && !f.is_waived);
  const selectedTotal = fines
    .filter((f) => selected.includes(f.id))
    .reduce((sum, f) => sum + Number(f.amount), 0);

  const payFines = async () => {
    if (!selected.length) return;
    setError(""); setNotice("");
    try {
      const { data } = await libraryApi.payFines(selected);
      setNotice(`Recorded payment for ${data.paid} fine(s).`);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not record payment.");
    }
  };

  const waive = async () => {
    try {
      await libraryApi.waiveFine(waiveTarget.id, waiveReason);
      setWaiveTarget(null);
      setWaiveReason("");
      setNotice("Fine waived.");
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not waive fine.");
    }
  };

  return (
    <div className="lib-page">
      <div className="lib-header">
        <div>
          <h1 className="lib-title"><i className="bi bi-cash-coin" /> Fines</h1>
          <p className="lib-subtitle">Overdue, lost and damage fines. Once raised a fine is never edited — only paid or waived.</p>
        </div>
      </div>

      <LibraryNav />

      {error && <div className="lib-alert lib-alert-error">{error}</div>}
      {notice && <div className="lib-alert lib-alert-success">{notice}</div>}

      <div className="lib-card">
        <div className="lib-toolbar">
          <div className="lib-toolbar-left">
            <select className="lib-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="waived">Waived</option>
              <option value="all">All</option>
            </select>
          </div>
          {filter === "unpaid" && (
            <button className="lib-btn lib-btn-primary" disabled={!selected.length} onClick={payFines}>
              <i className="bi bi-check2-circle" /> Record payment ({selected.length ? money(selectedTotal) : "select fines"})
            </button>
          )}
        </div>
        <div className="lib-table-wrap">
          <table className="lib-table">
            <thead>
              <tr>
                {filter === "unpaid" && <th style={{ width: 32 }}></th>}
                <th>Member</th><th>Reason</th><th>Amount</th><th>Raised</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fines.map((f) => (
                <tr key={f.id}>
                  {filter === "unpaid" && (
                    <td>
                      <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggleSelect(f.id)} />
                    </td>
                  )}
                  <td>{f.member_detail?.user_detail?.first_name} {f.member_detail?.user_detail?.last_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{f.reason}</td>
                  <td>{money(f.amount)}</td>
                  <td>{new Date(f.created_at).toLocaleDateString()}</td>
                  <td>
                    {f.is_waived
                      ? <span className="lib-badge lib-badge-gray">Waived</span>
                      : f.is_paid
                      ? <span className="lib-badge lib-badge-green">Paid</span>
                      : <span className="lib-badge lib-badge-red">Unpaid</span>}
                  </td>
                  <td>
                    {!f.is_paid && !f.is_waived && (
                      <button className="lib-btn lib-btn-outline lib-btn-sm" onClick={() => setWaiveTarget(f)}>Waive</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!fines.length && <div className="lib-empty">No fines for this filter.</div>}
        </div>
      </div>

      {waiveTarget && (
        <div className="lib-modal-backdrop" onClick={() => setWaiveTarget(null)}>
          <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Waive {money(waiveTarget.amount)} fine</h3>
            <div className="lib-field">
              <label>Reason</label>
              <textarea className="lib-textarea" value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} />
            </div>
            <div className="lib-modal-actions">
              <button className="lib-btn lib-btn-outline" onClick={() => setWaiveTarget(null)}>Cancel</button>
              <button className="lib-btn lib-btn-primary" onClick={waive}>Waive fine</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}