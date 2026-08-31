# hr/views.py
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    JobGroup, Position, StaffProfile, EmploymentContract,
    LeaveType, LeaveBalance, LeaveApplication,
    AttendanceDevice, QRAttendanceSession, BiometricLog, StaffAttendance,
    SalaryComponentType, Allowance, Deduction, PAYEBand, StatutoryRate,
    SalaryAdvance, StaffLoan, LoanRepayment,
    PayrollPeriod, Payslip, PayslipLineItem, PayrollRun,
)
from .serializers import (
    JobGroupSerializer, PositionSerializer, StaffProfileListSerializer, StaffProfileDetailSerializer,
    EmploymentContractSerializer, LeaveTypeSerializer, LeaveBalanceSerializer, LeaveApplicationSerializer,
    LeaveDecisionSerializer, AttendanceDeviceSerializer, QRAttendanceSessionSerializer, BiometricLogSerializer,
    StaffAttendanceSerializer, QRCheckInSerializer, SalaryComponentTypeSerializer, AllowanceSerializer,
    DeductionSerializer, PAYEBandSerializer, StatutoryRateSerializer, SalaryAdvanceSerializer,
    StaffLoanSerializer, LoanRepaymentSerializer, PayrollPeriodSerializer, PayslipSerializer,
    PayrollRunSerializer, RunPayrollSerializer,
)
from .services import LeaveService, LeaveError, AttendanceService, PayrollService, PayrollError, HRDashboardService


class IsHRorAdmin(permissions.BasePermission):
    """HR officers, registrar, and admins manage this module; everyone authenticated can read their own bits."""
    allowed_roles = {"admin", "staff", "registrar"}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_superuser or request.user.user_type in self.allowed_roles


# ---------------------------------------------------------------- Employee

class JobGroupViewSet(viewsets.ModelViewSet):
    queryset = JobGroup.objects.all()
    serializer_class = JobGroupSerializer
    permission_classes = [IsHRorAdmin]


class PositionViewSet(viewsets.ModelViewSet):
    queryset = Position.objects.select_related("department", "job_group").all()
    serializer_class = PositionSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["department", "is_academic", "is_active"]
    search_fields = ["title"]


class StaffProfileViewSet(viewsets.ModelViewSet):
    queryset = StaffProfile.objects.select_related("user", "department", "position", "job_group").all()
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["department", "category", "employment_status", "is_active"]
    search_fields = ["staff_number", "user__first_name", "user__last_name", "user__username"]
    ordering_fields = ["date_of_joining", "staff_number"]

    def get_serializer_class(self):
        return StaffProfileDetailSerializer if self.action in ["retrieve", "create", "update", "partial_update"] \
            else StaffProfileListSerializer

    @action(detail=True, methods=["get"])
    def payslips(self, request, pk=None):
        staff = self.get_object()
        qs = staff.payslips.select_related("payroll_period").order_by("-payroll_period__year", "-payroll_period__month")
        return Response(PayslipSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"])
    def leave_balances(self, request, pk=None):
        staff = self.get_object()
        year = request.query_params.get("year", None)
        qs = staff.leave_balances.select_related("leave_type").all()
        if year:
            qs = qs.filter(year=year)
        return Response(LeaveBalanceSerializer(qs, many=True).data)


class EmploymentContractViewSet(viewsets.ModelViewSet):
    queryset = EmploymentContract.objects.select_related("staff", "position").all()
    serializer_class = EmploymentContractSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["staff", "contract_type", "is_active"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ---------------------------------------------------------------- Leave

class LeaveTypeViewSet(viewsets.ModelViewSet):
    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeSerializer
    permission_classes = [IsHRorAdmin]


class LeaveBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LeaveBalance.objects.select_related("staff", "leave_type").all()
    serializer_class = LeaveBalanceSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["staff", "leave_type", "year"]


class LeaveApplicationViewSet(viewsets.ModelViewSet):
    queryset = LeaveApplication.objects.select_related("staff__user", "leave_type", "reviewed_by").all()
    serializer_class = LeaveApplicationSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["staff", "leave_type", "status"]
    ordering_fields = ["applied_at", "start_date"]

    def create(self, request, *args, **kwargs):
        try:
            application = LeaveService.apply(
                staff_id_to_staff(request.data.get("staff")),
                LeaveType.objects.get(pk=request.data.get("leave_type")),
                request.data.get("start_date"), request.data.get("end_date"),
                reason=request.data.get("reason", ""),
            )
        except (LeaveError, LeaveType.DoesNotExist) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(application).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        application = self.get_object()
        serializer = LeaveDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            LeaveService.decide(application, True, request.user, serializer.validated_data.get("remarks", ""))
        except LeaveError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        application = self.get_object()
        serializer = LeaveDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            LeaveService.decide(application, False, request.user, serializer.validated_data.get("remarks", ""))
        except LeaveError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        application = self.get_object()
        try:
            LeaveService.cancel(application)
        except LeaveError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(application).data)


def staff_id_to_staff(staff_id):
    return StaffProfile.objects.get(pk=staff_id)


# ---------------------------------------------------------------- Attendance

class AttendanceDeviceViewSet(viewsets.ModelViewSet):
    queryset = AttendanceDevice.objects.all()
    serializer_class = AttendanceDeviceSerializer
    permission_classes = [IsHRorAdmin]


class QRAttendanceSessionViewSet(viewsets.ModelViewSet):
    queryset = QRAttendanceSession.objects.all()
    serializer_class = QRAttendanceSessionSerializer
    permission_classes = [IsHRorAdmin]

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def check_in(self, request):
        serializer = QRCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        staff = getattr(request.user, "staff_hr_profile", None)
        if not staff:
            return Response({"detail": "No HR staff profile linked to this account."},
                             status=status.HTTP_400_BAD_REQUEST)
        try:
            record = AttendanceService.check_in_via_qr(serializer.validated_data["token"], staff)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(StaffAttendanceSerializer(record).data)


class BiometricLogViewSet(viewsets.ModelViewSet):
    queryset = BiometricLog.objects.select_related("staff", "device").all()
    serializer_class = BiometricLogSerializer
    permission_classes = [IsHRorAdmin]

    @action(detail=False, methods=["post"])
    def fold(self, request):
        """Fold today's (or a given date's) raw punches into StaffAttendance rows."""
        date = request.data.get("date") or None
        from django.utils import timezone as tz
        date = date or tz.localdate()
        updated = AttendanceService.fold_biometric_logs(date)
        return Response({"updated": len(updated)})


class StaffAttendanceViewSet(viewsets.ModelViewSet):
    queryset = StaffAttendance.objects.select_related("staff__user", "staff__department").all()
    serializer_class = StaffAttendanceSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["staff", "date", "status", "source"]

    @action(detail=False, methods=["post"])
    def mark_absentees(self, request):
        from django.utils import timezone as tz
        date = request.data.get("date") or tz.localdate()
        department = request.data.get("department")
        count = AttendanceService.mark_absentees(date, department)
        return Response({"marked_absent": count})


# ---------------------------------------------------------------- Payroll

class SalaryComponentTypeViewSet(viewsets.ModelViewSet):
    queryset = SalaryComponentType.objects.all()
    serializer_class = SalaryComponentTypeSerializer
    permission_classes = [IsHRorAdmin]


class AllowanceViewSet(viewsets.ModelViewSet):
    queryset = Allowance.objects.select_related("staff", "component_type").all()
    serializer_class = AllowanceSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["staff", "component_type", "is_active"]


class DeductionViewSet(viewsets.ModelViewSet):
    queryset = Deduction.objects.select_related("staff", "component_type").all()
    serializer_class = DeductionSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["staff", "component_type", "is_active"]


class PAYEBandViewSet(viewsets.ModelViewSet):
    queryset = PAYEBand.objects.all()
    serializer_class = PAYEBandSerializer
    permission_classes = [IsHRorAdmin]


class StatutoryRateViewSet(viewsets.ModelViewSet):
    queryset = StatutoryRate.objects.all()
    serializer_class = StatutoryRateSerializer
    permission_classes = [IsHRorAdmin]


class SalaryAdvanceViewSet(viewsets.ModelViewSet):
    queryset = SalaryAdvance.objects.select_related("staff__user").all()
    serializer_class = SalaryAdvanceSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["staff", "status"]

    def perform_create(self, serializer):
        serializer.save(balance_remaining=serializer.validated_data["amount"])

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        from django.utils import timezone as tz
        advance = self.get_object()
        advance.status = SalaryAdvance.Status.APPROVED
        advance.approved_by = request.user
        advance.approved_at = tz.now()
        advance.save(update_fields=["status", "approved_by", "approved_at"])
        return Response(self.get_serializer(advance).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        advance = self.get_object()
        advance.status = SalaryAdvance.Status.REJECTED
        advance.save(update_fields=["status"])
        return Response(self.get_serializer(advance).data)


class StaffLoanViewSet(viewsets.ModelViewSet):
    queryset = StaffLoan.objects.select_related("staff__user").all()
    serializer_class = StaffLoanSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["staff", "status"]

    def perform_create(self, serializer):
        serializer.save(balance_remaining=serializer.validated_data["principal_amount"])

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        loan = self.get_object()
        loan.status = StaffLoan.Status.ACTIVE
        loan.approved_by = request.user
        loan.save(update_fields=["status", "approved_by"])
        return Response(self.get_serializer(loan).data)


class LoanRepaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LoanRepayment.objects.select_related("loan").all()
    serializer_class = LoanRepaymentSerializer
    permission_classes = [IsHRorAdmin]


class PayrollPeriodViewSet(viewsets.ModelViewSet):
    queryset = PayrollPeriod.objects.all()
    serializer_class = PayrollPeriodSerializer
    permission_classes = [IsHRorAdmin]

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        period = self.get_object()
        serializer = RunPayrollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            run = PayrollService.run_payroll(period, request.user)
        except PayrollError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PayrollRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        period = self.get_object()
        try:
            PayrollService.mark_paid(period)
        except PayrollError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(period).data)

    @action(detail=True, methods=["get"])
    def payslips(self, request, pk=None):
        period = self.get_object()
        qs = period.payslips.select_related("staff__user").all()
        return Response(PayslipSerializer(qs, many=True).data)


class PayslipViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payslip.objects.select_related("staff__user", "payroll_period").prefetch_related("line_items").all()
    serializer_class = PayslipSerializer
    permission_classes = [IsHRorAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["staff", "payroll_period", "is_paid"]


class PayrollRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PayrollRun.objects.select_related("payroll_period", "triggered_by").all()
    serializer_class = PayrollRunSerializer
    permission_classes = [IsHRorAdmin]


# ---------------------------------------------------------------- Dashboard

class HRDashboardView(viewsets.ViewSet):
    """Non-model endpoints backing the React HR dashboard page."""
    permission_classes = [IsHRorAdmin]

    def list(self, request):
        return Response(HRDashboardService.summary())

    @action(detail=False, methods=["get"])
    def staff_by_category(self, request):
        return Response(HRDashboardService.staff_by_category())

    @action(detail=False, methods=["get"])
    def payroll_trend(self, request):
        months = int(request.query_params.get("months", 6))
        return Response(HRDashboardService.payroll_cost_trend(months))

    @action(detail=False, methods=["get"])
    def attendance_trend(self, request):
        days = int(request.query_params.get("days", 14))
        return Response(HRDashboardService.attendance_trend(days))
