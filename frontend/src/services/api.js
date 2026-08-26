import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mu_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh once on 401, then retry the original request.
let isRefreshing = false;
let queue = [];

const flushQueue = (error, token = null) => {
  queue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject })).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;
    const refresh = localStorage.getItem("mu_refresh_token");
    if (!refresh) {
      isRefreshing = false;
      authApi.logout();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
      localStorage.setItem("mu_access_token", data.access);
      flushQueue(null, data.access);
      originalRequest.headers.Authorization = `Bearer ${data.access}`;
      return api(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      authApi.logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
export const authApi = {
  login: (username, password) => api.post("/auth/login/", { username, password }),
  verifyOtp: (username, code) => api.post("/auth/verify-otp/", { username, code }),
  permissions: () => api.get("/auth/permissions/"),
  me: () => api.get("/auth/me/"),
  storeSession: ({ access, refresh, user }) => {
    localStorage.setItem("mu_access_token", access);
    localStorage.setItem("mu_refresh_token", refresh);
    localStorage.setItem("mu_user", JSON.stringify(user));
  },
  currentUser: () => {
    const raw = localStorage.getItem("mu_user");
    return raw ? JSON.parse(raw) : null;
  },
  logout: () => {
    localStorage.removeItem("mu_access_token");
    localStorage.removeItem("mu_refresh_token");
    localStorage.removeItem("mu_user");
    window.location.href = "/login";
  },
};

// Add these to studentsApi:
export const studentsApi = {
  list: (params) => api.get("/students/", { params }),
  get: (id) => api.get(`/students/${id}/`),
  admit: (payload) => api.post("/students/admit/", payload),
  update: (id, payload) => api.patch(`/students/${id}/`, payload),
  remove: (id) => api.delete(`/students/${id}/`),
  transcript: (id) => api.get(`/students/${id}/transcript/`),
  feeSummary: (id) => api.get(`/students/${id}/fee-summary/`),
  enrollments: (params) => api.get("/enrollments/", { params }),
  myProfile: () => api.get("/me/profile/"),
  myTranscript: () => api.get("/me/transcript/"),
  myFeeSummary: () => api.get("/me/fee-summary/"),
  mySupplementary: () => api.get("/me/supplementary/"),
  myDashboard: () => api.get("/me/dashboard/"),
};

// ---------------------------------------------------------------------
// Unit APIs
// ---------------------------------------------------------------------
export const unitsApi = {
  autoRegister: (semester) => api.post("/me/units/auto-register/", { semester }),
  myRegistrations: () => api.get("/me/units/"),
  availableUnits: () => api.get("/me/units/available/"),
  registerSelected: (courseIds) => api.post("/me/units/register-selected/", { course_ids: courseIds }),
  lecturerAllocations: () => api.get("/lecturer-allocations/"),
  roster: (allocationId) => api.get(`/lecturer-allocations/${allocationId}/roster/`),
  currentSemester: () => api.get("/me/current-semester/"),
};

// ---------------------------------------------------------------------
// CATs APIs
// ---------------------------------------------------------------------
export const catsApi = {
  list: (params) => api.get("/cats/", { params }),
  create: (payload) => api.post("/cats/", payload),
  submit: (payload) => {
    const formData = new FormData();
    formData.append("cat_id", payload.cat_id);
    if (payload.answer_file) formData.append("answer_file", payload.answer_file);
    if (payload.answer_text) formData.append("answer_text", payload.answer_text);
    return api.post("/me/cats/submit/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  mySubmissions: () => api.get("/me/cat-submissions/"),
  myCats: () => api.get("/me/cats/"),
};


// Add register() alongside the existing mySupplementary GET
export const supplementaryApi = {
  outstanding: () => api.get("/me/supplementary/"),
  register: (course, semester) => api.post("/me/supplementary/", { course, semester }),
};

export const timetableApi = {
  mine: () => api.get("/me/timetable/"),
};

export const reportingApi = {
  status: () => api.get("/me/reporting-status/"),
  mine: () => api.get("/student-reportings/"),
  submit: (semester, reportingType = "online") =>
    api.post("/student-reportings/", { semester, reporting_type: reportingType }),
};

export const defermentApi = {
  mine: () => api.get("/deferments/"),
  create: (payload) => {
    // payload may include a File (supporting_document), so send multipart.
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        formData.append(key, value);
      }
    });
    return api.post("/deferments/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ---------------------------------------------------------------------
// Grades APIs
// ---------------------------------------------------------------------
export const gradesApi = {
  list: (params) => api.get("/grades/", { params }),
  enter: (payload) => api.post("/grades/enter/", payload),
  remove: (id) => api.delete(`/grades/${id}/`),
  myGrades: () => api.get("/grades/"),
};

// ---------------------------------------------------------------------
// Fees APIs
// ---------------------------------------------------------------------
export const feesApi = {
  myFeeSummary: () => api.get("/me/fee-summary/"),
  invoices: () => api.get("/invoices/"),
  payments: () => api.get("/fee-payments/"),
  feeStructures: () => api.get("/fee-structures/"),
};

// ---------------------------------------------------------------------
// Hostel APIs
// ---------------------------------------------------------------------
export const hostelApi = {
  beds: (params) => api.get("/beds/", { params }),
  book: (payload) => api.post("/hostel-bookings/", payload),
  myBookings: () => api.get("/hostel-bookings/"),
  hostels: () => api.get("/hostels/"),
  rooms: () => api.get("/rooms/"),
  status: () => api.get("/me/hostel-status/"),
};


// ---------------------------------------------------------------------
// Clearance APIs
// ---------------------------------------------------------------------
export const clearanceApi = {
  request: (clearanceType) => api.post("/clearances/", { clearance_type: clearanceType }),
  mine: () => api.get("/clearances/"),
  status: () => api.get("/me/clearance-status/"),
};

// ---------------------------------------------------------------------
// Notifications APIs
// ---------------------------------------------------------------------
export const notificationsApi = {
  summary: () => api.get("/notifications/summary/"),
  list: (params) => api.get("/notifications/", { params }),
  markRead: (id) => api.post(`/notifications/${id}/mark-read/`),
  markAllRead: () => api.post("/notifications/mark-all-read/"),
};

// ---------------------------------------------------------------------
// Admin APIs
// ---------------------------------------------------------------------
export const adminApi = {
  // Dashboard
  dashboard: () => api.get("/admin/dashboard/"),

  // Academic Structure
  faculties: (params) => api.get("/faculties/", { params }),
  createFaculty: (payload) => api.post("/faculties/", payload),
  updateFaculty: (id, payload) => api.patch(`/faculties/${id}/`, payload),
  deleteFaculty: (id) => api.delete(`/faculties/${id}/`),

  departments: (params) => api.get("/departments/", { params }),
  createDepartment: (payload) => api.post("/departments/", payload),
  updateDepartment: (id, payload) => api.patch(`/departments/${id}/`, payload),
  deleteDepartment: (id) => api.delete(`/departments/${id}/`),

  gradingSchemes: (params) => api.get("/grading-schemes/", { params }),
  createGradingScheme: (payload) => api.post("/grading-schemes/", payload),
  updateGradingScheme: (id, payload) => api.patch(`/grading-schemes/${id}/`, payload),
  deleteGradingScheme: (id) => api.delete(`/grading-schemes/${id}/`),

  gradeBands: (params) => api.get("/grade-bands/", { params }),
  createGradeBand: (payload) => api.post("/grade-bands/", payload),
  updateGradeBand: (id, payload) => api.patch(`/grade-bands/${id}/`, payload),
  deleteGradeBand: (id) => api.delete(`/grade-bands/${id}/`),

  programmes: (params) => api.get("/programmes/", { params }),
  courses: (params) => api.get("/courses/", { params }),
  curriculumVersions: (params) => api.get("/curriculum-versions/", { params }),

  // Calendar
  academicYears: (params) => api.get("/academic-years/", { params }),
  semesters: (params) => api.get("/semesters/", { params }),
  intakes: (params) => api.get("/intakes/", { params }),

  users: (params) => api.get("/users/", { params }),
  getUser: (id) => api.get(`/users/${id}/`),
  createUser: (payload) => api.post("/users/", payload),
  updateUser: (id, payload) => api.patch(`/users/${id}/`, payload),
  deleteUser: (id) => api.delete(`/users/${id}/`),
  setUserPassword: (id, password, forceChange = true) =>
    api.post(`/users/${id}/set-password/`, { password, force_change: forceChange }),

  // People Management
  students: (params) => api.get("/students/", { params }),
  lecturers: (params) => api.get("/lecturers/", { params }),
  staff: (params) => api.get("/staff/", { params }),
  deferments: (params) => api.get("/deferments/", { params }),

  // Operations
  clearances: (params) => api.get("/clearances/", { params }),
  examinations: (params) => api.get("/examinations/", { params }),

  // Fee Management
  feeStructures: (params) => api.get("/fee-structures/", { params }),
  financialAwards: (params) => api.get("/financial-awards/", { params }),

  // Hostel
  hostels: (params) => api.get("/hostels/", { params }),
  rooms: (params) => api.get("/rooms/", { params }),
  beds: (params) => api.get("/beds/", { params }),
  hostelBookings: (params) => api.get("/hostel-bookings/", { params }),

  // Promotions
  runPromotion: () => api.post("/admin-ops/run-promotion/"),
  unitRegistrations: (params) => api.get("/unit-registrations/", { params }),

  // Reports
  reports: () => api.get("/reports/"),

  // Reportings
  reportings: (params) => api.get("/student-reportings/", { params }),
  updateReportingStatus: (id, statusValue) =>
    api.post(`/student-reportings/${id}/update-status/`, { status: statusValue }),
  bulkUpdateReportingStatus: (reportingIds, statusValue) =>
    api.post("/student-reportings/bulk-update-status/", { reporting_ids: reportingIds, status: statusValue }),
  reportForStudent: (payload) => api.post("/student-reportings/report-for-student/", payload),

  // Academic Years
  createAcademicYear: (payload) => api.post("/academic-years/", payload),
  updateAcademicYear: (id, payload) => api.patch(`/academic-years/${id}/`, payload),
  deleteAcademicYear: (id) => api.delete(`/academic-years/${id}/`),

  // Semesters
  createSemester: (payload) => api.post("/semesters/", payload),
  updateSemester: (id, payload) => api.patch(`/semesters/${id}/`, payload),
  deleteSemester: (id) => api.delete(`/semesters/${id}/`),

  // Intakes
  createIntake: (payload) => api.post("/intakes/", payload),
  updateIntake: (id, payload) => api.patch(`/intakes/${id}/`, payload),
  deleteIntake: (id) => api.delete(`/intakes/${id}/`),

  // Programmes
  createProgramme: (payload) => api.post("/programmes/", payload),
  updateProgramme: (id, payload) => api.patch(`/programmes/${id}/`, payload),
  deleteProgramme: (id) => api.delete(`/programmes/${id}/`),

  // Courses
  createCourse: (payload) => api.post("/courses/", payload),
  updateCourse: (id, payload) => api.patch(`/courses/${id}/`, payload),
  deleteCourse: (id) => api.delete(`/courses/${id}/`),

  // Curriculum versions
  createCurriculumVersion: (payload) => api.post("/curriculum-versions/", payload),
  updateCurriculumVersion: (id, payload) => api.patch(`/curriculum-versions/${id}/`, payload),
  deleteCurriculumVersion: (id) => api.delete(`/curriculum-versions/${id}/`),

  // Curriculum units
  curriculumUnits: (params) => api.get("/curriculum-units/", { params }),
  createCurriculumUnit: (payload) => api.post("/curriculum-units/", payload),
  updateCurriculumUnit: (id, payload) => api.patch(`/curriculum-units/${id}/`, payload),
  deleteCurriculumUnit: (id) => api.delete(`/curriculum-units/${id}/`),

  // Lecturer unit allocations
  lecturerAllocations: (params) => api.get("/lecturer-allocations/", { params }),
  createLecturerAllocation: (payload) => api.post("/lecturer-allocations/", payload),
  updateLecturerAllocation: (id, payload) => api.patch(`/lecturer-allocations/${id}/`, payload),
  deleteLecturerAllocation: (id) => api.delete(`/lecturer-allocations/${id}/`),

  // Timetable
  timetableSlots: (params) => api.get("/timetable/", { params }),
  createTimetableSlot: (payload) => api.post("/timetable/", payload),
  updateTimetableSlot: (id, payload) => api.patch(`/timetable/${id}/`, payload),
  deleteTimetableSlot: (id) => api.delete(`/timetable/${id}/`),

  // Lecturer & Staff accounts
  admitLecturer: (payload) => api.post("/lecturers/admit/", payload),
  updateLecturer: (id, payload) => api.patch(`/lecturers/${id}/`, payload),
  deleteLecturer: (id) => api.delete(`/lecturers/${id}/`),
 
  admitStaff: (payload) => api.post("/staff/admit/", payload),
  updateStaffMember: (id, payload) => api.patch(`/staff/${id}/`, payload),
  deleteStaffMember: (id) => api.delete(`/staff/${id}/`),
 
  // Deferments
  approveDeferment: (id) => api.post(`/deferments/${id}/approve/`),
  rejectDeferment: (id, remarks) => api.post(`/deferments/${id}/reject/`, { remarks }),
  resumeDeferment: (id) => api.post(`/deferments/${id}/resume/`),
 
  // Examinations
  createExamination: (payload) => api.post("/examinations/", payload),
  updateExamination: (id, payload) => api.patch(`/examinations/${id}/`, payload),
  deleteExamination: (id) => api.delete(`/examinations/${id}/`),
 
  // Clearances
  approveClearance: (id, remarks) => api.post(`/clearances/${id}/approve/`, { remarks }),
  rejectClearance: (id, remarks) => api.post(`/clearances/${id}/reject/`, { remarks }),

  // Security Audit
  loginSessions: (params) => api.get("/security/login-sessions/", { params }),
  lockEvents: (params) => api.get("/security/lock-events/", { params }),
  securityAlerts: (params) => api.get("/security/alerts/", { params }),
  resolveAlert: (id) => api.post(`/security/alerts/${id}/resolve/`),
  loginAttempts: (params) => api.get("/security/login-attempts/", { params }),
  securityDashboard: () => api.get("/security/dashboard/"),
  unlockUser: (id, notes) => api.post(`/users/${id}/unlock/`, { notes }),
  lockUser: (id, notes) => api.post(`/users/${id}/lock/`, { notes }),

};


export const communicationApi = {
  // ---- Broadcasts (Announcements) ----
  audienceOptions: () => api.get("/messages/audience-options/"),
  compose: (payload) => api.post("/messages/compose/", payload),
  sentMessages: (params) => api.get("/messages/", { params }),
  messageRecipients: (id) => api.get(`/messages/${id}/recipients/`),
 
  // ---- Inbox (received announcements) ----
  inbox: () => api.get("/me/inbox/"),
  markMessageRead: (id) => api.post(`/me/inbox/${id}/mark-read/`),
 
  // ---- Conversations (two-way threads: enquiries/complaints/support) ----
  conversationTargets: () => api.get("/me/conversation-targets/"),
  conversations: (params) => api.get("/conversations/", { params }),
  conversation: (id) => api.get(`/conversations/${id}/`),
  openConversation: (payload) => api.post("/conversations/", payload),
  replyConversation: (id, body) => api.post(`/conversations/${id}/reply/`, { body }),
  assignConversation: (id) => api.post(`/conversations/${id}/assign/`),
  setConversationStatus: (id, statusValue) => api.post(`/conversations/${id}/set-status/`, { status: statusValue }),
};

// ---------------------------------------------------------------------
// Lecturer APIs
// ---------------------------------------------------------------------
export const lecturerApi = {
  dashboard: () => api.get("/lecturer/dashboard/"),
  myAllocations: () => api.get("/lecturer-allocations/"),
  roster: (allocationId) => api.get(`/lecturer-allocations/${allocationId}/roster/`),
  gradingSheet: (allocationId) => api.get(`/lecturer-allocations/${allocationId}/grading-sheet/`),
  enterGrades: (payload) => api.post("/grades/enter/", payload),
  createCat: (payload) => api.post("/cats/", payload),
  myCats: () => api.get("/cats/"),
  myTimetable: () => api.get("/timetable/"),
  attendanceSessions: () => api.get("/attendance/mine/"),
  startAttendanceSession: (timetableSlotId, durationMinutes = 15) =>
    api.post("/attendance/start/", { timetable_slot: timetableSlotId, duration_minutes: durationMinutes }),
  attendanceSessionLive: (sessionId) => api.get(`/attendance/${sessionId}/live/`),
  closeAttendanceSession: (sessionId) => api.post(`/attendance/${sessionId}/close/`),
};

// ---------------------------------------------------------------------
// Finance APIs
// ---------------------------------------------------------------------
export const financeApi = {
  feeStructures: (params) => api.get("/fee-structures/", { params }),
  createFeeStructure: (payload) => api.post("/fee-structures/", payload),
  updateFeeStructure: (id, payload) => api.patch(`/fee-structures/${id}/`, payload),
  deleteFeeStructure: (id) => api.delete(`/fee-structures/${id}/`),
 
  payments: (params) => api.get("/fee-payments/", { params }),
  paymentAllocations: (paymentId) => api.get("/invoice-allocations/", { params: { payment: paymentId } }),
  resolvePayment: (id) => api.post(`/fee-payments/${id}/resolve/`),
  reassignPayment: (id, studentId) => api.post(`/fee-payments/${id}/reassign/`, { student: studentId }),
 
  helbAwards: (params) => api.get("/financial-awards/", { params }),
  createHelbAward: (payload) => api.post("/financial-awards/", payload),
  updateHelbAward: (id, payload) => api.patch(`/financial-awards/${id}/`, payload),
  deleteHelbAward: (id) => api.delete(`/financial-awards/${id}/`),
  markDisbursed: (id) => api.post(`/financial-awards/${id}/mark-disbursed/`),
 
  bankWebhook: (payload) => api.post("/integrations/bank-payment/", payload),
  dashboard: () => api.get("/finance/dashboard/"),

  feeStructureStudents: (id) => api.get(`/fee-structures/${id}/students/`),
  raiseFeeStructureInvoice: (id, studentId) => api.post(`/fee-structures/${id}/raise-invoice/`, { student: studentId }),
  recordFeeStructurePayment: (id, payload) => api.post(`/fee-structures/${id}/record-payment/`, payload),
};

// ---------------------------------------------------------------------
// Hostel Warden APIs
// ---------------------------------------------------------------------
export const hostelWardenApi = {
  hostels: (params) => api.get("/hostels/", { params }),
  createHostel: (payload) => api.post("/hostels/", payload),
  updateHostel: (id, payload) => api.patch(`/hostels/${id}/`, payload),
  deleteHostel: (id) => api.delete(`/hostels/${id}/`),
 
  rooms: (params) => api.get("/rooms/", { params }),
  createRoom: (payload) => api.post("/rooms/", payload),
  updateRoom: (id, payload) => api.patch(`/rooms/${id}/`, payload),
  deleteRoom: (id) => api.delete(`/rooms/${id}/`),
 
  beds: (params) => api.get("/beds/", { params }),
  createBed: (payload) => api.post("/beds/", payload),
  updateBed: (id, payload) => api.patch(`/beds/${id}/`, payload),
  deleteBed: (id) => api.delete(`/beds/${id}/`),
 
  bookings: (params) => api.get("/hostel-bookings/", { params }),
  manualBook: (payload) => api.post("/hostel-bookings/manual_book/", payload),
  checkIn: (id) => api.post(`/hostel-bookings/${id}/check_in/`),
  checkOut: (id) => api.post(`/hostel-bookings/${id}/check_out/`),
  cancelBooking: (id) => api.post(`/hostel-bookings/${id}/cancel/`),
 
  dashboard: (academicYearId) => api.get("/hostel/dashboard/", { params: academicYearId ? { academic_year: academicYearId } : {} }),
};

export default api;