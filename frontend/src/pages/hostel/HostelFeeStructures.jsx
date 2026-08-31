import { useEffect, useState, useCallback } from "react";
import { hostelWardenApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const emptyForm = { hostel: "", academic_year: "", amount: "" };

export default function HostelFeeStructures() {
  const [loading, setLoading] = useState(true);
  const [feeStructures, setFeeStructures] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [filterHostel, setFilterHostel] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const asArray = (data) => (Array.isArray(data) ? data : data?.results || []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [feesRes, hostelsRes, yearsRes] = await Promise.all([
        hostelWardenApi.feeStructures(),
        hostelWardenApi.hostels(),
        hostelWardenApi.academicYears(),
      ]);
      setFeeStructures(asArray(feesRes.data));
      setHostels(asArray(hostelsRes.data));
      setAcademicYears(asArray(yearsRes.data));
    } catch (err) {
      console.error("Error loading fee structures:", err);
      setError("Failed to load hostel fee structures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (fee) => {
    setEditing(fee);
    setForm({
      hostel: String(fee.hostel),
      academic_year: String(fee.academic_year),
      amount: String(fee.amount),
    });
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.hostel || !form.academic_year || !form.amount) {
      setFormError("All fields are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      hostel: form.hostel,
      academic_year: form.academic_year,
      amount: form.amount,
    };
    try {
      if (editing) {
        await hostelWardenApi.updateFeeStructure(editing.id, payload);
        setSuccess("Fee structure updated.");
      } else {
        await hostelWardenApi.createFeeStructure(payload);
        setSuccess("Fee structure created.");
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      console.error("Error saving fee structure:", err);
      setFormError(
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        "Failed to save fee structure."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await hostelWardenApi.deleteFeeStructure(deleteTarget.id);
      setSuccess("Fee structure deleted.");
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      console.error("Error deleting fee structure:", err);
      setError(err.response?.data?.detail || "Failed to delete fee structure.");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = feeStructures.filter((fee) => {
    if (filterHostel && String(fee.hostel) !== String(filterHostel)) return false;
    if (filterYear && String(fee.academic_year) !== String(filterYear)) return false;
    return true;
  });

  if (loading) return <LoadingSpinner text="Loading hostel fee structures..." />;

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-cash-stack" />
            Hostel Fee Structure
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Hostel <span className="separator">/</span> Fee Structure
          </div>
        </div>
        <button className="mu-btn mu-btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-circle" />
          Set Fee
        </button>
      </div>

      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}
      {success && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {success}
        </div>
      )}

      <div className="mu-card" style={{ marginBottom: 16 }}>
        <div className="mu-card-body" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div className="mu-form-group" style={{ minWidth: 220 }}>
            <label>Filter by Hostel</label>
            <select className="mu-select" value={filterHostel} onChange={(e) => setFilterHostel(e.target.value)}>
              <option value="">All hostels</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="mu-form-group" style={{ minWidth: 220 }}>
            <label>Filter by Academic Year</label>
            <select className="mu-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="">All years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mu-card">
        <div className="mu-card-body" style={{ padding: 0 }}>
          <table className="mu-table">
            <thead>
              <tr>
                <th>Hostel</th>
                <th>Academic Year</th>
                <th>Amount</th>
                <th>Last Updated</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>
                    No fee structures set yet.
                  </td>
                </tr>
              ) : (
                filtered.map((fee) => (
                  <tr key={fee.id}>
                    <td>{fee.hostel_detail?.name || "N/A"}</td>
                    <td>{fee.academic_year_detail?.year || "N/A"}</td>
                    <td style={{ fontWeight: 600 }}>KES {Number(fee.amount).toLocaleString()}</td>
                    <td>{fee.updated_at ? new Date(fee.updated_at).toLocaleDateString() : "N/A"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="mu-btn mu-btn-sm mu-btn-outline" onClick={() => openEdit(fee)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        className="mu-btn mu-btn-sm mu-btn-danger"
                        style={{ marginLeft: 6 }}
                        onClick={() => setDeleteTarget(fee)}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Hostel Fee" : "Set Hostel Fee"}
        size="md"
        confirmText={editing ? "Save Changes" : "Create"}
        onConfirm={handleSave}
        isLoading={saving}
      >
        <div>
          {formError && (
            <div className="mu-alert mu-alert-danger" style={{ marginBottom: 12 }}>
              <i className="bi bi-exclamation-triangle" />
              {formError}
            </div>
          )}
          <div className="mu-form-group">
            <label>Hostel</label>
            <select
              className="mu-select"
              value={form.hostel}
              onChange={(e) => setForm({ ...form, hostel: e.target.value })}
            >
              <option value="">Select hostel...</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>{h.name} ({h.hostel_type})</option>
              ))}
            </select>
          </div>
          <div className="mu-form-group">
            <label>Academic Year</label>
            <select
              className="mu-select"
              value={form.academic_year}
              onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
            >
              <option value="">Select academic year...</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.year}</option>
              ))}
            </select>
          </div>
          <div className="mu-form-group">
            <label>Fee Amount (KES)</label>
            <input
              type="number"
              min="0"
              className="mu-input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="e.g. 8000"
            />
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Fee Structure"
        size="sm"
        confirmText="Delete"
        onConfirm={handleDelete}
        isLoading={deleting}
      >
        <p>
          Delete the fee for <strong>{deleteTarget?.hostel_detail?.name}</strong> —{" "}
          <strong>{deleteTarget?.academic_year_detail?.year}</strong>? Existing invoices already raised
          against this fee are not affected.
        </p>
      </Modal>
    </div>
  );
}