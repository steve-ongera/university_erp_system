// src/pages/finance/FeeStructures.jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminApi, financeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const PAGE_SIZE = 20;
const SEMESTER_OPTIONS = [1, 2, 3];
const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function unwrapList(data) {
  return Array.isArray(data) ? data : data.results || [];
}

function summarizeErrors(err) {
  const data = err?.response?.data;
  if (!data || typeof data !== "object") return null;
  const parts = Object.entries(data).map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(" ") : msgs}`);
  return parts.join(" ");
}

function FeeStructureFormModal({ mode, feeStructure, programmes, academicYears, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    programme: feeStructure?.programme || "",
    academic_year: feeStructure?.academic_year || "",
    year: feeStructure?.year || 1,
    semester: feeStructure?.semester || 1,
    tuition_fee: feeStructure?.tuition_fee || "",
    other_fees: feeStructure?.other_fees || "0",
    government_subsidy: feeStructure?.government_subsidy || "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.programme || !form.academic_year || !form.tuition_fee) {
      setError("Programme, academic year and tuition fee are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form, year: Number(form.year), semester: Number(form.semester),
        tuition_fee: Number(form.tuition_fee), other_fees: Number(form.other_fees),
        government_subsidy: Number(form.government_subsidy),
      };
      const data = isEdit
        ? (await financeApi.updateFeeStructure(feeStructure.id, payload)).data
        : (await financeApi.createFeeStructure(payload)).data;
      onSaved(data, isEdit ? "Fee structure updated." : "Fee structure created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save fee structure.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEdit ? "Edit Fee Structure" : "Add Fee Structure"} size="lg">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-form-group">
          <label>Programme</label>
          <select className="mu-select" required value={form.programme} onChange={handleChange("programme")}>
            <option value="">Select programme...</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>

        <div className="mu-dashboard-grid-3" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Academic Year</label>
            <select className="mu-select" required value={form.academic_year} onChange={handleChange("academic_year")}>
              <option value="">Select...</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </div>
          <div className="mu-form-group">
            <label>Year</label>
            <input type="number" min={1} max={8} className="mu-input" value={form.year} onChange={handleChange("year")} />
          </div>
          <div className="mu-form-group">
            <label>Semester</label>
            <input type="number" min={1} max={3} className="mu-input" value={form.semester} onChange={handleChange("semester")} />
          </div>
        </div>

        <div className="mu-dashboard-grid-3" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Tuition Fee (Ksh)</label>
            <input type="number" step="0.01" min={0} className="mu-input" required value={form.tuition_fee} onChange={handleChange("tuition_fee")} />
          </div>
          <div className="mu-form-group">
            <label>Other Fees (Ksh)</label>
            <input type="number" step="0.01" min={0} className="mu-input" value={form.other_fees} onChange={handleChange("other_fees")} />
          </div>
          <div className="mu-form-group">
            <label>Govt. Subsidy (Ksh)</label>
            <input type="number" step="0.01" min={0} className="mu-input" value={form.government_subsidy} onChange={handleChange("government_subsidy")} />
          </div>
        </div>

        <div className="mu-alert mu-alert-info" style={{ marginTop: 12 }}>
          <i className="bi bi-info-circle" />
          Net fee due: <strong>Ksh {(Number(form.tuition_fee || 0) + Number(form.other_fees || 0) - Number(form.government_subsidy || 0)).toLocaleString()}</strong>
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Create Fee Structure"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecordPaymentModal({ feeStructure, student, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const numeric = Number(amount);
    if (!numeric || numeric <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await financeApi.recordFeeStructurePayment(feeStructure.id, {
        student: student.id, amount: numeric, method,
      });
      onSaved("Payment recorded.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not record payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Record Payment — ${student.registration_number}`} size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-form-group">
          <label>Amount (Ksh)</label>
          <input type="number" step="0.01" min={0} className="mu-input" autoFocus
                 value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="mu-form-group">
          <label>Method</label>
          <select className="mu-select" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank Transfer</option>
            <option value="helb">HELB Disbursement</option>
            <option value="bursary">Bursary</option>
          </select>
        </div>

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Saving...
              </>
            ) : "Record Payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FeeStructureStudentsModal({ feeStructure, onClose, showToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payTarget, setPayTarget] = useState(null);
  const [raisingId, setRaisingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await financeApi.feeStructureStudents(feeStructure.id);
      setRows(data);
    } catch {
      setError("Failed to load students for this fee structure.");
    } finally {
      setLoading(false);
    }
  }, [feeStructure.id]);

  useEffect(() => { load(); }, [load]);

  const handleRaise = async (student) => {
    setRaisingId(student.id);
    try {
      await financeApi.raiseFeeStructureInvoice(feeStructure.id, student.id);
      await load();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not raise invoice.");
    } finally {
      setRaisingId(null);
    }
  };

  const totals = rows.reduce((acc, r) => {
    if (r.has_invoice) {
      acc.invoiced += Number(r.amount_due || 0);
      acc.outstanding += Number(r.balance || 0);
      if (r.is_paid) acc.paidCount += 1;
    }
    return acc;
  }, { invoiced: 0, outstanding: 0, paidCount: 0 });

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Students — ${feeStructure.programme_code || ""} Y${feeStructure.year}S${feeStructure.semester}`}
      size="xl"
      showFooter={false}
    >
      {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

      {!loading && rows.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
          <span className="mu-badge mu-badge-primary">Students: <strong>{rows.length}</strong></span>
          <span className="mu-badge mu-badge-success">Paid: <strong>{totals.paidCount}</strong></span>
          <span className="mu-badge mu-badge-info">Total invoiced: <strong>Ksh {totals.invoiced.toLocaleString()}</strong></span>
          <span className="mu-badge mu-badge-warning">Outstanding: <strong>Ksh {totals.outstanding.toLocaleString()}</strong></span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32 }}><LoadingSpinner text="Loading students..." /></div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
          <i className="bi bi-people" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
          <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Students Found</h3>
          <p style={{ margin: "8px 0 0" }}>No students currently sit in this programme/year.</p>
        </div>
      ) : (
        <div className="mu-table-wrapper">
          <table className="mu-table mu-table-hover">
            <thead>
              <tr>
                <th>Reg. No.</th>
                <th>Name</th>
                <th style={{ textAlign: "right" }}>Amount Due</th>
                <th style={{ textAlign: "right" }}>Balance</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const student = row.student;
                return (
                  <tr key={student.id}>
                    <td><strong>{student.registration_number}</strong></td>
                    <td>{student.user_detail?.first_name} {student.user_detail?.last_name}</td>
                    <td style={{ textAlign: "right" }}>
                      {row.has_invoice ? `Ksh ${Number(row.amount_due).toLocaleString()}` : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {row.has_invoice ? (
                        <span style={{ color: row.balance > 0 ? "var(--mu-danger)" : "var(--mu-success)", fontWeight: 600 }}>
                          Ksh {Number(row.balance).toLocaleString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td>
                      {!row.has_invoice ? (
                        <span className="mu-badge mu-badge-gray">Not Invoiced</span>
                      ) : row.is_paid ? (
                        <span className="mu-badge mu-badge-success">
                          <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                          Paid
                        </span>
                      ) : (
                        <span className="mu-badge mu-badge-warning">
                          <i className="bi bi-exclamation-triangle" style={{ marginRight: 4 }} />
                          Balance
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {!row.has_invoice ? (
                        <button
                          className="mu-btn mu-btn-sm mu-btn-primary"
                          disabled={raisingId === student.id}
                          onClick={() => handleRaise(student)}
                        >
                          {raisingId === student.id ? (
                            <>
                              <i className="bi bi-arrow-repeat mu-animate-spin" />
                              Raising...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-receipt" />
                              Raise
                            </>
                          )}
                        </button>
                      ) : !row.is_paid ? (
                        <button
                          className="mu-btn mu-btn-sm mu-btn-primary"
                          onClick={() => setPayTarget(student)}
                        >
                          <i className="bi bi-cash-coin" />
                          Pay
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--mu-gray-400)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payTarget && (
        <RecordPaymentModal
          feeStructure={feeStructure}
          student={payTarget}
          onClose={() => setPayTarget(null)}
          onSaved={(msg) => { setPayTarget(null); showToast(msg); load(); }}
        />
      )}
    </Modal>
  );
}

export default function FeeStructures() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [viewMode, setViewMode] = useState("table");

  const [programmeFilter, setProgrammeFilter] = useState("");
  const [academicYearFilter, setAcademicYearFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const debouncedFilters = useDebouncedValue(
    `${programmeFilter}|${academicYearFilter}|${semesterFilter}|${yearFilter}`, 200
  );

  const [programmes, setProgrammes] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [studentsModalTarget, setStudentsModalTarget] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.programmes(), adminApi.academicYears()]).then(([pRes, yRes]) => {
      setProgrammes(unwrapList(pRes.data));
      setAcademicYears(unwrapList(yRes.data));
    }).catch(() => {});
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (programmeFilter) params.programme = programmeFilter;
      if (academicYearFilter) params.academic_year = academicYearFilter;
      if (semesterFilter) params.semester = semesterFilter;
      if (yearFilter) params.year = yearFilter;

      const { data } = await financeApi.feeStructures(params);
      if (Array.isArray(data)) { setItems(data); setCount(data.length); }
      else { setItems(data.results || []); setCount(data.count ?? (data.results || []).length); }
    } catch (err) {
      console.error(err);
      setError("Failed to load fee structures.");
      setItems([]); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, programmeFilter, academicYearFilter, semesterFilter, yearFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setPage(1); }, [debouncedFilters]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const programmeOf = (id) => programmes.find((p) => p.id === id);
  const yearLabelOf = (id) => academicYears.find((y) => y.id === id)?.year || "—";

  const handleDelete = async () => {
    try {
      await financeApi.deleteFeeStructure(deleteTarget.id);
      showToast("Fee structure deleted.");
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete — invoices likely reference this fee structure.");
      setDeleteTarget(null);
    }
  };

  const openStudents = (fs) => {
    setStudentsModalTarget({ ...fs, programme_code: programmeOf(fs.programme)?.code });
  };

  const resetFilters = () => {
    setProgrammeFilter(""); setAcademicYearFilter(""); setSemesterFilter(""); setYearFilter("");
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-receipt-cutoff" />
            Fee Structures
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Finance <span className="separator">/</span> Fee Structures
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/finance/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add Fee Structure
          </button>
        </div>
      </div>

      {toast && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {toast}
        </div>
      )}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Table with Filters Above Header */}
      <div className="mu-card">
        <div className="mu-card-body" style={{ padding: 0 }}>
          <div className="mu-table-wrapper">
            <table className="mu-table">
              <thead>
                {/* Filter Row */}
                <tr style={{ background: "var(--mu-gray-50)" }}>
                  <th colSpan={8} style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {/* Programme Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Programme:</span>
                        <select
                          className="mu-select"
                          style={{ 
                            width: 130, 
                            padding: "3px 8px", 
                            fontSize: "var(--mu-font-size-xs)",
                            minHeight: "auto",
                            height: 28
                          }}
                          value={programmeFilter}
                          onChange={(e) => setProgrammeFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {programmes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                      </div>

                      {/* Academic Year Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Year:</span>
                        <select
                          className="mu-select"
                          style={{ 
                            width: 110, 
                            padding: "3px 8px", 
                            fontSize: "var(--mu-font-size-xs)",
                            minHeight: "auto",
                            height: 28
                          }}
                          value={academicYearFilter}
                          onChange={(e) => setAcademicYearFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
                        </select>
                      </div>

                      {/* Programme Year Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>P Year:</span>
                        <select
                          className="mu-select"
                          style={{ 
                            width: 90, 
                            padding: "3px 8px", 
                            fontSize: "var(--mu-font-size-xs)",
                            minHeight: "auto",
                            height: 28
                          }}
                          value={yearFilter}
                          onChange={(e) => setYearFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {YEAR_OPTIONS.map((y) => <option key={y} value={y}>Y{y}</option>)}
                        </select>
                      </div>

                      {/* Semester Filter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", fontWeight: 500 }}>Sem:</span>
                        <select
                          className="mu-select"
                          style={{ 
                            width: 90, 
                            padding: "3px 8px", 
                            fontSize: "var(--mu-font-size-xs)",
                            minHeight: "auto",
                            height: 28
                          }}
                          value={semesterFilter}
                          onChange={(e) => setSemesterFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {SEMESTER_OPTIONS.map((s) => <option key={s} value={s}>S{s}</option>)}
                        </select>
                      </div>

                      {/* Reset */}
                      <button
                        className="mu-btn mu-btn-secondary"
                        style={{ padding: "2px 10px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        onClick={resetFilters}
                      >
                        <i className="bi bi-arrow-counterclockwise" />
                        Reset
                      </button>

                      {/* Results count */}
                      <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginLeft: "auto" }}>
                        {count} record(s)
                      </span>

                      {/* View Mode Toggle */}
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className={`mu-btn mu-btn-sm ${viewMode === "table" ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
                          onClick={() => setViewMode("table")}
                          type="button"
                          style={{ padding: "2px 8px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        >
                          <i className="bi bi-table" /> Table
                        </button>
                        <button
                          className={`mu-btn mu-btn-sm ${viewMode === "cards" ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
                          onClick={() => setViewMode("cards")}
                          type="button"
                          style={{ padding: "2px 8px", fontSize: "var(--mu-font-size-xs)", height: 28, minHeight: "auto" }}
                        >
                          <i className="bi bi-grid-3x3-gap" /> Cards
                        </button>
                      </div>
                    </div>
                  </th>
                </tr>
                {/* Column Headers */}
                <tr>
                  <th>Programme</th>
                  <th>Academic Year</th>
                  <th>Y/S</th>
                  <th style={{ textAlign: "right" }}>Tuition</th>
                  <th style={{ textAlign: "right" }}>Other</th>
                  <th style={{ textAlign: "right" }}>Subsidy</th>
                  <th style={{ textAlign: "right" }}>Net Fee</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: 48, textAlign: "center" }}><LoadingSpinner text="Loading..." /></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                    <i className="bi bi-receipt" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                    <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No fee structures found</h3>
                    <p style={{ margin: "8px 0 0" }}>Add one for a programme/year/semester combination.</p>
                  </td></tr>
                ) : viewMode === "table" ? (
                  items.map((fs) => (
                    <tr key={fs.id}>
                      <td>{programmeOf(fs.programme)?.code || "—"}</td>
                      <td>{yearLabelOf(fs.academic_year)}</td>
                      <td>Y{fs.year} S{fs.semester}</td>
                      <td style={{ textAlign: "right" }}>Ksh {Number(fs.tuition_fee).toLocaleString()}</td>
                      <td style={{ textAlign: "right" }}>Ksh {Number(fs.other_fees).toLocaleString()}</td>
                      <td style={{ textAlign: "right" }}>Ksh {Number(fs.government_subsidy).toLocaleString()}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="mu-badge mu-badge-primary">
                          Ksh {Number(fs.net_fee).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => openStudents(fs)} title="View students">
                            <i className="bi bi-people" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", feeStructure: fs })}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(fs)}>
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} style={{ padding: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                      {items.map((fs) => (
                        <div key={fs.id} className="mu-card" style={{ margin: 0 }}>
                          <div className="mu-card-body">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{programmeOf(fs.programme)?.code || "—"}</div>
                                <div style={{ fontSize: 12, color: "var(--mu-gray-500)" }}>{yearLabelOf(fs.academic_year)} · Y{fs.year} S{fs.semester}</div>
                              </div>
                              <span className="mu-badge mu-badge-primary">Ksh {Number(fs.net_fee).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: 13, marginTop: 10, color: "var(--mu-gray-600)", lineHeight: 1.7 }}>
                              <div>Tuition: Ksh {Number(fs.tuition_fee).toLocaleString()}</div>
                              <div>Other: Ksh {Number(fs.other_fees).toLocaleString()}</div>
                              <div>Subsidy: Ksh {Number(fs.government_subsidy).toLocaleString()}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ flex: 1 }} onClick={() => openStudents(fs)}>
                                <i className="bi bi-people" /> Students
                              </button>
                              <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", feeStructure: fs })}>
                                <i className="bi bi-pencil" />
                              </button>
                              <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(fs)}>
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!loading && items.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              Page {page} of {totalPages} &middot; {count} records
            </span>
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

      {/* Modals */}
      {formModal && (
        <FeeStructureFormModal
          mode={formModal.mode} feeStructure={formModal.feeStructure}
          programmes={programmes} academicYears={academicYears}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchItems(); }}
        />
      )}

      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Fee Structure"
          size="sm"
          confirmText="Delete"
          onConfirm={handleDelete}
          danger={true}
        >
          <p style={{ marginTop: 0 }}>
            Delete this fee structure (Y{deleteTarget.year} S{deleteTarget.semester})?
            <br />
            <span style={{ color: "var(--mu-danger)", fontSize: "var(--mu-font-size-sm)" }}>
              This cannot be undone.
            </span>
          </p>
        </Modal>
      )}

      {studentsModalTarget && (
        <FeeStructureStudentsModal
          feeStructure={studentsModalTarget}
          onClose={() => setStudentsModalTarget(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}