// Adjust the import path below to wherever your api.js actually lives
// (e.g. "../../api/api" or "../../services/api").
import { useEffect, useState } from "react";
import { communicationApi } from "../../api/api";

export default function Inbox() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await communicationApi.inbox();
      setItems(data.results);
      setUnreadCount(data.unread_count);
    } finally {
      setLoading(false);
    }
  };

  const openItem = async (item) => {
    setSelected(item);
    if (!item.is_read) {
      await communicationApi.markMessageRead(item.id);
      load();
    }
  };

  if (loading) return <div>Loading inbox...</div>;

  return (
    <div>
      <h2>Inbox ({unreadCount} unread)</h2>

      <div>
        <div>
          {items.length === 0 && <div>No messages yet.</div>}
          {items.map((item) => (
            <div key={item.id} onClick={() => openItem(item)}>
              <strong>{item.is_read ? "" : "\u25CF "}{item.title}</strong>
              <div>
                {item.sender_name} &middot; {item.category} &middot;{" "}
                {item.sent_at ? new Date(item.sent_at).toLocaleString() : ""}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div>
            <h3>{selected.title}</h3>
            <div>From: {selected.sender_name} ({selected.sender_role})</div>
            {selected.audience_label && <div>Audience: {selected.audience_label}</div>}
            <div>Sent: {selected.sent_at ? new Date(selected.sent_at).toLocaleString() : ""}</div>
            <p>{selected.body}</p>
            <div>Channels: {(selected.channels || []).join(", ")}</div>
          </div>
        )}
      </div>
    </div>
  );
}