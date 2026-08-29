from decimal import Decimal

from rest_framework import serializers

from . import models as m
from . import services


# ----------------------------------------------------------------------
# AUTH
# ----------------------------------------------------------------------

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(help_text="Registration number or employee number")
    password = serializers.CharField(write_only=True)


class VerifyOtpSerializer(serializers.Serializer):
    username = serializers.CharField()
    code = serializers.CharField(max_length=6)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.User
        fields = ["id", "username", "first_name", "last_name", "user_type", "email",
                  "phone", "gender", "profile_picture", "must_change_password", "is_2fa_enrolled"]
        read_only_fields = ["id", "username", "user_type"]


# ----------------------------------------------------------------------
# ACADEMIC STRUCTURE
# ----------------------------------------------------------------------

class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Faculty
        fields = "__all__"


class GradeBandSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.GradeBand
        fields = "__all__"


class GradingSchemeSerializer(serializers.ModelSerializer):
    bands = GradeBandSerializer(many=True, read_only=True)

    class Meta:
        model = m.GradingScheme
        fields = "__all__"


class GradeTranscriptSerializer(serializers.ModelSerializer):
    """
    Presents a Grade row in transcript shape. Grade is the single
    source of truth (OneToOneField on Enrollment — exactly one row,
    always current, whether it was set via GradingService or corrected
    by hand in admin). Field names match TranscriptEntrySerializer's
    output so the frontend transcript UI works unchanged.
    """
    course_detail = serializers.SerializerMethodField()
    academic_year_detail = serializers.SerializerMethodField()
    semester_number = serializers.SerializerMethodField()
    programme_year = serializers.SerializerMethodField()
    credit_hours = serializers.SerializerMethodField()
    is_supplementary = serializers.BooleanField(source="is_supplementary_result", read_only=True)

    class Meta:
        model = m.Grade
        fields = [
            "id", "course_detail", "academic_year_detail", "semester_number",
            "programme_year", "letter_grade", "grade_points", "credit_hours",
            "quality_points", "is_supplementary", "is_pass",
            "requires_supplementary", "published_at",
        ]

    def get_course_detail(self, obj):
        return CourseSerializer(obj.enrollment.course).data

    def get_academic_year_detail(self, obj):
        return AcademicYearSerializer(obj.enrollment.semester.academic_year).data

    def get_semester_number(self, obj):
        return obj.enrollment.semester.semester_number

    def get_programme_year(self, obj):
        allocation = obj.enrollment.lecturer_allocation
        if allocation:
            return allocation.year
        # Fall back to the curriculum map itself — this stays correct even
        # when no LecturerUnitAllocation was ever linked to this Enrollment
        # (historical data, or an allocation that was later deactivated),
        # since CurriculumUnit is the actual (curriculum_version, course)
        # -> (year, semester) source of truth.
        curriculum_unit = m.CurriculumUnit.objects.filter(
            curriculum_version=obj.enrollment.student.curriculum_version,
            course=obj.enrollment.course,
        ).first()
        return curriculum_unit.year if curriculum_unit else None

    def get_credit_hours(self, obj):
        return obj.enrollment.course.credit_hours
    
    
class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.AcademicYear
        fields = "__all__"



class DepartmentSerializer(serializers.ModelSerializer):
    head_of_department_detail = serializers.SerializerMethodField()
    faculty_detail = serializers.SerializerMethodField()

    class Meta:
        model = m.Department
        fields = "__all__"

    def get_head_of_department_detail(self, obj):
        return obj.head_of_department.get_full_name() if obj.head_of_department else None

    def get_faculty_detail(self, obj):
        return {"id": obj.faculty.id, "name": obj.faculty.name, "code": obj.faculty.code} if obj.faculty else None




class ProgrammeSerializer(serializers.ModelSerializer):
    total_semesters = serializers.ReadOnlyField()

    class Meta:
        model = m.Programme
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Course
        fields = "__all__"

class CurriculumVersionBriefSerializer(serializers.ModelSerializer):
    """Used inside CurriculumUnitSerializer — deliberately excludes `units` to avoid recursion."""
    effective_academic_year_detail = AcademicYearSerializer(source="effective_academic_year", read_only=True)

    class Meta:
        model = m.CurriculumVersion
        fields = ["id", "programme", "effective_academic_year", "effective_academic_year_detail", "is_active", "notes"]



class CurriculumUnitSerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)
    curriculum_version_detail = CurriculumVersionBriefSerializer(source="curriculum_version", read_only=True)

    class Meta:
        model = m.CurriculumUnit
        fields = "__all__"


class CurriculumVersionSerializer(serializers.ModelSerializer):
    units = CurriculumUnitSerializer(many=True, read_only=True)
    effective_academic_year_detail = AcademicYearSerializer(source="effective_academic_year", read_only=True)

    class Meta:
        model = m.CurriculumVersion
        fields = "__all__"


# ----------------------------------------------------------------------
# CALENDAR
# ----------------------------------------------------------------------


class SemesterSerializer(serializers.ModelSerializer):
    academic_year_detail = AcademicYearSerializer(source="academic_year", read_only=True)

    class Meta:
        model = m.Semester
        fields = "__all__"


class IntakeSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Intake
        fields = "__all__"


# ----------------------------------------------------------------------
# PEOPLE
# ----------------------------------------------------------------------

class LecturerSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    department_detail = DepartmentSerializer(source="department", read_only=True)

    class Meta:
        model = m.Lecturer
        fields = "__all__"


class StaffSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)

    class Meta:
        model = m.Staff
        fields = "__all__"


class StudentSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    programme_detail = ProgrammeSerializer(source="programme", read_only=True)
    cumulative_gpa = serializers.SerializerMethodField()

    class Meta:
        model = m.Student
        fields = "__all__"
        read_only_fields = ["registration_number"]

    def get_cumulative_gpa(self, obj):
        # Prefer the stored value once GradingService starts keeping it
        # current; fall back to a live computation for any student whose
        # grades were entered before this field was wired up.
        if obj.cumulative_gpa is not None:
            return float(obj.cumulative_gpa)
        from .services import GradingService
        return GradingService.compute_cumulative_gpa(obj)
    
    
class AdmitStudentSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    gender = serializers.ChoiceField(choices=m.User.Gender.choices)
    programme = serializers.PrimaryKeyRelatedField(queryset=m.Programme.objects.all())
    intake = serializers.PrimaryKeyRelatedField(queryset=m.Intake.objects.all())
    curriculum_version = serializers.PrimaryKeyRelatedField(queryset=m.CurriculumVersion.objects.all())
    sponsor_type = serializers.ChoiceField(choices=m.Student.SponsorType.choices,
                                            default=m.Student.SponsorType.SELF)

    def create(self, validated_data):
        return services.AdmissionService.admit_student(
            full_name_first=validated_data["first_name"],
            full_name_last=validated_data["last_name"],
            gender=validated_data["gender"],
            programme=validated_data["programme"],
            intake=validated_data["intake"],
            curriculum_version=validated_data["curriculum_version"],
            sponsor_type=validated_data["sponsor_type"],
        )


class StudentDefermentSerializer(serializers.ModelSerializer):
    student_detail = StudentSerializer(source="student", read_only=True)
    class Meta:
        model = m.StudentDeferment
        fields = "__all__"
        read_only_fields = ["status", "processed_by", "processed_at", "resumed_at",
                             "year_at_deferment", "semester_at_deferment"]

# ----------------------------------------------------------------------
# UNITS / ENROLLMENT
# ----------------------------------------------------------------------
class LecturerUnitAllocationSerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)
    lecturer_detail = LecturerSerializer(source="lecturer", read_only=True)
    semester_detail = SemesterSerializer(source="semester", read_only=True)
    programme_detail = ProgrammeSerializer(source="programme", read_only=True)   # <-- add this
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = m.LecturerUnitAllocation
        fields = "__all__"

    def get_student_count(self, obj):
        return obj.roster().count()


class EnrollmentSerializer(serializers.ModelSerializer):
    student_detail = StudentSerializer(source="student", read_only=True)
    course_detail = CourseSerializer(source="course", read_only=True)
    semester_detail = SemesterSerializer(source="semester", read_only=True)
    programme_year = serializers.SerializerMethodField()
    programme_semester = serializers.SerializerMethodField()

    class Meta:
        model = m.Enrollment
        fields = "__all__"

    def get_programme_year(self, obj):
        return obj.lecturer_allocation.year if obj.lecturer_allocation else None

    def get_programme_semester(self, obj):
        return obj.lecturer_allocation.programme_semester if obj.lecturer_allocation else None




# ----------------------------------------------------------------------
# CATS / GRADES
# ----------------------------------------------------------------------

class CatSubmissionSerializer(serializers.ModelSerializer):
    is_open = serializers.ReadOnlyField()

    class Meta:
        model = m.CatSubmission
        fields = "__all__"


class CatAnswerSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.CatAnswerSubmission
        fields = "__all__"
        read_only_fields = ["submitted_at", "is_late", "marks_awarded", "graded_at", "graded_by"]


class GradeSerializer(serializers.ModelSerializer):
    enrollment_detail = EnrollmentSerializer(source="enrollment", read_only=True)
    verified_by_detail = UserSerializer(source="verified_by", read_only=True)

    class Meta:
        model = m.Grade
        fields = "__all__"
        read_only_fields = ["total_marks", "letter_grade", "grade_points", "quality_points",
                             "is_pass", "requires_supplementary", "published_at",
                             "is_verified", "verified_by", "verified_at"]

class GradeEntrySerializer(serializers.Serializer):
    """Payload lecturers submit: raw CAT + exam marks; grading is computed server-side."""
    enrollment = serializers.PrimaryKeyRelatedField(queryset=m.Enrollment.objects.all())
    cat_marks = serializers.DecimalField(max_digits=5, decimal_places=2)
    final_exam_marks = serializers.DecimalField(max_digits=5, decimal_places=2)
    exam_date = serializers.DateField(required=False)


class TranscriptEntrySerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)
    academic_year_detail = AcademicYearSerializer(source="academic_year", read_only=True)

    class Meta:
        model = m.TranscriptEntry
        fields = "__all__"


# ----------------------------------------------------------------------
# FEES
# ----------------------------------------------------------------------

class FeeStructureSerializer(serializers.ModelSerializer):
    total_fee = serializers.SerializerMethodField()
    net_fee = serializers.SerializerMethodField()

    class Meta:
        model = m.FeeStructure
        fields = "__all__"

    def get_total_fee(self, obj):
        return obj.total_fee()

    def get_net_fee(self, obj):
        return obj.net_fee()


class InvoiceSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = m.Invoice
        fields = "__all__"

    def get_balance(self, obj):
        from .services import FeeService
        return FeeService.invoice_balance(obj)


class FeePaymentSerializer(serializers.ModelSerializer):
    student_detail = StudentSerializer(source="student", read_only=True)
    class Meta:
        model = m.FeePayment
        fields = "__all__"
        read_only_fields = ["receipt_number", "is_reconciled", "received_at"]

class BankNotificationSerializer(serializers.Serializer):
    """What the bank/ERP integration posts to the webhook."""
    registration_number = serializers.CharField()
    payer_name = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    bank_name = serializers.CharField()
    bank_reference = serializers.CharField()
    payment_date = serializers.DateTimeField(required=False)


class StudentFeeAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.StudentFeeAccount
        fields = "__all__"


class HelbBursaryAwardSerializer(serializers.ModelSerializer):
    student_detail = StudentSerializer(source="student", read_only=True)
    class Meta:
        model = m.HelbBursaryAward
        fields = "__all__"



# ----------------------------------------------------------------------
# HOSTEL
# ----------------------------------------------------------------------

class HostelSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Hostel
        fields = "__all__"


class RoomSerializer(serializers.ModelSerializer):
    hostel_detail = HostelSerializer(source="hostel", read_only=True)
    class Meta:
        model = m.Room
        fields = "__all__"


class BedSerializer(serializers.ModelSerializer):
    room_detail = RoomSerializer(source="room", read_only=True)
    academic_year_detail = AcademicYearSerializer(source="academic_year", read_only=True)
    class Meta:
        model = m.Bed
        fields = "__all__"


class HostelBookingSerializer(serializers.ModelSerializer):
    bed_detail = BedSerializer(source="bed", read_only=True)
    student_detail = StudentSerializer(source="student", read_only=True)
    class Meta:
        model = m.HostelBooking
        fields = "__all__"
        read_only_fields = ["status", "booked_at", "checked_in_at", "checked_out_at"]



# ----------------------------------------------------------------------
# REPORTING / CLEARANCE
# ----------------------------------------------------------------------

class StudentReportingSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.StudentReporting
        fields = "__all__"
        read_only_fields = ["student", "status", "processed_by", "reporting_date"]


class ClearanceRequestSerializer(serializers.ModelSerializer):
    student_detail = StudentSerializer(source="student", read_only=True)

    class Meta:
        model = m.ClearanceRequest
        fields = "__all__"
        read_only_fields = ["student", "status", "processed_by", "processed_at", "requested_at"]

 
        
# ----------------------------------------------------------------------
# EXAMS / TIMETABLE / ATTENDANCE
# ----------------------------------------------------------------------

class ExaminationSerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)
    semester_detail = SemesterSerializer(source="semester", read_only=True)

    class Meta:
        model = m.Examination
        fields = "__all__"


class TimetableSerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)
    lecturer_detail = LecturerSerializer(source="lecturer", read_only=True)

    class Meta:
        model = m.Timetable
        fields = "__all__"


class AttendanceSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.AttendanceSession
        fields = "__all__"


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Attendance
        fields = "__all__"


# ----------------------------------------------------------------------
# NOTIFICATIONS
# ----------------------------------------------------------------------

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Notification
        fields = "__all__"
        read_only_fields = ["created_at"]



# ----------------------------------------------------------------------
# UNITS / ENROLLMENT (Enhanced)
# ----------------------------------------------------------------------

class CourseDetailSerializer(serializers.ModelSerializer):
    """Detailed course information for unit registrations."""
    department_name = serializers.CharField(source="department.name", read_only=True)
    
    class Meta:
        model = m.Course
        fields = ["id", "code", "name", "credit_hours", "course_type", "department_name", "description"]


class SemesterDetailSerializer(serializers.ModelSerializer):
    """Detailed semester information."""
    academic_year_detail = AcademicYearSerializer(source="academic_year", read_only=True)
    
    class Meta:
        model = m.Semester
        fields = ["id", "semester_number", "academic_year", "academic_year_detail", "is_current"]



class UnitRegistrationSerializer(serializers.ModelSerializer):
    course_detail = CourseDetailSerializer(source="course", read_only=True)
    semester_detail = SemesterDetailSerializer(source="semester", read_only=True)
    student_detail = StudentSerializer(source="student", read_only=True)
    has_grade = serializers.SerializerMethodField()
    grade_detail = serializers.SerializerMethodField()
    enrollment_id = serializers.SerializerMethodField()
    invoice_status = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()
    lecturer_detail = serializers.SerializerMethodField()   # <-- new

    class Meta:
        model = m.UnitRegistration
        fields = "__all__"
        read_only_fields = ["registered_at"]

    def get_has_grade(self, obj):
        return hasattr(obj, "enrollment") and hasattr(obj.enrollment, "grade")

    def get_grade_detail(self, obj):
        if hasattr(obj, "enrollment") and hasattr(obj.enrollment, "grade"):
            return GradeSerializer(obj.enrollment.grade).data
        return None

    def get_enrollment_id(self, obj):
        return obj.enrollment.id if hasattr(obj, "enrollment") else None

    def get_lecturer_detail(self, obj):
        """
        Looks up the CURRENT allocation directly from LecturerUnitAllocation
        (the authoritative table) rather than Enrollment.lecturer_allocation,
        which is only set once when the Enrollment row is first created and
        goes stale if an allocation is added/changed afterward.
        """
        if not hasattr(obj, "enrollment"):
            return None
        enrollment = obj.enrollment
        allocation = (
            m.LecturerUnitAllocation.objects
            .filter(course=enrollment.course, semester=enrollment.semester, is_active=True)
            .select_related("lecturer__user")
            .first()
        )
        if not allocation:
            return None
        lecturer = allocation.lecturer
        return {
            "id": lecturer.id,
            "employee_number": lecturer.employee_number,
            "full_name": lecturer.user.get_full_name(),
            "email": lecturer.user.email,
        }

    def get_invoice_status(self, obj):
        if obj.supplementary_invoice:
            from .services import FeeService
            balance = FeeService.invoice_balance(obj.supplementary_invoice)
            return {
                "invoice_id": obj.supplementary_invoice.id,
                "amount_due": obj.supplementary_invoice.amount_due,
                "balance": balance,
                "is_paid": balance <= 0
            }
        return None

    def get_is_paid(self, obj):
        if obj.registration_type == m.UnitRegistration.RegType.SUPPLEMENTARY:
            if obj.supplementary_invoice:
                from .services import FeeService
                return FeeService.invoice_balance(obj.supplementary_invoice) <= 0
            return False
        return True


class AutoRegisterUnitsSerializer(serializers.Serializer):
    semester = serializers.PrimaryKeyRelatedField(
        queryset=m.Semester.objects.filter(is_current=True)
    )
    
    
    
# ----------------------------------------------------------------------
# CATS / ASSESSMENTS (Enhanced)
# ----------------------------------------------------------------------
class CatSubmissionDetailSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="lecturer_allocation.course.code", read_only=True)
    course_name = serializers.CharField(source="lecturer_allocation.course.name", read_only=True)
    lecturer_name = serializers.SerializerMethodField()
    is_open = serializers.ReadOnlyField()
    seconds_remaining = serializers.ReadOnlyField()
    submission_count = serializers.SerializerMethodField()
    graded_count = serializers.SerializerMethodField()

    class Meta:
        model = m.CatSubmission
        fields = "__all__"

    def get_lecturer_name(self, obj):
        return f"{obj.lecturer_allocation.lecturer.user.first_name} {obj.lecturer_allocation.lecturer.user.last_name}"

    def get_submission_count(self, obj):
        return obj.student_submissions.count()

    def get_graded_count(self, obj):
        return obj.student_submissions.filter(marks_awarded__isnull=False).count()


class CatAnswerSubmissionDetailSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    registration_number = serializers.CharField(source="student.registration_number", read_only=True)
    cat_title = serializers.CharField(source="cat.title", read_only=True)
    max_marks = serializers.DecimalField(source="cat.max_marks", max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = m.CatAnswerSubmission
        fields = "__all__"
        read_only_fields = ["submitted_at", "is_late", "graded_at", "graded_by"]

    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"


class GradeCatAnswerSerializer(serializers.Serializer):
    marks_awarded = serializers.DecimalField(max_digits=5, decimal_places=2)


class LectureNoteSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="lecturer_allocation.course.code", read_only=True)
    course_name = serializers.CharField(source="lecturer_allocation.course.name", read_only=True)

    class Meta:
        model = m.LectureNote
        fields = "__all__"
        read_only_fields = ["uploaded_at", "uploaded_by"]
    
    
    

# ======================================================================
# ADMIN DASHBOARD SERIALIZERS
# ======================================================================

class AdminDashboardStatsSerializer(serializers.Serializer):
    total_students = serializers.IntegerField()
    total_staff = serializers.IntegerField()
    total_programmes = serializers.IntegerField()
    total_departments = serializers.IntegerField()
    active_students = serializers.IntegerField()
    graduated_students = serializers.IntegerField()


class AdminDashboardStudentSerializer(serializers.ModelSerializer):
    """Simplified student serializer for admin dashboard."""
    user_detail = UserSerializer(source="user", read_only=True)
    programme_detail = ProgrammeSerializer(source="programme", read_only=True)
    
    class Meta:
        model = m.Student
        fields = [
            "id", "registration_number", "user_detail", "programme_detail",
            "current_year", "current_semester", "status", "admission_date"
        ]


class AdminDashboardProgrammeDistributionSerializer(serializers.Serializer):
    name = serializers.CharField()
    code = serializers.CharField()
    count = serializers.IntegerField()
    color = serializers.CharField(default="#3b6ce0")


class AdminDashboardDepartmentStatSerializer(serializers.Serializer):
    name = serializers.CharField()
    code = serializers.CharField()
    student_count = serializers.IntegerField()
    programmes = serializers.IntegerField()


class AdminDashboardResponseSerializer(serializers.Serializer):
    stats = AdminDashboardStatsSerializer()
    recent_students = AdminDashboardStudentSerializer(many=True)
    enrollment_trends = serializers.ListField()
    programme_distribution = AdminDashboardProgrammeDistributionSerializer(many=True)
    department_stats = AdminDashboardDepartmentStatSerializer(many=True)
    
    
class AdmitLecturerSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    gender = serializers.ChoiceField(choices=m.User.Gender.choices)
    department = serializers.PrimaryKeyRelatedField(queryset=m.Department.objects.all())
    academic_rank = serializers.CharField(required=False, allow_blank=True, default="")
    joining_date = serializers.DateField(required=False)

    def create(self, validated_data):
        return services.StaffService.admit_lecturer(**validated_data)


class AdmitStaffSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    gender = serializers.ChoiceField(choices=m.User.Gender.choices)
    department = serializers.PrimaryKeyRelatedField(queryset=m.Department.objects.all(), required=False, allow_null=True)
    designation = serializers.CharField(required=False, allow_blank=True, default="")
    user_type = serializers.ChoiceField(choices=m.User.UserType.choices, default=m.User.UserType.STAFF)

    def create(self, validated_data):
        return services.StaffService.admit_staff(**validated_data)
    
      
class InvoiceAllocationSerializer(serializers.ModelSerializer):
    invoice_detail = InvoiceSerializer(source="invoice", read_only=True)
    class Meta:
        model = m.InvoiceAllocation
        fields = "__all__"


class StudentReportingDetailSerializer(serializers.ModelSerializer):
    """Used for staff/admin views — includes nested student/semester/processor info."""
    student_detail = StudentSerializer(source="student", read_only=True)
    semester_detail = SemesterSerializer(source="semester", read_only=True)
    processed_by_detail = UserSerializer(source="processed_by", read_only=True)

    class Meta:
        model = m.StudentReporting
        fields = "__all__"


class BulkReportingStatusUpdateSerializer(serializers.Serializer):
    reporting_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    status = serializers.ChoiceField(choices=m.StudentReporting.Status.choices)
    
class AdminReportForStudentSerializer(serializers.Serializer):
    """Lets staff create/override a reporting record on behalf of a student."""
    student = serializers.PrimaryKeyRelatedField(queryset=m.Student.objects.all())
    semester = serializers.PrimaryKeyRelatedField(queryset=m.Semester.objects.all())
    reporting_type = serializers.ChoiceField(
        choices=[("online", "Online"), ("physical", "Physical")], default="physical"
    )
    status = serializers.ChoiceField(
        choices=m.StudentReporting.Status.choices, default=m.StudentReporting.Status.APPROVED
    )    
    

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.User
        fields = ["id", "username", "first_name", "last_name", "email", "phone", "gender",
                  "user_type", "address", "is_active", "must_change_password",
                  "is_2fa_enrolled", "date_joined", "created_at",
                  "failed_login_attempts", "is_locked", "locked_at",
                  "last_login_ip", "last_login_at"]
        read_only_fields = ["id", "user_type", "date_joined", "created_at",
                             "failed_login_attempts", "is_locked", "locked_at",
                             "last_login_ip", "last_login_at"]


class AdminCreateUserSerializer(serializers.Serializer):
    username = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=m.User.Gender.choices, required=False, allow_blank=True)
    user_type = serializers.ChoiceField(choices=m.User.UserType.choices)
    password = serializers.CharField(required=False, allow_blank=True)
    
    
    

class LoginSessionSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)

    class Meta:
        model = m.LoginSession
        fields = "__all__"


class AccountLockEventSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    performed_by_detail = UserSerializer(source="performed_by", read_only=True)

    class Meta:
        model = m.AccountLockEvent
        fields = "__all__"


class SecurityAlertSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    resolved_by_detail = UserSerializer(source="resolved_by", read_only=True)

    class Meta:
        model = m.SecurityAlert
        fields = "__all__"
        read_only_fields = ["is_resolved", "resolved_by", "resolved_at", "created_at"]


class AdminLoginAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.AdminLoginAttempt
        fields = "__all__"
        
  