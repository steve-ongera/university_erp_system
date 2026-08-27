// Kept as a separate file because App.jsx's existing "/library-management/dashboard"
// route already imports LibraryDashboard. It simply renders the same component used
// for the new role-specific "/librarian/dashboard" route, so there is one
// implementation to maintain.
import LibrarianDashboard from "./LibrarianDashboard";

export default function LibraryDashboard() {
  return <LibrarianDashboard />;
}