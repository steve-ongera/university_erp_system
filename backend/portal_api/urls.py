from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views as v

router = DefaultRouter()

# Academic structure
router.register(r"faculties", v.FacultyViewSet)
router.register(r"departments", v.DepartmentViewSet)
router.register(r"grading-schemes", v.GradingSchemeViewSet)
router.register(r"programmes", v.ProgrammeViewSet)
router.register(r"courses", v.CourseViewSet)
router.register(r"curriculum-versions", v.CurriculumVersionViewSet)

# Calendar
router.register(r"academic-years", v.AcademicYearViewSet)
router.register(r"semesters", v.SemesterViewSet)
router.register(r"intakes", v.IntakeViewSet)

# People
router.register(r"students", v.StudentViewSet)
router.register(r"lecturers", v.LecturerViewSet)
router.register(r"staff", v.StaffViewSet)
router.register(r"deferments", v.StudentDefermentViewSet, basename="deferments")

# Units
router.register(r"lecturer-allocations", v.LecturerUnitAllocationViewSet, basename="lecturer-allocations")
router.register(r"unit-registrations", v.UnitRegistrationViewSet, basename="unit-registrations")
router.register(r"enrollments", v.EnrollmentViewSet, basename="enrollments")

# CATs / Grades
router.register(r"cats", v.CatSubmissionViewSet, basename="cats")
router.register(r"cat-submissions", v.CatAnswerSubmissionViewSet, basename="cat-submissions")
router.register(r"grades", v.GradeViewSet, basename="grades")

# Fees
router.register(r"fee-structures", v.FeeStructureViewSet)
router.register(r"invoices", v.InvoiceViewSet, basename="invoices")
router.register(r"fee-payments", v.FeePaymentViewSet, basename="fee-payments")
router.register(r"financial-awards", v.HelbBursaryAwardViewSet)

# Hostel
router.register(r"hostels", v.HostelViewSet)
router.register(r"rooms", v.RoomViewSet)
router.register(r"beds", v.BedViewSet)
router.register(r"hostel-bookings", v.HostelBookingViewSet, basename="hostel-bookings")

# Reporting / Clearance
router.register(r"reportings", v.StudentReportingViewSet, basename="reportings")
router.register(r"clearances", v.ClearanceRequestViewSet, basename="clearances")

# Exams / Timetable / Attendance
router.register(r"examinations", v.ExaminationViewSet)
router.register(r"timetable", v.TimetableViewSet)
router.register(r"attendance-sessions", v.AttendanceSessionViewSet)
router.register(r"attendance", v.AttendanceViewSet, basename="attendance")

# Notifications
router.register(r"notifications", v.NotificationViewSet, basename="notifications")

urlpatterns = [
    # Auth
    path("auth/login/", v.LoginView.as_view(), name="login"),
    path("auth/verify-otp/", v.VerifyOtpView.as_view(), name="verify-otp"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", v.MeView.as_view(), name="me"),

    # Student self-service shortcuts
    path("me/profile/", v.MyProfileStudentView.as_view(), name="my-profile"),
    path("me/transcript/", v.MyTranscriptView.as_view(), name="my-transcript"),
    path("me/fee-summary/", v.MyFeeSummaryView.as_view(), name="my-fee-summary"),
    path("me/supplementary/", v.SupplementaryView.as_view(), name="my-supplementary"),
    path("me/dashboard/", v.MyDashboardView.as_view(), name="my-dashboard"),
    
    # Student Unit endpoints
    path("me/units/", v.MyUnitsView.as_view(), name="my-units"),
    path("me/units/auto-register/", v.AutoRegisterUnitsView.as_view(), name="auto-register-units"),
    path("me/current-semester/", v.CurrentSemesterView.as_view(), name="current-semester"),
    
    # Student CAT endpoints
    path("me/cats/", v.MyCatsView.as_view(), name="my-cats"),
    path("me/cats/submit/", v.SubmitCatAnswerView.as_view(), name="submit-cat-answer"),
    path("me/cat-submissions/", v.MyCatSubmissionsView.as_view(), name="my-cat-submissions"),

    # Integrations / admin ops
    path("integrations/bank-payment/", v.BankPaymentWebhookView.as_view(), name="bank-payment-webhook"),
    path("admin-ops/run-promotion/", v.RunPromotionView.as_view(), name="run-promotion"),

    path("", include(router.urls)),
]
