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


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Department
        fields = "__all__"


class ProgrammeSerializer(serializers.ModelSerializer):
    total_semesters = serializers.ReadOnlyField()

    class Meta:
        model = m.Programme
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Course
        fields = "__all__"


class CurriculumUnitSerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)

    class Meta:
        model = m.CurriculumUnit
        fields = "__all__"


class CurriculumVersionSerializer(serializers.ModelSerializer):
    units = CurriculumUnitSerializer(many=True, read_only=True)

    class Meta:
        model = m.CurriculumVersion
        fields = "__all__"


# ----------------------------------------------------------------------
# CALENDAR
# ----------------------------------------------------------------------

class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.AcademicYear
        fields = "__all__"


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

    class Meta:
        model = m.Student
        fields = "__all__"
        read_only_fields = ["registration_number"]


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

    class Meta:
        model = m.LecturerUnitAllocation
        fields = "__all__"



class EnrollmentSerializer(serializers.ModelSerializer):
    student_detail = StudentSerializer(source="student", read_only=True)
    course_detail = CourseSerializer(source="course", read_only=True)

    class Meta:
        model = m.Enrollment
        fields = "__all__"


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
    class Meta:
        model = m.Grade
        fields = "__all__"
        read_only_fields = ["total_marks", "letter_grade", "grade_points", "quality_points",
                             "is_pass", "requires_supplementary", "published_at"]


class GradeEntrySerializer(serializers.Serializer):
    """Payload lecturers submit: raw CAT + exam marks; grading is computed server-side."""
    enrollment = serializers.PrimaryKeyRelatedField(queryset=m.Enrollment.objects.all())
    cat_marks = serializers.DecimalField(max_digits=5, decimal_places=2)
    final_exam_marks = serializers.DecimalField(max_digits=5, decimal_places=2)
    exam_date = serializers.DateField(required=False)


class TranscriptEntrySerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)

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
    class Meta:
        model = m.Room
        fields = "__all__"


class BedSerializer(serializers.ModelSerializer):
    room_detail = RoomSerializer(source="room", read_only=True)

    class Meta:
        model = m.Bed
        fields = "__all__"


class HostelBookingSerializer(serializers.ModelSerializer):
    bed_detail = BedSerializer(source="bed", read_only=True)

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
        read_only_fields = ["status", "processed_by", "reporting_date"]


class ClearanceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.ClearanceRequest
        fields = "__all__"
        read_only_fields = ["status", "processed_by", "processed_at", "requested_at"]


# ----------------------------------------------------------------------
# EXAMS / TIMETABLE / ATTENDANCE
# ----------------------------------------------------------------------

class ExaminationSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Examination
        fields = "__all__"


class TimetableSerializer(serializers.ModelSerializer):
    course_detail = CourseSerializer(source="course", read_only=True)

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
    invoice_status = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()

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
    """Detailed CAT submission with course and lecturer info."""
    course_code = serializers.CharField(source="lecturer_allocation.course.code", read_only=True)
    course_name = serializers.CharField(source="lecturer_allocation.course.name", read_only=True)
    lecturer_name = serializers.SerializerMethodField()
    is_open = serializers.ReadOnlyField()
    
    class Meta:
        model = m.CatSubmission
        fields = "__all__"
    
    def get_lecturer_name(self, obj):
        return f"{obj.lecturer_allocation.lecturer.user.first_name} {obj.lecturer_allocation.lecturer.user.last_name}"


class CatAnswerSubmissionDetailSerializer(serializers.ModelSerializer):
    """Detailed student CAT answer submission."""
    student_name = serializers.SerializerMethodField()
    cat_title = serializers.CharField(source="cat.title", read_only=True)
    
    class Meta:
        model = m.CatAnswerSubmission
        fields = "__all__"
        read_only_fields = ["submitted_at", "is_late", "marks_awarded", "graded_at", "graded_by"]
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"