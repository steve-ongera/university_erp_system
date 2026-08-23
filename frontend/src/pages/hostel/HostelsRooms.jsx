// src/pages/hostel/HostelsRooms.jsx
import { useState, useEffect, useCallback } from "react";
import { adminApi, hostelWardenApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  Modal, ConfirmModal, Field, EmptyState, unwrapList, summarizeErrors,
} from "../../components/ui/AdminUI";

const HOSTEL_TYPES = [
  { value: "boys", label: "Boys Hostel" },
  { value: "girls", label: "Girls Hostel" },
  { value: "mixed", label: "Mixed" },
];

// ----------------------------------------------------------------------
// Hostel Add/Edit
// ----------------------------------------------------------------------
function HostelFormModal({ mode, hostel, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    name: hostel?.name || "", hostel_type: hostel?.hostel_type || "mixed", is_active: hostel?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name) { setError("Name is required."); return; }
    setSaving(true);
    try {
      const data = isEdit
        ? (await hostelWardenApi.updateHostel(hostel.id, form)).data
        : (await hostelWardenApi.createHostel(form)).data;
      onSaved(data, isEdit ? "Hostel updated." : "Hostel created.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save hostel.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? "Edit Hostel" : "Add Hostel"} onClose={onClose} width={420}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        <Field label="Name"><input className="mu-input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <div style={{ marginTop: 12 }}>
          <Field label="Type">
            <select className="mu-input" value={form.hostel_type} onChange={(e) => setForm((f) => ({ ...f, hostel_type: e.target.value }))}>
              {HOSTEL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          Active
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Hostel"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Room Add/Edit
// ----------------------------------------------------------------------
function RoomFormModal({ mode, room, hostel, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({ room_number: room?.room_number || "", capacity: room?.capacity || 4, is_active: room?.is_active ?? true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.room_number) { setError("Room number is required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity), hostel: hostel.id };
      const data = isEdit
        ? (await hostelWardenApi.updateRoom(room.id, payload)).data
        : (await hostelWardenApi.createRoom(payload)).data;
      onSaved(data, isEdit ? "Room updated." : "Room added.");
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not save room.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? "Edit Room" : `Add Room — ${hostel.name}`} onClose={onClose} width={400}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        <Field label="Room Number"><input className="mu-input" required value={form.room_number} onChange={(e) => setForm((f) => ({ ...f, room_number: e.target.value }))} placeholder="e.g. 101" /></Field>
        <div style={{ marginTop: 12 }}>
          <Field label="Capacity"><input type="number" min={1} max={12} className="mu-input" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} /></Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          Active
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Add Room"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Rooms Modal (list + CRUD, per hostel) with nested Beds modal
// ----------------------------------------------------------------------
function BedsModal({ room, academicYear, onClose, showToast }) {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    hostelWardenApi.beds({ room: room.id, academic_year: academicYear.id })
      .then(({ data }) => setBeds(unwrapList(data)))
      .catch(() => setBeds([]))
      .finally(() => setLoading(false));
  }, [room.id, academicYear.id]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const letters = "ABCDEFGHIJKL".slice(0, room.capacity);
      const existing = new Set(beds.map((b) => b.bed_number));
      for (const letter of letters) {
        if (existing.has(letter)) continue;
        await hostelWardenApi.createBed({ room: room.id, academic_year: academicYear.id, bed_number: letter, is_available: true });
      }
      showToast("Beds generated.");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not generate beds.");
    } finally { setGenerating(false); }
  };

  const handleDelete = async () => {
    try {
      await hostelWardenApi.deleteBed(deleteTarget.id);
      showToast("Bed removed.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete bed — it may have a booking.");
      setDeleteTarget(null);
    }
  };

  return (
    <Modal title={`Beds — Room ${room.room_number} (${academicYear.year})`} onClose={onClose} width={480}>
      {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "#666" }}>Capacity: {room.capacity}</span>
        <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={handleGenerate} disabled={generating}>
          <i className="bi bi-magic" /> {generating ? "Generating..." : "Generate Missing Beds"}
        </button>
      </div>
      {loading ? <LoadingSpinner text="Loading beds..." /> : (
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead><tr><th>Bed</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {beds.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", padding: 16, color: "#999" }}>No beds yet for this year.</td></tr>}
              {beds.map((b) => (
                <tr key={b.id}>
                  <td>{b.bed_number}</td>
                  <td><span className={`mu-badge ${b.is_available ? "mu-badge-success" : "mu-badge-gray"}`}>{b.is_available ? "Available" : "Occupied"}</span></td>
                  <td>
                    <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(b)} disabled={!b.is_available}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleteTarget && (
        <ConfirmModal title="Delete Bed" message={`Remove bed ${deleteTarget.bed_number}?`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </Modal>
  );
}

function RoomsModal({ hostel, academicYears, onClose, showToast }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [academicYearId, setAcademicYearId] = useState(academicYears.find((y) => y.is_current)?.id || academicYears[0]?.id || "");
  const [roomForm, setRoomForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bedsRoom, setBedsRoom] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    hostelWardenApi.rooms({ hostel: hostel.id })
      .then(({ data }) => setRooms(unwrapList(data)))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [hostel.id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await hostelWardenApi.deleteRoom(deleteTarget.id);
      showToast("Room deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete room — it may have beds/bookings.");
      setDeleteTarget(null);
    }
  };

  const selectedYear = academicYears.find((y) => y.id === academicYearId);

  return (
    <Modal title={`Rooms — ${hostel.name}`} onClose={onClose} width={620}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 200 }}>
          <Field label="Manage Beds For Year">
            <select className="mu-input" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </Field>
        </div>
        <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setRoomForm({ mode: "add" })}>
          <i className="bi bi-plus-circle" /> Add Room
        </button>
      </div>

      {loading ? <LoadingSpinner text="Loading rooms..." /> : rooms.length === 0 ? (
        <EmptyState icon="bi-door-closed" label="No rooms yet" />
      ) : (
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead><tr><th>Room</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.room_number}</td>
                  <td>{r.capacity}</td>
                  <td><span className={`mu-badge ${r.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>{r.is_active ? "Active" : "Inactive"}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setBedsRoom(r)} disabled={!selectedYear}>
                        <i className="bi bi-door-open" /> Beds
                      </button>
                      <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setRoomForm({ mode: "edit", room: r })}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(r)}>
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

      {roomForm && (
        <RoomFormModal
          mode={roomForm.mode} room={roomForm.room} hostel={hostel}
          onClose={() => setRoomForm(null)}
          onSaved={(_d, msg) => { setRoomForm(null); showToast(msg); load(); }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal title="Delete Room" message={`Delete room ${deleteTarget.room_number}?`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
      {bedsRoom && selectedYear && (
        <BedsModal room={bedsRoom} academicYear={selectedYear} onClose={() => setBedsRoom(null)} showToast={showToast} />
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function HostelsRooms() {
  const [hostels, setHostels] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [formModal, setFormModal] = useState(null);
  const [roomsHostel, setRoomsHostel] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([hostelWardenApi.hostels(), adminApi.academicYears()])
      .then(([hRes, yRes]) => {
        setHostels(unwrapList(hRes.data));
        setAcademicYears(unwrapList(yRes.data));
      })
      .catch(() => setError("Failed to load hostels."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async () => {
    try {
      await hostelWardenApi.deleteHostel(deleteTarget.id);
      showToast("Hostel deleted.");
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete — it may have rooms/bookings.");
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mu-page-header">
        <div>
          <h1><i className="bi bi-building" /> Hostels &amp; Rooms</h1>
          <div className="mu-breadcrumb">Home <span className="separator">/</span> Hostel <span className="separator">/</span> Hostels &amp; Rooms</div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-primary" onClick={() => setFormModal({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add Hostel
          </button>
        </div>
      </div>

      {toast && <div className="mu-alert mu-alert-success"><i className="bi bi-check-circle" /> {toast}</div>}
      {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

      {loading ? (
        <div style={{ padding: 48 }}><LoadingSpinner text="Loading hostels..." /></div>
      ) : hostels.length === 0 ? (
        <div className="mu-card"><div className="mu-card-body"><EmptyState icon="bi-building" label="No hostels yet" hint="Add one to start managing rooms and beds." /></div></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {hostels.map((h) => (
            <div key={h.id} className="mu-card" style={{ margin: 0 }}>
              <div className="mu-card-body">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{h.name}</strong>
                  <span className={`mu-badge ${h.is_active ? "mu-badge-success" : "mu-badge-gray"}`}>{h.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div style={{ fontSize: 13, color: "#777", marginTop: 4, textTransform: "capitalize" }}>{h.hostel_type}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setRoomsHostel(h)}>
                    <i className="bi bi-door-open" /> Manage Rooms
                  </button>
                  <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setFormModal({ mode: "edit", hostel: h })}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button className="mu-btn mu-btn-sm mu-btn-danger" onClick={() => setDeleteTarget(h)}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formModal && (
        <HostelFormModal
          mode={formModal.mode} hostel={formModal.hostel}
          onClose={() => setFormModal(null)}
          onSaved={(_d, msg) => { setFormModal(null); showToast(msg); fetchAll(); }}
        />
      )}

      {roomsHostel && (
        <RoomsModal hostel={roomsHostel} academicYears={academicYears} onClose={() => setRoomsHostel(null)} showToast={showToast} />
      )}

      {deleteTarget && (
        <ConfirmModal title="Delete Hostel" message={`Delete ${deleteTarget.name}?`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}