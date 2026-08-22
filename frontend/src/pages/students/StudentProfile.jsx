import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { studentsApi } from "../../services/api";
import defaultProfile from "../../assets/default-profile.jpg";

export default function StudentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("personal");

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

  // Get profile picture URL
  const getProfilePicture = () => {
    if (user?.profile_picture) {
      return user.profile_picture;
    }
    return defaultProfile;
  };

  // Get status badge color
  const getStatusBadge = (status) => {
    const statusMap = {
      active: "success",
      deferred: "warning",
      graduated: "info",
      suspended: "danger",
      discontinued: "danger",
      expelled: "danger",
    };
    return statusMap[status?.toLowerCase()] || "gray";
  };

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

      {/* Profile Content - 4x8 Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "4fr 8fr", gap: 24 }}>
        {/* Left Column - 4fr (Profile Card) */}
        <div className="mu-card" style={{ height: "fit-content" }}>
          <div className="mu-card-body" style={{ textAlign: "center" }}>
            <img 
              src={getProfilePicture()} 
              alt={`${user.first_name} ${user.last_name}`}
              style={{ 
                width: 150, 
                height: 150, 
                borderRadius: "50%", 
                objectFit: "cover",
                border: "4px solid var(--mu-primary-100)",
                marginBottom: 16,
              }}
              onError={(e) => {
                e.target.src = defaultProfile;
              }}
            />
            <h3 style={{ margin: 0 }}>{user.first_name} {user.last_name}</h3>
            <div className="mu-profile-role" style={{ color: "var(--mu-gray-500)", fontSize: "var(--mu-font-size-sm)" }}>
              {user.user_type?.replace("_", " ")}
            </div>
            <div style={{ marginTop: 8 }}>
              <span className={`mu-badge mu-badge-${getStatusBadge(profile?.status)}`}>
                {profile?.status || "Active"}
              </span>
            </div>
            <hr style={{ margin: "16px 0" }} />
            <div style={{ textAlign: "left", fontSize: "var(--mu-font-size-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Registration</span>
                <span style={{ fontWeight: 500 }}>{profile?.registration_number || user.username}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Programme</span>
                <span style={{ fontWeight: 500 }}>{profile?.programme_detail?.code || "N/A"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Year</span>
                <span style={{ fontWeight: 500 }}>{profile?.current_year || 1}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--mu-gray-500)" }}>Semester</span>
                <span style={{ fontWeight: 500 }}>{profile?.current_semester || 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - 8fr (Tabs Content) */}
        <div className="mu-card">
          <div className="mu-card-body">
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--mu-border)", marginBottom: 20, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setActiveTab("personal")}
                style={{
                  border: "none",
                  borderBottom: activeTab === "personal" ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
                  borderRadius: 0,
                  background: "transparent",
                  padding: "10px 16px",
                  cursor: "pointer",
                  color: activeTab === "personal" ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
                  fontWeight: activeTab === "personal" ? 600 : 400,
                  fontSize: "var(--mu-font-size-sm)",
                  transition: "all var(--mu-transition-fast)",
                }}
              >
                <i className="bi bi-person" style={{ marginRight: 6 }} />
                Personal Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("academic")}
                style={{
                  border: "none",
                  borderBottom: activeTab === "academic" ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
                  borderRadius: 0,
                  background: "transparent",
                  padding: "10px 16px",
                  cursor: "pointer",
                  color: activeTab === "academic" ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
                  fontWeight: activeTab === "academic" ? 600 : 400,
                  fontSize: "var(--mu-font-size-sm)",
                  transition: "all var(--mu-transition-fast)",
                }}
              >
                <i className="bi bi-mortarboard" style={{ marginRight: 6 }} />
                Academic Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("contact")}
                style={{
                  border: "none",
                  borderBottom: activeTab === "contact" ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
                  borderRadius: 0,
                  background: "transparent",
                  padding: "10px 16px",
                  cursor: "pointer",
                  color: activeTab === "contact" ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
                  fontWeight: activeTab === "contact" ? 600 : 400,
                  fontSize: "var(--mu-font-size-sm)",
                  transition: "all var(--mu-transition-fast)",
                }}
              >
                <i className="bi bi-envelope" style={{ marginRight: 6 }} />
                Contact Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("guardian")}
                style={{
                  border: "none",
                  borderBottom: activeTab === "guardian" ? "2px solid var(--mu-primary-500)" : "2px solid transparent",
                  borderRadius: 0,
                  background: "transparent",
                  padding: "10px 16px",
                  cursor: "pointer",
                  color: activeTab === "guardian" ? "var(--mu-primary-500)" : "var(--mu-gray-500)",
                  fontWeight: activeTab === "guardian" ? 600 : 400,
                  fontSize: "var(--mu-font-size-sm)",
                  transition: "all var(--mu-transition-fast)",
                }}
              >
                <i className="bi bi-people" style={{ marginRight: 6 }} />
                Guardian Info
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ minHeight: 300 }}>
              {/* Personal Info Tab */}
              {activeTab === "personal" && (
                <div>
                  <div className="mu-dashboard-grid-2" style={{ gap: 16 }}>
                    <div className="mu-form-group">
                      <label>First Name</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {user.first_name || "N/A"}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Last Name</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {user.last_name || "N/A"}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Gender</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {user.gender || "N/A"}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Date of Birth</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {user.date_of_birth || "N/A"}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>National ID</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {user.national_id || "N/A"}
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
              )}

              {/* Academic Info Tab */}
              {activeTab === "academic" && (
                <div>
                  <div className="mu-dashboard-grid-2" style={{ gap: 16 }}>
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
                      <label>Current Year</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.current_year || 1}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Current Semester</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.current_semester || 1}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>CGPA</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.cumulative_gpa || "N/A"}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Total Credit Hours</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.total_credit_hours_earned || 0}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Admission Date</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.admission_date || "N/A"}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Expected Graduation</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.expected_graduation_date || "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Details Tab */}
              {activeTab === "contact" && (
                <div>
                  <div className="mu-dashboard-grid-2" style={{ gap: 16 }}>
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
                    <div className="mu-form-group" style={{ gridColumn: "span 2" }}>
                      <label>Address</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {user.address || "Not set"}
                      </div>
                    </div>
                    <div className="mu-form-group" style={{ gridColumn: "span 2" }}>
                      <label>Emergency Contact</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.emergency_contact || "Not set"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Guardian Info Tab */}
              {activeTab === "guardian" && (
                <div>
                  <div className="mu-dashboard-grid-2" style={{ gap: 16 }}>
                    <div className="mu-form-group" style={{ gridColumn: "span 2" }}>
                      <label>Guardian Name</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.guardian_name || "Not set"}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Guardian Phone</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.guardian_phone || "Not set"}
                      </div>
                    </div>
                    <div className="mu-form-group">
                      <label>Relationship</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.guardian_relationship || "Not set"}
                      </div>
                    </div>
                    <div className="mu-form-group" style={{ gridColumn: "span 2" }}>
                      <label>Guardian Email</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.guardian_email || "Not set"}
                      </div>
                    </div>
                    <div className="mu-form-group" style={{ gridColumn: "span 2" }}>
                      <label>Guardian Address</label>
                      <div className="mu-input" style={{ background: "var(--mu-gray-50)" }}>
                        {profile?.guardian_address || "Not set"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}