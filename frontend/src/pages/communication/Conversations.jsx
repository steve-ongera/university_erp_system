// Adjust import paths below to match your project structure.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { communicationApi } from "../../api/api";

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [targets, setTargets] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "", category: "enquiry", target_type: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    communicationApi.conversationTargets().then(({ data }) => setTargets(data));
  }, []);

  const load = async () => {
    const { data } = await communicationApi.conversations();
    setConversations(data.results || data);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (form.target_type === "department") payload.department = targets?.department?.id;
      if (form.target_type === "dean") payload.faculty = targets?.faculty?.id;
      await communicationApi.openConversation(payload);
      setShowForm(false);
      setForm({ subject: "", body: "", category: "enquiry", target_type: "" });
      load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Conversations</h2>
      <button onClick={() => setShowForm((s) => !s)}>
        {showForm ? "Cancel" : "New Enquiry / Complaint"}
      </button>

      {showForm && targets && (
        <form onSubmit={submit}>
          <div>
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="enquiry">General Enquiry</option>
              <option value="complaint">Complaint</option>
              <option value="academic">Academic</option>
              <option value="finance">Finance</option>
              <option value="hostel">Hostel/Accommodation</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label>Send to</label>
            <select
              value={form.target_type}
              onChange={(e) => setForm({ ...form, target_type: e.target.value })}
              required
            >
              <option value="">-- Select --</option>
              {targets.target_types.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {form.target_type === "lecturer" && (
            <div>
              <label>Lecturer</label>
              <select
                onChange={(e) => setForm({ ...form, target_lecturer: e.target.value })}
                required
              >
                <option value="">-- Select a lecturer teaching you --</option>
                {(targets.lecturers || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label>Subject</label>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
          </div>

          <div>
            <label>Message</label>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
          </div>

          <button type="submit" disabled={submitting}>{submitting ? "Sending..." : "Submit"}</button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Category</th>
            <th>Status</th>
            <th>Last update</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((c) => (
            <tr key={c.id}>
              <td><Link to={`/communication/${c.id}`}>{c.subject}</Link></td>
              <td>{c.category}</td>
              <td>{c.status}</td>
              <td>{new Date(c.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}