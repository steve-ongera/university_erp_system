import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || user.username[0].toUpperCase()
    : "?";

  return (
    <header className="mu-navbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button className="mu-icon-btn d-lg-none" onClick={onToggleSidebar} aria-label="Toggle menu">
          <i className="bi bi-list" />
        </button>
        <div className="mu-brand d-lg-none">
          <i className="bi bi-mortarboard-fill" />
          <span>Muranga Portal</span>
        </div>
      </div>

      <div className="mu-navbar-actions">
        <button className="mu-icon-btn" aria-label="Notifications">
          <i className="bi bi-bell" />
          <span className="mu-badge-dot" />
        </button>

        <div className="mu-user-chip" onClick={() => setMenuOpen((v) => !v)}>
          <div className="mu-avatar">{initials}</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              {user ? `${user.first_name} ${user.last_name}` : "Guest"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--mu-text-muted)", textTransform: "capitalize" }}>
              {user?.user_type?.replace("_", " ")}
            </div>
          </div>
          <i className="bi bi-chevron-down" style={{ fontSize: "0.7rem" }} />
        </div>

        {menuOpen && (
          <div className="mu-card" style={{ position: "absolute", top: 56, right: 20, padding: 8, minWidth: 180 }}>
            <div className="mu-nav-link" style={{ color: "var(--mu-text)" }}>
              <i className="bi bi-person" /> My profile
            </div>
            <div className="mu-nav-link" style={{ color: "var(--mu-text)" }}>
              <i className="bi bi-gear" /> Settings
            </div>
            <div className="mu-nav-link" style={{ color: "var(--mu-danger)" }} onClick={logout}>
              <i className="bi bi-box-arrow-right" /> Sign out
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
