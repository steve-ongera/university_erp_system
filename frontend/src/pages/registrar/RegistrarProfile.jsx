import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { registrarApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function RegistrarProfile() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    registrarApi
      .profile()
      .then((res) => setForm(res.data))
      .catch(() => setError("Could not load your profile."));
  }, []);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { first_name, last_name, email, phone, gender } = form;
      const res = await registrarApi.updateProfile({ first_name, last_name, email, phone, gender });
      setForm(res.data);
      setMessage("Profile updated successfully.");
    } catch {
      setError("Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <LoadingSpinner text={error || "Loading profile..."} />;
  }

  // Get user initials for avatar
  const initials = form
    ? `${form.first_name?.[0] ?? ""}${form.last_name?.[0] ?? ""}`.toUpperCase() || form.username[0].toUpperCase()
    : "?";

  return (
    <div>
      {/* Page Header */}
      <div className="mu-page-header">
        <div>
          <h1>
            <i className="bi bi-person" />
            My Profile
          </h1>
          <div className="mu-breadcrumb">
            Home <span className="separator">/</span> Registrar <span className="separator">/</span> Profile
          </div>
        </div>
        
      </div>

      {/* Alerts */}
      {message && (
        <div className="mu-alert mu-alert-success">
          <i className="bi bi-check-circle" />
          {message}
        </div>
      )}
      {error && (
        <div className="mu-alert mu-alert-danger">
          <i className="bi bi-exclamation-triangle" />
          {error}
        </div>
      )}

      {/* Profile Content - 4x8 Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "4fr 8fr", gap: 24 }}>
        {/* Left Column - 4fr (Profile Card) */}
        <div className="mu-card" style={{ height: "fit-content" }}>
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <div 
              className="mu-profile-avatar" 
              style={{ 
                width: 120, 
                height: 120, 
                borderRadius: "50%", 
                background: "var(--mu-primary-500)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.5rem",
                fontWeight: 700,
                margin: "0 auto 16px",
              }}
            >
              {initials}
            </div>
            <h3 style={{ margin: 0 }}>
              {form.first_name} {form.last_name}
            </h3>
            <div className="mu-profile-role" style={{ color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)", textTransform: "capitalize" }}>
              {form.user_type?.replace("_", " ") || "Registrar"}
            </div>
            <hr style={{ margin: "16px 0" }} />
            <div style={{ textAlign: "left", fontSize: "var(--mu-font-size-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Username</span>
                <span style={{ fontWeight: 500 }}>{form.username}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Email</span>
                <span style={{ fontWeight: 500 }}>{form.email || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Phone</span>
                <span style={{ fontWeight: 500 }}>{form.phone || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Gender</span>
                <span style={{ fontWeight: 500 }}>{form.gender || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Role</span>
                <span style={{ fontWeight: 500 }}>{form.user_type?.replace("_", " ") || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - 8fr (Edit Form) */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-pencil-square" style={{ marginRight: 8 }} />
              Edit Profile
            </h4>
          </div>
          <div className="mu-card-body">
            <form onSubmit={handleSave}>
              <div className="mu-form-group">
                <label>Username</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {form.username}
                </div>
              </div>

              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="mu-input"
                    value={form.first_name || ""}
                    onChange={handleChange("first_name")}
                  />
                </div>
                <div className="mu-form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="mu-input"
                    value={form.last_name || ""}
                    onChange={handleChange("last_name")}
                  />
                </div>
              </div>

              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="mu-input"
                    value={form.email || ""}
                    onChange={handleChange("email")}
                  />
                </div>
                <div className="mu-form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    className="mu-input"
                    value={form.phone || ""}
                    onChange={handleChange("phone")}
                  />
                </div>
              </div>

              <div className="mu-form-group">
                <label>Gender</label>
                <select 
                  className="mu-select" 
                  value={form.gender || ""} 
                  onChange={handleChange("gender")}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mu-modal-footer" style={{ padding: "16px 0 0 0" }}>
                <button type="submit" className="mu-btn mu-btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <i className="bi bi-arrow-repeat mu-animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}