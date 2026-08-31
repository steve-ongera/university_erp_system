# hr/admin.py
from django.contrib import admin
from . import models


@admin.register(models.JobGroup)
class JobGroupAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "min_salary", "max_salary", "is_active"]


@admin.register(models.Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ["title", "department", "is_academic", "job_group", "is_active"]
    list_filter = ["department", "is_academic"]


@admin.register(models.StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ["staff_number", "user", "department", "position", "category", "employment_status"]
    search_fields = ["staff_number", "user__username", "user__first_name", "user__last_name"]
    list_filter = ["department", "category", "employment_status"]


@admin.register(models.EmploymentContract)
class EmploymentContractAdmin(admin.ModelAdmin):
    list_display = ["staff", "contract_type", "basic_salary", "start_date", "end_date", "is_active"]
    list_filter = ["contract_type", "is_active"]


@admin.register(models.LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "days_per_year", "is_paid", "carry_forward_allowed"]


@admin.register(models.LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ["staff", "leave_type", "year", "opening_balance", "accrued_days", "used_days"]
    list_filter = ["leave_type", "year"]


@admin.register(models.LeaveApplication)
class LeaveApplicationAdmin(admin.ModelAdmin):
    list_display = ["staff", "leave_type", "start_date", "end_date", "status"]
    list_filter = ["status", "leave_type"]


@admin.register(models.AttendanceDevice)
class AttendanceDeviceAdmin(admin.ModelAdmin):
    list_display = ["name", "device_type", "location", "is_active"]


@admin.register(models.QRAttendanceSession)
class QRAttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ["valid_date", "department", "opens_at", "closes_at", "is_active"]


@admin.register(models.StaffAttendance)
class StaffAttendanceAdmin(admin.ModelAdmin):
    list_display = ["staff", "date", "check_in_time", "check_out_time", "status", "source"]
    list_filter = ["status", "source", "date"]


@admin.register(models.SalaryComponentType)
class SalaryComponentTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "category", "is_taxable", "is_statutory"]


@admin.register(models.Allowance)
class AllowanceAdmin(admin.ModelAdmin):
    list_display = ["staff", "component_type", "amount", "effective_date", "is_active"]


@admin.register(models.Deduction)
class DeductionAdmin(admin.ModelAdmin):
    list_display = ["staff", "component_type", "amount", "effective_date", "is_active"]


@admin.register(models.PAYEBand)
class PAYEBandAdmin(admin.ModelAdmin):
    list_display = ["effective_year", "band_order", "lower_limit", "upper_limit", "rate_percent"]


@admin.register(models.StatutoryRate)
class StatutoryRateAdmin(admin.ModelAdmin):
    list_display = ["scheme", "effective_year", "rate_employee_percent", "rate_employer_percent"]


@admin.register(models.SalaryAdvance)
class SalaryAdvanceAdmin(admin.ModelAdmin):
    list_display = ["staff", "amount", "balance_remaining", "status", "requested_at"]


@admin.register(models.StaffLoan)
class StaffLoanAdmin(admin.ModelAdmin):
    list_display = ["staff", "loan_type", "principal_amount", "balance_remaining", "status"]


@admin.register(models.PayrollPeriod)
class PayrollPeriodAdmin(admin.ModelAdmin):
    list_display = ["month", "year", "status", "pay_date"]
    list_filter = ["status", "year"]


@admin.register(models.Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ["staff", "payroll_period", "gross_pay", "net_pay", "is_paid"]
    list_filter = ["payroll_period", "is_paid"]


@admin.register(models.PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ["payroll_period", "status", "staff_count", "total_net", "started_at"]
