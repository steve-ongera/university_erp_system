from rest_framework.routers import DefaultRouter
from . import views as hv

router = DefaultRouter()

router.register(r"hr/job-groups", hv.JobGroupViewSet, basename="job-groups")
router.register(r"hr/positions", hv.PositionViewSet, basename="positions")

router.register(r"hr/staff", hv.StaffProfileViewSet, basename="staff")
router.register(r"hr/contracts", hv.EmploymentContractViewSet, basename="contracts")

router.register(r"hr/leave-types", hv.LeaveTypeViewSet, basename="leave-types")
router.register(r"hr/leave-balances", hv.LeaveBalanceViewSet, basename="leave-balances")
router.register(r"hr/leave-applications", hv.LeaveApplicationViewSet, basename="leave-applications")

router.register(r"hr/attendance-devices", hv.AttendanceDeviceViewSet, basename="attendance-devices")
router.register(r"hr/qr-sessions", hv.QRAttendanceSessionViewSet, basename="qr-sessions")
router.register(r"hr/biometric-logs", hv.BiometricLogViewSet, basename="biometric-logs")
router.register(r"hr/attendance", hv.StaffAttendanceViewSet, basename="attendance")

router.register(r"hr/salary-components", hv.SalaryComponentTypeViewSet, basename="salary-components")
router.register(r"hr/allowances", hv.AllowanceViewSet, basename="allowances")
router.register(r"hr/deductions", hv.DeductionViewSet, basename="deductions")
router.register(r"hr/paye-bands", hv.PAYEBandViewSet, basename="paye-bands")
router.register(r"hr/statutory-rates", hv.StatutoryRateViewSet, basename="statutory-rates")

router.register(r"hr/salary-advances", hv.SalaryAdvanceViewSet, basename="salary-advances")
router.register(r"hr/loans", hv.StaffLoanViewSet, basename="loans")
router.register(r"hr/loan-repayments", hv.LoanRepaymentViewSet, basename="loan-repayments")

router.register(r"hr/payroll-periods", hv.PayrollPeriodViewSet, basename="payroll-periods")
router.register(r"hr/payslips", hv.PayslipViewSet, basename="payslips")
router.register(r"hr/payroll-runs", hv.PayrollRunViewSet, basename="payroll-runs")

router.register(r"hr/dashboard", hv.HRDashboardView, basename="dashboard")

urlpatterns = router.urls