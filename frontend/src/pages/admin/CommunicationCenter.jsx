// Adjust the import path below to wherever your api.js actually lives.
import { useEffect, useState } from "react";
import { communicationApi } from "../../services/api";

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

  useEffect(() => {
    loadOptions();
    loadMessages();
  }, []);

  const loadOptions = async () => {
    const { data } = await communicationApi.audienceOptions();
    setOptions(data);
  };

  const loadMessages = async () => {
    const { data } = await communicationApi.sentMessages();
    setMessages(data.results || data);
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
      setFeedback("Message sent.");
      setForm(EMPTY_FORM);
      loadMessages();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (!options) return <div>Loading...</div>;

  return (
    <div>
      <h2>Communication Center</h2>

      <form onSubmit={submit}>
        <div>
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>

        <div>
          <label>Message</label>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </div>

        <div>
          <label>Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="announcement">Announcement</option>
            <option value="alert">Alert</option>
            <option value="reminder">Reminder</option>
            <option value="meeting">Meeting Notice</option>
          </select>
        </div>

        <div>
          <label>Audience</label>
          <select
            value={form.audience_type}
            onChange={(e) => setForm({ ...form, audience_type: e.target.value, filters: {} })}
          >
            {options.audience_types.map((a) => (
              <option key={a} value={a}>{AUDIENCE_LABELS[a] || a}</option>
            ))}
          </select>
        </div>

        {form.audience_type === "students" && (
          <fieldset>
            <legend>Student filters (leave blank for all)</legend>

            <label>Faculty</label>
            <select onChange={(e) => updateFilter("faculty", e.target.value)}>
              <option value="">-- Any --</option>
              {(options.faculties || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            <label>Department</label>
            <select onChange={(e) => updateFilter("department", e.target.value)}>
              <option value="">-- Any --</option>
              {(options.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <label>Programme</label>
            <select onChange={(e) => updateFilter("programme", e.target.value)}>
              <option value="">-- Any --</option>
              {(options.programmes || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label>Year of Study</label>
            <select onChange={(e) => updateFilter("year", e.target.value)}>
              <option value="">-- Any --</option>
              {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>

            <label>Status</label>
            <select onChange={(e) => updateFilter("status", e.target.value)}>
              <option value="">-- Any --</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </fieldset>
        )}

        {form.audience_type === "lecturers" && (
          <fieldset>
            <legend>Lecturer filters (leave blank for all)</legend>
            <label>Faculty</label>
            <select onChange={(e) => updateFilter("faculty", e.target.value)}>
              <option value="">-- Any --</option>
              {(options.faculties || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <label>Department</label>
            <select onChange={(e) => updateFilter("department", e.target.value)}>
              <option value="">-- Any --</option>
              {(options.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </fieldset>
        )}

        {form.audience_type === "staff" && (
          <fieldset>
            <legend>Staff filters</legend>
            <label>Department</label>
            <select onChange={(e) => updateFilter("department", e.target.value)}>
              <option value="">-- Any --</option>
              {(options.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </fieldset>
        )}

        {form.audience_type === "custom" && (
          <fieldset>
            <legend>Custom recipients</legend>
            <label>Comma-separated User IDs</label>
            <input
              placeholder="e.g. 12,45,88"
              onChange={(e) =>
                updateFilter("user_ids", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))
              }
            />
          </fieldset>
        )}

        <div>
          <label>Audience label (optional, shown in history)</label>
          <input
            value={form.audience_label}
            onChange={(e) => setForm({ ...form, audience_label: e.target.value })}
            placeholder="e.g. BSc Software Engineering - Year 4 - Active Students"
          />
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

        <div>
          <label>Send later (optional)</label>
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
          />
        </div>

        <button type="submit" disabled={sending}>{sending ? "Sending..." : "Send"}</button>
        {feedback && <div>{feedback}</div>}
      </form>

      <h3>Sent History</h3>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Audience</th>
            <th>Channels</th>
            <th>Recipients</th>
            <th>Status</th>
            <th>Sent</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((msg) => (
            <tr key={msg.id}>
              <td>{msg.title}</td>
              <td>{msg.audience_label || AUDIENCE_LABELS[msg.audience_type]}</td>
              <td>{(msg.channels || []).join(", ")}</td>
              <td>{msg.recipient_count}</td>
              <td>{msg.status}</td>
              <td>{msg.sent_at ? new Date(msg.sent_at).toLocaleString() : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}