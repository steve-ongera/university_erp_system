import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, ROLES } from "./context/AuthContext";
import Dashboard from "./layout/Dashboard";
import Login from "./pages/Login";
import RoleDashboard from "./pages/RoleDashboard";
import PlaceholderPage from "./pages/PlaceholderPage";
import UnderDevelopment from "./pages/UnderDevelopment";
import { PAGES } from "./config/rbac";

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
import UnitAllocations from "./pages/admin/UnitAllocations";
import AdminReportings from "./pages/admin/AdminReportings";
import TimetableBuilder from "./pages/admin/TimetableBuilder";

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

            {/* ===== HOSTEL WARDEN PAGES (unchanged — already correctly scoped) ===== */}
            <Route path="/hostel/dashboard" element={<ProtectedRoute allow={[ROLES.HOSTEL_WARDEN, ROLES.ADMIN]}><HostelWardenDashboard /></ProtectedRoute>} />
            <Route path="/hostel-management" element={<ProtectedRoute allow={[ROLES.HOSTEL_WARDEN, ROLES.ADMIN]}><HostelsRooms /></ProtectedRoute>} />
            <Route path="/hostel-bookings" element={<ProtectedRoute allow={[ROLES.HOSTEL_WARDEN, ROLES.ADMIN]}><HostelBookings /></ProtectedRoute>} />

            {/* ===== FINANCE PAGES (unchanged — already correctly scoped) ===== */}
            <Route path="/finance/dashboard" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><FinanceDashboard /></ProtectedRoute>} />
            <Route path="/fee-structures" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><FeeStructures /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><PaymentsReconciliation /></ProtectedRoute>} />
            <Route path="/awards" element={<ProtectedRoute allow={[ROLES.FINANCE, ROLES.ADMIN]}><HelbBursaries /></ProtectedRoute>} />

            {/* ===== STAFF — no dedicated modules yet ===== */}
            <Route
              path="/staff/dashboard"
              element={
                <ProtectedRoute allow={[ROLES.STAFF]}>
                  <UnderDevelopment
                    plannedFeatures={["Task/ticket assignment", "Internal announcements", "Document requests"]}
                  />
                </ProtectedRoute>
              }
            />

            {/*
              ===== ADMIN-STYLE PAGES =====
              Every route below is now guarded by PAGES.X.roles from
              src/config/rbac.js instead of one shared ADMIN_ROLES bucket.
              Only 'admin' appears on every single one; every other role
              (registrar/dean/cod/exam_office) gets its own narrow slice.
              See rbac.js for the full matrix + rationale.

              NOTE: /reportings uses a plain [ROLES.ADMIN, ROLES.REGISTRAR]
              array instead of PAGES.REPORTINGS.roles because that entry
              doesn't exist in rbac.js yet. Add a REPORTINGS entry to
              rbac.js (matching the shape of e.g. PAGES.CLEARANCES), then
              swap this back to allow={PAGES.REPORTINGS.roles} for
              consistency with the rest of this block.
            */}
            <Route path="/admin/dashboard" element={<ProtectedRoute allow={PAGES.ADMIN_DASHBOARD.roles}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/faculties" element={<ProtectedRoute allow={PAGES.FACULTIES.roles}><FacultiesDepartments /></ProtectedRoute>} />
            <Route path="/programmes" element={<ProtectedRoute allow={PAGES.PROGRAMMES.roles}><Programmes /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute allow={PAGES.COURSES.roles}><CoursesCurriculum /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute allow={PAGES.CALENDAR.roles}><AcademicCalendar /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute allow={PAGES.STUDENTS.roles}><StudentsManagement /></ProtectedRoute>} />
            <Route path="/lecturers" element={<ProtectedRoute allow={PAGES.LECTURERS.roles}><LecturersStaff /></ProtectedRoute>} />
            <Route path="/deferments" element={<ProtectedRoute allow={PAGES.DEFERMENTS.roles}><DefermentsManagement /></ProtectedRoute>} />
            <Route path="/promotions" element={<ProtectedRoute allow={PAGES.PROMOTIONS.roles}><Promotions /></ProtectedRoute>} />
            <Route path="/examinations" element={<ProtectedRoute allow={PAGES.EXAMINATIONS.roles}><Examinations /></ProtectedRoute>} />
            <Route path="/clearances" element={<ProtectedRoute allow={PAGES.CLEARANCES.roles}><ClearancesManagement /></ProtectedRoute>} />
            <Route path="/reportings" element={<ProtectedRoute allow={[ROLES.ADMIN, ROLES.REGISTRAR]}><AdminReportings /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allow={PAGES.REPORTS.roles}><Reports /></ProtectedRoute>} />
            <Route path="/resultsmanagement" element={<ProtectedRoute allow={PAGES.RESULTS_MANAGER.roles}><ResultsManager /></ProtectedRoute>} />
            <Route path="/unitallocations" element={<ProtectedRoute allow={PAGES.UNIT_ALLOCATIONS.roles}><UnitAllocations /></ProtectedRoute>} />
            <Route path="/timetable-builder" element={<ProtectedRoute allow={[ROLES.ADMIN, ROLES.REGISTRAR, ROLES.COD]}><TimetableBuilder /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}