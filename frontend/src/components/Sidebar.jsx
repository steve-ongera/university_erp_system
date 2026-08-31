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
        { to: "/cats", label: "CATs & Notes", icon: "bi-pencil-square" },
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
        { to: "/library", label: "My Library", icon: "bi-book-half" },
        { to: "/reporting", label: "Reporting", icon: "bi-check2-square" },
        { to: "/clearance", label: "Clearance", icon: "bi-file-earmark-check" },
        { to: "/deferment", label: "Deferment", icon: "bi-pause-circle" },
      ],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/contact-support", label: "Contact Support", icon: "bi-headset" },
      ],
    },
  ],
  [ROLES.LECTURER]: [
    { section: "Overview", links: [{ to: "/lecturer/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Teaching",
      links: [
        { to: "/my-units", label: "My Allocated Units", icon: "bi-journal-bookmark" },
        { to: "/lecturer/cats-notes", label: "CATs & Notes", icon: "bi-pencil-square" },
        { to: "/grading", label: "Enter Marks", icon: "bi-check2-circle" },
        { to: "/attendance", label: "Attendance (QR)", icon: "bi-qr-code" },
      ],
    },
    {
      section: "Campus Life",
      links: [{ to: "/library", label: "My Library", icon: "bi-book-half" }],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
        { to: "/conversations", label: "Conversations", icon: "bi-chat-dots" },
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
        { to: "/hostel-fee-structures", label: "Fee Structure", icon: "bi-cash-stack" },
        { to: "/hostel-reports", label: "Reports", icon: "bi-bar-chart" },
      ],
    },
    {
      section: "Campus Life",
      links: [{ to: "/library", label: "My Library", icon: "bi-book-half" }],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
        { to: "/conversations", label: "Conversations", icon: "bi-chat-dots" },
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
    {
      section: "Campus Life",
      links: [{ to: "/library", label: "My Library", icon: "bi-book-half" }],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
        { to: "/conversations", label: "Conversations", icon: "bi-chat-dots" },
      ],
    },
  ],
  [ROLES.COD]: [
    { section: "Overview", links: [{ to: "/cod/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Department",
      links: [
        { to: "/cod/students", label: "Students", icon: "bi-people" },
        { to: "/cod/enrollments", label: "Enrollments", icon: "bi-clipboard-check" },
        { to: "/cod/reports", label: "Academic Reports", icon: "bi-bar-chart" },
      ],
    },
    {
      section: "Academics",
      links: [
        { to: "/cod/unit-allocations", label: "Unit Allocations", icon: "bi-diagram-3" },
        { to: "/cod/verify-marks", label: "Verify Marks", icon: "bi-patch-check" },
        { to: "/examinations", label: "Examinations", icon: "bi-clipboard-check" },
      ],
    },
    {
      section: "Campus Life",
      links: [{ to: "/library", label: "My Library", icon: "bi-book-half" }],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
        { to: "/conversations", label: "Conversations", icon: "bi-chat-dots" },
      ],
    },
    {
      section: "Account",
      links: [{ to: "/cod/profile", label: "My Profile", icon: "bi-person-circle" }],
    },
  ],
  [ROLES.REGISTRAR]: [
    { section: "Overview", links: [{ to: "/registrar/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Student Records",
      links: [
        { to: "/registrar/students", label: "Students", icon: "bi-people" },
        { to: "/registrar/deferments", label: "Deferments", icon: "bi-pause-circle" },
        { to: "/registrar/clearances", label: "Clearances", icon: "bi-file-earmark-check" },
      ],
    },
    {
      section: "Campus Life",
      links: [{ to: "/library", label: "My Library", icon: "bi-book-half" }],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
        { to: "/conversations", label: "Conversations", icon: "bi-chat-dots" },
      ],
    },
    {
      section: "Account",
      links: [{ to: "/registrar/profile", label: "My Profile", icon: "bi-person-circle" }],
    },
  ],
  [ROLES.DEAN]: [
    { section: "Overview", links: [{ to: "/dean/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Faculty",
      links: [
        { to: "/dean/departments", label: "Departments", icon: "bi-diagram-3" },
        { to: "/dean/lecturers", label: "Lecturers", icon: "bi-person-video3" },
        { to: "/dean/clearances", label: "Clearances", icon: "bi-file-earmark-check" },
      ],
    },
    {
      section: "Campus Life",
      links: [{ to: "/library", label: "My Library", icon: "bi-book-half" }],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
        { to: "/conversations", label: "Conversations", icon: "bi-chat-dots" },
      ],
    },
    {
      section: "Account",
      links: [{ to: "/dean/profile", label: "My Profile", icon: "bi-person-circle" }],
    },
  ],
  [ROLES.EXAM_OFFICE]: [
    { section: "Overview", links: [{ to: "/exam-office/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Examinations",
      links: [
        { to: "/exam-office/examinations", label: "Examinations", icon: "bi-clipboard-check" },
        { to: "/exam-office/grade-verification", label: "Grade Verification", icon: "bi-patch-check" },
        { to: "/exam-office/supplementary", label: "Supplementary", icon: "bi-arrow-repeat" },
        { to: "/grading-schemes", label: "Grading Schemes", icon: "bi-clipboard-data" },
      ],
    },
    {
      section: "Campus Life",
      links: [{ to: "/library", label: "My Library", icon: "bi-book-half" }],
    },
    {
      // NOTE: /conversations currently does NOT list ROLES.EXAM_OFFICE in
      // its allow[] in App.jsx (compose-message does). Left out here to
      // avoid a dead link — add both together if you want it enabled.
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
      ],
    },
    {
      section: "Account",
      links: [{ to: "/exam-office/profile", label: "My Profile", icon: "bi-person-circle" }],
    },
  ],
  // ===== LIBRARIAN =====
  // Dedicated nav tree, same pattern as COD/Registrar/Dean/Exam Office above.
  // No /librarian/profile page exists yet, so there's no "Account" section —
  // add one (mirroring e.g. cod/profile) once that page is built.
  [ROLES.LIBRARIAN]: [
    { section: "Overview", links: [{ to: "/librarian/dashboard", label: "Dashboard", icon: "bi-speedometer2" }] },
    {
      section: "Library Desk",
      links: [
        { to: "/library-management/circulation", label: "Circulation", icon: "bi-arrow-left-right" },
        { to: "/library-management/catalog", label: "Catalog", icon: "bi-journal-bookmark" },
        { to: "/library-management/members", label: "Members", icon: "bi-people" },
        { to: "/library-management/reservations", label: "Reservations", icon: "bi-bookmark-star" },
        { to: "/library-management/fines", label: "Fines", icon: "bi-cash-coin" },
      ],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
        { to: "/conversations", label: "Conversations", icon: "bi-chat-dots" },
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
      // Admin gets both the self-service page and the staff desk — admin is
      // in IsLibraryStaff.STAFF_ROLES on the backend, same as Librarian.
      section: "Library",
      links: [
        { to: "/library", label: "My Library", icon: "bi-book-half" },
        { to: "/library-management/dashboard", label: "Library Desk", icon: "bi-book" },
      ],
    },
    {
      section: "Hostel",
      links: [
        { to: "/hostel/dashboard", label: "Hostel Dashboard", icon: "bi-speedometer2" },
        { to: "/hostel-management", label: "Hostels & Rooms", icon: "bi-building" },
        { to: "/hostel-bookings", label: "Bookings", icon: "bi-door-open" },
        { to: "/hostel-fee-structures", label: "Fee Structure", icon: "bi-cash-stack" },
        { to: "/hostel-reports", label: "Reports", icon: "bi-bar-chart" },
      ],
    },
    {
      section: "Communication",
      links: [
        { to: "/inbox", label: "Inbox", icon: "bi-inbox" },
        { to: "/conversations", label: "Conversations", icon: "bi-chat-dots" },
        { to: "/compose-message", label: "Compose Message", icon: "bi-pencil-square" },
        { to: "/communication-center", label: "Communication Center", icon: "bi-megaphone" },
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
// their backend permissions allow when they hit the API). COD, Registrar,
// Dean, Exam Office and Librarian all have their own dedicated nav trees
// above and are intentionally NOT in this list.
const ADMIN_LIKE = [ROLES.ADMIN, ROLES.STAFF];

export default function Sidebar({ mobileOpen, onClose }) {
  const { user } = useAuth();
  if (!user) return null;

  const sections =
    NAV_BY_ROLE[user.user_type] ||
    (ADMIN_LIKE.includes(user.user_type) ? NAV_BY_ROLE.DEFAULT_ADMIN : []);

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