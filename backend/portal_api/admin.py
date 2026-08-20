from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from . import models as m


@admin.register(m.User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "first_name", "last_name", "user_type", "is_active")
    list_filter = ("user_type", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("Portal Info", {"fields": ("user_type", "phone", "gender", "national_id",
                                     "must_change_password", "is_2fa_enrolled")}),
    )


admin.site.register([
    m.Faculty, m.Department, m.GradingScheme, m.GradeBand, m.Programme, m.Course,
    m.CurriculumVersion, m.CurriculumUnit, m.AcademicYear, m.Semester, m.Intake,
    m.Lecturer, m.Staff, m.Student, m.StudentDeferment, m.LecturerUnitAllocation,
    m.UnitRegistration, m.Enrollment, m.CatSubmission, m.CatAnswerSubmission, m.Grade,
    m.TranscriptEntry, m.FeeStructure, m.Invoice, m.StudentFeeAccount, m.FeePayment,
    m.InvoiceAllocation, m.HelbBursaryAward, m.Hostel, m.Room, m.Bed, m.HostelBooking,
    m.StudentReporting, m.ClearanceRequest, m.Examination, m.Timetable,
    m.AttendanceSession, m.Attendance, m.Notification, m.ActivityLog,
    m.AdminLoginAttempt, m.TwoFactorCode,
])
