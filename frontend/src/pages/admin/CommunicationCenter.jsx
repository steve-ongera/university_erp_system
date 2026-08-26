// Adjust the import path below to wherever your api.js actually lives.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { communicationApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

const AUDIENCE_LABELS = {
  all: "All Users",
  students: "Students",
  lecturers: "Lecturers",
  staff: "Non-Academic Staff",
  class: "Specific Class",
  custom: "Custom / Specific Users",
};

const STATUS_LABELS = {
  active: "Active students only",
  outstanding_fees: "Students with outstanding fees",
  not_registered: "Students who have not registered",
};

const EMPTY_FORM = {
  title: "",
  body: "",
  category: "announcement",
  audience_type: "all",
  channels: ["erp"],
  filters: {},
  audience_label: "",
  scheduled_at: "",
};

export default function CommunicationCenter() {
  const [options, setOptions] = useState(null);
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    loadOptions();
    loadMessages();
  }, []);

  const loadOptions = async () => {
    try {
      const { data } = await communicationApi.audienceOptions();
      setOptions(data);
    } catch (err) {
      console.error("Error loading options:", err);
      setFeedback("Failed to load audience options.");
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data } = await communicationApi.sentMessages();
      setMessages(data.results || data || []);
    } catch (err) {
      console.error("Error loading messages:", err);
      setFeedback("Failed to load sent messages.");
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setForm((f) => ({ ...f, filters: { ...f.filters, [key]: value || undefined } }));
  };

  const toggleChannel = (channel) => {
    setForm((f) => {
      const has = f.channels.includes(channel);
      return { ...f, channels: has ? f.channels.filter((c) => c !== channel) : [...f.channels, channel] };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setFeedback("");
    try {
      const payload = { ...form, scheduled_at: form.scheduled_at || null };
      await communicationApi.compose(payload);
      setFeedback(" Message sent successfully.");
      setForm(EMPTY_FORM);
      setConfirmModalOpen(false);
      loadMessages();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const openConfirmModal = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setFeedback("Please fill in both title and message.");
      return;
    }
    setConfirmModalOpen(true);
  };

  if (!options) {
    return <LoadingSpinner text="Loading communication options..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-megaphone" />
            Communication Center
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Admin <span className="separator">/</span> Communication
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/admin/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`mu-alert ${feedback.includes("") ? "mu-alert-success" : "mu-alert-danger"}`}>
          <i className={`bi ${feedback.includes("") ? "bi-check-circle" : "bi-exclamation-triangle"}`} />
          {feedback}
        </div>
      )}

      {/* Compose Form */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-pencil-square" style={{ marginRight: 8 }} />
            Compose Message
          </h4>
          <span className="mu-badge mu-badge-primary">
            {form.channels.length} Channel(s)
          </span>
        </div>
        <div className="mu-card-body">
          <form onSubmit={openConfirmModal}>
            <div className="mu-form-group">
              <label>Title</label>
              <input 
                className="mu-input" 
                value={form.title} 
                onChange={(e) => setForm({ ...form, title: e.target.value })} 
                placeholder="Enter message title..."
                required 
              />
            </div>

            <div className="mu-form-group">
              <label>Message</label>
              <textarea 
                className="mu-textarea" 
                value={form.body} 
                onChange={(e) => setForm({ ...form, body: e.target.value })} 
                placeholder="Type your message here..."
                rows={5}
                required 
              />
            </div>

            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Category</label>
                <select 
                  className="mu-select" 
                  value={form.category} 
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="announcement">Announcement</option>
                  <option value="alert">Alert</option>
                  <option value="reminder">Reminder</option>
                  <option value="meeting">Meeting Notice</option>
                </select>
              </div>

              <div className="mu-form-group">
                <label>Audience</label>
                <select
                  className="mu-select"
                  value={form.audience_type}
                  onChange={(e) => setForm({ ...form, audience_type: e.target.value, filters: {} })}
                >
                  {options.audience_types?.map((a) => (
                    <option key={a} value={a}>{AUDIENCE_LABELS[a] || a}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student Filters */}
            {form.audience_type === "students" && (
              <fieldset style={{ 
                border: "1px solid var(--mu-border)", 
                borderRadius: "var(--mu-radius-sm)", 
                padding: 16, 
                marginBottom: 12 
              }}>
                <legend style={{ fontSize: "var(--mu-font-size-sm)", fontWeight: 600, color: "var(--mu-gray-600)", padding: "0 8px" }}>
                  Student Filters (leave blank for all)
                </legend>
                <div className="mu-dashboard-grid-3" style={{ gap: 12, marginBottom: 0 }}>
                  <div className="mu-form-group">
                    <label>Faculty</label>
                    <select className="mu-select" onChange={(e) => updateFilter("faculty", e.target.value)}>
                      <option value="">-- Any --</option>
                      {(options.faculties || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="mu-form-group">
                    <label>Department</label>
                    <select className="mu-select" onChange={(e) => updateFilter("department", e.target.value)}>
                      <option value="">-- Any --</option>
                      {(options.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="mu-form-group">
                    <label>Programme</label>
                    <select className="mu-select" onChange={(e) => updateFilter("programme", e.target.value)}>
                      <option value="">-- Any --</option>
                      {(options.programmes || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="mu-form-group">
                    <label>Year of Study</label>
                    <select className="mu-select" onChange={(e) => updateFilter("year", e.target.value)}>
                      <option value="">-- Any --</option>
                      {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                  <div className="mu-form-group" style={{ gridColumn: "span 2" }}>
                    <label>Status</label>
                    <select className="mu-select" onChange={(e) => updateFilter("status", e.target.value)}>
                      <option value="">-- Any --</option>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Lecturer Filters */}
            {form.audience_type === "lecturers" && (
              <fieldset style={{ 
                border: "1px solid var(--mu-border)", 
                borderRadius: "var(--mu-radius-sm)", 
                padding: 16, 
                marginBottom: 12 
              }}>
                <legend style={{ fontSize: "var(--mu-font-size-sm)", fontWeight: 600, color: "var(--mu-gray-600)", padding: "0 8px" }}>
                  Lecturer Filters (leave blank for all)
                </legend>
                <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                  <div className="mu-form-group">
                    <label>Faculty</label>
                    <select className="mu-select" onChange={(e) => updateFilter("faculty", e.target.value)}>
                      <option value="">-- Any --</option>
                      {(options.faculties || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="mu-form-group">
                    <label>Department</label>
                    <select className="mu-select" onChange={(e) => updateFilter("department", e.target.value)}>
                      <option value="">-- Any --</option>
                      {(options.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Staff Filters */}
            {form.audience_type === "staff" && (
              <fieldset style={{ 
                border: "1px solid var(--mu-border)", 
                borderRadius: "var(--mu-radius-sm)", 
                padding: 16, 
                marginBottom: 12 
              }}>
                <legend style={{ fontSize: "var(--mu-font-size-sm)", fontWeight: 600, color: "var(--mu-gray-600)", padding: "0 8px" }}>
                  Staff Filters
                </legend>
                <div className="mu-form-group">
                  <label>Department</label>
                  <select className="mu-select" onChange={(e) => updateFilter("department", e.target.value)}>
                    <option value="">-- Any --</option>
                    {(options.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </fieldset>
            )}

            {/* Custom Recipients */}
            {form.audience_type === "custom" && (
              <fieldset style={{ 
                border: "1px solid var(--mu-border)", 
                borderRadius: "var(--mu-radius-sm)", 
                padding: 16, 
                marginBottom: 12 
              }}>
                <legend style={{ fontSize: "var(--mu-font-size-sm)", fontWeight: 600, color: "var(--mu-gray-600)", padding: "0 8px" }}>
                  Custom Recipients
                </legend>
                <div className="mu-form-group">
                  <label>Comma-separated User IDs</label>
                  <input
                    className="mu-input"
                    placeholder="e.g. 12,45,88"
                    onChange={(e) =>
                      updateFilter("user_ids", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))
                    }
                  />
                  <div className="mu-help-text">
                    <i className="bi bi-info-circle" />
                    Enter user IDs separated by commas.
                  </div>
                </div>
              </fieldset>
            )}

            <div className="mu-form-group">
              <label>Audience Label (optional, shown in history)</label>
              <input
                className="mu-input"
                value={form.audience_label}
                onChange={(e) => setForm({ ...form, audience_label: e.target.value })}
                placeholder="e.g. BSc Software Engineering - Year 4 - Active Students"
              />
            </div>

            <div className="mu-form-group">
              <label>Channels</label>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {["erp", "email", "sms"].map((c) => (
                  <div className="mu-checkbox" key={c}>
                    <input
                      type="checkbox"
                      checked={form.channels.includes(c)}
                      onChange={() => toggleChannel(c)}
                      id={`channel-${c}`}
                    />
                    <label htmlFor={`channel-${c}`}>
                      {c === "erp" && <i className="bi bi-bell" style={{ marginRight: 4 }} />}
                      {c === "email" && <i className="bi bi-envelope" style={{ marginRight: 4 }} />}
                      {c === "sms" && <i className="bi bi-phone" style={{ marginRight: 4 }} />}
                      {c.toUpperCase()}
                    </label>
                  </div>
                ))}
              </div>
              <div className="mu-help-text">
                <i className="bi bi-info-circle" />
                Select one or more channels for delivery. ERP notifications appear in the portal.
              </div>
            </div>

            <div className="mu-form-group">
              <label>Send Later (optional)</label>
              <input
                type="datetime-local"
                className="mu-input"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              />
              <div className="mu-help-text">
                <i className="bi bi-info-circle" />
                Leave blank to send immediately.
              </div>
            </div>

            <button type="submit" className="mu-btn mu-btn-primary" disabled={sending}>
              {sending ? (
                <>
                  <i className="bi bi-arrow-repeat mu-animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <i className="bi bi-send" />
                  Send Message
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Sent Messages History */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-clock-history" style={{ marginRight: 8 }} />
            Sent History
          </h4>
          <span className="mu-badge mu-badge-primary">
            {messages.length} Message(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 48 }}><LoadingSpinner text="Loading messages..." /></div>
          ) : messages.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Messages Sent</h3>
              <p style={{ margin: "8px 0 0" }}>Your sent messages will appear here.</p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Audience</th>
                    <th>Channels</th>
                    <th style={{ textAlign: "center" }}>Recipients</th>
                    <th>Status</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg) => (
                    <tr key={msg.id}>
                      <td>
                        <strong>{msg.title}</strong>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {msg.audience_label || AUDIENCE_LABELS[msg.audience_type] || msg.audience_type}
                        </span>
                      </td>
                      <td>
                        {(msg.channels || ["erp"]).map((ch) => (
                          <span key={ch} className="mu-badge mu-badge-gray" style={{ marginRight: 4 }}>
                            {ch.toUpperCase()}
                          </span>
                        ))}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mu-badge mu-badge-success">
                          <i className="bi bi-people" style={{ marginRight: 4 }} />
                          {msg.recipient_count || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge ${
                          msg.status === "sent" ? "mu-badge-success" :
                          msg.status === "draft" ? "mu-badge-gray" :
                          msg.status === "failed" ? "mu-badge-danger" :
                          msg.status === "scheduled" ? "mu-badge-info" :
                          "mu-badge-gray"
                        }`}>
                          {msg.status || "Sent"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {msg.sent_at ? new Date(msg.sent_at).toLocaleString() : "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {messages.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {messages.length} message(s)
            </span>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={loadMessages}>
              <i className="bi bi-arrow-repeat" />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Send Message"
        size="md"
        confirmText="Send Now"
        onConfirm={submit}
        isLoading={sending}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-megaphone" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Send Message</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to send a message to <strong>{AUDIENCE_LABELS[form.audience_type] || form.audience_type}</strong>
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)" }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Title:</span>
              <span><strong>{form.title}</strong></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Channels:</span>
              <span>
                {form.channels.map((ch) => (
                  <span key={ch} className="mu-badge mu-badge-primary" style={{ marginLeft: 4 }}>
                    {ch.toUpperCase()}
                  </span>
                ))}
              </span>
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--mu-border)" }}>
              <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>Message:</div>
              <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-700)", marginTop: 4 }}>
                {form.body}
              </div>
            </div>
          </div>
          <div className="mu-alert mu-alert-info" style={{ marginTop: 12, textAlign: "left" }}>
            <i className="bi bi-info-circle" />
            <div>
              <strong>Note:</strong> This message will be sent to all selected recipients via the chosen channels.
              This action cannot be undone.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}