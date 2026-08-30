// src/pages/hostel/HostelsRooms.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
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
// Room Add/Edit (manual, single room)
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
// Bulk Generate Rooms (new hostel setup — creates rooms + their beds)
// ----------------------------------------------------------------------
function BulkGenerateRoomsModal({ hostel, academicYear, onClose, onGenerated }) {
  const [roomCount, setRoomCount] = useState(10);
  const [bedsPerRoom, setBedsPerRoom] = useState(4);
  const [startRoomNumber, setStartRoomNumber] = useState(1);
  const [prefix, setPrefix] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!academicYear) { setError("Select an academic year first."); return; }
    if (!roomCount || Number(roomCount) < 1) { setError("Enter how many rooms to create."); return; }
    if (!bedsPerRoom || Number(bedsPerRoom) < 1) { setError("Enter beds per room."); return; }
    setSaving(true);
    try {
      const { data } = await hostelWardenApi.bulkGenerateRooms(hostel.id, {
        academic_year: academicYear.id,
        room_count: Number(roomCount),
        beds_per_room: Number(bedsPerRoom),
        start_room_number: Number(startRoomNumber) || 1,
        prefix,
      });
      setResult(data);
      onGenerated();
    } catch (err) {
      setError(err.response?.data?.detail || summarizeErrors(err) || "Could not generate rooms.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Bulk Generate Rooms — ${hostel.name}`} onClose={onClose} width={460}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        {result && (
          <div className="mu-alert mu-alert-success" style={{ marginBottom: 16 }}>
            Created {result.rooms_created} room(s) and {result.beds_created} bed(s) for {academicYear.year}.
          </div>
        )}
        {!result && (
          <div className="mu-alert mu-alert-info" style={{ marginBottom: 16, fontSize: 13 }}>
            <i className="bi bi-info-circle" /> Generating for academic year <strong>{academicYear?.year || "—"}</strong>.
            Room numbers are created exactly as entered (no skipping) — if any number already
            exists on this hostel, the whole request is rejected and none are created, so you
            can adjust the range or prefix and retry. If you're only adding beds for a new year
            to rooms you already built, use "Generate Beds For Year" instead.
          </div>
        )}

        {!result && (
          <>
            <Field label="Number of Rooms to Create">
              <input type="number" min={1} max={2000} className="mu-input" value={roomCount} onChange={(e) => setRoomCount(e.target.value)} />
            </Field>

            <div style={{ marginTop: 12 }}>
              <Field label="Beds per Room">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {[2, 4].map((n) => (
                    <button
                      key={n} type="button"
                      className={`mu-btn mu-btn-sm ${Number(bedsPerRoom) === n ? "mu-btn-primary" : "mu-btn-outline-primary"}`}
                      onClick={() => setBedsPerRoom(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number" min={1} max={12} className="mu-input" style={{ width: 90 }}
                    value={bedsPerRoom} onChange={(e) => setBedsPerRoom(e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Field label="Starting Room Number">
                <input type="number" min={1} className="mu-input" value={startRoomNumber} onChange={(e) => setStartRoomNumber(e.target.value)} />
              </Field>
              <Field label="Prefix (optional)">
                <input className="mu-input" placeholder="e.g. A-" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </Field>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>
              Example: prefix "A-" with starting number 1 produces rooms A-1, A-2, A-3...
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="mu-btn mu-btn-outline-primary" onClick={onClose}>{result ? "Close" : "Cancel"}</button>
          {!result && (
            <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
              {saving ? "Generating..." : "Generate"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Generate Beds For Year (existing rooms — roll into a new year)
// ----------------------------------------------------------------------
function GenerateBedsForYearModal({ hostel, academicYear, onClose, onGenerated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleConfirm = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await hostelWardenApi.generateBedsForYear(hostel.id, { academic_year: academicYear.id });
      setResult(data);
      onGenerated();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not generate beds.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Generate Beds — ${hostel.name}`} onClose={onClose} width={420}>
      {error && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {result ? (
        <div className="mu-alert mu-alert-success">
          Topped up {result.rooms_touched} room(s) with {result.beds_created} new bed(s) for {academicYear.year}.
        </div>
      ) : (
        <p style={{ marginTop: 0 }}>
          This creates beds for <strong>{academicYear?.year}</strong> on every existing active room in{" "}
          <strong>{hostel.name}</strong> that doesn't already have a full set, based on each room's own capacity.
          No rooms are created or modified — use this when rolling into a new academic year without
          changing your room layout.
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button className="mu-btn mu-btn-outline-primary" onClick={onClose}>{result ? "Close" : "Cancel"}</button>
        {!result && (
          <button className="mu-btn mu-btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? "Generating..." : "Generate Beds"}
          </button>
        )}
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Beds Modal (per room — view/generate-missing/delete a bed)
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

// ----------------------------------------------------------------------
// Room Floor Plan — "real house" visual: rooms as doors, beds inside
// ----------------------------------------------------------------------
function RoomFloorPlan({ rooms, onOpenBeds, onEditRoom, onDeleteRoom }) {
  if (rooms.length === 0) {
    return <EmptyState icon="bi-door-closed" label="No rooms yet" hint="Add one manually, or use Bulk Generate Rooms above." />;
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 14,
        }}
      >
        {rooms.map((room) => {
          const beds = room.beds || [];
          const occupied = room.occupied_beds ?? beds.filter((b) => !b.is_available).length;
          const total = room.total_beds ?? beds.length;
          const isFull = total > 0 && occupied === total;
          const hasNoBeds = total === 0;

          return (
            <div
              key={room.id}
              style={{
                border: "2px solid #d8dee9",
                borderRadius: 10,
                background: "#fbfbfd",
                overflow: "hidden",
                opacity: room.is_active ? 1 : 0.5,
              }}
            >
              {/* Door / header */}
              <div
                onClick={() => onOpenBeds(room)}
                title="Click to manage beds in this room"
                style={{
                  background: isFull ? "#c23b3b" : hasNoBeds ? "#9aa2ad" : "#1a8a5a",
                  color: "#fff",
                  padding: "6px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  <i className="bi bi-door-closed-fill" /> {room.room_number}
                </span>
                <span style={{ fontSize: 11 }}>{occupied}/{total}</span>
              </div>

              {/* Beds inside the room */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 6,
                  padding: 10,
                  minHeight: 60,
                }}
              >
                {hasNoBeds ? (
                  <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#999", textAlign: "center", padding: "10px 0" }}>
                    No beds this year
                  </div>
                ) : (
                  beds.map((bed) => (
                    <div
                      key={bed.id}
                      title={`Bed ${bed.bed_number} — ${bed.is_available ? "Available" : "Occupied"}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px 2px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#fff",
                        background: bed.is_available ? "#3b6ce0" : "#c97d2a",
                      }}
                    >
                      <i className="bi bi-lamp" style={{ fontSize: 14 }} />
                      {bed.bed_number}
                    </div>
                  ))
                )}
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 4,
                  padding: "4px 8px",
                  borderTop: "1px solid #eee",
                  background: "#fff",
                }}
              >
                <button
                  className="mu-btn mu-btn-sm mu-btn-outline-primary"
                  style={{ padding: "2px 6px" }}
                  onClick={(e) => { e.stopPropagation(); onEditRoom(room); }}
                >
                  <i className="bi bi-pencil" />
                </button>
                <button
                  className="mu-btn mu-btn-sm mu-btn-danger"
                  style={{ padding: "2px 6px" }}
                  onClick={(e) => { e.stopPropagation(); onDeleteRoom(room); }}
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12, color: "#666", flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#3b6ce0", borderRadius: 3, marginRight: 4 }} /> Available bed</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#c97d2a", borderRadius: 3, marginRight: 4 }} /> Occupied bed</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1a8a5a", borderRadius: 3, marginRight: 4 }} /> Room has space</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#c23b3b", borderRadius: 3, marginRight: 4 }} /> Room full</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Rooms Modal (per hostel) — floor plan + table view, bulk-generate entry points
// ----------------------------------------------------------------------
function RoomsModal({ hostel, academicYears, onClose, showToast }) {
  const [rooms, setRooms] = useState([]); // each room already carries its own beds
  const [loading, setLoading] = useState(true);
  const [totalRooms, setTotalRooms] = useState(null);
  const [academicYearId, setAcademicYearId] = useState(academicYears.find((y) => y.is_current)?.id || academicYears[0]?.id || "");
  const [viewMode, setViewMode] = useState("layout"); // "layout" | "table"
  const [roomForm, setRoomForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bedsRoom, setBedsRoom] = useState(null);
  const [bulkModal, setBulkModal] = useState(null); // "rooms" | "beds" | null
  const [loadError, setLoadError] = useState("");

  const selectedYear = academicYears.find((y) => y.id === academicYearId);

  const loadFloorPlan = useCallback(() => {
    if (!academicYearId) return;
    setLoading(true);
    setLoadError("");
    hostelWardenApi.floorPlan(hostel.id, academicYearId)
      .then(({ data }) => {
        setRooms(data.rooms || []);
        setTotalRooms(data.total_rooms ?? (data.rooms || []).length);
      })
      .catch((err) => {
        setRooms([]);
        setTotalRooms(null);
        setLoadError(err.response?.data?.detail || "Could not load rooms/beds for this hostel.");
      })
      .finally(() => setLoading(false));
  }, [hostel.id, academicYearId]);

  useEffect(() => { loadFloorPlan(); }, [loadFloorPlan]);

  const handleDelete = async () => {
    try {
      await hostelWardenApi.deleteRoom(deleteTarget.id);
      showToast("Room deleted.");
      setDeleteTarget(null);
      loadFloorPlan();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not delete room — it may have beds/bookings.");
      setDeleteTarget(null);
    }
  };

  const handleBulkGenerated = () => {
    showToast("Rooms/beds generated.");
    setBulkModal(null);
    loadFloorPlan();
  };

  const handleCloseBedsModal = () => {
    setBedsRoom(null);
    loadFloorPlan(); // refresh counts after any bed edits
  };

  return (
    <Modal title={`Rooms — ${hostel.name}`} onClose={onClose} width={780}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ width: 200 }}>
            <Field label="Manage For Academic Year">
              <select
                className="mu-input"
                value={academicYearId}
                onChange={(e) => setAcademicYearId(Number(e.target.value))}
              >
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
              </select>
            </Field>
          </div>
          {totalRooms !== null && (
            <span className="mu-badge mu-badge-gray" style={{ marginBottom: 6 }}>
              {totalRooms} room{totalRooms === 1 ? "" : "s"} total
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #d8dee9" }}>
            <button
              type="button"
              className={`mu-btn mu-btn-sm ${viewMode === "layout" ? "mu-btn-primary" : ""}`}
              style={{ borderRadius: 0 }}
              onClick={() => setViewMode("layout")}
            >
              <i className="bi bi-grid-3x3-gap" /> Floor Plan
            </button>
            <button
              type="button"
              className={`mu-btn mu-btn-sm ${viewMode === "table" ? "mu-btn-primary" : ""}`}
              style={{ borderRadius: 0 }}
              onClick={() => setViewMode("table")}
            >
              <i className="bi bi-list-ul" /> Table
            </button>
          </div>
          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setBulkModal("beds")} disabled={!selectedYear}>
            <i className="bi bi-magic" /> Generate Beds For Year
          </button>
          <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={() => setBulkModal("rooms")} disabled={!selectedYear}>
            <i className="bi bi-grid-3x3-gap-fill" /> Bulk Generate Rooms
          </button>
          <button className="mu-btn mu-btn-sm mu-btn-primary" onClick={() => setRoomForm({ mode: "add" })}>
            <i className="bi bi-plus-circle" /> Add Room
          </button>
        </div>
      </div>

      {loadError && <div className="mu-alert mu-alert-danger" style={{ marginBottom: 12 }}>{loadError}</div>}

      {loading ? (
        <LoadingSpinner text="Loading rooms..." />
      ) : viewMode === "layout" ? (
        <RoomFloorPlan
          rooms={rooms}
          onOpenBeds={(r) => setBedsRoom(r)}
          onEditRoom={(r) => setRoomForm({ mode: "edit", room: r })}
          onDeleteRoom={(r) => setDeleteTarget(r)}
        />
      ) : rooms.length === 0 ? (
        <EmptyState icon="bi-door-closed" label="No rooms yet" hint="Add one manually, or use Bulk Generate Rooms above." />
      ) : (
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead><tr><th>Room</th><th>Capacity</th><th>Beds ({selectedYear?.year || "—"})</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.room_number}</td>
                  <td>{r.capacity}</td>
                  <td>{r.occupied_beds}/{r.total_beds}</td>
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
          onSaved={(_d, msg) => { setRoomForm(null); showToast(msg); loadFloorPlan(); }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal title="Delete Room" message={`Delete room ${deleteTarget.room_number}?`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
      {bedsRoom && selectedYear && (
        <BedsModal room={bedsRoom} academicYear={selectedYear} onClose={handleCloseBedsModal} showToast={showToast} />
      )}
      {bulkModal === "rooms" && selectedYear && (
        <BulkGenerateRoomsModal
          hostel={hostel} academicYear={selectedYear}
          onClose={() => setBulkModal(null)}
          onGenerated={handleBulkGenerated}
        />
      )}
      {bulkModal === "beds" && selectedYear && (
        <GenerateBedsForYearModal
          hostel={hostel} academicYear={selectedYear}
          onClose={() => setBulkModal(null)}
          onGenerated={handleBulkGenerated}
        />
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