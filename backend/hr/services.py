# hr/services.py
"""
Business logic for the HR & Payroll module. Views should stay thin and
call into these services rather than computing money or leave balances
inline — mirrors portal_api.services' separation (see grading_service /
fee_service there).
"""
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import (
    LeaveBalance, LeaveApplication, LeaveType,
    StaffAttendance, QRAttendanceSession, BiometricLog, AttendanceDevice,
    Allowance, Deduction, PAYEBand, StatutoryRate,
    SalaryAdvance, StaffLoan, LoanRepayment,
    PayrollPeriod, Payslip, PayslipLineItem, PayrollRun, StaffProfile,
)


def _q2(value) -> Decimal:
    """Round to 2dp the way payroll figures should be rounded."""
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ======================================================================
# LEAVE
# ======================================================================

class LeaveError(Exception):
    pass


class LeaveService:

    @staticmethod
    def get_or_create_balance(staff, leave_type, year):
        balance, _ = LeaveBalance.objects.get_or_create(
            staff=staff, leave_type=leave_type, year=year,
            defaults={"opening_balance": Decimal("0"), "accrued_days": Decimal(leave_type.days_per_year)},
        )
        return balance

    @staticmethod
    @transaction.atomic
    def apply(staff, leave_type: LeaveType, start_date, end_date, reason="", supporting_document=None):
        if end_date < start_date:
            raise LeaveError("End date cannot be before start date.")
        days_requested = Decimal((end_date - start_date).days + 1)

        balance = LeaveService.get_or_create_balance(staff, leave_type, start_date.year)
        if leave_type.is_paid and balance.available_days < days_requested:
            raise LeaveError(
                f"Insufficient {leave_type.name} balance: {balance.available_days} day(s) available, "
                f"{days_requested} requested."
            )

        overlap = LeaveApplication.objects.filter(
            staff=staff, status__in=[LeaveApplication.Status.PENDING, LeaveApplication.Status.APPROVED],
            start_date__lte=end_date, end_date__gte=start_date,
        ).exists()
        if overlap:
            raise LeaveError("This staff member already has a leave application overlapping these dates.")

        return LeaveApplication.objects.create(
            staff=staff, leave_type=leave_type, start_date=start_date, end_date=end_date,
            days_requested=days_requested, reason=reason, supporting_document=supporting_document,
        )

    @staticmethod
    @transaction.atomic
    def decide(application: LeaveApplication, approve: bool, reviewer, remarks=""):
        if application.status != LeaveApplication.Status.PENDING:
            raise LeaveError("Only pending applications can be decided on.")

        application.status = LeaveApplication.Status.APPROVED if approve else LeaveApplication.Status.REJECTED
        application.reviewed_by = reviewer
        application.reviewed_at = timezone.now()
        application.review_remarks = remarks
        application.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks"])

        if approve:
            balance = LeaveService.get_or_create_balance(
                application.staff, application.leave_type, application.start_date.year)
            balance.used_days += application.days_requested
            balance.save(update_fields=["used_days"])

            application.staff.employment_status = StaffProfile.EmploymentStatus.ON_LEAVE
            application.staff.save(update_fields=["employment_status"])

        return application

    @staticmethod
    def cancel(application: LeaveApplication):
        if application.status not in [LeaveApplication.Status.PENDING, LeaveApplication.Status.APPROVED]:
            raise LeaveError("This application cannot be cancelled.")
        if application.status == LeaveApplication.Status.APPROVED:
            balance = LeaveService.get_or_create_balance(
                application.staff, application.leave_type, application.start_date.year)
            balance.used_days -= application.days_requested
            balance.save(update_fields=["used_days"])
        application.status = LeaveApplication.Status.CANCELLED
        application.save(update_fields=["status"])
        return application


# ======================================================================
# ATTENDANCE
# ======================================================================

class AttendanceService:

    @staticmethod
    def check_in_via_qr(token: str, staff, expected_start_time=None):
        try:
            session = QRAttendanceSession.objects.get(token=token, is_active=True)
        except QRAttendanceSession.DoesNotExist:
            raise ValueError("Invalid or expired QR session.")

        now = timezone.localtime()
        if not (session.opens_at <= now.time() <= session.closes_at):
            raise ValueError("This QR session is not currently open.")

        record, created = StaffAttendance.objects.get_or_create(
            staff=staff, date=session.valid_date,
            defaults={"source": StaffAttendance.Source.QR, "check_in_time": now.time()},
        )
        if not created and not record.check_in_time:
            record.check_in_time = now.time()
            record.source = StaffAttendance.Source.QR

        if expected_start_time and now.time() > expected_start_time:
            late_minutes = int((datetime.combine(now.date(), now.time())
                                 - datetime.combine(now.date(), expected_start_time)).total_seconds() // 60)
            record.status = StaffAttendance.Status.LATE
            record.late_minutes = max(late_minutes, 0)
        else:
            record.status = StaffAttendance.Status.PRESENT

        record.save()
        return record

    @staticmethod
    def fold_biometric_logs(date):
        """Turn today's raw BiometricLog punches into StaffAttendance rows (run periodically)."""
        logs = BiometricLog.objects.filter(timestamp__date=date).order_by("staff_id", "timestamp")
        by_staff = {}
        for log in logs:
            by_staff.setdefault(log.staff_id, []).append(log)

        updated = []
        for staff_id, entries in by_staff.items():
            check_ins = [e for e in entries if e.log_type == BiometricLog.LogType.CHECK_IN]
            check_outs = [e for e in entries if e.log_type == BiometricLog.LogType.CHECK_OUT]
            record, _ = StaffAttendance.objects.get_or_create(
                staff_id=staff_id, date=date, defaults={"source": StaffAttendance.Source.BIOMETRIC})
            if check_ins:
                record.check_in_time = min(e.timestamp for e in check_ins).time()
            if check_outs:
                record.check_out_time = max(e.timestamp for e in check_outs).time()
            record.source = StaffAttendance.Source.BIOMETRIC
            record.status = StaffAttendance.Status.PRESENT
            record.save()
            updated.append(record)
        return updated

    @staticmethod
    def mark_absentees(date, department=None):
        """Any active staff with no attendance row for `date` gets marked ABSENT — run end-of-day."""
        staff_qs = StaffProfile.objects.filter(is_active=True,
                                                 employment_status=StaffProfile.EmploymentStatus.ACTIVE)
        if department:
            staff_qs = staff_qs.filter(department=department)

        already_marked = set(StaffAttendance.objects.filter(date=date).values_list("staff_id", flat=True))
        to_create = [
            StaffAttendance(staff=staff, date=date, status=StaffAttendance.Status.ABSENT,
                             source=StaffAttendance.Source.MANUAL)
            for staff in staff_qs.exclude(id__in=already_marked)
        ]
        StaffAttendance.objects.bulk_create(to_create)
        return len(to_create)


# ======================================================================
# PAYROLL
# ======================================================================

class PayrollError(Exception):
    pass


class PayrollService:

    @staticmethod
    def compute_paye(taxable_pay: Decimal, year: int) -> Decimal:
        bands = list(PAYEBand.objects.filter(effective_year=year).order_by("band_order"))
        if not bands:
            return Decimal("0.00")

        tax = Decimal("0.00")
        remaining = taxable_pay
        for band in bands:
            lower, upper = band.lower_limit, band.upper_limit
            band_width = (upper - lower) if upper is not None else remaining
            taxable_in_band = min(remaining, band_width) if remaining > 0 else Decimal("0")
            if taxable_pay <= lower:
                continue
            amount_above_lower = min(taxable_pay, upper) - lower if upper is not None else taxable_pay - lower
            amount_above_lower = max(amount_above_lower, Decimal("0"))
            tax += amount_above_lower * (band.rate_percent / Decimal("100"))
        return _q2(tax)

    @staticmethod
    def compute_statutory(scheme: str, gross_pay: Decimal, year: int) -> Decimal:
        try:
            rate = StatutoryRate.objects.get(scheme=scheme, effective_year=year)
        except StatutoryRate.DoesNotExist:
            return Decimal("0.00")

        if rate.fixed_amount_employee is not None:
            amount = rate.fixed_amount_employee
        else:
            amount = gross_pay * (rate.rate_employee_percent / Decimal("100"))

        if rate.min_contribution:
            amount = max(amount, rate.min_contribution)
        if rate.max_contribution:
            amount = min(amount, rate.max_contribution)
        return _q2(amount)

    @staticmethod
    @transaction.atomic
    def compute_payslip(staff: StaffProfile, period: PayrollPeriod) -> Payslip:
        contract = staff.current_contract
        if not contract:
            raise PayrollError(f"{staff.staff_number} has no active employment contract.")

        basic_salary = contract.basic_salary
        line_items = []

        allowances = Allowance.objects.filter(staff=staff, is_active=True, effective_date__lte=period.pay_date
                                               or timezone.localdate())
        total_allowances = Decimal("0.00")
        taxable_allowances = Decimal("0.00")
        for a in allowances:
            total_allowances += a.amount
            if a.component_type.is_taxable:
                taxable_allowances += a.amount
            line_items.append(PayslipLineItem(component_type=a.component_type, label=a.component_type.name,
                                               item_type=PayslipLineItem.ItemType.ALLOWANCE, amount=a.amount))

        gross_pay = basic_salary + total_allowances
        taxable_pay = basic_salary + taxable_allowances

        paye = PayrollService.compute_paye(taxable_pay, period.year)
        nssf = PayrollService.compute_statutory(StatutoryRate.Scheme.NSSF, gross_pay, period.year)
        shif = PayrollService.compute_statutory(StatutoryRate.Scheme.SHIF, gross_pay, period.year)
        pension = PayrollService.compute_statutory(StatutoryRate.Scheme.PENSION, gross_pay, period.year)

        other_deductions = Decimal("0.00")
        for d in Deduction.objects.filter(staff=staff, is_active=True):
            other_deductions += d.amount
            line_items.append(PayslipLineItem(component_type=d.component_type, label=d.component_type.name,
                                               item_type=PayslipLineItem.ItemType.DEDUCTION, amount=d.amount))

        loan_deduction_total = Decimal("0.00")
        for loan in StaffLoan.objects.filter(staff=staff, status=StaffLoan.Status.ACTIVE, balance_remaining__gt=0):
            installment = min(loan.monthly_installment, loan.balance_remaining)
            loan_deduction_total += installment
            loan.balance_remaining -= installment
            if loan.balance_remaining <= 0:
                loan.status = StaffLoan.Status.CLOSED
            loan.save(update_fields=["balance_remaining", "status"])
            line_items.append(PayslipLineItem(label=f"{loan.loan_type} Repayment",
                                               item_type=PayslipLineItem.ItemType.DEDUCTION, amount=installment))

        advance_deduction_total = Decimal("0.00")
        for advance in SalaryAdvance.objects.filter(staff=staff, status=SalaryAdvance.Status.APPROVED,
                                                      balance_remaining__gt=0):
            installment = min(advance.monthly_deduction, advance.balance_remaining)
            advance_deduction_total += installment
            advance.balance_remaining -= installment
            if advance.balance_remaining <= 0:
                advance.status = SalaryAdvance.Status.FULLY_RECOVERED
            advance.save(update_fields=["balance_remaining", "status"])
            line_items.append(PayslipLineItem(label="Salary Advance Recovery",
                                               item_type=PayslipLineItem.ItemType.DEDUCTION, amount=installment))

        total_statutory = paye + nssf + shif + pension
        total_deductions = total_statutory + other_deductions + loan_deduction_total + advance_deduction_total
        net_pay = gross_pay - total_deductions

        payslip, _ = Payslip.objects.update_or_create(
            staff=staff, payroll_period=period,
            defaults=dict(
                basic_salary=basic_salary, total_allowances=total_allowances, gross_pay=gross_pay,
                taxable_pay=taxable_pay, paye=paye, nssf_employee=nssf, shif=shif, pension_employee=pension,
                other_deductions=other_deductions, loan_deductions=loan_deduction_total,
                advance_deductions=advance_deduction_total, total_statutory_deductions=total_statutory,
                total_deductions=total_deductions, net_pay=net_pay,
            ),
        )
        payslip.line_items.all().delete()
        for item in line_items:
            item.payslip = payslip
        PayslipLineItem.objects.bulk_create(line_items)
        return payslip

    @staticmethod
    @transaction.atomic
    def run_payroll(period: PayrollPeriod, triggered_by) -> PayrollRun:
        if period.status == PayrollPeriod.PeriodStatus.PAID:
            raise PayrollError("This payroll period has already been paid out.")

        run, _ = PayrollRun.objects.update_or_create(
            payroll_period=period,
            defaults=dict(triggered_by=triggered_by, status=PayrollRun.RunStatus.RUNNING,
                          staff_count=0, total_gross=0, total_net=0, total_paye=0, error_log=""),
        )
        period.status = PayrollPeriod.PeriodStatus.PROCESSING
        period.save(update_fields=["status"])

        staff_qs = StaffProfile.objects.filter(
            is_active=True,
            employment_status__in=[StaffProfile.EmploymentStatus.ACTIVE, StaffProfile.EmploymentStatus.ON_LEAVE],
        )

        errors = []
        count, total_gross, total_net, total_paye = 0, Decimal("0"), Decimal("0"), Decimal("0")
        for staff in staff_qs:
            try:
                payslip = PayrollService.compute_payslip(staff, period)
                count += 1
                total_gross += payslip.gross_pay
                total_net += payslip.net_pay
                total_paye += payslip.paye
            except PayrollError as exc:
                errors.append(f"{staff.staff_number}: {exc}")

        run.staff_count = count
        run.total_gross = total_gross
        run.total_net = total_net
        run.total_paye = total_paye
        run.error_log = "\n".join(errors)
        run.status = PayrollRun.RunStatus.COMPLETED if not errors or count else PayrollRun.RunStatus.FAILED
        run.completed_at = timezone.now()
        run.save()

        period.status = PayrollPeriod.PeriodStatus.CLOSED
        period.processed_by = triggered_by
        period.processed_at = timezone.now()
        period.save(update_fields=["status", "processed_by", "processed_at"])

        return run

    @staticmethod
    @transaction.atomic
    def mark_paid(period: PayrollPeriod):
        if period.status != PayrollPeriod.PeriodStatus.CLOSED:
            raise PayrollError("Only a closed (payslips generated) period can be marked paid.")
        now = timezone.now()
        period.payslips.update(is_paid=True, paid_at=now)
        period.status = PayrollPeriod.PeriodStatus.PAID
        period.save(update_fields=["status"])
        return period


# ======================================================================
# DASHBOARD
# ======================================================================

class HRDashboardService:
    """Aggregate stats consumed by the React HR dashboard's cards/graphs/table."""

    @staticmethod
    def summary():
        active = StaffProfile.objects.filter(is_active=True)
        on_leave = active.filter(employment_status=StaffProfile.EmploymentStatus.ON_LEAVE).count()
        pending_leave = LeaveApplication.objects.filter(status=LeaveApplication.Status.PENDING).count()

        latest_period = PayrollPeriod.objects.order_by("-year", "-month").first()
        latest_payroll_cost = Decimal("0.00")
        if latest_period:
            latest_payroll_cost = latest_period.payslips.aggregate(total=Sum("net_pay"))["total"] or Decimal("0.00")

        today = timezone.localdate()
        today_attendance = StaffAttendance.objects.filter(date=today)
        present_today = today_attendance.filter(
            status__in=[StaffAttendance.Status.PRESENT, StaffAttendance.Status.LATE]).count()

        return {
            "total_staff": active.count(),
            "staff_on_leave": on_leave,
            "pending_leave_applications": pending_leave,
            "present_today": present_today,
            "latest_payroll_net_cost": latest_payroll_cost,
        }

    @staticmethod
    def staff_by_category():
        return list(StaffProfile.objects.filter(is_active=True)
                    .values("category").annotate(count=Sum("id") * 0 + Sum(1)))

    @staticmethod
    def payroll_cost_trend(months=6):
        periods = PayrollPeriod.objects.order_by("-year", "-month")[:months]
        result = []
        for p in reversed(periods):
            total = p.payslips.aggregate(net=Sum("net_pay"), gross=Sum("gross_pay"), paye=Sum("paye"))
            result.append({
                "period": f"{p.month:02d}/{p.year}",
                "gross": total["gross"] or Decimal("0"),
                "net": total["net"] or Decimal("0"),
                "paye": total["paye"] or Decimal("0"),
            })
        return result

    @staticmethod
    def attendance_trend(days=14):
        today = timezone.localdate()
        result = []
        for i in range(days - 1, -1, -1):
            d = today - timedelta(days=i)
            qs = StaffAttendance.objects.filter(date=d)
            result.append({
                "date": d.isoformat(),
                "present": qs.filter(status__in=[StaffAttendance.Status.PRESENT,
                                                   StaffAttendance.Status.LATE]).count(),
                "absent": qs.filter(status=StaffAttendance.Status.ABSENT).count(),
                "late": qs.filter(status=StaffAttendance.Status.LATE).count(),
            })
        return result
