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
import { communicationApi } from "../../api/api";

export default function ComposeMessage() {
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState({ title: "", body: "", audience_type: "", filters: {}, channels: ["erp"] });
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    communicationApi.audienceOptions().then(({ data }) => {
      setOptions(data);
      setForm((f) => ({ ...f, audience_type: data.audience_types[0] || "" }));
    });
    communicationApi.sentMessages().then(({ data }) => setHistory(data.results || data));
  }, []);

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
      await communicationApi.compose(form);
      setFeedback("Message sent.");
      setForm((f) => ({ ...f, title: "", body: "" }));
      const { data } = await communicationApi.sentMessages();
      setHistory(data.results || data);
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (!options) return <div>Loading...</div>;

  return (
    <div>
      <h2>Compose Message</h2>

      <form onSubmit={submit}>
        {options.audience_types.length > 1 && (
          <div>
            <label>Audience</label>
            <select
              value={form.audience_type}
              onChange={(e) => setForm({ ...form, audience_type: e.target.value, filters: {} })}
            >
              {options.audience_types.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        {form.audience_type === "class" && (
          <div>
            <label>Class</label>
            <select
              onChange={(e) => setForm({ ...form, filters: { lecturer_allocation: e.target.value } })}
              required
            >
              <option value="">-- Select a class you teach --</option>
              {(options.allocations || []).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>

        <div>
          <label>Message</label>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </div>

        <div>
          <label>Channels</label>
          {["erp", "email", "sms"].map((c) => (
            <label key={c}>
              <input type="checkbox" checked={form.channels.includes(c)} onChange={() => toggleChannel(c)} />
              {c.toUpperCase()}
            </label>
          ))}
        </div>

        <button type="submit" disabled={sending}>{sending ? "Sending..." : "Send"}</button>
        {feedback && <div>{feedback}</div>}
      </form>

      <h3>Messages I've Sent</h3>
      <ul>
        {history.map((msg) => (
          <li key={msg.id}>{msg.title} &mdash; {msg.recipient_count} recipients &mdash; {msg.status}</li>
        ))}
      </ul>
    </div>
  );
}