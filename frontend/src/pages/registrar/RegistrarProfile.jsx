import { useAuth } from "../../context/AuthContext";

export default function RegistrarProfile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="mu-page">
      <h2>My Profile</h2>
      <div className="mu-card">
        <div className="mu-profile-row">
          <span className="mu-profile-label">Full Name</span>
          <span>{user.first_name} {user.last_name}</span>
        </div>
        <div className="mu-profile-row">
          <span className="mu-profile-label">Employee Number</span>
          <span>{user.username}</span>
        </div>
        <div className="mu-profile-row">
          <span className="mu-profile-label">Role</span>
          <span>Registrar</span>
        </div>
        <div className="mu-profile-row">
          <span className="mu-profile-label">Email</span>
          <span>{user.email || "—"}</span>
        </div>
        <div className="mu-profile-row">
          <span className="mu-profile-label">Phone</span>
          <span>{user.phone || "—"}</span>
        </div>
        <div className="mu-profile-row">
          <span className="mu-profile-label">Gender</span>
          <span>{user.gender || "—"}</span>
        </div>
      </div>
    </div>
  );
}