import { Navigate } from "react-router-dom";
import { useAuth, ROLES } from "../context/AuthContext";

/**
 * Maps a logged-in user's role to their "home" dashboard route. Shared by
 * Login.jsx (redirect right after auth) and this component (fallback for
 * anyone who lands on /dashboard directly — old bookmark, back button, etc).
 */
export function getRoleHomePath(userType) {
  // Normalize userType string to lower-case to prevent issues with casing differences (e.g. "librarian" vs "LIBRARIAN")
  const normalizedRole = userType ? String(userType).toLowerCase() : "";

  switch (normalizedRole) {
    case "student":
    case ROLES.STUDENT?.toLowerCase():
      return "/student/dashboard";

    case "lecturer":
    case ROLES.LECTURER?.toLowerCase():
      return "/lecturer/dashboard";

    case "hostel_warden":
    case ROLES.HOSTEL_WARDEN?.toLowerCase():
      return "/hostel/dashboard";

    case "finance":
    case ROLES.FINANCE?.toLowerCase():
      return "/finance/dashboard";

    case "staff":
    case ROLES.STAFF?.toLowerCase():
      return "/staff/dashboard";

    case "cod":
    case ROLES.COD?.toLowerCase():
      return "/cod/dashboard";

    case "dean":
    case ROLES.DEAN?.toLowerCase():
      return "/dean/dashboard";

    case "registrar":
    case ROLES.REGISTRAR?.toLowerCase():
      return "/registrar/dashboard";

    case "exam_office":
    case ROLES.EXAM_OFFICE?.toLowerCase():
      return "/exam-office/dashboard";

    case "librarian":
    case ROLES.LIBRARIAN?.toLowerCase():
      return "/librarian/dashboard";

    case "admin":
    case ROLES.ADMIN?.toLowerCase():
      return "/admin/dashboard";

    default:
      // Fallback for unmapped or missing roles
      return "/admin/dashboard";
  }
}

/**
 * /dashboard is a pure redirect now — it forwards straight to the user's
 * real role dashboard instead of rendering placeholder widgets.
 */
export default function RoleDashboard() {
  const { user, loading } = useAuth();

  // If AuthContext is still loading the session from storage, wait
  if (loading) return null;

  // If no authenticated user exists, redirect to login
  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={getRoleHomePath(user.user_type)} replace />;
}