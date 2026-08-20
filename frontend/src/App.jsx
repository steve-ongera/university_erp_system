import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, ROLES } from "./context/AuthContext";
import Dashboard from "./layout/Dashboard";
import Login from "./pages/Login";
import RoleDashboard from "./pages/RoleDashboard";
import PlaceholderPage from "./pages/PlaceholderPage";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./style/main.css";

/** All roles the system recognises — see portal_api.models.User.UserType. */
const ALL_ROLES = Object.values(ROLES);

function ProtectedRoute({ children, allow = ALL_ROLES }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.user_type)) return <Navigate to="/dashboard" replace />;
  return children;
}

function FullScreenLoader() {
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <i className="bi bi-arrow-repeat" style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }} />
    </div>
  );
}

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.DEAN, ROLES.COD, ROLES.EXAM_OFFICE, ROLES.STAFF];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            {/* Shared */}
            <Route path="/dashboard" element={<RoleDashboard />} />

            {/* Student-only */}
            <Route path="/units" element={<ProtectedRoute allow={[ROLES.STUDENT]}><PlaceholderPage title="My Units" /></ProtectedRoute>} />
            <Route path="/cats" element={<PlaceholderPage title="CATs" />} />
            <Route path="/grades" element={<ProtectedRoute allow={[ROLES.STUDENT]}><PlaceholderPage title="Results & Transcript" /></ProtectedRoute>} />
            <Route path="/supplementary" element={<ProtectedRoute allow={[ROLES.STUDENT]}><PlaceholderPage title="Supplementary Units" /></ProtectedRoute>} />
            <Route path="/timetable" element={<PlaceholderPage title="Timetable" />} />
            <Route path="/fees" element={<ProtectedRoute allow={[ROLES.STUDENT]}><PlaceholderPage title="Fees & Payments" /></ProtectedRoute>} />
            <Route path="/hostel" element={<ProtectedRoute allow={[ROLES.STUDENT]}><PlaceholderPage title="Hostel Booking" /></ProtectedRoute>} />
            <Route path="/reporting" element={<ProtectedRoute allow={[ROLES.STUDENT]}><PlaceholderPage title="Semester Reporting" /></ProtectedRoute>} />
            <Route path="/clearance" element={<ProtectedRoute allow={[ROLES.STUDENT]}><PlaceholderPage title="Graduation Clearance" /></ProtectedRoute>} />
            <Route path="/deferment" element={<ProtectedRoute allow={[ROLES.STUDENT]}><PlaceholderPage title="Deferment" /></ProtectedRoute>} />

            {/* Lecturer-only */}
            <Route path="/my-units" element={<ProtectedRoute allow={[ROLES.LECTURER]}><PlaceholderPage title="My Allocated Units" /></ProtectedRoute>} />
            <Route path="/grading" element={<ProtectedRoute allow={[ROLES.LECTURER]}><PlaceholderPage title="Enter Marks" /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute allow={[ROLES.LECTURER]}><PlaceholderPage title="QR Attendance" /></ProtectedRoute>} />

            {/* Hostel warden */}
            <Route path="/hostel-management" element={<ProtectedRoute allow={[ROLES.HOSTEL_WARDEN, ROLES.ADMIN]}><PlaceholderPage title="Hostels & Rooms" /></ProtectedRoute>} />
            <Route path="/hostel-bookings" element={<ProtectedRoute allow={[ROLES.HOSTEL_WARDEN, ROLES.ADMIN]}><PlaceholderPage title="Hostel Bookings" /></ProtectedRoute>} />

            {/* Finance */}
            <Route path="/fee-structures" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><PlaceholderPage title="Fee Structures" /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><PlaceholderPage title="Payments & Reconciliation" /></ProtectedRoute>} />
            <Route path="/awards" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><PlaceholderPage title="HELB & Bursaries" /></ProtectedRoute>} />

            {/* Admin / Registrar / Dean / COD / Exam office */}
            <Route path="/faculties" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Faculties & Departments" /></ProtectedRoute>} />
            <Route path="/programmes" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Programmes" /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Courses & Curriculum" /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Academic Years / Intakes" /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Students" /></ProtectedRoute>} />
            <Route path="/lecturers" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Lecturers & Staff" /></ProtectedRoute>} />
            <Route path="/deferments" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Deferments" /></ProtectedRoute>} />
            <Route path="/promotions" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Semester Promotions" /></ProtectedRoute>} />
            <Route path="/examinations" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Examinations" /></ProtectedRoute>} />
            <Route path="/clearances" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Clearances" /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allow={ADMIN_ROLES}><PlaceholderPage title="Reports" /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
