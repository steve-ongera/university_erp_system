// Adjust import paths below to match your project structure.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { communicationApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function ConversationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    const { data } = await communicationApi.conversation(id);
    setConversation(data);
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await communicationApi.replyConversation(id, reply);
      setReply("");
      load();
    } finally {
      setSending(false);
    }
  };

  const assignToMe = async () => {
    await communicationApi.assignConversation(id);
    load();
  };

  const changeStatus = async (statusValue) => {
    await communicationApi.setConversationStatus(id, statusValue);
    load();
  };

  if (!conversation) return <div>Loading...</div>;

  const isStaff = user?.user_type !== "student";

  return (
    <div>
      <h2>{conversation.subject}</h2>
      <div>Status: {conversation.status} &middot; Category: {conversation.category}</div>
      <div>Opened by: {conversation.opened_by_name}</div>
      {conversation.assigned_to_name && <div>Assigned to: {conversation.assigned_to_name}</div>}

      {isStaff && (
        <div>
          {!conversation.assigned_to_name && <button onClick={assignToMe}>Assign to me</button>}
          <button onClick={() => changeStatus("resolved")}>Mark Resolved</button>
          <button onClick={() => changeStatus("closed")}>Close</button>
        </div>
      )}

      <div>
        {(conversation.messages || []).map((msg) => (
          <div key={msg.id}>
            <strong>{msg.sender_name}</strong> ({msg.sender_role}) &mdash; {new Date(msg.created_at).toLocaleString()}
            <p>{msg.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={submitReply}>
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply..." required />
        <button type="submit" disabled={sending}>{sending ? "Sending..." : "Reply"}</button>
      </form>
    </div>
  );
}