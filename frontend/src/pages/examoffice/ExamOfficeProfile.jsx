import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { examOfficeApi } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function ExamOfficeProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    examOfficeApi
      .profile()
      .then((res) => setProfile(res.data))
      .catch(() => setError("Could not load profile."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading profile..." />;
  }

  if (error) {
    return (
      <div className="mu-alert mu-alert-danger">
        <i className="bi bi-exclamation-triangle" />
        {error}
      </div>
    );
  }

  const data = profile || user;
  if (!data) return null;

  // Get user initials for avatar
  const initials = data
    ? `${data.first_name?.[0] ?? ""}${data.last_name?.[0] ?? ""}`.toUpperCase() || data.username?.[0]?.toUpperCase() || "?"
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
            Home <span className="separator">/</span> Exam Office <span className="separator">/</span> Profile
          </div>
        </div>
        <div className="mu-page-header-actions">
          <Link to="/exam-office/dashboard" className="mu-btn mu-btn-outline-primary">
            <i className="bi bi-arrow-left" />
            Back to Dashboard
          </Link>
        </div>
      </div>

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
              {data.first_name} {data.last_name}
            </h3>
            <div className="mu-profile-role" style={{ color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)", textTransform: "capitalize" }}>
              Examinations Office
            </div>
            <hr style={{ margin: "16px 0" }} />
            <div style={{ textAlign: "left", fontSize: "var(--mu-font-size-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Employee Number</span>
                <span style={{ fontWeight: 500 }}>{data.username}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Email</span>
                <span style={{ fontWeight: 500 }}>{data.email || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Phone</span>
                <span style={{ fontWeight: 500 }}>{data.phone || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Gender</span>
                <span style={{ fontWeight: 500 }}>{data.gender || "Not set"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Role</span>
                <span style={{ fontWeight: 500 }}>Examinations Office</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - 8fr (Profile Details) */}
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>
              <i className="bi bi-info-circle" style={{ marginRight: 8 }} />
              Profile Details
            </h4>
          </div>
          <div className="mu-card-body">
            <div className="mu-form-group">
              <label>Full Name</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {data.first_name} {data.last_name}
              </div>
            </div>

            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Employee Number</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {data.username}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Role</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  <span className="mu-badge mu-badge-primary">Examinations Office</span>
                </div>
              </div>
            </div>

            <div className="mu-dashboard-grid-2" style={{ gap: 12, marginBottom: 0 }}>
              <div className="mu-form-group">
                <label>Email</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {data.email || "Not set"}
                </div>
              </div>
              <div className="mu-form-group">
                <label>Phone</label>
                <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                  {data.phone || "Not set"}
                </div>
              </div>
            </div>

            <div className="mu-form-group">
              <label>Gender</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {data.gender || "Not set"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}