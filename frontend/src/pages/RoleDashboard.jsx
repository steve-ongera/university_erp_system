import { Navigate } from "react-router-dom";
import { useAuth, ROLES } from "../context/AuthContext";

/**
 * Maps a logged-in user's role to their "home" dashboard route. Shared by
 * Login.jsx (redirect right after auth) and this component (fallback for
 * anyone who lands on /dashboard directly — old bookmark, back button, etc).
 */
export function getRoleHomePath(userType) {
  switch (userType) {
    case ROLES.STUDENT:
      return "/student/dashboard";
    case ROLES.LECTURER:
      return "/lecturer/dashboard";
    case ROLES.HOSTEL_WARDEN:
      return "/hostel/dashboard";
    case ROLES.FINANCE:
      return "/finance/dashboard";
    case ROLES.STAFF:
      return "/staff/dashboard";
    case ROLES.COD:
      return "/cod/dashboard";
    default:
      // admin, registrar, dean, exam_office all share the admin-style shell
      return "/admin/dashboard";
  }
}

/**
 * /dashboard is a pure redirect now — it forwards straight to the user's
 * real role dashboard instead of rendering placeholder widgets. Kept as a
 * route (not removed) purely so stale /dashboard links still resolve.
 */
export default function RoleDashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={getRoleHomePath(user.user_type)} replace />;
}