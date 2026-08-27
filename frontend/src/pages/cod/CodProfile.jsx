import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

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
      setSuccess("Profile updated successfully.");
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

  if (loading) {
    return <LoadingSpinner text="Loading profile..." />;
  }

  // Get user initials for avatar
  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || profile.username[0].toUpperCase()
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
            Home <span className="separator">/</span> COD <span className="separator">/</span> Profile
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/cod/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
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
              {profile?.first_name} {profile?.last_name}
            </h3>
            <div className="mu-profile-role" style={{ color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)", textTransform: "capitalize" }}>
              {profile?.user_type?.replace("_", " ") || "COD"}
            </div>
            <hr style={{ margin: "16px 0" }} />
            <div style={{ textAlign: "left", fontSize: "var(--mu-font-size-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Username</span>
                <span style={{ fontWeight: 500 }}>{profile?.username}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Email</span>
                <span style={{ fontWeight: 500 }}>{profile?.email || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Phone</span>
                <span style={{ fontWeight: 500 }}>{profile?.phone || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Gender</span>
                <span style={{ fontWeight: 500 }}>{profile?.gender || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Role</span>
                <span style={{ fontWeight: 500 }}>{profile?.user_type?.replace("_", " ") || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - 8fr (Edit Form) */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              
              Edit Profile
            </h4>
          </div>
          <div className="mu-card-body">
            <form onSubmit={handleSubmit}>
              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="mu-input"
                    value={form.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    required
                  />
                </div>
                <div className="mu-form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="mu-input"
                    value={form.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="mu-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="mu-input"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
                <div className="mu-form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    className="mu-input"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="mu-form-group">
                <label>Gender</label>
                <select 
                  className="mu-select" 
                  value={form.gender} 
                  onChange={(e) => handleChange("gender", e.target.value)}
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