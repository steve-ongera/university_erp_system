// Adjust the import path below to wherever your api.js actually lives.
//
// This is the "narrow" compose screen used by roles whose reach is
// pinned server-side (Dean -> own faculty, HOD -> own department,
// Lecturer -> a class they teach, Finance/Exam Office/Hostel Warden ->
// students). It reads /messages/audience-options/ to find out which
// audience_type(s) this role may use and, for lecturers, which classes
// they're currently allocated to — the filter form only shows what's
// actually needed for that role.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { communicationApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function ComposeMessage() {
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState({ 
    title: "", 
    body: "", 
    audience_type: "", 
    filters: {}, 
    channels: ["erp"] 
  });
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [optionsRes, historyRes] = await Promise.all([
          communicationApi.audienceOptions(),
          communicationApi.sentMessages(),
        ]);
        setOptions(optionsRes.data);
        setForm((f) => ({ 
          ...f, 
          audience_type: optionsRes.data.audience_types?.[0] || "" 
        }));
        setHistory(historyRes.data.results || historyRes.data || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        setFeedback("Failed to load messaging options.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleChannel = (channel) => {
    setForm((f) => {
      const has = f.channels.includes(channel);
      return { 
        ...f, 
        channels: has ? f.channels.filter((c) => c !== channel) : [...f.channels, channel] 
      };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setFeedback("");
    try {
      await communicationApi.compose(form);
      setFeedback(" Message sent successfully.");
      setForm((f) => ({ ...f, title: "", body: "" }));
      const { data } = await communicationApi.sentMessages();
      setHistory(data.results || data);
      setConfirmModalOpen(false);
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

  if (loading) {
    return <LoadingSpinner text="Loading messaging options..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-envelope-paper" />
            Compose Message
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Communication <span className="separator">/</span> Compose
          </div>
        </div>
        
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`mu-alert ${feedback.includes("") ? "mu-alert-success" : "mu-alert-danger"}`}>
          <i className={`bi ${feedback.includes("") ? "bi-check-circle" : "bi-exclamation-triangle"}`} />
          {feedback}
        </div>
      )}

      {/* Main Form Card */}
      <div className="mu-card" style={{ marginBottom: 24 }}>
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-pencil-square" style={{ marginRight: 8 }} />
            New Message
          </h4>
          <span className="mu-badge mu-badge-primary">
            {form.channels.length} Channel(s)
          </span>
        </div>
        <div className="mu-card-body">
          <form onSubmit={openConfirmModal}>
            {/* Audience Selection */}
            {options?.audience_types && options.audience_types.length > 1 && (
              <div className="mu-form-group">
                <label>Audience</label>
                <select
                  className="mu-select"
                  value={form.audience_type}
                  onChange={(e) => setForm({ ...form, audience_type: e.target.value, filters: {} })}
                >
                  {options.audience_types.map((a) => (
                    <option key={a} value={a}>
                      {a.replace(/_/g, " ").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Class Selection (for lecturers) */}
            {form.audience_type === "class" && (
              <div className="mu-form-group">
                <label>Select Class</label>
                <select
                  className="mu-select"
                  onChange={(e) => setForm({ ...form, filters: { lecturer_allocation: e.target.value } })}
                  required
                >
                  <option value="">-- Select a class you teach --</option>
                  {(options?.allocations || []).map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
                <div className="mu-help-text">
                  <i className="bi bi-info-circle" />
                  You can only message classes you are allocated to teach.
                </div>
              </div>
            )}

            {/* Title */}
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

            {/* Message Body */}
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
              <div className="mu-help-text">
                <i className="bi bi-info-circle" />
                Be clear and concise. Your message will be sent to all selected recipients.
              </div>
            </div>

            {/* Channels */}
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

            {/* Submit Button */}
            <button
              type="submit"
              className="mu-btn mu-btn-primary"
              disabled={sending}
            >
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
            Messages I've Sent
          </h4>
          <span className="mu-badge mu-badge-primary">
            {history.length} Message(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {history.length > 0 ? (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Recipients</th>
                    <th>Status</th>
                    <th>Channels</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((msg) => (
                    <tr key={msg.id}>
                      <td>
                        <strong>{msg.title}</strong>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          <i className="bi bi-people" style={{ marginRight: 4 }} />
                          {msg.recipient_count || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge ${
                          msg.status === "sent" ? "mu-badge-success" :
                          msg.status === "draft" ? "mu-badge-gray" :
                          msg.status === "failed" ? "mu-badge-danger" :
                          "mu-badge-info"
                        }`}>
                          {msg.status || "Sent"}
                        </span>
                      </td>
                      <td>
                        {(msg.channels || ["erp"]).map((ch) => (
                          <span key={ch} className="mu-badge mu-badge-gray" style={{ marginRight: 4 }}>
                            {ch.toUpperCase()}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {msg.created_at ? new Date(msg.created_at).toLocaleDateString() : "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Messages Sent</h3>
              <p style={{ margin: "8px 0 0" }}>Your sent messages will appear here.</p>
            </div>
          )}
        </div>
        {history.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {history.length} message(s)
            </span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mu-dashboard-grid-3" style={{ marginTop: 24 }}>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-inbox" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>Inbox</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              View received messages
            </p>
            <Link to="/messages/inbox" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              <i className="bi bi-arrow-right" />
              Open Inbox
            </Link>
          </div>
        </div>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-bell" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>Notifications</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              View your notifications
            </p>
            <Link to="/notifications" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              <i className="bi bi-arrow-right" />
              View Notifications
            </Link>
          </div>
        </div>
        <div className="mu-card">
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <i className="bi bi-people" style={{ fontSize: 24, color: "var(--mu-primary-500)" }} />
            <h4 style={{ margin: "8px 0 4px" }}>Students</h4>
            <p style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", margin: 0 }}>
              Manage student records
            </p>
            <Link to="/students" className="mu-btn mu-btn-sm mu-btn-outline-primary" style={{ marginTop: 8 }}>
              <i className="bi bi-arrow-right" />
              View Students
            </Link>
          </div>
        </div>
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
          <i className="bi bi-envelope-paper" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Send Message</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to send a message to <strong>{form.audience_type?.replace(/_/g, " ").toUpperCase() || "Selected Recipients"}</strong>
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