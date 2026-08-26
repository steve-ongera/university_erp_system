import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { lecturerApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

// ---------------------------------------------------------------------
// Countdown — days/hours/mins/secs to a target closes_at timestamp
// ---------------------------------------------------------------------
function useCountdown(targetIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = targetIso ? new Date(targetIso).getTime() : null;
  const remainingMs = target ? Math.max(target - now, 0) : 0;
  const isOver = target ? remainingMs <= 0 : false;

  const d = Math.floor(remainingMs / 86400000);
  const h = Math.floor((remainingMs % 86400000) / 3600000);
  const m = Math.floor((remainingMs % 3600000) / 60000);
  const sec = Math.floor((remainingMs % 60000) / 1000);

  return { d, h, m, sec, isOver };
}

function CountdownBadge({ closesAt, opensAt }) {
  const { d, h, m, sec, isOver } = useCountdown(closesAt);
  const notYetOpen = opensAt && new Date(opensAt).getTime() > Date.now();

  return (
    <span className={`mu-badge ${isOver ? "mu-badge-danger" : notYetOpen ? "mu-badge-gray" : d === 0 && h < 6 ? "mu-badge-warning" : "mu-badge-success"}`}>
      <i className={`bi ${isOver ? "bi-lock-fill" : "bi-hourglass-split"}`} style={{ marginRight: 4 }} />
      {notYetOpen
        ? "Not yet open"
        : isOver
        ? "Closed"
        : `${d}d ${h}h ${m}m left`}
    </span>
  );
}

// ---------------------------------------------------------------------
// Upload CAT modal
// ---------------------------------------------------------------------
function CatFormModal({ allocation, onClose, onSaved }) {
  const [form, setForm] = useState({
    cat_number: 1,
    title: "",
    instructions: "",
    max_marks: 30,
    opens_at: "",
    closes_at: "",
    is_published: true,
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.title || !form.opens_at || !form.closes_at) {
      setError("Title, opens-at and closes-at are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("lecturer_allocation", allocation.id);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("cat_file", file);
      const { data } = await lecturerApi.createCat(fd);
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not save CAT. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Upload CAT — ${allocation.course_detail?.code}`} size="md">
      <div className="mu-alert mu-alert-info" style={{ marginBottom: 16 }}>
        <i className="bi bi-info-circle" />
        Attach the question paper. Students will see a countdown until it closes.
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>CAT Number</label>
            <select
              className="mu-select"
              value={form.cat_number}
              onChange={(e) => setForm({ ...form, cat_number: e.target.value })}
            >
              <option value={1}>CAT 1</option>
              <option value={2}>CAT 2</option>
              <option value={3}>CAT 3</option>
            </select>
          </div>
          <div className="mu-form-group">
            <label>Max Marks</label>
            <input
              className="mu-input"
              type="number"
              value={form.max_marks}
              onChange={(e) => setForm({ ...form, max_marks: e.target.value })}
            />
          </div>
        </div>

        <div className="mu-form-group">
          <label>Title</label>
          <input
            className="mu-input"
            placeholder="e.g. CAT 1 — Data Structures"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div className="mu-form-group">
          <label>Instructions (optional)</label>
          <textarea
            className="mu-textarea"
            rows={3}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </div>

        <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
          <div className="mu-form-group">
            <label>Opens At</label>
            <input
              className="mu-input"
              type="datetime-local"
              value={form.opens_at}
              onChange={(e) => setForm({ ...form, opens_at: e.target.value })}
            />
          </div>
          <div className="mu-form-group">
            <label>Closes At</label>
            <input
              className="mu-input"
              type="datetime-local"
              value={form.closes_at}
              onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
            />
          </div>
        </div>

        <div className="mu-form-group">
          <label>Question Paper (PDF)</label>
          <input
            className="mu-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="mu-help-text">Upload the question paper as a PDF</div>
        </div>

        <div className="mu-checkbox">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            id="publish_cat"
          />
          <label htmlFor="publish_cat">Publish immediately (students can see and download it right away)</label>
        </div>

        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Publishing...
              </>
            ) : "Publish CAT"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Upload lecture note modal
// ---------------------------------------------------------------------
function NoteFormModal({ allocation, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title || !file) {
      setError("Title and a PDF file are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("lecturer_allocation", allocation.id);
      fd.append("title", title);
      fd.append("description", description);
      fd.append("file", file);
      const { data } = await lecturerApi.createNote(fd);
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not upload notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Upload Notes — ${allocation.course_detail?.code}`} size="md">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="mu-form-group">
          <label>Title</label>
          <input
            className="mu-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Week 4 — Recursion"
          />
        </div>

        <div className="mu-form-group">
          <label>Description (optional)</label>
          <textarea
            className="mu-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="mu-form-group">
          <label>PDF File</label>
          <input
            className="mu-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="mu-help-text">Upload course notes as a PDF</div>
        </div>

        {error && <div className="mu-alert mu-alert-danger"><i className="bi bi-exclamation-triangle" /> {error}</div>}

        <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
          <button type="button" className="mu-btn mu-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat mu-animate-spin" />
                Uploading...
              </>
            ) : "Upload"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Grading drawer — lists every student submission for a CAT
// ---------------------------------------------------------------------
function GradingDrawer({ cat, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marksDraft, setMarksDraft] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await lecturerApi.catSubmissions(cat.id);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [cat.id]);

  useEffect(() => { load(); }, [load]);

  const saveMark = async (submissionId) => {
    const marks = marksDraft[submissionId];
    if (marks === undefined || marks === "") return;
    setSavingId(submissionId);
    try {
      await lecturerApi.gradeSubmission(submissionId, marks);
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not save marks.");
    } finally {
      setSavingId(null);
    }
  };

  const gradedCount = rows.filter((r) => r.marks_awarded !== null).length;

  return (
    <Modal isOpen={true} onClose={onClose} title={cat.title} size="xl" showFooter={false}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ margin: 0, color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)" }}>
          {rows.length} submitted · {gradedCount} graded · out of {cat.max_marks} marks
        </p>
        <button className="mu-btn mu-btn-secondary" onClick={onClose}>Close</button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading submissions..." />
      ) : rows.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
          <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
          <p style={{ margin: 0 }}>No student has submitted yet.</p>
        </div>
      ) : (
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Submitted</th>
                <th>Answer</th>
                <th>Marks</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--mu-gray-900)" }}>{r.student_name}</div>
                    <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>{r.registration_number}</div>
                  </td>
                  <td>
                    {new Date(r.submitted_at).toLocaleString()}
                    {r.is_late && (
                      <span className="mu-badge mu-badge-danger" style={{ marginLeft: 6, fontSize: "0.6rem" }}>LATE</span>
                    )}
                  </td>
                  <td>
                    {r.answer_file ? (
                      <a href={r.answer_file} target="_blank" rel="noreferrer" className="mu-btn mu-btn-sm mu-btn-outline-primary">
                        <i className="bi bi-file-earmark-pdf" />
                        View PDF
                      </a>
                    ) : (
                      <span style={{ color: "var(--mu-gray-400)", fontSize: "var(--mu-font-size-sm)" }}>Text answer only</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={cat.max_marks}
                      className="mu-input"
                      placeholder={r.marks_awarded ?? "—"}
                      value={marksDraft[r.id] ?? r.marks_awarded ?? ""}
                      onChange={(e) => setMarksDraft({ ...marksDraft, [r.id]: e.target.value })}
                      style={{ width: 80 }}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="mu-btn mu-btn-sm mu-btn-primary"
                      onClick={() => saveMark(r.id)}
                      disabled={savingId === r.id}
                    >
                      {savingId === r.id ? (
                        <>
                          <i className="bi bi-arrow-repeat mu-animate-spin" />
                          Saving...
                        </>
                      ) : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------
export default function LecturePage() {
  const [allocations, setAllocations] = useState([]);
  const [selectedAllocationId, setSelectedAllocationId] = useState(null);
  const [cats, setCats] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [gradingCat, setGradingCat] = useState(null);

  useEffect(() => {
    lecturerApi.myAllocations().then(({ data }) => {
      const list = data.results || data;
      setAllocations(list);
      if (list.length) setSelectedAllocationId(list[0].id);
    });
  }, []);

  const selectedAllocation = useMemo(
    () => allocations.find((a) => a.id === selectedAllocationId),
    [allocations, selectedAllocationId]
  );

  const loadCatsAndNotes = useCallback(async () => {
    if (!selectedAllocationId) return;
    setLoading(true);
    try {
      const [catsRes, notesRes] = await Promise.all([
        lecturerApi.myCats(),
        lecturerApi.notes({ lecturer_allocation: selectedAllocationId }),
      ]);
      const allCats = catsRes.data.results || catsRes.data;
      setCats(allCats.filter((c) => c.lecturer_allocation === selectedAllocationId));
      setNotes(notesRes.data.results || notesRes.data);
    } finally {
      setLoading(false);
    }
  }, [selectedAllocationId]);

  useEffect(() => { loadCatsAndNotes(); }, [loadCatsAndNotes]);

  const deleteNote = async (id) => {
    if (!confirm("Remove this note for students?")) return;
    await lecturerApi.deleteNote(id);
    loadCatsAndNotes();
  };

  const togglePublish = async (cat) => {
    try {
      await lecturerApi.togglePublishCat(cat.id, !cat.is_published);
      loadCatsAndNotes();
    } catch (e) {
      alert("Could not update publish status.");
    }
  };

  // Count allocations
  const activeAllocations = allocations.filter(a => a.is_active);
  const totalStudents = allocations.reduce((sum, a) => sum + (a.student_count || 0), 0);

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-journal-bookmark" />
            CATs & Course Notes
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Lecturer <span className="separator">/</span> CATs & Notes
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/lecturer/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* 4x8 Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "4fr 8fr", gap: 24 }}>
        {/* Left Column - 4fr (Unit List) */}
        <div>
          <div className="mu-card">
            <div className="mu-card-header">
              <h4>
                <i className="bi bi-list-check" style={{ marginRight: 8 }} />
                My Units
              </h4>
              <span className="mu-badge mu-badge-primary">
                {allocations.length}
              </span>
            </div>
            <div className="mu-card-body" style={{ padding: 0 }}>
              {allocations.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--mu-gray-400)" }}>
                  <i className="bi bi-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: "var(--mu-font-size-sm)" }}>No units allocated</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {allocations.map((a) => {
                    const isActive = selectedAllocationId === a.id;
                    const catCount = cats.filter(c => c.lecturer_allocation === a.id).length;
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          setSelectedAllocationId(a.id);
                          loadCatsAndNotes();
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          padding: "12px 16px",
                          border: "none",
                          borderBottom: "1px solid var(--mu-border)",
                          background: isActive ? "var(--mu-primary-50)" : "transparent",
                          cursor: "pointer",
                          transition: "background var(--mu-transition-fast)",
                          width: "100%",
                          textAlign: "left",
                          position: "relative",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = "var(--mu-gray-50)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {isActive && (
                          <div style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 3,
                            background: "var(--mu-primary-500)",
                            borderRadius: "0 3px 3px 0",
                          }} />
                        )}
                        <div style={{ fontWeight: isActive ? 600 : 400, fontSize: "var(--mu-font-size-sm)" }}>
                          {a.course_detail?.code}
                        </div>
                        <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                          Y{a.year} S{a.programme_semester} · {a.programme_detail?.code || a.programme}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <span className="mu-badge mu-badge-primary" style={{ fontSize: "0.6rem" }}>
                            <i className="bi bi-people" style={{ marginRight: 2 }} />
                            {a.student_count || 0}
                          </span>
                          {catCount > 0 && (
                            <span className="mu-badge mu-badge-info" style={{ fontSize: "0.6rem" }}>
                              <i className="bi bi-clipboard-check" style={{ marginRight: 2 }} />
                              {catCount} CATs
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-people" style={{ marginRight: 4 }} />
                {totalStudents} Total Students
              </span>
              <span style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                {activeAllocations.length} Active
              </span>
            </div>
          </div>
        </div>

        {/* Right Column - 8fr (Selected Unit Details) */}
        <div>
          {selectedAllocation ? (
            <>
              {/* Unit Info */}
              <div className="mu-card" style={{ marginBottom: 24 }}>
                <div className="mu-card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h3 style={{ margin: 0, color: "var(--mu-gray-900)" }}>
                        {selectedAllocation.course_detail?.name}
                      </h3>
                      <p style={{ margin: "4px 0 0", color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)" }}>
                        {selectedAllocation.course_detail?.code} · 
                        Programme Y{selectedAllocation.year} S{selectedAllocation.programme_semester} · 
                        {selectedAllocation.programme_detail?.name || selectedAllocation.programme}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="mu-btn mu-btn-primary mu-btn-sm" onClick={() => setShowCatModal(true)}>
                        <i className="bi bi-plus-circle" />
                        Upload CAT
                      </button>
                      <button className="mu-btn mu-btn-outline-primary mu-btn-sm" onClick={() => setShowNoteModal(true)}>
                        <i className="bi bi-upload" />
                        Upload Notes
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CATs Section */}
              <div className="mu-card" style={{ marginBottom: 24 }}>
                <div className="mu-card-header">
                  <h4>
                    <i className="bi bi-clipboard-check" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
                    CATs
                  </h4>
                  <span className="mu-badge mu-badge-primary">{cats.length} CATs</span>
                </div>
                <div className="mu-card-body">
                  {loading ? (
                    <LoadingSpinner text="Loading CATs..." />
                  ) : cats.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>
                      <i className="bi bi-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                      <p style={{ margin: 0, fontSize: "var(--mu-font-size-sm)" }}>No CATs uploaded yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {cats.map((cat) => (
                        <div
                          key={cat.id}
                          style={{
                            border: "1px solid var(--mu-border)",
                            borderRadius: "var(--mu-radius-sm)",
                            padding: "10px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                            background: "var(--mu-white)",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--mu-gray-900)", fontSize: "var(--mu-font-size-sm)" }}>
                              CAT {cat.cat_number} — {cat.title}
                            </div>
                            <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)", marginTop: 2 }}>
                              {cat.max_marks} marks · {cat.submission_count || 0} submitted · {cat.graded_count || 0} graded
                              {cat.cat_file && (
                                <>
                                  {" · "}
                                  <a href={cat.cat_file} target="_blank" rel="noreferrer" style={{ color: "var(--mu-primary-500)" }}>
                                    question paper
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {/* Publish Toggle */}
                            <span
                              onClick={() => togglePublish(cat)}
                              title="Click to toggle"
                              style={{
                                cursor: "pointer",
                                fontSize: "0.6rem",
                                fontWeight: 600,
                                color: cat.is_published ? "var(--mu-success)" : "var(--mu-gray-400)",
                                background: cat.is_published ? "var(--mu-success-light)" : "var(--mu-gray-100)",
                                padding: "2px 10px",
                                borderRadius: 20,
                                border: "1px solid transparent",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = cat.is_published ? "var(--mu-success)" : "var(--mu-gray-300)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "transparent";
                              }}
                            >
                              <i className={`bi ${cat.is_published ? "bi-eye-fill" : "bi-eye-slash-fill"}`} style={{ marginRight: 4 }} />
                              {cat.is_published ? "Published" : "Draft"}
                            </span>
                            <CountdownBadge closesAt={cat.closes_at} opensAt={cat.opens_at} />
                            <button
                              className="mu-btn mu-btn-sm mu-btn-primary"
                              onClick={() => setGradingCat(cat)}
                            >
                              Grade ({cat.submission_count || 0})
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes Section */}
              <div className="mu-card">
                <div className="mu-card-header">
                  <h4>
                    <i className="bi bi-file-earmark-text" style={{ marginRight: 8, color: "var(--mu-primary-500)" }} />
                    Course Notes
                  </h4>
                  <span className="mu-badge mu-badge-primary">{notes.length} Notes</span>
                </div>
                <div className="mu-card-body">
                  {loading ? (
                    <LoadingSpinner text="Loading notes..." />
                  ) : notes.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 24, color: "var(--mu-gray-400)" }}>
                      <i className="bi bi-file-earmark-text" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                      <p style={{ margin: 0, fontSize: "var(--mu-font-size-sm)" }}>No notes uploaded yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {notes.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            border: "1px solid var(--mu-border)",
                            borderRadius: "var(--mu-radius-sm)",
                            background: "var(--mu-white)",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--mu-gray-900)", fontSize: "var(--mu-font-size-sm)" }}>
                              {n.title}
                            </div>
                            {n.description && (
                              <div style={{ fontSize: "var(--mu-font-size-xs)", color: "var(--mu-gray-500)" }}>
                                {n.description}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <a
                              href={n.file}
                              target="_blank"
                              rel="noreferrer"
                              className="mu-btn mu-btn-sm mu-btn-outline-primary"
                            >
                              <i className="bi bi-download" />
                              Download
                            </a>
                            <button
                              onClick={() => deleteNote(n.id)}
                              className="mu-btn mu-btn-sm mu-btn-danger"
                              title="Remove"
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="mu-card">
              <div className="mu-card-body" style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
                <i className="bi bi-journal-bookmark" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>Select a Unit</h3>
                <p style={{ margin: "8px 0 0" }}>Choose a unit from the left panel to view its CATs and notes.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCatModal && selectedAllocation && (
        <CatFormModal
          allocation={selectedAllocation}
          onClose={() => setShowCatModal(false)}
          onSaved={loadCatsAndNotes}
        />
      )}

      {showNoteModal && selectedAllocation && (
        <NoteFormModal
          allocation={selectedAllocation}
          onClose={() => setShowNoteModal(false)}
          onSaved={loadCatsAndNotes}
        />
      )}

      {gradingCat && <GradingDrawer cat={gradingCat} onClose={() => setGradingCat(null)} />}
    </div>
  );
}