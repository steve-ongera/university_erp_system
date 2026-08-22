import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, ROLES } from "./context/AuthContext";
import Dashboard from "./layout/Dashboard";
import Login from "./pages/Login";
import RoleDashboard from "./pages/RoleDashboard";
import PlaceholderPage from "./pages/PlaceholderPage";

// Student Pages
import StudentDashboard from "./pages/students/StudentDashboard";
import MyUnits from "./pages/students/MyUnits";
import MyCats from "./pages/students/MyCats";
import MyGrades from "./pages/students/MyGrades";
import Supplementary from "./pages/students/Supplementary";
import Timetable from "./pages/students/Timetable";
import FeesPayments from "./pages/students/FeesPayments";
import HostelBooking from "./pages/students/HostelBooking";
import SemesterReporting from "./pages/students/SemesterReporting";
import GraduationClearance from "./pages/students/GraduationClearance";
import Deferment from "./pages/students/Deferment";
import StudentProfile from "./pages/students/StudentProfile";

// Lecturer Pages
import LecturerDashboard from "./pages/lecturers/LecturerDashboard";
import MyAllocatedUnits from "./pages/lecturers/MyAllocatedUnits";
import EnterMarks from "./pages/lecturers/EnterMarks";
import QRAttendance from "./pages/lecturers/QRAttendance";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import FacultiesDepartments from "./pages/admin/FacultiesDepartments";
import Programmes from "./pages/admin/Programmes";
import CoursesCurriculum from "./pages/admin/CoursesCurriculum";
import AcademicCalendar from "./pages/admin/AcademicCalendar";
import StudentsManagement from "./pages/admin/StudentsManagement";
import LecturersStaff from "./pages/admin/LecturersStaff";
import DefermentsManagement from "./pages/admin/DefermentsManagement";
import Promotions from "./pages/admin/Promotions";
import Examinations from "./pages/admin/Examinations";
import ClearancesManagement from "./pages/admin/ClearancesManagement";
import Reports from "./pages/admin/Reports";
import ResultsManager from "./pages/admin/ResultsManagement";

// Finance Pages
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import FeeStructures from "./pages/finance/FeeStructures";
import PaymentsReconciliation from "./pages/finance/PaymentsReconciliation";
import HelbBursaries from "./pages/finance/HelbBursaries";

// Hostel Warden Pages
import HostelWardenDashboard from "./pages/hostel/HostelWardenDashboard";
import HostelsRooms from "./pages/hostel/HostelsRooms";
import HostelBookings from "./pages/hostel/HostelBookings";

import "bootstrap-icons/font/bootstrap-icons.css";
import "./style/main.css";

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
            {/* ===== SHARED ===== */}
            <Route path="/dashboard" element={<RoleDashboard />} />

            {/* ===== STUDENT PAGES ===== */}
            <Route path="/student/dashboard" element={<ProtectedRoute allow={[ROLES.STUDENT]}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/units" element={<ProtectedRoute allow={[ROLES.STUDENT]}><MyUnits /></ProtectedRoute>} />
            <Route path="/cats" element={<ProtectedRoute allow={[ROLES.STUDENT]}><MyCats /></ProtectedRoute>} />
            <Route path="/grades" element={<ProtectedRoute allow={[ROLES.STUDENT]}><MyGrades /></ProtectedRoute>} />
            <Route path="/supplementary" element={<ProtectedRoute allow={[ROLES.STUDENT]}><Supplementary /></ProtectedRoute>} />
            <Route path="/timetable" element={<ProtectedRoute allow={[ROLES.STUDENT]}><Timetable /></ProtectedRoute>} />
            <Route path="/fees" element={<ProtectedRoute allow={[ROLES.STUDENT]}><FeesPayments /></ProtectedRoute>} />
            <Route path="/hostel" element={<ProtectedRoute allow={[ROLES.STUDENT]}><HostelBooking /></ProtectedRoute>} />
            <Route path="/reporting" element={<ProtectedRoute allow={[ROLES.STUDENT]}><SemesterReporting /></ProtectedRoute>} />
            <Route path="/clearance" element={<ProtectedRoute allow={[ROLES.STUDENT]}><GraduationClearance /></ProtectedRoute>} />
            <Route path="/deferment" element={<ProtectedRoute allow={[ROLES.STUDENT]}><Deferment /></ProtectedRoute>} />
            <Route path="/me/profile" element={<ProtectedRoute allow={[ROLES.STUDENT]}><StudentProfile /></ProtectedRoute>} />

            {/* ===== LECTURER PAGES ===== */}
            <Route path="/lecturer/dashboard" element={<ProtectedRoute allow={[ROLES.LECTURER]}><LecturerDashboard /></ProtectedRoute>} />
            <Route path="/my-units" element={<ProtectedRoute allow={[ROLES.LECTURER]}><MyAllocatedUnits /></ProtectedRoute>} />
            <Route path="/grading" element={<ProtectedRoute allow={[ROLES.LECTURER]}><EnterMarks /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute allow={[ROLES.LECTURER]}><QRAttendance /></ProtectedRoute>} />

            {/* ===== HOSTEL WARDEN PAGES ===== */}
            <Route path="/hostel/dashboard" element={<ProtectedRoute allow={[ROLES.HOSTEL_WARDEN, ROLES.ADMIN]}><HostelWardenDashboard /></ProtectedRoute>} />
            <Route path="/hostel-management" element={<ProtectedRoute allow={[ROLES.HOSTEL_WARDEN, ROLES.ADMIN]}><HostelsRooms /></ProtectedRoute>} />
            <Route path="/hostel-bookings" element={<ProtectedRoute allow={[ROLES.HOSTEL_WARDEN, ROLES.ADMIN]}><HostelBookings /></ProtectedRoute>} />

            {/* ===== FINANCE PAGES ===== */}
            <Route path="/finance/dashboard" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><FinanceDashboard /></ProtectedRoute>} />
            <Route path="/fee-structures" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><FeeStructures /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><PaymentsReconciliation /></ProtectedRoute>} />
            <Route path="/awards" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><HelbBursaries /></ProtectedRoute>} />

            {/* ===== ADMIN PAGES ===== */}
            <Route path="/admin/dashboard" element={<ProtectedRoute allow={ADMIN_ROLES}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/faculties" element={<ProtectedRoute allow={ADMIN_ROLES}><FacultiesDepartments /></ProtectedRoute>} />
            <Route path="/programmes" element={<ProtectedRoute allow={ADMIN_ROLES}><Programmes /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute allow={ADMIN_ROLES}><CoursesCurriculum /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute allow={ADMIN_ROLES}><AcademicCalendar /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute allow={ADMIN_ROLES}><StudentsManagement /></ProtectedRoute>} />
            <Route path="/lecturers" element={<ProtectedRoute allow={ADMIN_ROLES}><LecturersStaff /></ProtectedRoute>} />
            <Route path="/deferments" element={<ProtectedRoute allow={ADMIN_ROLES}><DefermentsManagement /></ProtectedRoute>} />
            <Route path="/promotions" element={<ProtectedRoute allow={ADMIN_ROLES}><Promotions /></ProtectedRoute>} />
            <Route path="/examinations" element={<ProtectedRoute allow={ADMIN_ROLES}><Examinations /></ProtectedRoute>} />
            <Route path="/clearances" element={<ProtectedRoute allow={ADMIN_ROLES}><ClearancesManagement /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allow={ADMIN_ROLES}><Reports /></ProtectedRoute>} />
            <Route path="/resultsmanagement" element={<ProtectedRoute allow={ADMIN_ROLES}><ResultsManager /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}