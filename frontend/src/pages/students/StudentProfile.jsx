import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { studentsApi } from "../../services/api";

export default function StudentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await studentsApi.myProfile();
        setProfile(data);
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="mu-loader">
        <i className="bi bi-arrow-repeat mu-animate-spin" />
        <span>Loading profile...</span>
      </div>
    );
  }

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || user.username[0].toUpperCase()
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
            Home <span className="separator">/</span> Profile
          </div>
        </div>
        <div className="mu-page-header-actions">
          <button className="mu-btn mu-btn-outline">
            <i className="bi bi-pencil" />
            Edit Profile
          </button>
        </div>
      </div>

      {/* Profile Content */}
      <div className="mu-profile-header">
        <div className="mu-profile-avatar">{initials}</div>
        <div className="mu-profile-info">
          <h2>{user.first_name} {user.last_name}</h2>
          <div className="mu-profile-role">{user.user_type?.replace("_", " ")}</div>
          <div className="mu-profile-details">
            <span>
              <strong>Registration:</strong> {profile?.registration_number || user.username}
            </span>
            <span>
              <strong>Email:</strong> {user.email || "Not set"}
            </span>
            <span>
              <strong>Phone:</strong> {user.phone || "Not set"}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Stats Cards */}
      <div className="mu-dashboard-grid" style={{ marginTop: 24 }}>
        <div className="mu-stat-card">
          <div className="mu-stat-icon blue">
            <i className="bi bi-journal-bookmark" />
          </div>
          <div className="mu-stat-label">Current Year</div>
          <div className="mu-stat-value">{profile?.current_year || 1}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon gold">
            <i className="bi bi-calendar" />
          </div>
          <div className="mu-stat-label">Current Semester</div>
          <div className="mu-stat-value">{profile?.current_semester || 1}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon green">
            <i className="bi bi-award" />
          </div>
          <div className="mu-stat-label">CGPA</div>
          <div className="mu-stat-value">{profile?.cumulative_gpa || "N/A"}</div>
        </div>
        <div className="mu-stat-card">
          <div className="mu-stat-icon red">
            <i className="bi bi-mortarboard" />
          </div>
          <div className="mu-stat-label">Status</div>
          <div className="mu-stat-value">
            <span className="mu-badge mu-badge-success">{profile?.status || "Active"}</span>
          </div>
        </div>
      </div>

      {/* Profile Info Cards */}
      <div className="mu-dashboard-grid-2" style={{ marginTop: 24 }}>
        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Personal Information</h4>
          </div>
          <div className="mu-card-body">
            <div className="mu-form-group">
              <label>Full Name</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {user.first_name} {user.last_name}
              </div>
            </div>
            <div className="mu-form-group">
              <label>Email Address</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {user.email || "Not set"}
              </div>
            </div>
            <div className="mu-form-group">
              <label>Phone Number</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {user.phone || "Not set"}
              </div>
            </div>
          </div>
        </div>

        <div className="mu-card">
          <div className="mu-card-header">
            <h4>Academic Information</h4>
          </div>
          <div className="mu-card-body">
            <div className="mu-form-group">
              <label>Programme</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {profile?.programme_detail?.name || "Not assigned"}
              </div>
            </div>
            <div className="mu-form-group">
              <label>Registration Number</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {profile?.registration_number || user.username}
              </div>
            </div>
            <div className="mu-form-group">
              <label>Sponsor Type</label>
              <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                {profile?.sponsor_type?.replace("_", " ") || "Self Sponsored"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}