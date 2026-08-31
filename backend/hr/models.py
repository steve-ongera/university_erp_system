# hr/models.py
"""
Muranga University Student Portal — HR & Payroll module.

Design notes
------------
- This app plugs into the existing `portal_api` app rather than duplicating
  it: `StaffProfile.user` points at the existing `portal_api.User`, and
  `Position`/`EmploymentContract` point at the existing `portal_api.Department`.
  A Lecturer or Staff row in portal_api can (and normally will) also have a
  StaffProfile here — this app owns *employment/payroll* facts, portal_api
  keeps owning *academic* facts (who teaches what).
- Same conventions as portal_api: money is Decimal, nothing is mutated in
  place for financial history — Payslip rows are generated once per
  PayrollPeriod and never edited after `is_paid=True`; corrections happen
  via a new PayrollPeriod / adjustment, never by rewriting a paid payslip.
- Leave balances are derived (opening + accrued + carried_forward - used),
  not stored as a single drifting number — see services.LeaveService.
"""
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone

from portal_api.models import User, Department, AcademicYear


# ======================================================================
# EMPLOYEE MANAGEMENT
# ======================================================================

class JobGroup(models.Model):
    """A pay-scale band, e.g. Job Group 'K', 'L', 'M' (government scale)."""
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100, blank=True)
    min_salary = models.DecimalField(max_digits=10, decimal_places=2)
    max_salary = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["min_salary"]

    def __str__(self):
        return f"Job Group {self.code}"


class Position(models.Model):
    """A job title/role, e.g. 'Senior Lecturer', 'Accountant II', 'Groundsman'."""
    title = models.CharField(max_length=100)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="hr_positions")
    is_academic = models.BooleanField(default=False, help_text="True for teaching positions (lecturers, tutors).")
    job_group = models.ForeignKey(JobGroup, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="positions")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ["title", "department"]

    def __str__(self):
        return f"{self.title} - {self.department.code}"


class StaffProfile(models.Model):
    """
    The HR "employee record" for anyone on payroll — academic or
    non-academic. One per portal_api.User; may coexist with that user's
    Lecturer/Staff academic profile.
    """
    class Category(models.TextChoices):
        PERMANENT = "permanent", "Permanent & Pensionable"
        CONTRACT = "contract", "Contract Staff"
        PART_TIME = "part_time", "Part-Time"
        CASUAL = "casual", "Casual"

    class EmploymentStatus(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_LEAVE = "on_leave", "On Leave"
        SUSPENDED = "suspended", "Suspended"
        TERMINATED = "terminated", "Terminated"
        RETIRED = "retired", "Retired"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_hr_profile")
    staff_number = models.CharField(max_length=20, unique=True, db_index=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, related_name="hr_staff")
    position = models.ForeignKey(Position, on_delete=models.SET_NULL, null=True, related_name="holders")
    job_group = models.ForeignKey(JobGroup, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="staff")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.PERMANENT)
    employment_status = models.CharField(max_length=20, choices=EmploymentStatus.choices,
                                          default=EmploymentStatus.ACTIVE)
    date_of_joining = models.DateField(default=timezone.now)
    date_of_exit = models.DateField(null=True, blank=True)

    # Statutory identifiers — needed for payroll remittance
    kra_pin = models.CharField(max_length=20, blank=True)
    nssf_number = models.CharField(max_length=30, blank=True)
    shif_number = models.CharField(max_length=30, blank=True)

    # Bank details for salary payment
    bank_name = models.CharField(max_length=100, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=30, blank=True)

    next_of_kin_name = models.CharField(max_length=100, blank=True)
    next_of_kin_phone = models.CharField(max_length=15, blank=True)
    next_of_kin_relationship = models.CharField(max_length=50, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["staff_number"]), models.Index(fields=["employment_status"])]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.staff_number}"

    @property
    def current_contract(self):
        return self.contracts.filter(is_active=True).order_by("-start_date").first()


class EmploymentContract(models.Model):
    """
    Append-only contract history for a StaffProfile. Renewals create a
    NEW row (linked via `renewed_from`) rather than editing the old one,
    so contract history is auditable.
    """
    class ContractType(models.TextChoices):
        PERMANENT = "permanent", "Permanent"
        FIXED_TERM = "fixed_term", "Fixed Term"
        PART_TIME = "part_time", "Part-Time"
        CASUAL = "casual", "Casual"

    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="contracts")
    contract_type = models.CharField(max_length=20, choices=ContractType.choices)
    position = models.ForeignKey(Position, on_delete=models.SET_NULL, null=True, related_name="contracts")
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True, help_text="Blank for permanent contracts.")
    renewed_from = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name="renewals")
    document = models.FileField(upload_to="contracts/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    terminated_at = models.DateTimeField(null=True, blank=True)
    termination_reason = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="contracts_created")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.staff.staff_number} - {self.contract_type} ({self.start_date})"


# ======================================================================
# LEAVE
# ======================================================================

class LeaveType(models.Model):
    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=10, unique=True)
    days_per_year = models.IntegerField(default=21)
    is_paid = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    carry_forward_allowed = models.BooleanField(default=False)
    max_carry_forward_days = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class LeaveBalance(models.Model):
    """
    One row per staff/leave-type/year. `used_days` is updated by
    LeaveService whenever an application is approved — never edited
    directly from a view.
    """
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="leave_balances")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name="balances")
    year = models.IntegerField()
    opening_balance = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    accrued_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    carried_forward_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["staff", "leave_type", "year"]

    @property
    def available_days(self):
        return (self.opening_balance + self.accrued_days + self.carried_forward_days) - self.used_days

    def __str__(self):
        return f"{self.staff.staff_number} - {self.leave_type.code} {self.year}: {self.available_days}"


class LeaveApplication(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="leave_applications")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name="applications")
    start_date = models.DateField()
    end_date = models.DateField()
    days_requested = models.DecimalField(max_digits=5, decimal_places=1)
    reason = models.TextField(blank=True)
    supporting_document = models.FileField(upload_to="leave_docs/", null=True, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    applied_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="leave_reviews")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remarks = models.TextField(blank=True)

    class Meta:
        ordering = ["-applied_at"]
        indexes = [models.Index(fields=["staff", "status"])]

    def __str__(self):
        return f"{self.staff.staff_number} - {self.leave_type.code} ({self.status})"


# ======================================================================
# ATTENDANCE
# ======================================================================

class AttendanceDevice(models.Model):
    class DeviceType(models.TextChoices):
        BIOMETRIC = "biometric", "Biometric Scanner"
        QR = "qr", "QR Kiosk"

    name = models.CharField(max_length=100)
    device_type = models.CharField(max_length=15, choices=DeviceType.choices)
    location = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.device_type})"


class QRAttendanceSession(models.Model):
    """A rotating QR code window staff scan to check in/out from their phone."""
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True, blank=True,
                                    related_name="qr_sessions")
    token = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    valid_date = models.DateField(default=timezone.localdate)
    opens_at = models.TimeField()
    closes_at = models.TimeField()
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"QR session {self.valid_date} ({self.token[:8]})"


class BiometricLog(models.Model):
    """Raw punches ingested from a biometric device, before being folded into StaffAttendance."""
    class LogType(models.TextChoices):
        CHECK_IN = "check_in", "Check In"
        CHECK_OUT = "check_out", "Check Out"

    device = models.ForeignKey(AttendanceDevice, on_delete=models.SET_NULL, null=True, related_name="logs")
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="biometric_logs")
    log_type = models.CharField(max_length=10, choices=LogType.choices)
    timestamp = models.DateTimeField()
    synced_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]


class StaffAttendance(models.Model):
    """
    The consolidated daily attendance row HR/payroll actually reads —
    folded together from BiometricLog / QR scans / manual entry by
    services.AttendanceService.
    """
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        LATE = "late", "Late"
        ABSENT = "absent", "Absent"
        ON_LEAVE = "on_leave", "On Leave"
        EXCUSED = "excused", "Excused"

    class Source(models.TextChoices):
        BIOMETRIC = "biometric", "Biometric"
        QR = "qr", "QR Code"
        MANUAL = "manual", "Manual Entry"

    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    late_minutes = models.IntegerField(default=0)
    marked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="attendance_marked")

    class Meta:
        unique_together = ["staff", "date"]
        ordering = ["-date"]
        indexes = [models.Index(fields=["staff", "date"]), models.Index(fields=["date", "status"])]

    def __str__(self):
        return f"{self.staff.staff_number} - {self.date} ({self.status})"


# ======================================================================
# PAYROLL
# ======================================================================

class SalaryComponentType(models.Model):
    """A named pay-slip line item, e.g. 'House Allowance', 'Union Dues'."""
    class Category(models.TextChoices):
        ALLOWANCE = "allowance", "Allowance"
        DEDUCTION = "deduction", "Deduction"

    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    category = models.CharField(max_length=15, choices=Category.choices)
    is_taxable = models.BooleanField(default=True, help_text="Allowances only — counts toward PAYE taxable pay.")
    is_statutory = models.BooleanField(default=False, help_text="PAYE/NSSF/SHIF/Pension — computed, not manually set.")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Allowance(models.Model):
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="allowances")
    component_type = models.ForeignKey(SalaryComponentType, on_delete=models.CASCADE,
                                        limit_choices_to={"category": "allowance"}, related_name="allowance_grants")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    effective_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.staff.staff_number} - {self.component_type.name}: {self.amount}"


class Deduction(models.Model):
    """A recurring non-statutory deduction, e.g. union dues, welfare contribution."""
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="deductions")
    component_type = models.ForeignKey(SalaryComponentType, on_delete=models.CASCADE,
                                        limit_choices_to={"category": "deduction"}, related_name="deduction_grants")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    effective_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.staff.staff_number} - {self.component_type.name}: {self.amount}"


class PAYEBand(models.Model):
    """A progressive-tax bracket, versioned by the year it took effect (KRA-style bands)."""
    effective_year = models.IntegerField()
    band_order = models.IntegerField(help_text="1 = lowest band, ascending.")
    lower_limit = models.DecimalField(max_digits=10, decimal_places=2)
    upper_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                                       help_text="Blank = no upper limit (top band).")
    rate_percent = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        unique_together = ["effective_year", "band_order"]
        ordering = ["effective_year", "band_order"]

    def __str__(self):
        return f"{self.effective_year} band {self.band_order}: {self.rate_percent}%"


class StatutoryRate(models.Model):
    """Employee/employer contribution rates for NSSF, SHIF, Pension — versioned by year."""
    class Scheme(models.TextChoices):
        NSSF = "nssf", "NSSF"
        SHIF = "shif", "SHIF"
        PENSION = "pension", "Pension"

    scheme = models.CharField(max_length=10, choices=Scheme.choices)
    effective_year = models.IntegerField()
    rate_employee_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    rate_employer_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    fixed_amount_employee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                                                 help_text="Used instead of a percentage where the scheme is a flat fee.")
    min_contribution = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_contribution = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ["scheme", "effective_year"]

    def __str__(self):
        return f"{self.scheme} {self.effective_year}"


class SalaryAdvance(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        FULLY_RECOVERED = "fully_recovered", "Fully Recovered"

    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="salary_advances")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField(blank=True)
    repayment_months = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    monthly_deduction = models.DecimalField(max_digits=10, decimal_places=2)
    balance_remaining = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="advances_approved")
    approved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.staff.staff_number} advance - {self.amount} ({self.status})"


class StaffLoan(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        REJECTED = "rejected", "Rejected"
        CLOSED = "closed", "Closed"

    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="loans")
    loan_type = models.CharField(max_length=50, default="Staff Loan")
    principal_amount = models.DecimalField(max_digits=10, decimal_places=2)
    interest_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    repayment_months = models.IntegerField(validators=[MinValueValidator(1)])
    monthly_installment = models.DecimalField(max_digits=10, decimal_places=2)
    balance_remaining = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField()
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="loans_approved")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.staff.staff_number} loan - {self.principal_amount} ({self.status})"


class LoanRepayment(models.Model):
    loan = models.ForeignKey(StaffLoan, on_delete=models.CASCADE, related_name="repayments")
    payroll_period = models.ForeignKey("PayrollPeriod", on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name="loan_repayments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.loan.staff.staff_number} repayment - {self.amount}"


class PayrollPeriod(models.Model):
    """One calendar month's payroll cycle."""
    class PeriodStatus(models.TextChoices):
        OPEN = "open", "Open"
        PROCESSING = "processing", "Processing"
        CLOSED = "closed", "Closed (Payslips Generated)"
        PAID = "paid", "Paid"

    month = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    year = models.IntegerField()
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name="payroll_periods")
    status = models.CharField(max_length=15, choices=PeriodStatus.choices, default=PeriodStatus.OPEN)
    pay_date = models.DateField(null=True, blank=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name="payroll_periods_processed")
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ["month", "year"]
        ordering = ["-year", "-month"]

    def __str__(self):
        return f"Payroll {self.month:02d}/{self.year}"


class Payslip(models.Model):
    """
    One staff member's payslip for one PayrollPeriod. Generated once by
    PayrollService.run_payroll(); immutable once `is_paid=True` — see
    module docstring.
    """
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="payslips")
    payroll_period = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE, related_name="payslips")
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    total_allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gross_pay = models.DecimalField(max_digits=10, decimal_places=2)
    taxable_pay = models.DecimalField(max_digits=10, decimal_places=2)
    paye = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    nssf_employee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shif = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pension_employee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    loan_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    advance_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_statutory_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_pay = models.DecimalField(max_digits=10, decimal_places=2)
    generated_at = models.DateTimeField(auto_now_add=True)
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ["staff", "payroll_period"]
        ordering = ["-payroll_period__year", "-payroll_period__month"]

    def __str__(self):
        return f"{self.staff.staff_number} - {self.payroll_period} - Net {self.net_pay}"


class PayslipLineItem(models.Model):
    """Itemised breakdown backing a Payslip's totals (one row per allowance/deduction shown)."""
    class ItemType(models.TextChoices):
        ALLOWANCE = "allowance", "Allowance"
        DEDUCTION = "deduction", "Deduction"

    payslip = models.ForeignKey(Payslip, on_delete=models.CASCADE, related_name="line_items")
    component_type = models.ForeignKey(SalaryComponentType, on_delete=models.SET_NULL, null=True, blank=True)
    label = models.CharField(max_length=100)
    item_type = models.CharField(max_length=15, choices=ItemType.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.payslip} - {self.label}: {self.amount}"


class PayrollRun(models.Model):
    """One payroll-processing batch — mirrors portal_api.PromotionRun's audit pattern."""
    class RunStatus(models.TextChoices):
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    payroll_period = models.OneToOneField(PayrollPeriod, on_delete=models.CASCADE, related_name="run")
    triggered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=15, choices=RunStatus.choices, default=RunStatus.RUNNING)
    staff_count = models.IntegerField(default=0)
    total_gross = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_net = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_paye = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    error_log = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"Payroll run {self.payroll_period} ({self.status})"
