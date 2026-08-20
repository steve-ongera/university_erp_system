import { useAuth, ROLES } from "../context/AuthContext";

/**
 * A single Dashboard component whose CONTENT is generated from the
 * logged-in user's role, rather than one hard-coded page per role.
 * Add a case here whenever a role needs bespoke summary widgets.
 */
export default function RoleDashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const widgets = getWidgetsForRole(user.user_type);

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Welcome back, {user.first_name}</h2>
      <p style={{ color: "var(--mu-text-muted)", marginTop: 0 }}>
        Here's what's happening on your {roleLabel(user.user_type)} account today.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 20 }}>
        {widgets.map((w) => (
          <div className="mu-card mu-stat-card" key={w.label}>
            <div className="mu-stat-label">
              <i className={`bi ${w.icon}`} style={{ marginRight: 6 }} />
              {w.label}
            </div>
            <div className="mu-stat-value">{w.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function roleLabel(type) {
  return type.replace("_", " ");
}

function getWidgetsForRole(role) {
  switch (role) {
    case ROLES.STUDENT:
      return [
        { label: "Units this semester", value: "—", icon: "bi-journal-bookmark" },
        { label: "Fee balance", value: "—", icon: "bi-cash-coin" },
        { label: "Pending CATs", value: "—", icon: "bi-pencil-square" },
        { label: "Hostel status", value: "—", icon: "bi-building" },
      ];
    case ROLES.LECTURER:
      return [
        { label: "Allocated units", value: "—", icon: "bi-journal-bookmark" },
        { label: "CATs to grade", value: "—", icon: "bi-check2-circle" },
        { label: "Students taught", value: "—", icon: "bi-people" },
      ];
    case ROLES.FINANCE:
      return [
        { label: "Payments today", value: "—", icon: "bi-bank" },
        { label: "Unreconciled", value: "—", icon: "bi-exclamation-triangle" },
        { label: "HELB awards pending", value: "—", icon: "bi-piggy-bank" },
      ];
    case ROLES.HOSTEL_WARDEN:
      return [
        { label: "Beds available", value: "—", icon: "bi-door-open" },
        { label: "Pending bookings", value: "—", icon: "bi-hourglass-split" },
      ];
    default:
      return [
        { label: "Active students", value: "—", icon: "bi-people" },
        { label: "Pending deferments", value: "—", icon: "bi-pause-circle" },
        { label: "Pending clearances", value: "—", icon: "bi-file-earmark-check" },
        { label: "Open supplementary units", value: "—", icon: "bi-arrow-repeat" },
      ];
  }
}
