// src/pages/finance/FeeStructures.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi, financeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState,
  useDebouncedValue, summarizeErrors, unwrapList,
} from "../../components/ui/AdminUI";

const PAGE_SIZE = 20;

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
    <Modal title={isEdit ? "Edit Fee Structure" : "Add Fee Structure"} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <Field label="Programme">
          <select className="mu-input" required value={form.programme} onChange={handleChange("programme")}>
            <option value="">Select programme...</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Academic Year">
            <select className="mu-input" required value={form.academic_year} onChange={handleChange("academic_year")}>
              <option value="">Select...</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </Field>
          <Field label="Year"><input type="number" min={1} max={8} className="mu-input" value={form.year} onChange={handleChange("year")} /></Field>
          <Field label="Semester"><input type="number" min={1} max={3} className="mu-input" value={form.semester} onChange={handleChange("semester")} /></Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Tuition Fee (Ksh)"><input type="number" step="0.01" min={0} className="mu-input" required value={form.tuition_fee} onChange={handleChange("tuition_fee")} /></Field>
          <Field label="Other Fees (Ksh)"><input type="number" step="0.01" min={0} className="mu-input" value={form.other_fees} onChange={handleChange("other_fees")} /></Field>
          <Field label="Govt. Subsidy (Ksh)"><input type="number" step="0.01" min={0} className="mu-input" value={form.government_subsidy} onChange={handleChange("government_subsidy")} /></Field>
        </div>

        <p style={{ fontSize: 13, marginTop: 14, background: "#f4f6fb", padding: "8px 12px", borderRadius: 6 }}>
          Net fee due: <strong>Ksh {(Number(form.tuition_fee || 0) + Number(form.other_fees || 0) - Number(form.government_subsidy || 0)).toLocaleString()}</strong>
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Fee Structure"}
          </button>
        </div>
      </form>
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

  const [programmeFilter, setProgrammeFilter] = useState("");
  const [academicYearFilter, setAcademicYearFilter] = useState("");
  const debouncedFilters = useDebouncedValue(`${programmeFilter}|${academicYearFilter}`, 200);

  const [programmes, setProgrammes] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
  }, [page, programmeFilter, academicYearFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setPage(1); }, [debouncedFilters]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

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

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-receipt-cutoff" /> Fee Structures</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Finance <span className="separator">/</span> Fee Structures</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add Fee Structure
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ width: 220 }}>
            <Field label="Programme">
              <select className="mu-input" value={programmeFilter} onChange={(e) => setProgrammeFilter(e.target.value)}>
                <option value="">All Programmes</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ width: 180 }}>
            <Field label="Academic Year">
              <select className="mu-input" value={academicYearFilter} onChange={(e) => setAcademicYearFilter(e.target.value)}>
                <option value="">All Years</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
              </select>
            </Field>
          </div>
          <button className="mu-btn mu-btn-outline-primary" onClick={() => { setProgrammeFilter(""); setAcademicYearFilter(""); }}>Reset</button>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-header">
          <h4>Fee Structures</h4>
          <span className="mu-badge mu-badge-primary">{count} total</span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading..." /></div>
          ) : items.length === 0 ? (
            <EmptyState icon="bi-receipt" label="No fee structures found" hint="Add one for a programme/year/semester combination." />
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr><th>Programme</th><th>Academic Year</th><th>Y/S</th><th>Tuition</th><th>Other</th><th>Subsidy</th><th>Net Fee</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {items.map((fs) => (
                    <tr key={fs.id}>
                      <td>{programmes.find((p) => p.id === fs.programme)?.code || "—"}</td>
                      <td>{academicYears.find((y) => y.id === fs.academic_year)?.year || "—"}</td>
                      <td>Y{fs.year} S{fs.semester}</td>
                      <td>Ksh {Number(fs.tuition_fee).toLocaleString()}</td>
                      <td>Ksh {Number(fs.other_fees).toLocaleString()}</td>
                      <td>Ksh {Number(fs.government_subsidy).toLocaleString()}</td>
                      <td><strong>Ksh {Number(fs.net_fee).toLocaleString()}</strong></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", feeStructure: fs })}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(fs)}>
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #eee" }}>
            <span style={{ fontSize: 13, color: "#777" }}>Page {page} of {totalPages} &middot; {count} records</span>
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

      {formModal && (
        <FeeStructureFormModal
          mode={formModal.mode} feeStructure={formModal.feeStructure}
          programmes={programmes} academicYears={academicYears}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchItems(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Fee Structure"
          message={`Delete this fee structure (Y${deleteTarget.year} S${deleteTarget.semester})?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}