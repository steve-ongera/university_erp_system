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
  list: () => api.get("/notifications/"),
  markRead: (id) => api.post(`/notifications/${id}/mark-read/`),
};

// ---------------------------------------------------------------------
// Admin APIs
// ---------------------------------------------------------------------
export const adminApi = {
  // Dashboard
  dashboard: () => api.get("/admin/dashboard/"),
  
  // Academic Structure
  faculties: () => api.get("/faculties/"),
  departments: () => api.get("/departments/"),
  programmes: () => api.get("/programmes/"),
  courses: () => api.get("/courses/"),
  curriculumVersions: () => api.get("/curriculum-versions/"),
  
  // Calendar
  academicYears: () => api.get("/academic-years/"),
  semesters: () => api.get("/semesters/"),
  intakes: () => api.get("/intakes/"),
  
  // People Management
  students: (params) => api.get("/students/", { params }),
  lecturers: () => api.get("/lecturers/"),
  staff: () => api.get("/staff/"),
  deferments: () => api.get("/deferments/"),
  
  // Operations
  clearances: () => api.get("/clearances/"),
  examinations: () => api.get("/examinations/"),
  
  // Fee Management
  feeStructures: () => api.get("/fee-structures/"),
  financialAwards: () => api.get("/financial-awards/"),
  
  // Hostel
  hostels: () => api.get("/hostels/"),
  rooms: () => api.get("/rooms/"),
  beds: (params) => api.get("/beds/", { params }),
  hostelBookings: () => api.get("/hostel-bookings/"),
  
  // Promotions
  runPromotion: () => api.post("/admin-ops/run-promotion/"),
  unitRegistrations: (params) => api.get("/unit-registrations/", { params }),
  
  // Reports
  reports: () => api.get("/reports/"),

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

};



// ---------------------------------------------------------------------
// Lecturer APIs
// ---------------------------------------------------------------------
export const lecturerApi = {
  myAllocations: () => api.get("/lecturer-allocations/"),
  roster: (allocationId) => api.get(`/lecturer-allocations/${allocationId}/roster/`),
  enterGrades: (payload) => api.post("/grades/enter/", payload),
  createCat: (payload) => api.post("/cats/", payload),
  myCats: () => api.get("/cats/"),
  attendanceSessions: () => api.get("/attendance-sessions/"),
  markAttendance: (payload) => api.post("/attendance/", payload),
};

// ---------------------------------------------------------------------
// Finance APIs
// ---------------------------------------------------------------------
export const financeApi = {
  feeStructures: () => api.get("/fee-structures/"),
  createFeeStructure: (payload) => api.post("/fee-structures/", payload),
  invoices: () => api.get("/invoices/"),
  payments: () => api.get("/fee-payments/"),
  financialAwards: () => api.get("/financial-awards/"),
  createAward: (payload) => api.post("/financial-awards/", payload),
  bankWebhook: (payload) => api.post("/integrations/bank-payment/", payload),
};

// ---------------------------------------------------------------------
// Hostel Warden APIs
// ---------------------------------------------------------------------
export const hostelWardenApi = {
  hostels: () => api.get("/hostels/"),
  createHostel: (payload) => api.post("/hostels/", payload),
  rooms: () => api.get("/rooms/"),
  createRoom: (payload) => api.post("/rooms/", payload),
  beds: (params) => api.get("/beds/", { params }),
  createBed: (payload) => api.post("/beds/", payload),
  bookings: () => api.get("/hostel-bookings/"),
  updateBooking: (id, payload) => api.patch(`/hostel-bookings/${id}/`, payload),
};

export default api;