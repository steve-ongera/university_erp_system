from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from rest_framework import serializers
from django.db.models import Q, Count, Sum, Prefetch
from . import utils

from . import models as m
from . import serializers as s
from . import services

from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter


# ======================================================================
# PERMISSIONS
# ======================================================================

class IsRole(permissions.BasePermission):
    """Usage: permission_classes = [IsRole.for_roles('admin', 'registrar')]"""
    allowed_roles = ()

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                     and request.user.user_type in self.allowed_roles)

    @classmethod
    def for_roles(cls, *roles):
        return type("IsRoleDynamic", (cls,), {"allowed_roles": roles})


class IsStaffRole(permissions.BasePermission):
    STAFF_ROLES = {"admin", "registrar", "dean", "cod", "finance", "hostel_warden", "exam_office", "lecturer"}

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                     and request.user.user_type in self.STAFF_ROLES)


# ======================================================================
# AUTH VIEWS
# ======================================================================

def _client_ip(request):
    return request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = s.LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ip = _client_ip(request)
        ua = request.META.get("HTTP_USER_AGENT", "")

        try:
            user = services.AuthService.authenticate(
                serializer.validated_data["username"], serializer.validated_data["password"], ip, ua
            )
        except services.AuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        if services.AuthService.bypass_required():
            services.AuthService.start_bypassed_session(user, ip, ua)
            return Response(self._tokens_payload(user))

        services.AuthService.issue_otp(user, ip)
        return Response({"detail": "OTP sent.", "otp_required": True, "username": user.username})

    @staticmethod
    def _tokens_payload(user):
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": s.UserSerializer(user).data,
        }


class VerifyOtpView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = s.VerifyOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = m.User.objects.filter(username=serializer.validated_data["username"]).first()
        if not user:
            return Response({"detail": "Unknown user."}, status=status.HTTP_404_NOT_FOUND)

        ip = _client_ip(request)
        ua = request.META.get("HTTP_USER_AGENT", "")
        if not services.AuthService.verify_otp(user, serializer.validated_data["code"], ip, ua):
            return Response({"detail": "Invalid or expired code."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(LoginView._tokens_payload(user))



class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(s.UserSerializer(request.user).data)

    def patch(self, request):
        serializer = s.UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)





class LoginSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """Device/IP login history — read-only, admin-visible audit trail."""
    queryset = m.LoginSession.objects.select_related("user")
    serializer_class = s.LoginSessionSerializer
    permission_classes = [IsRole.for_roles("admin")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["user", "ip_address", "otp_bypassed"]
    search_fields = ["user__username", "user__first_name", "user__last_name", "ip_address", "device_label"]
    ordering_fields = ["login_at"]
    ordering = ["-login_at"]


class AccountLockEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Lock/unlock audit trail — who locked/unlocked which account and why."""
    queryset = m.AccountLockEvent.objects.select_related("user", "performed_by")
    serializer_class = s.AccountLockEventSerializer
    permission_classes = [IsRole.for_roles("admin")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["user", "action", "reason"]
    search_fields = ["user__username", "user__first_name", "user__last_name"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]


class SecurityAlertViewSet(viewsets.ReadOnlyModelViewSet):
    """Unresolved/resolved security alerts admins need to act on."""
    queryset = m.SecurityAlert.objects.select_related("user", "resolved_by")
    serializer_class = s.SecurityAlertSerializer
    permission_classes = [IsRole.for_roles("admin")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["alert_type", "is_resolved", "user"]
    search_fields = ["user__username", "message"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.is_resolved = True
        alert.resolved_by = request.user
        alert.resolved_at = timezone.now()
        alert.save(update_fields=["is_resolved", "resolved_by", "resolved_at"])
        return Response(s.SecurityAlertSerializer(alert).data)


class AdminLoginAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """Every login attempt (success or fail) — the finest-grained audit record."""
    queryset = m.AdminLoginAttempt.objects.all()
    serializer_class = s.AdminLoginAttemptSerializer
    permission_classes = [IsRole.for_roles("admin")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["success", "username", "ip_address"]
    search_fields = ["username", "ip_address", "failure_reason"]
    ordering_fields = ["attempt_time"]
    ordering = ["-attempt_time"]


class SecurityAuditDashboardView(APIView):
    """Summary stats for the top of the Security Audit page."""
    permission_classes = [IsRole.for_roles("admin")]

    def get(self, request):
        from django.db.models import Count
        locked_users = m.User.objects.filter(is_locked=True)
        recent_failed = m.AdminLoginAttempt.objects.filter(success=False).order_by("-attempt_time")[:10]
        recent_sessions = m.LoginSession.objects.select_related("user").order_by("-login_at")[:10]
        unresolved_alerts = m.SecurityAlert.objects.filter(is_resolved=False).select_related("user")

        return Response({
            "stats": {
                "locked_accounts": locked_users.count(),
                "unresolved_alerts": unresolved_alerts.count(),
                "failed_logins_today": m.AdminLoginAttempt.objects.filter(
                    success=False, attempt_time__date=timezone.now().date()
                ).count(),
                "active_sessions_today": m.LoginSession.objects.filter(
                    login_at__date=timezone.now().date()
                ).count(),
            },
            "locked_accounts": s.AdminUserSerializer(locked_users, many=True).data,
            "recent_failed_attempts": s.AdminLoginAttemptSerializer(recent_failed, many=True).data,
            "recent_sessions": s.LoginSessionSerializer(recent_sessions, many=True).data,
            "unresolved_alerts": s.SecurityAlertSerializer(unresolved_alerts, many=True).data,
        })
        
        
# ======================================================================
# ACADEMIC STRUCTURE
# ======================================================================

class FacultyViewSet(viewsets.ModelViewSet):
    queryset = m.Faculty.objects.all()
    serializer_class = s.FacultySerializer
    permission_classes = [IsStaffRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code"]
    ordering = ["name"]



class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = m.Department.objects.all()
    serializer_class = s.DepartmentSerializer
    permission_classes = [IsStaffRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name", "code"]
    filterset_fields = ["faculty", "is_active"]
    ordering_fields = ["name", "code"]
    ordering = ["name"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type == "dean":
            faculty = services.get_dean_faculty(self.request.user)
            return qs.filter(faculty=faculty) if faculty else qs.none()
        return qs

    def perform_create(self, serializer):
        if self.request.user.user_type == "dean":
            raise serializers.ValidationError("Deans have read-only access to departments.")
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.user_type == "dean":
            raise serializers.ValidationError("Deans have read-only access to departments.")
        serializer.save()



class GradingSchemeViewSet(viewsets.ModelViewSet):
    queryset = m.GradingScheme.objects.all()
    serializer_class = s.GradingSchemeSerializer
    permission_classes = [IsRole.for_roles("admin", "registrar", "exam_office")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name"]
    ordering = ["name"]


class ProgrammeViewSet(viewsets.ModelViewSet):
    queryset = m.Programme.objects.all()
    serializer_class = s.ProgrammeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name", "code"]
    filterset_fields = ["faculty", "department", "programme_type", "is_active"]
    ordering_fields = ["name", "code", "duration_years"]
    ordering = ["name"]


class CourseViewSet(viewsets.ModelViewSet):
    queryset = m.Course.objects.all()
    serializer_class = s.CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name", "code"]
    filterset_fields = ["department", "course_type", "is_active"]
    ordering_fields = ["name", "code", "credit_hours"]
    ordering = ["name"]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type == "cod":
            department = services.get_cod_department(self.request.user)
            return qs.filter(department=department) if department else qs.none()
        return qs


class CurriculumVersionViewSet(viewsets.ModelViewSet):
    queryset = m.CurriculumVersion.objects.all()
    serializer_class = s.CurriculumVersionSerializer
    permission_classes = [IsStaffRole]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["programme", "effective_academic_year", "is_active"]
    ordering_fields = ["effective_academic_year"]
    ordering = ["-effective_academic_year"]



# ======================================================================
# CALENDAR
# ======================================================================

class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = m.AcademicYear.objects.all()
    serializer_class = s.AcademicYearSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["year"]
    ordering_fields = ["year", "start_date"]
    ordering = ["-start_date"]


class SemesterViewSet(viewsets.ModelViewSet):
    queryset = m.Semester.objects.all()
    serializer_class = s.SemesterSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["academic_year", "is_current"]
    ordering_fields = ["academic_year", "semester_number", "start_date"]
    ordering = ["academic_year", "semester_number"]

class IntakeViewSet(viewsets.ModelViewSet):
    queryset = m.Intake.objects.all()
    serializer_class = s.IntakeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name"]
    filterset_fields = ["academic_year", "is_active"]
    ordering_fields = ["name"]
    ordering = ["-id"]


# ======================================================================
# PEOPLE / ADMISSIONS
# ======================================================================

class StudentViewSet(viewsets.ModelViewSet):
    queryset = m.Student.objects.select_related("user", "programme")
    serializer_class = s.StudentSerializer
    permission_classes = [IsStaffRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["registration_number", "user__first_name", "user__last_name", "user__email",
                      "kcse_index_number", "previous_school"]
    filterset_fields = ["programme", "current_year", "status"]
    ordering_fields = ["registration_number", "admission_date", "current_year", "current_semester"]
    ordering = ["-admission_date"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type == "cod":
            department = services.get_cod_department(self.request.user)
            qs = qs.filter(programme__department=department) if department else qs.none()
        programme = self.request.query_params.get("programme")
        year = self.request.query_params.get("year")
        status_filter = self.request.query_params.get("status")
        if programme:
            qs = qs.filter(programme_id=programme)
        if year:
            qs = qs.filter(current_year=year)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=False, methods=["post"], url_path="admit")
    def admit(self, request):
        """
        Admits a student, creates their login (username=reg no,
        default password 'password123', must_change_password=True),
        and auto-raises the Year1/Sem1 fee invoice — all inside one
        atomic transaction. If no FeeStructure exists for this
        programme/year/semester, the ENTIRE admission (user, student,
        fee account) is rolled back and a 400 is returned instead of
        leaving an orphaned student with no invoice.
        """
        serializer = s.AdmitStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            student = serializer.save()
        except ValueError as exc:
            return Response(
                {"detail": f"Admission cancelled — could not raise fee invoice: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(s.StudentSerializer(student).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="transcript")
    def transcript(self, request, pk=None):
        """
        Full academic transcript for this student, built directly from
        Grade (the single source of truth — one row per Enrollment, so
        admin corrections show up immediately with no dedup step and no
        possibility of a stale duplicate). GradeTranscriptSerializer
        presents a Grade row in transcript shape (course_detail,
        academic_year_detail, semester_number, programme_year, etc.) —
        NOT TranscriptEntrySerializer, which is for the separate,
        append-only TranscriptEntry audit log and expects fields
        (like semester_number) that don't exist directly on Grade.
        """
        student = self.get_object()
        entries = services.TranscriptService.effective_entries(student)
        return Response(s.GradeTranscriptSerializer(entries, many=True).data)

    @action(detail=True, methods=["get"], url_path="fee-summary")
    def fee_summary(self, request, pk=None):
        student = self.get_object()
        summary = services.FeeService.student_balance_summary(student)
        return Response({
            "total_outstanding": summary["total_outstanding"],
            "wallet_credit": summary["wallet_credit"],
            "open_invoices": s.InvoiceSerializer(summary["open_invoices"], many=True).data,
        })


class MyProfileStudentView(APIView):
    """Student self-service: view own profile without exposing the admin StudentViewSet."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "student_profile", None)
        if not profile:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)
        return Response(s.StudentSerializer(profile).data)


class LecturerViewSet(viewsets.ModelViewSet):
    queryset = m.Lecturer.objects.select_related("user", "department")
    serializer_class = s.LecturerSerializer
    permission_classes = [IsStaffRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["department", "is_active"]
    search_fields = ["employee_number", "user__first_name", "user__last_name"]
    ordering_fields = ["employee_number", "joining_date"]
    ordering = ["-joining_date"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type == "cod":
            department = services.get_cod_department(self.request.user)
            return qs.filter(department=department) if department else qs.none()
        if self.request.user.user_type == "dean":
            faculty = services.get_dean_faculty(self.request.user)
            return qs.filter(department__faculty=faculty) if faculty else qs.none()
        return qs

    def perform_update(self, serializer):
        if self.request.user.user_type == "dean":
            raise serializers.ValidationError("Deans have read-only access to lecturer records.")
        serializer.save()

    @action(detail=False, methods=["post"], url_path="admit")
    def admit(self, request):
        if request.user.user_type == "dean":
            return Response({"detail": "Deans cannot admit lecturers."}, status=status.HTTP_403_FORBIDDEN)
        serializer = s.AdmitLecturerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lecturer = serializer.save()
        return Response(s.LecturerSerializer(lecturer).data, status=status.HTTP_201_CREATED)



class StaffViewSet(viewsets.ModelViewSet):
    queryset = m.Staff.objects.select_related("user")
    serializer_class = s.StaffSerializer
    permission_classes = [IsRole.for_roles("admin", "registrar")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["department", "is_active"]
    search_fields = ["employee_number", "user__first_name", "user__last_name"]
    ordering_fields = ["employee_number"]
    ordering = ["-id"]

    @action(detail=False, methods=["post"], url_path="admit")
    def admit(self, request):
        serializer = s.AdmitStaffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        staff = serializer.save()
        return Response(s.StaffSerializer(staff).data, status=status.HTTP_201_CREATED)


class StudentDefermentViewSet(viewsets.ModelViewSet):
    queryset = m.StudentDeferment.objects.select_related("student__user")
    serializer_class = s.StudentDefermentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "student"]
    search_fields = ["student__registration_number", "student__user__first_name", "student__user__last_name"]
    ordering_fields = ["applied_at"]
    ordering = ["-applied_at"]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "student":
            return m.StudentDeferment.objects.filter(student__user=user)
        return super().get_queryset()

    def perform_create(self, serializer):
        student = self.request.user.student_profile
        serializer.save(student=student)

    @action(detail=True, methods=["post"], url_path="approve",
            permission_classes=[IsRole.for_roles("admin", "registrar")])
    def approve(self, request, pk=None):
        deferment = self.get_object()
        services.DefermentService.approve(deferment, request.user)
        return Response(s.StudentDefermentSerializer(deferment).data)

    @action(detail=True, methods=["post"], url_path="resume",
            permission_classes=[IsRole.for_roles("admin", "registrar")])
    def resume(self, request, pk=None):
        deferment = self.get_object()
        student = services.DefermentService.resume(deferment)
        return Response(s.StudentSerializer(student).data)
    
    @action(detail=True, methods=["post"], url_path="reject",
            permission_classes=[IsRole.for_roles("admin", "registrar")])
    def reject(self, request, pk=None):
        deferment = self.get_object()
        deferment.status = m.StudentDeferment.Status.REJECTED
        deferment.processed_by = request.user
        deferment.processed_at = timezone.now()
        deferment.admin_remarks = request.data.get("remarks", "")
        deferment.save()
        return Response(s.StudentDefermentSerializer(deferment).data)


class CurriculumUnitViewSet(viewsets.ModelViewSet):
    queryset = m.CurriculumUnit.objects.select_related("course", "curriculum_version")
    serializer_class = s.CurriculumUnitSerializer
    permission_classes = [IsStaffRole]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["curriculum_version", "course", "year", "semester"]
    ordering_fields = ["year", "semester"]
    ordering = ["year", "semester"]
    
# ======================================================================
# UNIT REGISTRATION / ALLOCATION
# ======================================================================

class LecturerUnitAllocationViewSet(viewsets.ModelViewSet):
    queryset = m.LecturerUnitAllocation.objects.select_related("lecturer", "course")
    serializer_class = s.LecturerUnitAllocationSerializer
    permission_classes = [IsStaffRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["course", "programme", "year", "programme_semester", "semester", "lecturer", "is_active"]
    search_fields = ["course__code", "course__name", "lecturer__user__first_name", "lecturer__user__last_name"]
    ordering_fields = ["assigned_date"]
    ordering = ["-assigned_date"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type == "lecturer":
            return qs.filter(lecturer__user=self.request.user)
        if self.request.user.user_type == "cod":
            department = services.get_cod_department(self.request.user)
            return qs.filter(course__department=department) if department else qs.none()
        return qs

    @action(detail=True, methods=["get"], url_path="roster")
    def roster(self, request, pk=None):
        allocation = self.get_object()
        return Response(s.EnrollmentSerializer(allocation.roster(), many=True).data)
    
    @action(detail=True, methods=["get"], url_path="grading-sheet")
    def grading_sheet(self, request, pk=None):
        allocation = self.get_object()
        if request.user.user_type == "lecturer" and allocation.lecturer.user != request.user:
            return Response({"detail": "Not your allocation."}, status=status.HTTP_403_FORBIDDEN)

        enrollments = allocation.roster().select_related("student__user", "registration")
        rows = []
        for enrollment in enrollments:
            grade = getattr(enrollment, "grade", None)
            rows.append({
                "enrollment_id": enrollment.id,
                "student": s.StudentSerializer(enrollment.student).data,
                "registration_type": enrollment.registration.registration_type,
                "grade": s.GradeSerializer(grade).data if grade else None,
            })
        return Response(rows)
    
    def perform_create(self, serializer):
        if self.request.user.user_type == "cod":
            department = services.get_cod_department(self.request.user)
            course = serializer.validated_data.get("course")
            if not department or not course or course.department_id != department.id:
                raise serializers.ValidationError("You can only allocate units within your own department.")
        serializer.save(assigned_by=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.user_type == "cod":
            department = services.get_cod_department(self.request.user)
            course = serializer.validated_data.get("course", serializer.instance.course)
            if not department or course.department_id != department.id:
                raise serializers.ValidationError("You can only edit units within your own department.")
        serializer.save()


class UnitRegistrationViewSet(viewsets.ModelViewSet):
    queryset = m.UnitRegistration.objects.select_related(
        "course", "student",
        "semester__academic_year",
        "enrollment__lecturer_allocation__lecturer__user",
    )
    serializer_class = s.UnitRegistrationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["student", "semester", "course", "registration_type", "is_active"]
    search_fields = ["student__registration_number", "course__code", "course__name"]
    ordering_fields = ["registered_at"]
    ordering = ["-registered_at"]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "student":
            return m.UnitRegistration.objects.filter(student__user=user).select_related(
                "course", "student",
                "semester__academic_year",
                "enrollment__lecturer_allocation__lecturer__user",
            )
        return super().get_queryset()

    @action(detail=False, methods=["post"], url_path="auto-register")
    def auto_register(self, request):
        """Register the logged-in student for their current semester's curriculum units + outstanding supps."""
        student = request.user.student_profile
        semester_id = request.data.get("semester")
        semester = m.Semester.objects.get(pk=semester_id)
        registrations = services.UnitRegistrationService.register_semester_units(student, semester)
        for reg in registrations:
            services.UnitRegistrationService.enroll_with_lecturer(reg)
        return Response(s.UnitRegistrationSerializer(registrations, many=True).data)
    
    
class EnrollmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.Enrollment.objects.select_related("student", "course")
    serializer_class = s.EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["student", "course", "semester"]
    search_fields = ["student__registration_number", "course__code", "course__name"]
    ordering_fields = ["id"]
    ordering = ["-id"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.user_type == "cod":
            department = services.get_cod_department(user)
            return qs.filter(course__department=department) if department else qs.none()
        if user.user_type == "student":
            return qs.filter(student__user=user)
        return qs

# ======================================================================
# CATS / GRADES
# ======================================================================
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class CatSubmissionViewSet(viewsets.ModelViewSet):
    queryset = m.CatSubmission.objects.select_related("lecturer_allocation")
    serializer_class = s.CatSubmissionDetailSerializer
    permission_classes = [IsStaffRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "lecturer_allocation__course__code", "lecturer_allocation__course__name"]
    filterset_fields = ["lecturer_allocation", "cat_number", "is_published"]
    ordering_fields = ["opens_at", "closes_at"]
    ordering = ["-opens_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type == "lecturer":
            return qs.filter(lecturer_allocation__lecturer__user=self.request.user)
        return qs

    @action(detail=True, methods=["get"], url_path="submissions")
    def submissions(self, request, pk=None):
        """All student answer submissions for this CAT — the grading queue."""
        cat = self.get_object()
        if request.user.user_type == "lecturer" and cat.lecturer_allocation.lecturer.user != request.user:
            return Response({"detail": "Not your CAT."}, status=status.HTTP_403_FORBIDDEN)

        submissions = cat.student_submissions.select_related("student__user").order_by("-submitted_at")
        return Response(s.CatAnswerSubmissionDetailSerializer(submissions, many=True).data)


class CatAnswerSubmissionViewSet(viewsets.ModelViewSet):
    queryset = m.CatAnswerSubmission.objects.all()
    serializer_class = s.CatAnswerSubmissionDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["student__registration_number", "student__user__first_name", "student__user__last_name"]
    filterset_fields = ["cat", "student", "is_late"]
    ordering_fields = ["submitted_at"]
    ordering = ["-submitted_at"]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "student":
            return m.CatAnswerSubmission.objects.filter(student__user=user)
        if user.user_type == "lecturer":
            return m.CatAnswerSubmission.objects.filter(cat__lecturer_allocation__lecturer__user=user)
        return super().get_queryset()

    def perform_create(self, serializer):
        cat = serializer.validated_data["cat"]
        serializer.save(student=self.request.user.student_profile,
                         is_late=timezone.now() > cat.closes_at)

    @action(detail=True, methods=["post"], url_path="grade",
            permission_classes=[IsRole.for_roles("lecturer", "admin", "exam_office")])
    def grade(self, request, pk=None):
        submission = self.get_object()
        if request.user.user_type == "lecturer" and \
           submission.cat.lecturer_allocation.lecturer.user != request.user:
            return Response({"detail": "Not your student's submission."}, status=status.HTTP_403_FORBIDDEN)

        serializer = s.GradeCatAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        marks = serializer.validated_data["marks_awarded"]
        if marks > submission.cat.max_marks:
            return Response({"detail": f"Marks cannot exceed {submission.cat.max_marks}."},
                             status=status.HTTP_400_BAD_REQUEST)

        submission.marks_awarded = marks
        submission.graded_at = timezone.now()
        submission.graded_by = request.user
        submission.save(update_fields=["marks_awarded", "graded_at", "graded_by"])
        return Response(s.CatAnswerSubmissionDetailSerializer(submission).data)


class LectureNoteViewSet(viewsets.ModelViewSet):
    queryset = m.LectureNote.objects.select_related("lecturer_allocation__course")
    serializer_class = s.LectureNoteSerializer
    permission_classes = [IsStaffRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]   # <-- add JSONParser
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "lecturer_allocation__course__code", "lecturer_allocation__course__name"]
    filterset_fields = ["lecturer_allocation", "is_published"]
    ordering_fields = ["uploaded_at"]
    ordering = ["-uploaded_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type == "lecturer":
            return qs.filter(lecturer_allocation__lecturer__user=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class MyNotesView(APIView):
    """Published lecture notes for units the logged-in student is enrolled in this semester."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        enrollments = m.Enrollment.objects.filter(
            student=student, is_active=True
        ).select_related("course", "semester")

        note_ids = []
        for enrollment in enrollments:
            allocations = m.LecturerUnitAllocation.objects.filter(
                course=enrollment.course, semester=enrollment.semester, is_active=True
            )
            notes = m.LectureNote.objects.filter(
                lecturer_allocation__in=allocations, is_published=True
            )
            note_ids.extend(notes.values_list("id", flat=True))

        notes = m.LectureNote.objects.filter(
            id__in=note_ids
        ).select_related("lecturer_allocation__course").order_by("-uploaded_at")

        return Response(s.LectureNoteSerializer(notes, many=True).data)
    
    
class GradeViewSet(viewsets.ModelViewSet):
    queryset = m.Grade.objects.select_related(
        "enrollment__student",
        "enrollment__course",
        "enrollment__semester__academic_year",
        "enrollment__lecturer_allocation",
    )
    serializer_class = s.GradeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["enrollment", "enrollment__student", "enrollment__course", "enrollment__semester", "is_verified"]
    search_fields = ["enrollment__student__registration_number", "enrollment__course__code", "enrollment__course__name"]
    ordering_fields = ["published_at", "exam_date"]
    ordering = ["-published_at"]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "student":
            return m.Grade.objects.filter(enrollment__student__user=user)
        if user.user_type == "lecturer":
            return m.Grade.objects.filter(enrollment__lecturer_allocation__lecturer__user=user)
        if user.user_type == "cod":
            department = services.get_cod_department(user)
            if not department:
                return m.Grade.objects.none()
            return m.Grade.objects.filter(enrollment__course__department=department)
        return super().get_queryset()

    @action(detail=False, methods=["post"], url_path="enter",
            permission_classes=[IsRole.for_roles("lecturer", "admin", "exam_office")])
    def enter_grade(self, request):
        serializer = s.GradeEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        grade, _ = m.Grade.objects.get_or_create(enrollment=data["enrollment"])
        grade.cat_marks = data["cat_marks"]
        grade.final_exam_marks = data["final_exam_marks"]
        grade.exam_date = data.get("exam_date")
        grade.entered_by = request.user
        grade.is_supplementary_result = data["enrollment"].registration.registration_type == \
            m.UnitRegistration.RegType.SUPPLEMENTARY

        try:
            services.GradingService.compute_and_save(grade)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(s.GradeSerializer(grade).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="pending-verification",
            permission_classes=[IsRole.for_roles("cod", "admin", "exam_office")])
    def pending_verification(self, request):
        """Entered-but-unverified grades — the COD's marks-verification queue."""
        qs = m.Grade.objects.filter(
            published_at__isnull=False, is_verified=False
        ).select_related("enrollment__student", "enrollment__course", "enrollment__semester__academic_year")

        if request.user.user_type == "cod":
            department = services.get_cod_department(request.user)
            qs = qs.filter(enrollment__course__department=department) if department else qs.none()

        return Response(s.GradeSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="verify",
            permission_classes=[IsRole.for_roles("cod", "admin", "exam_office")])
    def verify(self, request, pk=None):
        grade = self.get_object()
        if request.user.user_type == "cod":
            department = services.get_cod_department(request.user)
            if not department or grade.enrollment.course.department_id != department.id:
                return Response({"detail": "This unit is outside your department."},
                                 status=status.HTTP_403_FORBIDDEN)
        grade.is_verified = True
        grade.verified_by = request.user
        grade.verified_at = timezone.now()
        grade.save(update_fields=["is_verified", "verified_by", "verified_at"])
        return Response(s.GradeSerializer(grade).data)



class MyTranscriptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)
        entries = services.TranscriptService.effective_entries(student)
        return Response(s.GradeTranscriptSerializer(entries, many=True).data)

    
    @action(detail=True, methods=["get"], url_path="transcript")
    def transcript(self, request, pk=None):
        """
        Transcript for this student, built from Grade (the single
        source of truth — one row per Enrollment) rather than the
        append-only TranscriptEntry log, so admin corrections show up
        immediately and there's no possibility of a stale duplicate.
        """
        student = self.get_object()
        entries = services.TranscriptService.effective_entries(student)
        return Response(s.GradeTranscriptSerializer(entries, many=True).data)
    
# ======================================================================
# SUPPLEMENTARY
# ======================================================================

class SupplementaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = request.user.student_profile
        outstanding = services.SupplementaryService.outstanding_units(student)
        return Response(s.CourseSerializer(outstanding, many=True).data)

    def post(self, request):
        """Register + auto-invoice a supplementary unit."""
        student = request.user.student_profile
        course = m.Course.objects.get(pk=request.data["course"])
        semester = m.Semester.objects.get(pk=request.data["semester"])
        registration = services.SupplementaryService.register_supplementary(student, course, semester)
        return Response(s.UnitRegistrationSerializer(registration).data, status=status.HTTP_201_CREATED)


# ======================================================================
# FEES
# ======================================================================

class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = m.FeeStructure.objects.select_related("programme", "academic_year")
    serializer_class = s.FeeStructureSerializer
    permission_classes = [IsRole.for_roles("admin", "finance", "registrar")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["programme", "academic_year", "year", "semester"]
    search_fields = ["programme__name", "programme__code"]
    ordering_fields = ["year", "semester", "tuition_fee"]
    ordering = ["-id"]

    @action(detail=True, methods=["get"], url_path="students",
            permission_classes=[IsRole.for_roles("admin", "finance", "registrar")])
    def students(self, request, pk=None):
        fee_structure = self.get_object()
        rows = services.FeeService.students_for_fee_structure(fee_structure)
        return Response([{
            "student": s.StudentSerializer(row["student"]).data,
            "invoice_id": row["invoice"].id if row["invoice"] else None,
            "amount_due": row["amount_due"],
            "balance": row["balance"],
            "is_paid": row["is_paid"],
            "has_invoice": row["has_invoice"],
        } for row in rows])

    @action(detail=True, methods=["post"], url_path="raise-invoice",
            permission_classes=[IsRole.for_roles("admin", "finance", "registrar")])
    def raise_invoice(self, request, pk=None):
        fee_structure = self.get_object()
        try:
            student = m.Student.objects.get(pk=request.data.get("student"))
        except (m.Student.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Valid student is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            invoice = services.FeeService.raise_invoice_for_fee_structure(student, fee_structure)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="record-payment",
            permission_classes=[IsRole.for_roles("admin", "finance")])
    def record_payment(self, request, pk=None):
        fee_structure = self.get_object()
        try:
            student = m.Student.objects.get(pk=request.data.get("student"))
        except (m.Student.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Valid student is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount = Decimal(str(request.data.get("amount", "0")))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({"detail": "Amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)
        method = request.data.get("method", m.FeePayment.Method.CASH)

        payment = services.FeeService.record_manual_payment(
            student=student, amount=amount, method=method, recorded_by=request.user.get_full_name(),
        )
        return Response(s.FeePaymentSerializer(payment).data, status=status.HTTP_201_CREATED)



class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.Invoice.objects.all()
    serializer_class = s.InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["student__registration_number", "description"]
    filterset_fields = ["student", "invoice_type", "semester", "is_active"]
    ordering_fields = ["created_at", "amount_due"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "student":
            return m.Invoice.objects.filter(student__user=user)
        return super().get_queryset()

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        """
        Student-facing 'Pay' button (per-invoice or the general 'Pay Now').
        BYPASS MODE: no real M-Pesa STK push fires yet — the invoice is
        marked paid immediately, as if the push had succeeded, so the
        pay -> receipt-with-QR flow can be built/tested before Daraja
        credentials are wired in. See FeeService.pay_invoice_via_mpesa
        for the TODO marking exactly what changes for the real integration.
        """
        invoice = self.get_object()
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        serializer = s.PayInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payment = services.FeeService.pay_invoice_via_mpesa(
                student, invoice, phone_number=serializer.validated_data.get("phone_number", "")
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        receipt = services.FeeService.build_receipt(payment, invoice)
        return Response(s.ReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)


class BankPaymentWebhookView(APIView):
    """
    Bank/ERP integration endpoint. Secure this with a shared-secret
    header or mTLS at the gateway/nginx level in production — kept
    permission-open here only so the *bank's* server (not a portal
    user) can call it.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = s.BankNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = services.FeeService.process_bank_notification(**serializer.validated_data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.FeePaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class MyFeeSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)
        summary = services.FeeService.student_balance_summary(student)
        return Response({
            "total_outstanding": summary["total_outstanding"],
            "wallet_credit": summary["wallet_credit"],
            "open_invoices": s.InvoiceSerializer(summary["open_invoices"], many=True).data,
        })


class FeePaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.FeePayment.objects.select_related("student__user")
    serializer_class = s.FeePaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["method", "is_reconciled", "student"]
    search_fields = ["registration_number_on_slip", "payer_name_on_slip", "bank_reference", "receipt_number"]
    ordering_fields = ["received_at", "payment_date", "amount"]
    ordering = ["-received_at"]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "student":
            return m.FeePayment.objects.filter(student__user=user)
        return super().get_queryset()

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, pk=None):
        """Re-view/reprint a past receipt — e.g. student clicks 'Receipt' in Payment History."""
        payment = self.get_object()
        allocation = payment.allocations.select_related("invoice").first()
        if not allocation:
            return Response({"detail": "No invoice allocation found for this payment."},
                             status=status.HTTP_404_NOT_FOUND)
        receipt = services.FeeService.build_receipt(payment, allocation.invoice)
        return Response(s.ReceiptSerializer(receipt).data)

    @action(detail=False, methods=["get"], url_path="flagged",
            permission_classes=[IsRole.for_roles("admin", "finance")])
    def flagged(self, request):
        qs = self.get_queryset().exclude(reconciliation_notes="")
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page or qs, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="resolve",
            permission_classes=[IsRole.for_roles("admin", "finance")])
    def resolve(self, request, pk=None):
        payment = self.get_object()
        payment.reconciliation_notes = ""
        payment.save(update_fields=["reconciliation_notes"])
        return Response(s.FeePaymentSerializer(payment).data)

    @action(detail=True, methods=["post"], url_path="reassign",
            permission_classes=[IsRole.for_roles("admin", "finance")])
    def reassign(self, request, pk=None):
        payment = self.get_object()
        try:
            new_student = m.Student.objects.get(pk=request.data.get("student"))
        except (m.Student.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Valid target student is required."}, status=status.HTTP_400_BAD_REQUEST)
        payment = services.FeeService.reassign_payment(payment, new_student)
        return Response(s.FeePaymentSerializer(payment).data)


# ======================================================================
# HOSTEL
# ======================================================================


class HostelBookingViewSet(viewsets.ModelViewSet):
    queryset = m.HostelBooking.objects.select_related("bed__room__hostel", "student__user")
    serializer_class = s.HostelBookingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["academic_year", "status", "bed__room__hostel", "student"]
    search_fields = ["student__registration_number", "student__user__first_name", "student__user__last_name"]
    ordering_fields = ["booked_at"]
    ordering = ["-booked_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.user_type == "student":
            return m.HostelBooking.objects.filter(student__user=user).select_related(
                "bed__room__hostel", "student__user"
            )
        return qs

    def create(self, request, *args, **kwargs):
        """
        Student self-service booking. Only `bed` is required in the
        payload — the current semester is derived server-side rather
        than trusted from the client, since a missing/undefined field
        client-side was the original cause of a 500 here.
        """
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        try:
            bed = m.Bed.objects.select_related("room__hostel").get(pk=request.data["bed"])
        except (m.Bed.DoesNotExist, KeyError, ValueError, TypeError):
            return Response({"detail": "Valid bed is required."}, status=status.HTTP_400_BAD_REQUEST)

        current_semester = m.Semester.objects.filter(is_current=True).first()
        if not current_semester:
            return Response({"detail": "No active semester found."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            booking = services.HostelService.book_bed(student, bed, current_semester)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.HostelBookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="manual_book",
            permission_classes=[IsRole.for_roles("admin", "hostel_warden")])
    def manual_book(self, request):
        try:
            student = m.Student.objects.get(pk=request.data["student"])
            bed = m.Bed.objects.get(pk=request.data["bed"])
        except (m.Student.DoesNotExist, m.Bed.DoesNotExist, KeyError):
            return Response({"detail": "Valid student and bed are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            booking = services.HostelService.manual_book(
                student, bed, bed.academic_year, status=request.data.get("status")
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.HostelBookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="check_in",
            permission_classes=[IsRole.for_roles("admin", "hostel_warden")])
    def check_in(self, request, pk=None):
        return Response(s.HostelBookingSerializer(services.HostelService.check_in(self.get_object())).data)

    @action(detail=True, methods=["post"], url_path="check_out",
            permission_classes=[IsRole.for_roles("admin", "hostel_warden")])
    def check_out(self, request, pk=None):
        return Response(s.HostelBookingSerializer(services.HostelService.check_out(self.get_object())).data)

    @action(detail=True, methods=["post"], url_path="cancel",
            permission_classes=[IsRole.for_roles("admin", "hostel_warden")])
    def cancel(self, request, pk=None):
        return Response(s.HostelBookingSerializer(services.HostelService.cancel(self.get_object())).data)

# ======================================================================
# REPORTING / CLEARANCE
# ======================================================================

class StudentReportingViewSet(viewsets.ModelViewSet):
    queryset = m.StudentReporting.objects.select_related(
        "student__user", "semester__academic_year", "processed_by"
    )
    serializer_class = s.StudentReportingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "semester", "reporting_type", "student",
                         "student__programme", "semester__academic_year"]
    search_fields = ["student__registration_number", "student__user__first_name", 
                     "student__user__last_name", "student__user__email"]
    ordering_fields = ["reporting_date", "status"]
    ordering = ["-reporting_date"]

    def get_serializer_class(self):
        if self.request.user.is_authenticated and self.request.user.user_type != "student":
            return s.StudentReportingDetailSerializer
        return s.StudentReportingSerializer

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "student":
            return m.StudentReporting.objects.filter(student__user=user)
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.save(student=self.request.user.student_profile)

    @action(detail=True, methods=["post"], url_path="update-status",
            permission_classes=[IsStaffRole])
    def update_status(self, request, pk=None):
        reporting = self.get_object()
        new_status = request.data.get("status")
        if new_status not in m.StudentReporting.Status.values:
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        reporting.status = new_status
        reporting.processed_by = request.user
        reporting.save(update_fields=["status", "processed_by"])
        return Response(s.StudentReportingDetailSerializer(reporting).data)

    @action(detail=False, methods=["post"], url_path="bulk-update-status",
            permission_classes=[IsStaffRole])
    def bulk_update_status(self, request):
        serializer = s.BulkReportingStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["reporting_ids"]
        new_status = serializer.validated_data["status"]
        updated = m.StudentReporting.objects.filter(id__in=ids).update(
            status=new_status, processed_by=request.user
        )
        return Response({"updated": updated, "status": new_status})
    
    @action(detail=False, methods=["post"], url_path="report-for-student",
            permission_classes=[IsStaffRole])
    def report_for_student(self, request):
        """Admin/registrar reports a semester on behalf of a specific student."""
        serializer = s.AdminReportForStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        reporting, created = m.StudentReporting.objects.update_or_create(
            student=data["student"], semester=data["semester"],
            defaults={
                "reporting_type": data["reporting_type"],
                "status": data["status"],
                "processed_by": request.user,
            },
        )
        return Response(
            s.StudentReportingDetailSerializer(reporting).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
    


class ClearanceRequestViewSet(viewsets.ModelViewSet):
    queryset = m.ClearanceRequest.objects.select_related("student__user")
    serializer_class = s.ClearanceRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["clearance_type", "status", "student"]
    search_fields = ["student__registration_number", "student__user__first_name", "student__user__last_name"]
    ordering_fields = ["requested_at"]
    ordering = ["-requested_at"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.user_type == "student":
            return m.ClearanceRequest.objects.filter(student__user=user)
        if user.user_type == "dean":
            faculty = services.get_dean_faculty(user)
            return qs.filter(student__programme__faculty=faculty) if faculty else qs.none()
        return qs

    def create(self, request, *args, **kwargs):
        student = request.user.student_profile
        try:
            clearance = services.ClearanceService.request_clearance(student, request.data["clearance_type"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.ClearanceRequestSerializer(clearance).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="approve", permission_classes=[IsStaffRole])
    def approve(self, request, pk=None):
        clearance = self.get_object()
        if request.user.user_type == "dean" and clearance.clearance_type not in (
            m.ClearanceRequest.ClearanceType.DEPARTMENT, m.ClearanceRequest.ClearanceType.GRADUATION
        ):
            return Response({"detail": "Deans can only act on department/graduation clearances."},
                             status=status.HTTP_403_FORBIDDEN)
        clearance = services.ClearanceService.approve(clearance, request.user, request.data.get("remarks", ""))
        return Response(s.ClearanceRequestSerializer(clearance).data)

    @action(detail=True, methods=["post"], url_path="reject", permission_classes=[IsStaffRole])
    def reject(self, request, pk=None):
        clearance = self.get_object()
        if request.user.user_type == "dean" and clearance.clearance_type not in (
            m.ClearanceRequest.ClearanceType.DEPARTMENT, m.ClearanceRequest.ClearanceType.GRADUATION
        ):
            return Response({"detail": "Deans can only act on department/graduation clearances."},
                             status=status.HTTP_403_FORBIDDEN)
        clearance = services.ClearanceService.reject(clearance, request.user, request.data.get("remarks", ""))
        return Response(s.ClearanceRequestSerializer(clearance).data)




# ======================================================================
# EXAMS / TIMETABLE / ATTENDANCE
# ======================================================================

class ExaminationViewSet(viewsets.ModelViewSet):
    queryset = m.Examination.objects.select_related("course", "semester")
    serializer_class = s.ExaminationSerializer
    permission_classes = [IsStaffRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["course", "semester", "exam_type", "is_published"]
    search_fields = ["course__code", "course__name", "venue"]
    ordering_fields = ["exam_date", "start_time"]
    ordering = ["exam_date", "start_time"]



class TimetableViewSet(viewsets.ModelViewSet):
    queryset = m.Timetable.objects.select_related("course", "lecturer")
    serializer_class = s.TimetableSerializer
    permission_classes = [IsStaffRole]   # was permissions.IsAuthenticated
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["course", "lecturer", "semester", "programme", "day_of_week", "is_active"]
    search_fields = ["course__code", "course__name", "lecturer__user__first_name", "lecturer__user__last_name", "venue"]
    ordering_fields = ["day_of_week", "start_time"]
    ordering = ["day_of_week", "start_time"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type == "lecturer":
            return qs.filter(lecturer__user=self.request.user)
        return qs


class AttendanceSessionViewSet(viewsets.ModelViewSet):
    queryset = m.AttendanceSession.objects.all()
    serializer_class = s.AttendanceSessionSerializer
    permission_classes = [IsRole.for_roles("lecturer", "admin")]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["timetable_slot", "is_active", "session_date"]
    ordering_fields = ["session_date"]
    ordering = ["-session_date"]


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = m.Attendance.objects.all()
    serializer_class = s.AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["student", "attendance_session", "status"]
    search_fields = ["student__registration_number", "student__user__first_name", "student__user__last_name"]
    ordering_fields = ["marked_at"]
    ordering = ["-marked_at"]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "student":
            return m.Attendance.objects.filter(student__user=user)
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.save(student=self.request.user.student_profile)


# ======================================================================
# NOTIFICATIONS
# ======================================================================

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = s.NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["notification_type", "is_read"]
    search_fields = ["title", "message"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return m.Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(s.NotificationSerializer(notification).data)


# ======================================================================
# ADMIN OPERATIONS (promotion run, etc.)
# ======================================================================

class RunPromotionView(APIView):
    permission_classes = [IsRole.for_roles("admin", "registrar")]

    def post(self, request):
        serializer = s.RunPromotionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        run = services.PromotionService.run_promotion(
            academic_year=data["academic_year"], faculty=data.get("faculty"),
            programme=data.get("programme"), bypass_result_check=data["bypass_result_check"],
            bypass_reason=data.get("bypass_reason", ""), triggered_by=request.user,
        )
        return Response(s.PromotionRunSerializer(run).data, status=status.HTTP_201_CREATED)


class PromotionRunViewSet(viewsets.ReadOnlyModelViewSet):
    """History of past promotion runs — 'students that were promoted' list lives here."""
    queryset = m.PromotionRun.objects.select_related("faculty", "programme", "academic_year", "triggered_by")
    serializer_class = s.PromotionRunSerializer
    permission_classes = [IsRole.for_roles("admin", "registrar")]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["faculty", "programme", "academic_year", "bypass_result_check"]
    ordering_fields = ["run_at"]
    ordering = ["-run_at"]


class ReportsView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request):
        return Response(services.ReportService.summary())


class MyDashboardView(APIView):
    """Student dashboard with real-time statistics and data."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        # Get current semester
        current_semester = m.Semester.objects.filter(is_current=True).first()

        # Get enrollments for current semester
        enrollments = m.Enrollment.objects.filter(
            student=student,
            semester=current_semester,
            is_active=True
        ) if current_semester else []

        # Get grades
        grades = m.Grade.objects.filter(
            enrollment__student=student,
            published_at__isnull=False
        ).select_related("enrollment__course")

        # cumulative_gpa is a stored field nothing currently writes to, so
        # compute it live from published grades' quality points / credit hours
        # (mirrors the same math GradingService uses when it sets quality_points).
        graded_list = list(grades)
        total_quality_points = sum(
            (g.quality_points for g in graded_list if g.quality_points is not None), Decimal("0")
        )
        total_credit_hours = sum(
            (g.enrollment.course.credit_hours for g in graded_list if g.quality_points is not None), 0
        )
        computed_gpa = round(float(total_quality_points) / total_credit_hours, 2) if total_credit_hours else None
        current_gpa = float(student.cumulative_gpa) if student.cumulative_gpa else computed_gpa

        # Calculate stats
        total_units = m.UnitRegistration.objects.filter(
            student=student,
            semester=current_semester,
            is_active=True
        ).count() if current_semester else 0

        # Get fee summary
        fee_summary = services.FeeService.student_balance_summary(student)

        # Get notifications
        notifications = m.Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()

        # Get upcoming exams
        upcoming_exams = m.Examination.objects.filter(
            semester=current_semester,
            exam_date__gte=timezone.now().date()
        ).order_by("exam_date")[:5] if current_semester else []

        # Get recent grades (last 5)
        recent_grades = grades.order_by("-published_at")[:5]

        # Check if reporting is done
        has_reported = m.StudentReporting.objects.filter(
            student=student,
            semester=current_semester,
            status=m.StudentReporting.Status.APPROVED
        ).exists() if current_semester else False

        # Check hostel booking
        has_hostel = m.HostelBooking.objects.filter(
            student=student,
            academic_year=current_semester.academic_year if current_semester else None,
            status__in=[m.HostelBooking.Status.APPROVED, m.HostelBooking.Status.CHECKED_IN]
        ).exists() if current_semester else False

        # Check clearance eligibility
        is_eligible_for_clearance = services.ClearanceService.is_eligible(student)

        data = {
            "student": s.StudentSerializer(student).data,
            "current_semester": s.SemesterSerializer(current_semester).data if current_semester else None,
            "stats": {
                "total_units": total_units,
                "completed_units": grades.filter(is_pass=True).count(),
                "current_gpa": current_gpa,
                "notifications": notifications,
                "fee_balance": float(fee_summary["total_outstanding"]),
                "wallet_credit": float(fee_summary["wallet_credit"]),
            },
            "recent_grades": s.GradeSerializer(recent_grades, many=True).data,
            "upcoming_exams": s.ExaminationSerializer(upcoming_exams, many=True).data,
            "quick_actions": {
                "has_reported": has_reported,
                "has_hostel": has_hostel,
                "is_eligible_for_clearance": is_eligible_for_clearance,
                "has_outstanding_fees": fee_summary["total_outstanding"] > 0,
            }
        }
        return Response(data)
    
    
# Add these imports at the top if not already present
from django.db.models import Q, Count, Sum
from django.utils import timezone

# ======================================================================
# STUDENT UNIT VIEWS
# ======================================================================

# ======================================================================
# STUDENT UNIT VIEWS
# ======================================================================

class MyUnitsView(APIView):
    """Get all unit registrations for the current student with detailed information."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        # Get all registrations for the student
        registrations = m.UnitRegistration.objects.filter(
            student=student,
            is_active=True
        ).select_related(
            "course",
            "semester__academic_year",
            "enrollment",
            "enrollment__lecturer_allocation",
            "enrollment__lecturer_allocation__lecturer",
            "enrollment__lecturer_allocation__lecturer__user",
            "supplementary_invoice"
        ).order_by("-semester__academic_year__year", "-semester__semester_number")

        serializer = s.UnitRegistrationSerializer(registrations, many=True)
        return Response(serializer.data)


class AutoRegisterUnitsView(APIView):
    """Auto-register student for current semester units + outstanding supplementaries."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        semester_id = request.data.get("semester")
        if not semester_id:
            return Response(
                {"detail": "Semester ID is required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            semester = m.Semester.objects.get(pk=semester_id, is_current=True)
        except m.Semester.DoesNotExist:
            return Response(
                {"detail": "Invalid or inactive semester."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # Register semester units
                registrations = services.UnitRegistrationService.register_semester_units(
                    student, semester
                )
                
                # Enroll with lecturer for each registration
                for reg in registrations:
                    services.UnitRegistrationService.enroll_with_lecturer(reg)

                serializer = s.UnitRegistrationSerializer(registrations, many=True)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {"detail": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class CurrentSemesterView(APIView):
    """Get the current active semester."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        semester = m.Semester.objects.filter(is_current=True).first()
        if not semester:
            return Response(
                {"detail": "No active semester found."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = s.SemesterSerializer(semester)
        return Response(serializer.data)
    
    
    
# ======================================================================
# STUDENT CAT VIEWS (FIXED)
# ======================================================================

class MyCatsView(APIView):
    """Get all CAT submissions for the current student's enrolled units."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        # Get all enrollments for the student
        enrollments = m.Enrollment.objects.filter(
            student=student,
            is_active=True
        ).select_related("course", "semester")

        # Get CAT submissions for these enrollments
        cat_ids = []
        for enrollment in enrollments:
            allocations = m.LecturerUnitAllocation.objects.filter(
                course=enrollment.course,
                semester=enrollment.semester,
                is_active=True
            )
            cats = m.CatSubmission.objects.filter(
                lecturer_allocation__in=allocations,
                is_published=True
            )
            cat_ids.extend(cats.values_list("id", flat=True))

        cats = m.CatSubmission.objects.filter(
            id__in=cat_ids
        ).select_related(
            "lecturer_allocation",
            "lecturer_allocation__course",
            "lecturer_allocation__lecturer",
            "lecturer_allocation__lecturer__user"
        ).order_by("-opens_at")  # Changed from created_at to opens_at

        # Get student's submissions for these CATs
        student_submissions = m.CatAnswerSubmission.objects.filter(
            student=student,
            cat__in=cats
        ).select_related("cat")

        serializer = s.CatSubmissionDetailSerializer(cats, many=True)
        data = serializer.data

        # Add submission status to each CAT
        for cat_data in data:
            cat_id = cat_data["id"]
            submission = student_submissions.filter(cat_id=cat_id).first()
            cat_data["has_submitted"] = bool(submission)
            if submission:
                cat_data["submission"] = s.CatAnswerSubmissionSerializer(submission).data

        return Response(data)
    

class SubmitCatAnswerView(APIView):
    """Submit an answer for a CAT."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        cat_id = request.data.get("cat_id")
        answer_file = request.FILES.get("answer_file")
        answer_text = request.data.get("answer_text", "")

        if not cat_id:
            return Response({"detail": "CAT ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cat = m.CatSubmission.objects.get(pk=cat_id)
        except m.CatSubmission.DoesNotExist:
            return Response({"detail": "CAT not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check if CAT is open
        if not cat.is_open:
            return Response({"detail": "This CAT is not open for submissions."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if student is enrolled in the course
        enrollment = m.Enrollment.objects.filter(
            student=student,
            course=cat.lecturer_allocation.course,
            semester=cat.lecturer_allocation.semester,
            is_active=True
        ).first()

        if not enrollment:
            return Response({"detail": "You are not enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)

        # Check if already submitted
        existing = m.CatAnswerSubmission.objects.filter(cat=cat, student=student).first()
        if existing:
            return Response({"detail": "You have already submitted for this CAT."}, status=status.HTTP_400_BAD_REQUEST)

        # Create submission
        is_late = timezone.now() > cat.closes_at
        submission = m.CatAnswerSubmission.objects.create(
            cat=cat,
            student=student,
            answer_file=answer_file,
            answer_text=answer_text,
            is_late=is_late
        )

        serializer = s.CatAnswerSubmissionSerializer(submission)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyCatSubmissionsView(APIView):
    """Get all CAT submissions for the current student."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        submissions = m.CatAnswerSubmission.objects.filter(
            student=student
        ).select_related("cat", "cat__lecturer_allocation", "cat__lecturer_allocation__course").order_by("-submitted_at")

        serializer = s.CatAnswerSubmissionDetailSerializer(submissions, many=True)
        return Response(serializer.data)
    
    
# ======================================================================
# ADMIN DASHBOARD (FIXED WITH BETTER ERROR HANDLING)
# ======================================================================

class AdminDashboardView(APIView):
    """Admin dashboard — all figures are real, queried live (no random/sample fallbacks)."""
    permission_classes = [IsRole.for_roles("admin", "registrar", "dean", "cod", "exam_office")]

    def get(self, request):
        try:
            students = m.Student.objects.select_related("user", "programme", "programme__department").all()
            lecturers = m.Lecturer.objects.all()
            programmes = m.Programme.objects.all()
            departments = m.Department.objects.all()

            active_students = students.filter(status=m.Student.Status.ACTIVE).count()
            graduated_students = students.filter(status=m.Student.Status.GRADUATED).count()
            recent_students = students.order_by("-admission_date")[:10]

            reporting_trends = services.AdminDashboardService.reporting_trends(num_years=3)
            programme_distribution = services.AdminDashboardService.programme_distribution()
            department_stats = services.AdminDashboardService.department_gender_stats()

            colors = ["#3b6ce0", "#1a8a5a", "#c97d2a", "#7c3aed", "#c23b3b", "#2f6fed", "#d4a437", "#0d1f55"]

            recent_students_data = []
            for student in recent_students:
                try:
                    recent_students_data.append({
                        "id": str(student.id),
                        "registration_number": student.registration_number,
                        "user_detail": {
                            "first_name": student.user.first_name if student.user else "",
                            "last_name": student.user.last_name if student.user else "",
                        },
                        "programme_detail": {"code": student.programme.code if student.programme else "N/A"},
                        "current_year": student.current_year,
                        "current_semester": student.current_semester,
                        "status": student.status,
                        "admission_date": student.admission_date.isoformat() if student.admission_date else None,
                    })
                except Exception as e:
                    print(f"Error serializing student {student.id}: {e}")
                    continue

            data = {
                "stats": {
                    "total_students": students.count(),
                    "total_staff": lecturers.count(),
                    "total_programmes": programmes.count(),
                    "total_departments": departments.count(),
                    "active_students": active_students,
                    "graduated_students": graduated_students,
                },
                "recent_students": recent_students_data,
                "reporting_trends": reporting_trends,
                "programme_distribution": [
                    {"name": p["name"], "code": p["code"], "count": p["count"], "color": colors[i % len(colors)]}
                    for i, p in enumerate(programme_distribution[:5])
                ],
                "department_stats": department_stats[:8],
            }
            return Response(data)

        except Exception as e:
            print(f"AdminDashboardView error: {e}")
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"Error loading dashboard: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    

class MyCurriculumUnitsView(APIView):
    """
    The checklist for the logged-in student: every CurriculumUnit mapped
    to their curriculum_version + current_year + current_semester, plus
    any outstanding supplementary units, each flagged with whether it's
    already registered. Also carries the fee-balance gate.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        current_semester = m.Semester.objects.filter(is_current=True).first()
        if not current_semester:
            return Response({"detail": "No active semester found."}, status=status.HTTP_404_NOT_FOUND)

        curriculum_units = m.CurriculumUnit.objects.filter(
            curriculum_version=student.curriculum_version,
            year=student.current_year,
            semester=student.current_semester,
        ).select_related("course", "course__department")

        existing_regs = {
            reg.course_id: reg
            for reg in m.UnitRegistration.objects.filter(
                student=student, semester=current_semester, is_active=True
            )
        }

        units = [{
            "course": s.CourseSerializer(cu.course).data,
            "is_mandatory": cu.is_mandatory,
            "is_registered": cu.course_id in existing_regs,
            "registration_type": "normal",
        } for cu in curriculum_units]

        # Units failed in earlier semesters that still need clearing.
        supplementary_courses = services.SupplementaryService.outstanding_units(student)
        supplementary_units = [{
            "course": s.CourseSerializer(course).data,
            "is_mandatory": True,
            "is_registered": (
                course.id in existing_regs
                and existing_regs[course.id].registration_type == m.UnitRegistration.RegType.SUPPLEMENTARY
            ),
            "registration_type": "supplementary",
        } for course in supplementary_courses]

        fee_summary = services.FeeService.student_balance_summary(student)
        total_outstanding = fee_summary["total_outstanding"]

        return Response({
            "semester": s.SemesterSerializer(current_semester).data,
            "units": units,
            "supplementary_units": supplementary_units,
            "fee": {
                "total_outstanding": total_outstanding,
                "wallet_credit": fee_summary["wallet_credit"],
                "can_register": total_outstanding <= 0,
            },
        })


class RegisterSelectedUnitsView(APIView):
    """
    Student ticks specific units and submits — replaces blanket
    auto-register. Hard-blocked if there's ANY outstanding balance
    (current or prior semester), per FeeService.student_balance_summary.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        course_ids = request.data.get("course_ids", [])
        if not course_ids:
            return Response({"detail": "Select at least one unit."}, status=status.HTTP_400_BAD_REQUEST)

        current_semester = m.Semester.objects.filter(is_current=True).first()
        if not current_semester:
            return Response({"detail": "No active semester found."}, status=status.HTTP_404_NOT_FOUND)

        fee_summary = services.FeeService.student_balance_summary(student)
        if fee_summary["total_outstanding"] > 0:
            return Response(
                {
                    "detail": "You have an outstanding fee balance. Clear it before registering units.",
                    "total_outstanding": fee_summary["total_outstanding"],
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        created = []
        try:
            with transaction.atomic():
                for course_id in course_ids:
                    course = m.Course.objects.get(pk=course_id)
                    is_curriculum_unit = m.CurriculumUnit.objects.filter(
                        curriculum_version=student.curriculum_version,
                        course=course,
                        year=student.current_year,
                        semester=student.current_semester,
                    ).exists()

                    if is_curriculum_unit:
                        reg, was_created = m.UnitRegistration.objects.get_or_create(
                            student=student, course=course, semester=current_semester,
                            defaults={"registration_type": m.UnitRegistration.RegType.NORMAL},
                        )
                        if was_created:
                            services.UnitRegistrationService.enroll_with_lecturer(reg)
                    else:
                        reg = services.SupplementaryService.register_supplementary(
                            student, course, current_semester
                        )
                    created.append(reg)
        except m.Course.DoesNotExist:
            return Response({"detail": "One of the selected units does not exist."},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(s.UnitRegistrationSerializer(created, many=True).data, status=status.HTTP_201_CREATED)
    
    
    
# ======================================================================
# STUDENT TIMETABLE
# ======================================================================

class MyTimetableView(APIView):
    """This semester's class schedule, scoped to the student's programme/year/semester."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        current_semester = m.Semester.objects.filter(is_current=True).first()
        if not current_semester:
            return Response({"detail": "No active semester found."}, status=status.HTTP_404_NOT_FOUND)

        slots = m.Timetable.objects.filter(
            programme=student.programme,
            year=student.current_year,
            programme_semester=student.current_semester,
            semester=current_semester,
            is_active=True,
        ).select_related("course", "lecturer__user").order_by("day_of_week", "start_time")

        return Response({
            "semester": s.SemesterSerializer(current_semester).data,
            "slots": s.TimetableSerializer(slots, many=True).data,
        })


# ======================================================================
# STUDENT HOSTEL STATUS
# ======================================================================

class MyHostelStatusView(APIView):
    """Current-year hostel booking (if any), reporting status, and Y1S1 booking eligibility."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        current_year = m.AcademicYear.objects.filter(is_current=True).first()
        current_semester = m.Semester.objects.filter(is_current=True).first()

        booking = None
        if current_year:
            booking = m.HostelBooking.objects.filter(
                student=student, academic_year=current_year
            ).select_related("bed__room__hostel").first()

        has_reported = False
        if current_semester:
            has_reported = m.StudentReporting.objects.filter(
                student=student, semester=current_semester, status=m.StudentReporting.Status.APPROVED
            ).exists()

        is_year1_sem1 = student.current_year == 1 and student.current_semester == 1

        return Response({
            "academic_year": s.AcademicYearSerializer(current_year).data if current_year else None,
            "semester": s.SemesterSerializer(current_semester).data if current_semester else None,
            "has_reported": has_reported,
            "is_year1_sem1": is_year1_sem1,
            "is_eligible": is_year1_sem1 and has_reported,
            "gender": student.user.gender,
            "booking": s.HostelBookingSerializer(booking).data if booking else None,
        })


# ======================================================================
# STUDENT SEMESTER REPORTING STATUS
# ======================================================================

class MyReportingStatusView(APIView):
    """Whether the student has reported for the current semester, plus their fee balance (reporting is often fee-gated)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        current_semester = m.Semester.objects.filter(is_current=True).first()
        if not current_semester:
            return Response({"detail": "No active semester found."}, status=status.HTTP_404_NOT_FOUND)

        reporting = m.StudentReporting.objects.filter(student=student, semester=current_semester).first()
        fee_summary = services.FeeService.student_balance_summary(student)

        return Response({
            "semester": s.SemesterSerializer(current_semester).data,
            "reporting": s.StudentReportingSerializer(reporting).data if reporting else None,
            "fee_outstanding": fee_summary["total_outstanding"],
        })


# ======================================================================
# STUDENT CLEARANCE STATUS
# ======================================================================

class MyClearanceStatusView(APIView):
    """Eligibility (final year/semester check) + all of the student's clearance requests, grouped."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Not a student."}, status=status.HTTP_403_FORBIDDEN)

        is_eligible = services.ClearanceService.is_eligible(student)
        requests = m.ClearanceRequest.objects.filter(student=student).order_by("-requested_at")

        return Response({
            "is_eligible": is_eligible,
            "clearance_types": m.ClearanceRequest.ClearanceType.choices,
            "requests": s.ClearanceRequestSerializer(requests, many=True).data,
        })
        
        
# ======================================================================
# LECTURER DASHBOARD
# ======================================================================

class LecturerDashboardView(APIView):
    permission_classes = [IsRole.for_roles("lecturer")]

    def get(self, request):
        lecturer = getattr(request.user, "lecturer_profile", None)
        if not lecturer:
            return Response({"detail": "Not a lecturer."}, status=status.HTTP_403_FORBIDDEN)

        current_semester = m.Semester.objects.filter(is_current=True).first()

        allocations = m.LecturerUnitAllocation.objects.filter(lecturer=lecturer, is_active=True)
        if current_semester:
            allocations = allocations.filter(semester=current_semester)
        allocation_ids = list(allocations.values_list("id", flat=True))

        total_students = m.Enrollment.objects.filter(
            lecturer_allocation_id__in=allocation_ids, is_active=True
        ).values("student").distinct().count()

        ungraded_count = m.Enrollment.objects.filter(
            lecturer_allocation_id__in=allocation_ids, is_active=True
        ).exclude(grade__isnull=False).count()

        open_cats = m.CatSubmission.objects.filter(
            lecturer_allocation_id__in=allocation_ids,
            is_published=True,
            closes_at__gte=timezone.now(),
        ).select_related("lecturer_allocation__course").order_by("closes_at")[:5]

        upcoming_classes = m.Timetable.objects.filter(
            lecturer=lecturer, is_active=True
        ).select_related("course").order_by("day_of_week", "start_time")[:5]

        pending_cat_grading = m.CatAnswerSubmission.objects.filter(
            cat__lecturer_allocation_id__in=allocation_ids,
            marks_awarded__isnull=True,
        ).select_related("student__user", "cat").order_by("-submitted_at")[:5]

        data = {
            "lecturer": s.LecturerSerializer(lecturer).data,
            "current_semester": s.SemesterSerializer(current_semester).data if current_semester else None,
            "stats": {
                "total_allocations": allocations.count(),
                "total_students": total_students,
                "ungraded_enrollments": ungraded_count,
                "open_cats": open_cats.count(),
            },
            "allocations": s.LecturerUnitAllocationSerializer(allocations, many=True).data,
            "upcoming_classes": s.TimetableSerializer(upcoming_classes, many=True).data,
            "open_cat_windows": s.CatSubmissionSerializer(open_cats, many=True).data,
            "pending_cat_grading": s.CatAnswerSubmissionDetailSerializer(pending_cat_grading, many=True).data,
        }
        return Response(data)


# ======================================================================
# QR ATTENDANCE
# ======================================================================

class MyAttendanceSessionsView(APIView):
    """Lecturer's own attendance sessions, most recent first."""
    permission_classes = [IsRole.for_roles("lecturer")]

    def get(self, request):
        lecturer = request.user.lecturer_profile
        sessions = m.AttendanceSession.objects.filter(
            timetable_slot__lecturer=lecturer
        ).select_related("timetable_slot__course").order_by("-session_date", "-id")[:20]
        return Response(s.AttendanceSessionSerializer(sessions, many=True).data)


class StartAttendanceSessionView(APIView):
    """Opens a QR attendance window for one of the lecturer's own timetable slots."""
    permission_classes = [IsRole.for_roles("lecturer")]

    def post(self, request):
        lecturer = request.user.lecturer_profile
        timetable_slot_id = request.data.get("timetable_slot")
        duration_minutes = int(request.data.get("duration_minutes", 15))

        try:
            timetable_slot = m.Timetable.objects.get(pk=timetable_slot_id, lecturer=lecturer)
        except m.Timetable.DoesNotExist:
            return Response({"detail": "Timetable slot not found for this lecturer."},
                             status=status.HTTP_404_NOT_FOUND)

        session = m.AttendanceSession.objects.create(
            timetable_slot=timetable_slot,
            session_date=timezone.now().date(),
            expires_at=timezone.now() + timezone.timedelta(minutes=duration_minutes),
        )
        return Response(s.AttendanceSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class AttendanceSessionLiveView(APIView):
    """Poll while a QR session is open to see who has checked in."""
    permission_classes = [IsRole.for_roles("lecturer")]

    def get(self, request, session_id):
        lecturer = request.user.lecturer_profile
        session = m.AttendanceSession.objects.filter(
            pk=session_id, timetable_slot__lecturer=lecturer
        ).select_related("timetable_slot__course").first()
        if not session:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        records = m.Attendance.objects.filter(attendance_session=session).select_related("student__user")
        enrolled_count = m.Enrollment.objects.filter(
            course=session.timetable_slot.course,
            semester=session.timetable_slot.semester,
            is_active=True,
        ).count()

        return Response({
            "session": s.AttendanceSessionSerializer(session).data,
            "is_open": session.is_active and timezone.now() <= session.expires_at,
            "enrolled_count": enrolled_count,
            "checked_in_count": records.count(),
            "records": s.AttendanceSerializer(records, many=True).data,
        })


class CloseAttendanceSessionView(APIView):
    """End a QR session early."""
    permission_classes = [IsRole.for_roles("lecturer")]

    def post(self, request, session_id):
        lecturer = request.user.lecturer_profile
        session = m.AttendanceSession.objects.filter(
            pk=session_id, timetable_slot__lecturer=lecturer
        ).first()
        if not session:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        session.is_active = False
        session.save(update_fields=["is_active"])
        return Response(s.AttendanceSessionSerializer(session).data)
    
    
    

# --- Add to views.py ---

# ======================================================================
# FINANCE
# ======================================================================

class InvoiceAllocationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.InvoiceAllocation.objects.select_related("invoice", "payment")
    serializer_class = s.InvoiceAllocationSerializer
    permission_classes = [IsRole.for_roles("admin", "finance")]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["payment", "invoice"]
    ordering_fields = ["allocated_at"]
    ordering = ["-allocated_at"]




class HelbBursaryAwardViewSet(viewsets.ModelViewSet):
    queryset = m.HelbBursaryAward.objects.select_related("student__user")
    serializer_class = s.HelbBursaryAwardSerializer
    permission_classes = [IsRole.for_roles("admin", "finance", "registrar")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["source", "academic_year", "disbursed", "student"]
    search_fields = ["student__registration_number", "student__user__first_name", "student__user__last_name"]
    ordering_fields = ["disbursed_date", "amount_awarded"]
    ordering = ["-id"]

    @action(detail=True, methods=["post"], url_path="mark-disbursed")
    def mark_disbursed(self, request, pk=None):
        award = self.get_object()
        award.disbursed = True
        award.disbursed_date = timezone.now().date()
        award.save(update_fields=["disbursed", "disbursed_date"])
        return Response(s.HelbBursaryAwardSerializer(award).data)


class FinanceDashboardView(APIView):
    permission_classes = [IsRole.for_roles("admin", "finance")]

    def get(self, request):
        data = services.FeeService.dashboard_summary()
        data["recent_payments"] = s.FeePaymentSerializer(data["recent_payments"], many=True).data
        return Response(data)


# ======================================================================
# HOSTEL
# ======================================================================

# ======================================================================
# HOSTEL
# ======================================================================

class HostelViewSet(viewsets.ModelViewSet):
    queryset = m.Hostel.objects.all()
    serializer_class = s.HostelSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name"]
    filterset_fields = ["hostel_type", "is_active"]
    ordering_fields = ["name"]
    ordering = ["name"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.user_type == "student":
            student = getattr(user, "student_profile", None)
            if not student:
                return qs.none()
            return qs.filter(hostel_type__in=services.HostelService.allowed_hostel_types(student))
        return qs

    @action(detail=True, methods=["get"], url_path="layout")
    def layout(self, request, pk=None):
        """
        Rooms + beds for the student-facing booking page. Rooms are
        sorted with the same natural_sort_key used in floor_plan() below
        — room_number is a CharField, so a plain .order_by("room_number")
        sorts lexicographically ("1", "10", "100", "101", ... "2", "20"),
        which is why rooms previously appeared out of numeric order on
        the booking grid.
        """
        hostel = self.get_object()
        user = request.user

        if user.user_type == "student":
            student = getattr(user, "student_profile", None)
            if not student or not services.HostelService.hostel_matches_gender(hostel, student):
                return Response({"detail": "This hostel is not available for your gender."},
                                 status=status.HTTP_403_FORBIDDEN)

        academic_year = m.AcademicYear.objects.filter(is_current=True).first()
        if not academic_year:
            return Response({"detail": "No active academic year found."}, status=status.HTTP_404_NOT_FOUND)

        rooms = list(
            hostel.rooms.filter(is_active=True)
            .prefetch_related(
                Prefetch("beds", queryset=m.Bed.objects.filter(academic_year=academic_year).order_by("bed_number"))
            )
        )
        rooms.sort(key=lambda r: utils.natural_sort_key(r.room_number))

        return Response({
            "hostel": s.HostelSerializer(hostel).data,
            "academic_year": academic_year.year,
            "rooms": [
                {
                    "id": room.id,
                    "room_number": room.room_number,
                    "capacity": room.capacity,
                    "beds": [
                        {"id": bed.id, "bed_number": bed.bed_number, "is_available": bed.is_available}
                        for bed in room.beds.all()
                    ],
                }
                for room in rooms
            ],
        })

    @action(detail=True, methods=["get"], url_path="floor-plan",
            permission_classes=[IsRole.for_roles("admin", "hostel_warden")])
    def floor_plan(self, request, pk=None):
        """
        Returns EVERY room in this hostel with its beds for the given
        academic year, in ONE unpaginated response, naturally sorted by
        room number. The generic /rooms/ and /beds/ list endpoints are
        paginated — fine for normal browsing, but it silently truncates
        a bulk-generated hostel with hundreds of rooms/beds down to a
        single page, which made it look like rooms weren't all created
        and beds showed 0/0. This endpoint bypasses pagination entirely
        (custom @action methods aren't auto-paginated) so the admin
        "Manage Rooms" floor plan always shows the true, complete state.
        """
        hostel = self.get_object()
        academic_year_id = request.query_params.get("academic_year")
        if not academic_year_id:
            return Response({"detail": "academic_year query param is required."},
                             status=status.HTTP_400_BAD_REQUEST)

        rooms = list(hostel.rooms.filter(is_active=True).only(
            "id", "room_number", "capacity", "is_active"
        ))
        rooms.sort(key=lambda r: utils.natural_sort_key(r.room_number))

        beds = m.Bed.objects.filter(
            room__hostel=hostel, academic_year_id=academic_year_id
        ).only("id", "room_id", "bed_number", "is_available")

        beds_by_room = {}
        for bed in beds:
            beds_by_room.setdefault(bed.room_id, []).append({
                "id": bed.id, "bed_number": bed.bed_number, "is_available": bed.is_available,
            })

        data = []
        for room in rooms:
            room_beds = sorted(beds_by_room.get(room.id, []), key=lambda b: b["bed_number"])
            data.append({
                "id": room.id,
                "room_number": room.room_number,
                "capacity": room.capacity,
                "is_active": room.is_active,
                "total_beds": len(room_beds),
                "occupied_beds": sum(1 for b in room_beds if not b["is_available"]),
                "beds": room_beds,
            })

        return Response({
            "academic_year": int(academic_year_id),
            "total_rooms": len(data),
            "rooms": data,
        })

    @action(detail=True, methods=["post"], url_path="bulk-generate-rooms",
            permission_classes=[IsRole.for_roles("admin", "hostel_warden")])
    def bulk_generate_rooms(self, request, pk=None):
        """
        Provisions BRAND-NEW physical rooms (with M beds each, for the
        given academic year) — intended to be used ONCE per hostel, when
        the rooms are first built.

        Room numbers are taken exactly as requested (start_room_number
        .. start_room_number + room_count - 1, with `prefix` applied) —
        no silent skipping. If any of those numbers already exist on
        this hostel, the whole call is rejected with a 400 listing the
        conflicting numbers, so nothing is created partially.

        If you're only trying to add beds for a NEW academic year to
        rooms that already exist, use `generate-beds-for-year` instead
        — it never creates new Room rows.
        """
        hostel = self.get_object()
        serializer = s.BulkGenerateRoomsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = services.HostelInventoryService.bulk_generate_rooms(
                hostel=hostel, academic_year=data["academic_year"],
                room_count=data["room_count"], beds_per_room=data["beds_per_room"],
                start_room_number=data["start_room_number"], prefix=data.get("prefix", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="generate-beds-for-year",
            permission_classes=[IsRole.for_roles("admin", "hostel_warden")])
    def generate_beds_for_year(self, request, pk=None):
        """
        Rolls EXISTING rooms into a new academic year: tops up beds on
        every already-existing active room to match that room's own
        capacity, without creating or changing any rooms. This is the
        correct action to use every year after the hostel's rooms have
        already been built once via bulk-generate-rooms.
        """
        hostel = self.get_object()
        serializer = s.GenerateBedsForYearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.HostelInventoryService.generate_beds_for_year(
            hostel=hostel, academic_year=serializer.validated_data["academic_year"],
        )
        return Response(result, status=status.HTTP_200_OK)


class RoomViewSet(viewsets.ModelViewSet):
    queryset = m.Room.objects.select_related("hostel")
    serializer_class = s.RoomSerializer
    permission_classes = [IsRole.for_roles("admin", "hostel_warden")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["hostel", "is_active"]
    search_fields = ["room_number"]
    ordering_fields = ["room_number"]
    ordering = ["room_number"]

    def get_queryset(self):
        """
        Same lexicographic-order problem as layout(): CharField
        room_number sorts as text via .order_by(), so this list would
        show "1, 10, 100, 101 ... 2, 20 ...". Since DRF's
        OrderingFilter/ordering_fields drive .order_by() directly on the
        queryset, we can't intercept it here with a Python sort the way
        layout()/floor_plan() do — so if this endpoint is used to render
        a room list anywhere, sort it client-side with the same natural
        sort, or switch this to a non-paginated custom action like
        floor_plan() if strict ordering is required.
        """
        return super().get_queryset()

class BedViewSet(viewsets.ModelViewSet):
    queryset = m.Bed.objects.all()
    serializer_class = s.BedSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["room", "academic_year", "is_available"]
    search_fields = ["bed_number", "room__room_number"]
    ordering_fields = ["bed_number"]
    ordering = ["bed_number"]

    def get_queryset(self):
        qs = m.Bed.objects.select_related("room__hostel")
        user = self.request.user

        if user.user_type in {"admin", "hostel_warden"}:
            return qs

        qs = qs.filter(is_available=True)
        if user.user_type == "student":
            student = getattr(user, "student_profile", None)
            if not student:
                return qs.none()
            qs = qs.filter(room__hostel__hostel_type__in=services.HostelService.allowed_hostel_types(student))
        return qs

    
    
class HostelDashboardView(APIView):
    permission_classes = [IsRole.for_roles("admin", "hostel_warden")]

    def get(self, request):
        academic_year = None
        ay_id = request.query_params.get("academic_year")
        if ay_id:
            academic_year = m.AcademicYear.objects.filter(pk=ay_id).first()
        data = services.HostelService.dashboard_summary(academic_year)
        data["recent_bookings"] = s.HostelBookingSerializer(data["recent_bookings"], many=True).data
        return Response(data)


class MyPermissionsView(APIView):
    """Returns the calling user's allowed page keys. Frontend uses this to
    double-check its own client-side RBAC config hasn't drifted — the
    frontend's src/config/rbac.js should mirror ROLE_PAGE_PERMISSIONS above."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            "role": request.user.user_type,
            "pages": services.ROLE_PAGE_PERMISSIONS.get(request.user.user_type, []),
        })
        
        

class AdminUserViewSet(viewsets.ModelViewSet):
    """
    Generic account management, admin-only. Student/Lecturer creation
    stays on StudentViewSet.admit / LecturerViewSet.admit, which also
    create the linked profile row — this viewset is for everyone else
    (admin, registrar, dean, cod, finance, hostel_warden, exam_office,
    plain staff) plus editing/password-reset for any existing account.
    """
    queryset = m.User.objects.all().order_by("-created_at")
    serializer_class = s.AdminUserSerializer
    permission_classes = [IsRole.for_roles("admin")]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["user_type", "is_active", "gender"]
    search_fields = ["username", "first_name", "last_name", "email", "phone"]
    ordering_fields = ["created_at", "date_joined", "username"]
    ordering = ["-created_at"]

    def create(self, request, *args, **kwargs):
        serializer = s.AdminCreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user, temp_password = services.UserManagementService.create_user(**serializer.validated_data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        payload = s.AdminUserSerializer(user).data
        payload["temporary_password"] = temp_password
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get("password", "")
        if len(new_password) < 6:
            return Response({"detail": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)
        force_change = request.data.get("force_change", True)
        services.UserManagementService.set_password(user, new_password, force_change=bool(force_change))
        return Response({"detail": "Password updated."})
    
    
    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        user = self.get_object()
        if not user.is_locked:
            return Response({"detail": "Account is not locked."}, status=status.HTTP_400_BAD_REQUEST)
        services.AuthService.unlock_account(user, performed_by=request.user, notes=request.data.get("notes", ""))
        return Response(s.AdminUserSerializer(user).data)

    @action(detail=True, methods=["post"], url_path="lock")
    def lock(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response({"detail": "You cannot lock your own account."}, status=status.HTTP_400_BAD_REQUEST)
        services.AuthService.lock_account(
            user, performed_by=request.user,
            reason=m.AccountLockEvent.Reason.ADMIN_MANUAL,
            notes=request.data.get("notes", ""),
        )
        return Response(s.AdminUserSerializer(user).data)
    
    

class GradeBandViewSet(viewsets.ModelViewSet):
    queryset = m.GradeBand.objects.select_related("scheme")
    serializer_class = s.GradeBandSerializer
    permission_classes = [IsRole.for_roles("admin", "registrar", "exam_office")]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["scheme", "is_supplementary_band", "is_fail_band"]
    ordering_fields = ["min_score"]
    ordering = ["-min_score"]
    
    

# ======================================================================
# COD DASHBOARD
# ======================================================================

class CodDashboardView(APIView):
    permission_classes = [IsRole.for_roles("cod")]

    def get(self, request):
        department = services.get_cod_department(request.user)
        if not department:
            return Response(
                {"detail": "You are not assigned as head of any department. Contact an admin."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(services.CodReportService.department_summary(department))


class CodDepartmentReportsView(APIView):
    """Deeper report view — same builder as the dashboard, kept as its own endpoint
    so the frontend Reports page can be extended independently later."""
    permission_classes = [IsRole.for_roles("cod")]

    def get(self, request):
        department = services.get_cod_department(request.user)
        if not department:
            return Response(
                {"detail": "You are not assigned as head of any department. Contact an admin."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(services.CodReportService.department_summary(department))
    
    
# ======================================================================
# REGISTRAR / DEAN / EXAM OFFICE DASHBOARDS
# Paste these into views.py, near CodDashboardView / CodDepartmentReportsView.
# Each depends on a service you'll need to add to services.py — see the
# companion file `services_additions.py` for the exact functions expected:
#   - services.get_dean_faculty(user)
#   - services.DeanReportService.faculty_summary(faculty)
#   - services.RegistrarReportService.summary()
#   - services.ExamOfficeReportService.summary()
# ======================================================================

class DeanDashboardView(APIView):
    """
    Mirrors CodDashboardView but scoped to Faculty instead of Department —
    a Dean heads a Faculty (Faculty.dean FK), a COD heads a Department.
    """
    permission_classes = [IsRole.for_roles("dean")]

    def get(self, request):
        faculty = services.get_dean_faculty(request.user)
        if not faculty:
            return Response(
                {"detail": "You are not assigned as dean of any faculty. Contact an admin."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(services.DeanReportService.faculty_summary(faculty))


class RegistrarDashboardView(APIView):
    """
    Registrar isn't tied to one faculty/department — it's an
    institution-wide records role, so this is unscoped (unlike Dean/COD).
    """
    permission_classes = [IsRole.for_roles("registrar")]

    def get(self, request):
        return Response(services.RegistrarReportService.summary())


class ExamOfficeDashboardView(APIView):
    """
    Institution-wide examinations overview: upcoming exams, unpublished
    exams, pending grade verifications, outstanding supplementary sittings.
    """
    permission_classes = [IsRole.for_roles("exam_office")]

    def get(self, request):
        return Response(services.ExamOfficeReportService.summary())
    
    
