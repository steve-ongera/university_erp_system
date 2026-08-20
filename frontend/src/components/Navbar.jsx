import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || user.username[0].toUpperCase()
    : "?";

  const fullName = user ? `${user.first_name} ${user.last_name}` : "Guest";
  const userRole = user?.user_type?.replace("_", " ") || "";

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
  };

  const handleProfile = () => {
    setUserMenuOpen(false);
    navigate("/me/profile");
  };

  // Sample notifications - replace with real data from API
  const notifications = [
    { id: 1, title: "Grade Published", text: "Your CAT 2 results for BSC 101 are now available.", time: "2 min ago", unread: true },
    { id: 2, title: "Fee Reminder", text: "Semester fees are due by October 15th.", time: "1 hour ago", unread: true },
    { id: 3, title: "Hostel Booking", text: "Your hostel booking has been confirmed.", time: "3 hours ago", unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="mu-navbar">
      {/* Left Section */}
      <div className="mu-navbar-left">
        <button 
          className="mu-navbar-toggle" 
          onClick={onToggleSidebar} 
          aria-label="Toggle menu"
        >
          <i className="bi bi-list" />
        </button>
        
        <div className="mu-navbar-brand">
          <i className="bi bi-mortarboard-fill" />
          <span>Muranga Portal</span>
        </div>

        {/* Search Bar */}
        <div className="mu-search-bar">
          <i className="bi bi-search" />
          <input 
            type="text" 
            placeholder="Search students, courses, units..." 
            aria-label="Search"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="mu-navbar-actions">
        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button 
            className="mu-navbar-action-btn" 
            aria-label="Notifications"
            onClick={() => setNotifOpen(!notifOpen)}
          >
            <i className="bi bi-bell" />
            {unreadCount > 0 && (
              <span className="mu-badge-count">{unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="mu-notifications-dropdown">
              <div className="mu-notifications-header">
                <h4>Notifications</h4>
                <button className="mu-mark-all">Mark all as read</button>
              </div>
              <div>
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`mu-notification-item ${notif.unread ? "unread" : ""}`}
                  >
                    <div className="mu-notif-icon">
                      <i className="bi bi-bell" />
                    </div>
                    <div className="mu-notif-content">
                      <div className="mu-notif-title">{notif.title}</div>
                      <div className="mu-notif-text">{notif.text}</div>
                      <div className="mu-notif-time">{notif.time}</div>
                    </div>
                    {notif.unread && <div className="mu-notif-dot" />}
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="mu-notifications-empty">
                    <i className="bi bi-inbox" />
                    <span>No notifications</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <button className="mu-navbar-action-btn" aria-label="Messages">
          <i className="bi bi-envelope" />
        </button>

        {/* User Menu */}
        <div ref={userMenuRef} style={{ position: "relative" }}>
          <div 
            className={`mu-user-chip ${userMenuOpen ? "open" : ""}`} 
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <div className="mu-avatar">{initials}</div>
            <div className="mu-user-text">
              <div className="mu-user-name">{fullName}</div>
              <div className="mu-user-role">{userRole}</div>
            </div>
            <i className="bi bi-chevron-down" />
          </div>

          {userMenuOpen && (
            <div className="mu-dropdown-menu">
              <button className="mu-dropdown-item" onClick={handleProfile}>
                <i className="bi bi-person" />
                My Profile
              </button>
              <button className="mu-dropdown-item">
                <i className="bi bi-gear" />
                Settings
              </button>
              <button className="mu-dropdown-item">
                <i className="bi bi-shield-lock" />
                Security
              </button>
              <div className="mu-dropdown-divider" />
              <button className="mu-dropdown-item danger" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}