import { useEffect, useState } from "react";
import { authApi } from "../../services/api";

export default function CodProfile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
  });

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.me();
      setProfile(res.data);
      setForm({
        first_name: res.data.first_name || "",
        last_name: res.data.last_name || "",
        email: res.data.email || "",
        phone: res.data.phone || "",
        gender: res.data.gender || "",
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err.response?.data?.detail || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await authApi.updateMe(form);
      setProfile(res.data);
      setSuccess("Profile updated.");
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data) ||
        "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading profile...</p>;

  return (
    <div>
      <h1>My Profile</h1>

      {error && <p>{error}</p>}
      {success && <p>{success}</p>}

      {profile && (
        <div>
          <p>Username: {profile.username}</p>
          <p>Role: {profile.user_type}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label>First Name</label>
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            required
          />
        </div>

        <div>
          <label>Last Name</label>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            required
          />
        </div>

        <div>
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
        </div>

        <div>
          <label>Phone</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
          />
        </div>

        <div>
          <label>Gender</label>
          <select value={form.gender} onChange={(e) => handleChange("gender", e.target.value)}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}