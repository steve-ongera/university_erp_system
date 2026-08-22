from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from . import models as m


# ======================================================================
# USER / AUTH ADMIN
# ======================================================================

@admin.register(m.User)
class UserAdmin(UserAdmin):
    list_display = (
        "username", "first_name", "last_name", "email", "user_type", 
        "is_active", "is_2fa_enrolled", "created_at"
    )
    list_filter = ("user_type", "is_active", "is_2fa_enrolled", "gender")
    search_fields = ("username", "first_name", "last_name", "email", "phone", "national_id")
    readonly_fields = ("id", "created_at", "updated_at")
    
    fieldsets = (
        ("Login Credentials", {"fields": ("username", "password")}),
        ("Personal Information", {
            "fields": (
                "first_name", "last_name", "email", "phone", "address",
                "gender", "date_of_birth", "national_id", "profile_picture"
            )
        }),
        ("User Type & Permissions", {
            "fields": ("user_type", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")
        }),
        ("Security", {"fields": ("must_change_password", "is_2fa_enrolled")}),
        ("Metadata", {"fields": ("id", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "password1", "password2", "user_type", "first_name", "last_name", "email"),
        }),
    )


@admin.register(m.AdminLoginAttempt)
class AdminLoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("username", "ip_address", "attempt_time", "success", "failure_reason")
    list_filter = ("success", "attempt_time")
    search_fields = ("username", "ip_address")
    readonly_fields = ("attempt_time",)


@admin.register(m.TwoFactorCode)
class TwoFactorCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "code", "created_at", "expires_at", "is_used", "is_valid")
    list_filter = ("is_used", "created_at")
    search_fields = ("user__username", "code")
    readonly_fields = ("created_at",)


# ======================================================================
# ACADEMIC STRUCTURE ADMIN
# ======================================================================

@admin.register(m.Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "dean", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code")
    prepopulated_fields = {"code": ("name",)}


@admin.register(m.GradingScheme)
class GradingSchemeAdmin(admin.ModelAdmin):
    list_display = ("name", "pass_mark", "supplementary_floor", "band_count")
    search_fields = ("name",)
    
    def band_count(self, obj):
        return obj.bands.count()
    band_count.short_description = "Bands"


@admin.register(m.GradeBand)
class GradeBandAdmin(admin.ModelAdmin):
    list_display = ("scheme", "letter", "min_score", "max_score", "points", "is_fail_band", "is_supplementary_band")
    list_filter = ("scheme", "is_fail_band", "is_supplementary_band")
    search_fields = ("letter",)


@admin.register(m.Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "faculty", "head_of_department", "grading_scheme", "is_active")
    list_filter = ("faculty", "is_active")
    search_fields = ("name", "code")
    autocomplete_fields = ("faculty", "head_of_department", "grading_scheme")


@admin.register(m.Programme)
class ProgrammeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "programme_type", "department", "faculty", "duration_years", "is_active")
    list_filter = ("programme_type", "department", "faculty", "is_active")
    search_fields = ("name", "code")
    readonly_fields = ("total_semesters",)
    autocomplete_fields = ("department", "faculty")


@admin.register(m.Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "course_type", "department", "credit_hours", "is_active")
    list_filter = ("course_type", "department", "is_active")
    search_fields = ("name", "code")
    autocomplete_fields = ("department",)


@admin.register(m.CurriculumVersion)
class CurriculumVersionAdmin(admin.ModelAdmin):
    list_display = ("programme", "effective_academic_year", "is_active")
    list_filter = ("programme", "effective_academic_year", "is_active")
    search_fields = ("programme__name",)
    autocomplete_fields = ("programme", "effective_academic_year")


@admin.register(m.CurriculumUnit)
class CurriculumUnitAdmin(admin.ModelAdmin):
    list_display = ("curriculum_version", "course", "year", "semester", "is_mandatory")
    list_filter = ("curriculum_version__programme", "year", "semester", "is_mandatory")
    search_fields = ("course__name", "course__code")
    autocomplete_fields = ("curriculum_version", "course")


# ======================================================================
# CALENDAR ADMIN
# ======================================================================

@admin.register(m.AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ("year", "start_date", "end_date", "is_current", "semester_count")
    list_filter = ("is_current",)
    search_fields = ("year",)
    readonly_fields = ("semester_count",)
    
    def semester_count(self, obj):
        return obj.semesters.count()
    semester_count.short_description = "Semesters"


@admin.register(m.Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ("academic_year", "semester_number", "start_date", "end_date", "is_current")
    list_filter = ("academic_year", "is_current")
    search_fields = ("academic_year__year",)
    autocomplete_fields = ("academic_year",)


@admin.register(m.Intake)
class IntakeAdmin(admin.ModelAdmin):
    list_display = ("name", "academic_year", "starting_semester", "application_deadline", "is_active")
    list_filter = ("academic_year", "is_active")
    search_fields = ("name",)
    autocomplete_fields = ("academic_year", "starting_semester")


# ======================================================================
# PEOPLE ADMIN
# ======================================================================

class StudentDefermentInline(admin.TabularInline):
    model = m.StudentDeferment
    extra = 0
    fields = ("reason", "status", "deferred_from_semester", "applied_at")
    readonly_fields = ("applied_at",)


class HostelBookingInline(admin.TabularInline):
    model = m.HostelBooking
    extra = 0
    fields = ("bed", "academic_year", "status", "booked_at")
    readonly_fields = ("booked_at",)


@admin.register(m.Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = (
        "registration_number", "user", "programme", "current_year", "current_semester", 
        "status", "cumulative_gpa", "admission_date"
    )
    list_filter = ("programme", "status", "current_year", "current_semester", "sponsor_type")
    search_fields = ("registration_number", "user__first_name", "user__last_name", "user__username")
    readonly_fields = ("registration_number", "admission_date")
    autocomplete_fields = ("user", "programme", "curriculum_version", "intake")
    inlines = [StudentDefermentInline, HostelBookingInline]
    
    fieldsets = (
        ("Student Identity", {"fields": ("user", "registration_number", "programme", "curriculum_version", "intake")}),
        ("Academic Status", {"fields": ("current_year", "current_semester", "status", "sponsor_type")}),
        ("Academic Performance", {"fields": ("cumulative_gpa", "total_credit_hours_earned")}),
        ("Personal Information", {"fields": ("guardian_name", "guardian_phone", "emergency_contact")}),
        ("Dates", {"fields": ("admission_date", "expected_graduation_date")}),
    )


@admin.register(m.Lecturer)
class LecturerAdmin(admin.ModelAdmin):
    list_display = ("user", "employee_number", "department", "academic_rank", "is_active")
    list_filter = ("department", "is_active")
    search_fields = ("user__first_name", "user__last_name", "employee_number")
    autocomplete_fields = ("user", "department")


@admin.register(m.Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ("user", "employee_number", "department", "designation", "is_active")
    list_filter = ("department", "is_active")
    search_fields = ("user__first_name", "user__last_name", "employee_number")
    autocomplete_fields = ("user", "department")


@admin.register(m.StudentDeferment)
class StudentDefermentAdmin(admin.ModelAdmin):
    list_display = ("student", "status", "year_at_deferment", "semester_at_deferment", "applied_at", "processed_at")
    list_filter = ("status", "deferred_from_semester", "applied_at")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    readonly_fields = ("applied_at",)
    autocomplete_fields = ("student", "deferred_from_semester", "requested_resume_semester", "processed_by")


# ======================================================================
# UNIT ALLOCATION / REGISTRATION ADMIN
# ======================================================================

@admin.register(m.LecturerUnitAllocation)
class LecturerUnitAllocationAdmin(admin.ModelAdmin):
    list_display = ("lecturer", "course", "semester", "programme", "year", "programme_semester", "is_active")
    list_filter = ("semester", "programme", "year", "is_active", "is_supplementary_offering")
    search_fields = ("lecturer__user__first_name", "lecturer__user__last_name", "course__name", "course__code")
    autocomplete_fields = ("lecturer", "course", "semester", "programme", "assigned_by")


@admin.register(m.UnitRegistration)
class UnitRegistrationAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "semester", "registration_type", "is_active", "registered_at")
    list_filter = ("semester", "registration_type", "is_active")
    search_fields = ("student__registration_number", "course__name", "course__code")
    readonly_fields = ("registered_at",)
    autocomplete_fields = ("student", "course", "semester", "supplementary_invoice")


@admin.register(m.Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "semester", "lecturer_allocation", "is_active", "has_grade")
    list_filter = ("semester", "is_active")
    search_fields = ("student__registration_number", "course__name", "course__code")
    autocomplete_fields = ("student", "course", "semester", "lecturer_allocation", "registration")
    
    def has_grade(self, obj):
        return hasattr(obj, "grade")
    has_grade.boolean = True
    has_grade.short_description = "Grade"


# ======================================================================
# CATS / GRADES ADMIN
# ======================================================================

class CatAnswerSubmissionInline(admin.TabularInline):
    model = m.CatAnswerSubmission
    extra = 0
    fields = ("student", "submitted_at", "is_late", "marks_awarded")
    readonly_fields = ("submitted_at",)


@admin.register(m.CatSubmission)
class CatSubmissionAdmin(admin.ModelAdmin):
    list_display = ("title", "lecturer_allocation", "cat_number", "max_marks", "is_open", "is_published")
    list_filter = ("is_published", "lecturer_allocation__semester")
    search_fields = ("title", "lecturer_allocation__course__name")
    readonly_fields = ("is_open",)
    autocomplete_fields = ("lecturer_allocation",)
    inlines = [CatAnswerSubmissionInline]


@admin.register(m.CatAnswerSubmission)
class CatAnswerSubmissionAdmin(admin.ModelAdmin):
    list_display = ("student", "cat", "submitted_at", "is_late", "marks_awarded")
    list_filter = ("is_late", "graded_at")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    readonly_fields = ("submitted_at",)
    autocomplete_fields = ("cat", "student", "graded_by")


@admin.register(m.Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = (
        "enrollment", "letter_grade", "total_marks", "grade_points", "is_pass", 
        "requires_supplementary", "published_at"
    )
    list_filter = ("is_pass", "requires_supplementary", "is_supplementary_result", "published_at")
    search_fields = ("enrollment__student__registration_number", "enrollment__course__name")
    readonly_fields = ("total_marks", "letter_grade", "grade_points", "quality_points", "is_pass", "requires_supplementary")
    autocomplete_fields = ("enrollment", "entered_by")


@admin.register(m.TranscriptEntry)
class TranscriptEntryAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "academic_year", "semester_number", "letter_grade", "grade_points")
    list_filter = ("academic_year", "semester_number", "is_supplementary")
    search_fields = ("student__registration_number", "course__name", "course__code")
    readonly_fields = ("recorded_at",)


# ======================================================================
# FEES ADMIN
# ======================================================================

@admin.register(m.FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ("programme", "academic_year", "year", "semester", "tuition_fee", "government_subsidy", "net_fee")
    list_filter = ("programme", "academic_year", "year", "semester")
    search_fields = ("programme__name", "programme__code")
    autocomplete_fields = ("programme", "academic_year")
    
    def net_fee(self, obj):
        return obj.net_fee()
    net_fee.short_description = "Net Fee"


@admin.register(m.Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("student", "invoice_type", "semester", "amount_due", "balance", "is_active", "created_at")
    list_filter = ("invoice_type", "semester", "is_active")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    readonly_fields = ("created_at", "balance")
    autocomplete_fields = ("student", "fee_structure", "semester")
    
    def balance(self, obj):
        from .services import FeeService
        return FeeService.invoice_balance(obj)
    balance.short_description = "Balance"


@admin.register(m.StudentFeeAccount)
class StudentFeeAccountAdmin(admin.ModelAdmin):
    list_display = ("student", "credit_balance", "updated_at")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    readonly_fields = ("updated_at",)
    autocomplete_fields = ("student",)


@admin.register(m.FeePayment)
class FeePaymentAdmin(admin.ModelAdmin):
    list_display = ("student", "amount", "method", "bank_reference", "receipt_number", "is_reconciled", "payment_date")
    list_filter = ("method", "is_reconciled", "payment_date")
    search_fields = ("student__registration_number", "bank_reference", "receipt_number")
    readonly_fields = ("received_at",)
    autocomplete_fields = ("student",)


@admin.register(m.InvoiceAllocation)
class InvoiceAllocationAdmin(admin.ModelAdmin):
    list_display = ("payment", "invoice", "amount_applied", "allocated_at")
    list_filter = ("allocated_at",)
    search_fields = ("payment__bank_reference", "invoice__student__registration_number")
    readonly_fields = ("allocated_at",)
    autocomplete_fields = ("payment", "invoice")


@admin.register(m.HelbBursaryAward)
class HelbBursaryAwardAdmin(admin.ModelAdmin):
    list_display = ("student", "source", "amount_awarded", "academic_year", "disbursed", "disbursed_date")
    list_filter = ("source", "disbursed", "academic_year")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    autocomplete_fields = ("student", "academic_year")


# ======================================================================
# HOSTEL ADMIN
# ======================================================================

@admin.register(m.Hostel)
class HostelAdmin(admin.ModelAdmin):
    list_display = ("name", "hostel_type", "warden", "is_active", "room_count")
    list_filter = ("hostel_type", "is_active")
    search_fields = ("name",)
    autocomplete_fields = ("warden",)
    
    def room_count(self, obj):
        return obj.rooms.count()
    room_count.short_description = "Rooms"


@admin.register(m.Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("hostel", "room_number", "capacity", "is_active", "bed_count")
    list_filter = ("hostel", "is_active")
    search_fields = ("room_number",)
    autocomplete_fields = ("hostel",)
    
    def bed_count(self, obj):
        return obj.beds.count()
    bed_count.short_description = "Beds"


@admin.register(m.Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = ("room", "bed_number", "academic_year", "is_available")
    list_filter = ("room__hostel", "academic_year", "is_available")
    search_fields = ("bed_number", "room__room_number")
    autocomplete_fields = ("room", "academic_year")


@admin.register(m.HostelBooking)
class HostelBookingAdmin(admin.ModelAdmin):
    list_display = ("student", "bed", "academic_year", "status", "booked_at", "checked_in_at")
    list_filter = ("status", "academic_year")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    readonly_fields = ("booked_at",)
    autocomplete_fields = ("student", "bed", "academic_year")


# ======================================================================
# REPORTING / CLEARANCE ADMIN
# ======================================================================

@admin.register(m.StudentReporting)
class StudentReportingAdmin(admin.ModelAdmin):
    list_display = ("student", "semester", "reporting_type", "status", "reporting_date")
    list_filter = ("semester", "status", "reporting_type")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    readonly_fields = ("reporting_date",)
    autocomplete_fields = ("student", "semester", "processed_by")


@admin.register(m.ClearanceRequest)
class ClearanceRequestAdmin(admin.ModelAdmin):
    list_display = ("student", "clearance_type", "status", "requested_at", "processed_at")
    list_filter = ("clearance_type", "status")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    readonly_fields = ("requested_at",)
    autocomplete_fields = ("student", "processed_by")


# ======================================================================
# EXAMINATIONS / TIMETABLE / ATTENDANCE ADMIN
# ======================================================================

@admin.register(m.Examination)
class ExaminationAdmin(admin.ModelAdmin):
    list_display = ("course", "semester", "exam_type", "exam_date", "start_time", "venue", "is_published")
    list_filter = ("semester", "exam_type", "is_published")
    search_fields = ("course__name", "course__code", "venue")
    autocomplete_fields = ("course", "semester")


@admin.register(m.Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display = ("course", "lecturer", "semester", "programme", "day_of_week", "start_time", "end_time", "venue")
    list_filter = ("semester", "programme", "day_of_week", "is_active")
    search_fields = ("course__name", "course__code", "venue")
    autocomplete_fields = ("course", "lecturer", "semester", "programme")


@admin.register(m.AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ("timetable_slot", "session_date", "expires_at", "is_active")
    list_filter = ("is_active", "session_date")
    search_fields = ("timetable_slot__course__name",)
    autocomplete_fields = ("timetable_slot",)


@admin.register(m.Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("student", "attendance_session", "status", "marked_at")
    list_filter = ("status", "attendance_session__session_date")
    search_fields = ("student__registration_number", "student__user__first_name", "student__user__last_name")
    readonly_fields = ("marked_at",)
    autocomplete_fields = ("student", "attendance_session")


# ======================================================================
# NOTIFICATIONS ADMIN
# ======================================================================

@admin.register(m.Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "recipient", "notification_type", "is_read", "created_at")
    list_filter = ("is_read", "notification_type", "created_at")
    search_fields = ("title", "message", "recipient__username")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("recipient",)


@admin.register(m.ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "object_repr", "timestamp", "ip_address")
    list_filter = ("action", "timestamp")
    search_fields = ("user__username", "action", "object_repr", "description")
    readonly_fields = ("timestamp",)
    autocomplete_fields = ("user",)