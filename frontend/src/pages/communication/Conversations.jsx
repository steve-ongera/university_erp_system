// Adjust import paths below to match your project structure.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { communicationApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [targets, setTargets] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    subject: "", 
    body: "", 
    category: "enquiry", 
    target_type: "" 
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    load();
    communicationApi.conversationTargets()
      .then(({ data }) => setTargets(data))
      .catch(() => setError("Failed to load conversation targets."));
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await communicationApi.conversations();
      setConversations(data.results || data || []);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError("Failed to load your conversations.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = { ...form };
      if (form.target_type === "department") payload.department = targets?.department?.id;
      if (form.target_type === "dean") payload.faculty = targets?.faculty?.id;
      if (form.target_type === "lecturer" && form.target_lecturer) {
        payload.target_lecturer = form.target_lecturer;
      }
      await communicationApi.openConversation(payload);
      setSuccess("Conversation opened successfully.");
      setShowForm(false);
      setConfirmModalOpen(false);
      setForm({ subject: "", body: "", category: "enquiry", target_type: "" });
      load();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to submit conversation.");
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirmModal = (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.body.trim() || !form.target_type) {
      setError("Please fill in subject, message, and select a recipient.");
      return;
    }
    setConfirmModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      open: "mu-badge-success",
      pending: "mu-badge-warning",
      closed: "mu-badge-gray",
      resolved: "mu-badge-info",
      escalated: "mu-badge-danger",
    };
    return statusMap[status?.toLowerCase()] || "mu-badge-gray";
  };

  if (loading) {
    return <LoadingSpinner text="Loading your conversations..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-chat-dots" />
            Conversations
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Communication <span className="separator">/</span> Conversations
          </div>
        </div>
        <div className="mu-page-header-actions">
          <button 
            className={`mu-btn ${showForm ? "mu-btn-secondary" : "mu-btn-primary"}`}
            onClick={() => {
              setShowForm(!showForm);
              setError("");
              setSuccess("");
            }}
          >
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-plus-circle"}`} />
            {showForm ? "Cancel" : "New Enquiry / Complaint"}
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* New Conversation Form */}
      {showForm && targets && (
        <div className="mu-card" style={{ marginBottom: 24 }}>
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-pencil-square" style={{ marginRight: 8 }} />
              New Conversation
            </h4>
          </div>
          <div className="mu-card-body">
            <form onSubmit={openConfirmModal}>
              <div className="mu-form-group">
                <label>Category</label>
                <select 
                  className="mu-select" 
                  value={form.category} 
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="enquiry">General Enquiry</option>
                  <option value="complaint">Complaint</option>
                  <option value="academic">Academic</option>
                  <option value="finance">Finance</option>
                  <option value="hostel">Hostel/Accommodation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mu-form-group">
                <label>Send to</label>
                <select
                  className="mu-select"
                  value={form.target_type}
                  onChange={(e) => setForm({ ...form, target_type: e.target.value, target_lecturer: "" })}
                  required
                >
                  <option value="">-- Select recipient --</option>
                  {targets.target_types?.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <div className="mu-help-text">
                  <i className="bi bi-info-circle" />
                  Choose who you want to send this conversation to.
                </div>
              </div>

              {form.target_type === "lecturer" && (
                <div className="mu-form-group">
                  <label>Lecturer</label>
                  <select
                    className="mu-select"
                    onChange={(e) => setForm({ ...form, target_lecturer: e.target.value })}
                    required
                  >
                    <option value="">-- Select a lecturer --</option>
                    {(targets.lecturers || []).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mu-form-group">
                <label>Subject</label>
                <input 
                  className="mu-input" 
                  value={form.subject} 
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} 
                  placeholder="Enter conversation subject..."
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
                  rows={4}
                  required 
                />
              </div>

              <button type="submit" className="mu-btn mu-btn-primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <i className="bi bi-arrow-repeat mu-animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send" />
                    Submit
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Conversations Table */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-chat-text" style={{ marginRight: 8 }} />
            Your Conversations
          </h4>
          <span className="mu-badge mu-badge-primary">
            {conversations.length} Conversation(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {conversations.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-chat-dots" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>No Conversations</h3>
              <p style={{ margin: "8px 0 0" }}>
                {showForm ? "Start a new conversation using the form above." : "Click 'New Enquiry / Complaint' to get started."}
              </p>
            </div>
          ) : (
            <div className="mu-table-wrapper">
              <table className="mu-table mu-table-hover">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link 
                          to={`/communication/${c.id}`}
                          style={{ fontWeight: c.status === "open" ? 600 : 400 }}
                        >
                          {c.subject}
                        </Link>
                      </td>
                      <td>
                        <span className="mu-badge mu-badge-primary">
                          {c.category || "General"}
                        </span>
                      </td>
                      <td>
                        <span className={`mu-badge ${getStatusBadge(c.status)}`}>
                          {c.status || "Open"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                          {c.updated_at ? new Date(c.updated_at).toLocaleString() : "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {conversations.length > 0 && (
          <div className="mu-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              Total: {conversations.length} conversation(s)
            </span>
            <button className="mu-btn mu-btn-sm mu-btn-outline-primary" onClick={load}>
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
        title="Submit Conversation"
        size="md"
        confirmText="Submit"
        onConfirm={submit}
        isLoading={submitting}
      >
        <div style={{ textAlign: "center" }}>
          <i className="bi bi-chat-dots" style={{ fontSize: 48, color: "var(--mu-primary-500)", display: "block", marginBottom: 16 }} />
          <h4 style={{ margin: "0 0 8px" }}>Confirm Submission</h4>
          <p style={{ color: "var(--mu-gray-500)", margin: 0 }}>
            You are about to start a new conversation.
            <br />
            <strong>Please review the details below:</strong>
          </p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--mu-gray-50)", borderRadius: "var(--mu-radius-sm)", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)" }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Category:</span>
              <span><span className="mu-badge mu-badge-primary">{form.category}</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--mu-font-size-sm)", marginTop: 4 }}>
              <span style={{ color: "var(--mu-gray-500)" }}>Subject:</span>
              <span><strong>{form.subject}</strong></span>
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
              <strong>Note:</strong> Your conversation will be sent to the selected recipient. 
              You will be notified when they respond.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}