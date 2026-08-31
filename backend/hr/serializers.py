# hr/serializers.py
from rest_framework import serializers

from portal_api.models import User, Department
from .models import (
    JobGroup, Position, StaffProfile, EmploymentContract,
    LeaveType, LeaveBalance, LeaveApplication,
    AttendanceDevice, QRAttendanceSession, BiometricLog, StaffAttendance,
    SalaryComponentType, Allowance, Deduction, PAYEBand, StatutoryRate,
    SalaryAdvance, StaffLoan, LoanRepayment,
    PayrollPeriod, Payslip, PayslipLineItem, PayrollRun,
)


class MiniUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "email", "phone", "profile_picture"]

    def get_full_name(self, obj):
        return obj.get_full_name()


# ---------------------------------------------------------------- Employee

class JobGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobGroup
        fields = "__all__"


class PositionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Position
        fields = "__all__"


class EmploymentContractSerializer(serializers.ModelSerializer):
    position_title = serializers.CharField(source="position.title", read_only=True)

    class Meta:
        model = EmploymentContract
        fields = "__all__"
        read_only_fields = ["created_by", "created_at"]


class StaffProfileListSerializer(serializers.ModelSerializer):
    """Lean serializer for tables/lists."""
    full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    position_title = serializers.CharField(source="position.title", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = StaffProfile
        fields = ["id", "staff_number", "full_name", "email", "phone", "department_name",
                  "position_title", "category", "employment_status", "date_of_joining", "is_active"]


class StaffProfileDetailSerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    position_title = serializers.CharField(source="position.title", read_only=True)
    job_group_code = serializers.CharField(source="job_group.code", read_only=True)
    contracts = EmploymentContractSerializer(many=True, read_only=True)
    current_basic_salary = serializers.SerializerMethodField()

    class Meta:
        model = StaffProfile
        fields = "__all__"

    def get_current_basic_salary(self, obj):
        contract = obj.current_contract
        return contract.basic_salary if contract else None


# ---------------------------------------------------------------- Leave

class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = "__all__"


class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    available_days = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)

    class Meta:
        model = LeaveBalance
        fields = "__all__"


class LeaveApplicationSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.user.get_full_name", read_only=True)
    staff_number = serializers.CharField(source="staff.staff_number", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.get_full_name", read_only=True)

    class Meta:
        model = LeaveApplication
        fields = "__all__"
        read_only_fields = ["days_requested", "status", "applied_at", "reviewed_by",
                             "reviewed_at", "review_remarks"]


class LeaveDecisionSerializer(serializers.Serializer):
    """Body for the approve/reject action on LeaveApplicationViewSet."""
    remarks = serializers.CharField(required=False, allow_blank=True)


# ---------------------------------------------------------------- Attendance

class AttendanceDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceDevice
        fields = "__all__"


class QRAttendanceSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QRAttendanceSession
        fields = "__all__"
        read_only_fields = ["token", "generated_by"]


class BiometricLogSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.user.get_full_name", read_only=True)

    class Meta:
        model = BiometricLog
        fields = "__all__"


class StaffAttendanceSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.user.get_full_name", read_only=True)
    staff_number = serializers.CharField(source="staff.staff_number", read_only=True)
    department_name = serializers.CharField(source="staff.department.name", read_only=True)

    class Meta:
        model = StaffAttendance
        fields = "__all__"


class QRCheckInSerializer(serializers.Serializer):
    """Body for the QR self-check-in endpoint."""
    token = serializers.CharField()


# ---------------------------------------------------------------- Payroll

class SalaryComponentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryComponentType
        fields = "__all__"


class AllowanceSerializer(serializers.ModelSerializer):
    component_name = serializers.CharField(source="component_type.name", read_only=True)
    staff_number = serializers.CharField(source="staff.staff_number", read_only=True)

    class Meta:
        model = Allowance
        fields = "__all__"


class DeductionSerializer(serializers.ModelSerializer):
    component_name = serializers.CharField(source="component_type.name", read_only=True)
    staff_number = serializers.CharField(source="staff.staff_number", read_only=True)

    class Meta:
        model = Deduction
        fields = "__all__"


class PAYEBandSerializer(serializers.ModelSerializer):
    class Meta:
        model = PAYEBand
        fields = "__all__"


class StatutoryRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatutoryRate
        fields = "__all__"


class SalaryAdvanceSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.user.get_full_name", read_only=True)
    staff_number = serializers.CharField(source="staff.staff_number", read_only=True)

    class Meta:
        model = SalaryAdvance
        fields = "__all__"
        read_only_fields = ["balance_remaining", "status", "approved_by", "approved_at"]


class StaffLoanSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.user.get_full_name", read_only=True)
    staff_number = serializers.CharField(source="staff.staff_number", read_only=True)

    class Meta:
        model = StaffLoan
        fields = "__all__"
        read_only_fields = ["balance_remaining", "status", "approved_by"]


class LoanRepaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanRepayment
        fields = "__all__"


class PayrollPeriodSerializer(serializers.ModelSerializer):
    processed_by_name = serializers.CharField(source="processed_by.get_full_name", read_only=True)
    payslip_count = serializers.IntegerField(source="payslips.count", read_only=True)

    class Meta:
        model = PayrollPeriod
        fields = "__all__"


class PayslipLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayslipLineItem
        fields = "__all__"


class PayslipSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.user.get_full_name", read_only=True)
    staff_number = serializers.CharField(source="staff.staff_number", read_only=True)
    department_name = serializers.CharField(source="staff.department.name", read_only=True)
    period_label = serializers.SerializerMethodField()
    line_items = PayslipLineItemSerializer(many=True, read_only=True)

    class Meta:
        model = Payslip
        fields = "__all__"

    def get_period_label(self, obj):
        return f"{obj.payroll_period.month:02d}/{obj.payroll_period.year}"


class PayrollRunSerializer(serializers.ModelSerializer):
    period_label = serializers.SerializerMethodField()
    triggered_by_name = serializers.CharField(source="triggered_by.get_full_name", read_only=True)

    class Meta:
        model = PayrollRun
        fields = "__all__"

    def get_period_label(self, obj):
        return f"{obj.payroll_period.month:02d}/{obj.payroll_period.year}"


class RunPayrollSerializer(serializers.Serializer):
    """Body for POST /payroll-periods/{id}/run/"""
    confirm = serializers.BooleanField(default=True)
