// Adjust the import path below to wherever your api.js actually lives
// (e.g. "../../api/api" or "../../services/api").
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { communicationApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";

export default function Inbox() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await communicationApi.inbox();
      setItems(data.results || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error("Error fetching inbox:", err);
      setError("Failed to load your inbox.");
    } finally {
      setLoading(false);
    }
  };

  const openItem = async (item) => {
    setSelected(item);
    setModalOpen(true);
    if (!item.is_read) {
      try {
        await communicationApi.markMessageRead(item.id);
        load();
      } catch (err) {
        console.error("Error marking message as read:", err);
      }
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading your inbox..." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-inbox" />
            Inbox
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Communication <span className="separator">/</span> Inbox
          </div>
        </div>
        <div className="mu-page-header-actions">
       
          <button className="mu-btn mu-btn-outline-primary" onClick={load}>
            <i className="bi bi-arrow-repeat" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="mu-dashboard-grid">
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-inbox" />
          </div>
          <div className="mu-stat-label">Total Messages</div>
          <div className="mu-stat-value">{items.length}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-envelope" />
          </div>
          <div className="mu-stat-label">Unread</div>
          <div className="mu-stat-value">{unreadCount}</div>
          {unreadCount > 0 && (
            <div className="mu-stat-change up" style={{ color: "var(--mu-danger)" }}>
              <i className="bi bi-exclamation-circle" />
              {unreadCount} unread message(s)
            </div>
          )}
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-check-circle" />
          </div>
          <div className="mu-stat-label">Read</div>
          <div className="mu-stat-value">{items.filter(i => i.is_read).length}</div>
        </div>
      </div>

      {/* Messages List */}
      <div className="mu-card">
        <div className="mu-card-header">
          <h4>
            <i className="bi bi-envelope-paper" style={{ marginRight: 8 }} />
            Messages
          </h4>
          <span className="mu-badge mu-badge-primary">
            {items.length} Message(s)
          </span>
        </div>
        <div className="mu-card-body" style={{ padding: 0 }}>
          {items.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--mu-gray-400)" }}>
              <i className="bi bi-inbox" style={{ fontSize: 48, display: "block", marginBottom: 16 }} />
              <h3 style={{ margin: 0, color: "var(--mu-gray-500)" }}>Your inbox is empty</h3>
              <p style={{ margin: "8px 0 0" }}>You haven't received any messages yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openItem(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--mu-border)",
                    cursor: "pointer",
                    transition: "background var(--mu-transition-fast)",
                    background: item.is_read ? "transparent" : "var(--mu-primary-50)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = item.is_read ? "var(--mu-gray-50)" : "var(--mu-primary-100)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = item.is_read ? "transparent" : "var(--mu-primary-50)";
                  }}
                >
                  {/* Unread Indicator */}
                  <div style={{ flexShrink: 0 }}>
                    {!item.is_read && (
                      <span className="mu-badge mu-badge-danger" style={{ borderRadius: "50%", width: 8, height: 8, padding: 0, display: "inline-block" }} />
                    )}
                  </div>

                  {/* Message Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: !item.is_read ? 600 : 400 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)" }}>
                      <span style={{ fontWeight: 500, color: "var(--mu-gray-700)" }}>
                        {item.sender_name || "System"}
                      </span>
                      <span style={{ margin: "0 4px" }}>·</span>
                      {item.category || "General"}
                      <span style={{ margin: "0 4px" }}>·</span>
                      {item.sent_at ? new Date(item.sent_at).toLocaleString() : ""}
                    </div>
                    {item.preview && (
                      <div style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-400)", marginTop: 2 }}>
                        {item.preview}
                      </div>
                    )}
                  </div>

                  {/* Read Status */}
                  <div style={{ flexShrink: 0 }}>
                    {item.is_read ? (
                      <span className="mu-badge mu-badge-gray" style={{ fontSize: "var(--mu-font-size-xs)" }}>
                        Read
                      </span>
                    ) : (
                      <span className="mu-badge mu-badge-primary" style={{ fontSize: "var(--mu-font-size-xs)" }}>
                        Unread
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

     

      {/* Message Detail Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        title={selected?.title || "Message Details"}
        size="lg"
        showFooter={false}
      >
        {selected && (
          <div>
            {/* Message Metadata */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="mu-form-group" style={{ marginBottom: 0 }}>
                <label>From</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  <strong>{selected.sender_name || "System"}</strong>
                  {selected.sender_role && (
                    <span style={{ fontSize: "var(--mu-font-size-sm)", color: "var(--mu-gray-500)", marginLeft: 8 }}>
                      ({selected.sender_role})
                    </span>
                  )}
                </div>
              </div>
              <div className="mu-form-group" style={{ marginBottom: 0 }}>
                <label>Sent</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {selected.sent_at ? new Date(selected.sent_at).toLocaleString() : "N/A"}
                </div>
              </div>
            </div>

            {selected.audience_label && (
              <div className="mu-form-group">
                <label>Audience</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  <span className="mu-badge mu-badge-primary">{selected.audience_label}</span>
                </div>
              </div>
            )}

            <div className="mu-form-group">
              <label>Subject</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)", fontWeight: 600 }}>
                {selected.title}
              </div>
            </div>

            <div className="mu-form-group">
              <label>Message</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)", minHeight: 100, whiteSpace: "pre-wrap" }}>
                {selected.body}
              </div>
            </div>

            <div className="mu-form-group">
              <label>Channels</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {(selected.channels || ["erp"]).map((ch) => (
                  <span key={ch} className="mu-badge mu-badge-primary" style={{ marginRight: 4 }}>
                    {ch.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            {/* Status */}
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selected.is_read ? (
                <span className="mu-badge mu-badge-success">
                  <i className="bi bi-check-circle" style={{ marginRight: 4 }} />
                  Read
                </span>
              ) : (
                <span className="mu-badge mu-badge-warning">
                  <i className="bi bi-clock" style={{ marginRight: 4 }} />
                  Unread
                </span>
              )}
              {selected.category && (
                <span className="mu-badge mu-badge-info">
                  <i className="bi bi-tag" style={{ marginRight: 4 }} />
                  {selected.category}
                </span>
              )}
            </div>

            <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
              <button className="mu-btn mu-btn-secondary" onClick={() => { setModalOpen(false); setSelected(null); }}>
                Close
              </button>
              {!selected.is_read && (
                <button className="mu-btn mu-btn-primary" onClick={() => { setModalOpen(false); }}>
                  <i className="bi bi-check" />
                  Mark as Read
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}