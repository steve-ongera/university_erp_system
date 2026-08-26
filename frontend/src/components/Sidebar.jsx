import { NavLink } from "react-router-dom";
import { useAuth, ROLES } from "../context/AuthContext";
import muLogo from "../assets/mut_logo.png"; // Adjust path as needed

/**
 * One nav tree per role. Keys are route paths (see App.jsx), so adding a
 * page is: add the route in App.jsx, then add its entry here for every
 * role that should see it. Icons are Bootstrap Icons class names.
 */
const NAV_BY_ROLE = {
  [ROLES.STUDENT]: [
    { section: "Overview", links: [{ to: "/student/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Academics",
      links: [
        { to: "/units", label: "My Units", icon: "bi-journal-bookmark" },
        { to: "/cats", label: "CATs", icon: "bi-pencil-square" },
        { to: "/grades", label: "Results & Transcript", icon: "bi-award" },
        { to: "/supplementary", label: "Supplementary", icon: "bi-arrow-repeat" },
        { to: "/timetable", label: "Timetable", icon: "bi-calendar3" },
      ],
    },
    {
      section: "Campus Life",
      links: [
        { to: "/fees", label: "Fees & Payments", icon: "bi-cash-coin" },
        { to: "/hostel", label: "Hostel Booking", icon: "bi-building" },
        { to: "/reporting", label: "Reporting", icon: "bi-check2-square" },
        { to: "/clearance", label: "Clearance", icon: "bi-file-earmark-check" },
        { to: "/deferment", label: "Deferment", icon: "bi-pause-circle" },
      ],
    },
  ],
  [ROLES.LECTURER]: [
    { section: "Overview", links: [{ to: "/lecturer/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Teaching",
      links: [
        { to: "/my-units", label: "My Allocated Units", icon: "bi-journal-bookmark" },
        { to: "/cats", label: "CATs & Assignments", icon: "bi-pencil-square" },
        { to: "/grading", label: "Enter Marks", icon: "bi-check2-circle" },
        { to: "/attendance", label: "Attendance (QR)", icon: "bi-qr-code" },
      ],
    },
  ],
  [ROLES.HOSTEL_WARDEN]: [
    { section: "Overview", links: [{ to: "/hostel/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Hostel",
      links: [
        { to: "/hostel-management", label: "Hostels & Rooms", icon: "bi-building" },
        { to: "/hostel-bookings", label: "Bookings", icon: "bi-door-open" },
      ],
    },
  ],
  [ROLES.FINANCE]: [
    { section: "Overview", links: [{ to: "/finance/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Finance",
      links: [
        { to: "/fee-structures", label: "Fee Structures", icon: "bi-receipt" },
        { to: "/payments", label: "Payments & Reconciliation", icon: "bi-bank" },
        { to: "/fee-payments", label: "All Fee Payments & Receipts", icon: "bi-receipt-cutoff" }, 
        { to: "/awards", label: "HELB & Bursaries", icon: "bi-piggy-bank" },
      ],
    },
  ],
  DEFAULT_ADMIN: [
    { section: "Overview", links: [{ to: "/admin/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Academic Structure",
      links: [
        { to: "/faculties", label: "Faculties & Depts", icon: "bi-diagram-3" },
        { to: "/programmes", label: "Programmes", icon: "bi-mortarboard" },
        { to: "/courses", label: "Courses & Curriculum", icon: "bi-journal-code" },
        { to: "/calendar", label: "Academic Years / Intakes", icon: "bi-calendar3" },
      ],
    },
    {
      section: "People",
      links: [
        { to: "/students", label: "Students", icon: "bi-people" },
        { to: "/lecturers", label: "Lecturers & Staff", icon: "bi-person-badge" },
        { to: "/deferments", label: "Deferments", icon: "bi-pause-circle" },
        { to: "/user-management", label: "User Management", icon: "bi-person-gear" },
      ],
    },
    {
      section: "Operations",
      links: [
        { to: "/resultsmanagement" , label:'Results Manager' , icon:"bi bi-arrow-bar-up"},
        { to: "/unitallocations" , label: "Unit Allocation" , icon:"bi bi-arrow-right"},
        { to: "/timetable-builder", label: "Timetable Builder", icon: "bi-calendar2-week" },
        { to: "/reportings", label: "Semester Reportings", icon: "bi-check2-square" },
        { to: "/fee-payments", label: "Fee Payments", icon: "bi-receipt-cutoff" },
        { to: "/grading-schemes", label: "Grading Schemes", icon: "bi-clipboard-data" },
        { to: "/promotions", label: "Promotions", icon: "bi-arrow-up-circle" },
        { to: "/examinations", label: "Examinations", icon: "bi-clipboard-check" },
        { to: "/clearances", label: "Clearances", icon: "bi-file-earmark-check" },
        { to: "/reports", label: "Reports", icon: "bi-bar-chart" },
        {to: "/security-audits", label: "Security Audits" , icon: "bi bi-shield"},
      ],
    },
  ],
};

// Roles that reuse the generic admin-style menu (each still sees only what
// their backend permissions allow when they hit the API).
const ADMIN_LIKE = [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.DEAN, ROLES.COD, ROLES.EXAM_OFFICE, ROLES.STAFF];

export default function Sidebar({ mobileOpen, onClose }) {
  const { user } = useAuth();
  if (!user) return null;

  const sections = ADMIN_LIKE.includes(user.user_type)
    ? NAV_BY_ROLE.DEFAULT_ADMIN
    : NAV_BY_ROLE[user.user_type] || [];

  // Get user initials for avatar
  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || user.username[0].toUpperCase()
    : "?";

  // Format role for display
  const displayRole = user.user_type?.replace(/_/g, " ") || "";

  // Full name for display
  const fullName = user ? `${user.first_name} ${user.last_name}` : user?.username || "User";

  return (
    <>
      <aside className={`mu-sidebar ${mobileOpen ? "mu-sidebar-open" : ""}`}>
        {/* Sidebar Header */}
        <div className="mu-sidebar-header">
          {muLogo ? (
            <img 
              src={muLogo} 
              alt="Muranga University" 
              className="mu-sidebar-logo"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.querySelector('.mu-logo-fallback').style.display = 'flex';
              }}
            />
          ) : null}
          <div className="mu-logo-fallback" style={{ display: muLogo ? 'none' : 'flex' }}>
            <i className="bi bi-mortarboard-fill" style={{ fontSize: '1.5rem', color: '#ffffff' }} />
          </div>
          <div>
            <div className="mu-brand-text">Muranga Portal</div>
            <div className="mu-brand-sub">University ERP</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mu-sidebar-nav">
          {sections.map((section) => (
            <div key={section.section}>
              <div className="mu-nav-section-label">{section.section}</div>
              {section.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) => `mu-nav-link${isActive ? " active" : ""}`}
                >
                  <i className={`bi ${link.icon}`} />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="mu-sidebar-footer">

          {/* Copyright Section */}
          <div className="mu-footer-copyright">
            <i className="bi bi-c-circle" />
            <span>2026 InnovationHub Software Ltd</span>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="mu-sidebar-overlay active" onClick={onClose} />
      )}
    </>
  );
}