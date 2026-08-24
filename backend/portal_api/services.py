"""
Business logic layer. Views should stay thin and call into these
services; services own transactions and invariants so the same rule
(e.g. "final semester only" for clearance) is enforced once, everywhere.
"""
from decimal import Decimal
import secrets
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from . import models as m
from . import utils


# ======================================================================
# AUTH / 2FA
# ======================================================================

class AuthError(Exception):
    pass


class AuthService:
    """
    Login flow:
      1. authenticate(username/reg-no, password) -> User | raises AuthError
      2. if user.requires_2fa (i.e. settings.DEBUG is False):
             issue_otp(user) -> emails/SMS a 6-digit code, caller returns
             a "2fa_required" response holding a short-lived challenge id
         else:
             caller issues JWT/session immediately (DEBUG bypass)
      3. verify_otp(user, code) -> True/False, then caller issues tokens
    """

    @staticmethod
    def authenticate(username: str, password: str, ip_address: str = "") -> m.User:
        from django.contrib.auth import authenticate as django_authenticate

        user = django_authenticate(username=username, password=password)
        m.AdminLoginAttempt.objects.create(
            username=username, ip_address=ip_address or "0.0.0.0",
            success=bool(user), failure_reason="" if user else "invalid_credentials",
        )
        if not user:
            raise AuthError("Invalid registration/employee number or password.")
        if not user.is_active:
            raise AuthError("Account is inactive. Contact the registrar.")
        return user

    @staticmethod
    def issue_otp(user: m.User, ip_address: str = "") -> m.TwoFactorCode:
        code = utils.generate_otp_code()
        otp = m.TwoFactorCode.objects.create(
            user=user, code=code, expires_at=utils.otp_expiry(), ip_address=ip_address
        )
        # NOTE: wire this to your SMS/email provider.
        # send_sms(user.phone, f"Your Muranga Portal code is {code}")
        return otp

    @staticmethod
    def verify_otp(user: m.User, code: str) -> bool:
        otp = (
            m.TwoFactorCode.objects.filter(user=user, code=code, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp or not otp.is_valid:
            return False
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        user.is_2fa_enrolled = True
        user.save(update_fields=["is_2fa_enrolled"])
        return True

    @staticmethod
    def bypass_required() -> bool:
        """DEBUG=True => skip OTP entirely (dev convenience only)."""
        return settings.DEBUG


# ======================================================================
# ADMISSIONS
# ======================================================================

class AdmissionService:
    @staticmethod
    @transaction.atomic
    def admit_student(*, full_name_first, full_name_last, gender, programme: m.Programme,
                       intake: m.Intake, curriculum_version: m.CurriculumVersion,
                       sponsor_type=m.Student.SponsorType.SELF, extra_user_fields=None) -> m.Student:
        admission_year = int(intake.name.split()[-1])
        reg_no = utils.generate_registration_number(programme, admission_year, m.Student)

        user = m.User.objects.create_user(
            username=reg_no,
            password=reg_no.replace("/", ""),  # temp password; must_change_password=True forces reset
            first_name=full_name_first,
            last_name=full_name_last,
            gender=gender,
            user_type=m.User.UserType.STUDENT,
            **(extra_user_fields or {}),
        )
        user.must_change_password = True
        user.save(update_fields=["must_change_password"])

        student = m.Student.objects.create(
            user=user,
            registration_number=reg_no,
            programme=programme,
            curriculum_version=curriculum_version,
            intake=intake,
            current_year=1,
            current_semester=1,
            sponsor_type=sponsor_type,
            admission_date=timezone.now().date(),
        )
        m.StudentFeeAccount.objects.create(student=student)
        return student


# ======================================================================
# UNIT REGISTRATION
# ======================================================================

# ======================================================================
# UNIT REGISTRATION (Enhanced)
# ======================================================================

class UnitRegistrationService:
    @staticmethod
    @transaction.atomic
    def register_semester_units(student: m.Student, semester: m.Semester):
        """
        Auto-register a student for every CurriculumUnit mapped to their
        current (year, semester) on THEIR curriculum_version, plus any
        outstanding supplementary/repeat units they still owe from
        earlier semesters.
        """
        # Get current curriculum units
        curriculum_units = m.CurriculumUnit.objects.filter(
            curriculum_version=student.curriculum_version,
            year=student.current_year,
            semester=student.current_semester,
        )

        created = []
        
        # Register normal units
        for unit in curriculum_units:
            reg, created_flag = m.UnitRegistration.objects.get_or_create(
                student=student, 
                course=unit.course, 
                semester=semester,
                defaults={
                    "registration_type": m.UnitRegistration.RegType.NORMAL,
                    "is_active": True
                },
            )
            if created_flag:
                created.append(reg)

        # Pull forward any pending supplementary/repeat units
        pending = SupplementaryService.outstanding_units(student)
        for course in pending:
            reg, created_flag = m.UnitRegistration.objects.get_or_create(
                student=student, 
                course=course, 
                semester=semester,
                defaults={
                    "registration_type": m.UnitRegistration.RegType.SUPPLEMENTARY,
                    "is_active": True
                },
            )
            if created_flag:
                # Create supplementary invoice
                invoice = SupplementaryService.create_supplementary_invoice(
                    student, course, semester
                )
                reg.supplementary_invoice = invoice
                reg.save(update_fields=["supplementary_invoice"])
                created.append(reg)

        return created

    @staticmethod
    def enroll_with_lecturer(registration: m.UnitRegistration):
        """
        Attach a registration to whichever LecturerUnitAllocation is
        currently teaching that course.
        """
        allocation = m.LecturerUnitAllocation.objects.filter(
            course=registration.course, 
            semester=registration.semester, 
            is_active=True
        ).first()

        enrollment, _ = m.Enrollment.objects.get_or_create(
            student=registration.student, 
            course=registration.course, 
            semester=registration.semester,
            defaults={
                "lecturer_allocation": allocation, 
                "registration": registration,
                "is_active": True
            },
        )
        return enrollment


# ======================================================================
# GRADING
# ======================================================================

class GradingService:
    """
    Grading is entirely data-driven via GradingScheme/GradeBand so
    Nursing and IT departments can have different scales without any
    code branching. CAT weight vs exam weight is fixed at 40/60 here;
    move that to a per-scheme field if it also needs to vary.
    """

    CAT_WEIGHT = Decimal("0.40")
    EXAM_WEIGHT = Decimal("0.60")

    @classmethod
    @transaction.atomic
    def compute_and_save(cls, grade: m.Grade) -> m.Grade:
        if grade.cat_marks is None or grade.final_exam_marks is None:
            raise ValueError("Both CAT and final exam marks are required before grading.")

        total = (grade.cat_marks * cls.CAT_WEIGHT) + (grade.final_exam_marks * cls.EXAM_WEIGHT)
        grade.total_marks = total.quantize(Decimal("0.01"))

        department = grade.enrollment.course.department
        scheme = department.grading_scheme
        band = scheme.bands.filter(min_score__lte=grade.total_marks, max_score__gte=grade.total_marks).first()
        if not band:
            raise ValueError(f"No grade band configured on '{scheme.name}' covers {grade.total_marks}.")

        grade.letter_grade = band.letter
        grade.grade_points = band.points
        grade.is_pass = not band.is_fail_band and not band.is_supplementary_band
        grade.requires_supplementary = band.is_supplementary_band

        credit_hours = grade.enrollment.course.credit_hours
        grade.quality_points = (band.points * credit_hours).quantize(Decimal("0.01"))
        grade.published_at = timezone.now()
        grade.save()

        cls._write_transcript_entry(grade)
        if grade.requires_supplementary:
            SupplementaryService.flag_unit(grade)
        return grade

    @staticmethod
    def _write_transcript_entry(grade: m.Grade):
        enrollment = grade.enrollment
        student = enrollment.student
        semester = enrollment.semester
        m.TranscriptEntry.objects.create(
            student=student,
            course=enrollment.course,
            academic_year=semester.academic_year,
            semester_number=semester.semester_number,
            programme_year=student.current_year,
            letter_grade=grade.letter_grade,
            grade_points=grade.grade_points,
            credit_hours=enrollment.course.credit_hours,
            quality_points=grade.quality_points,
            is_supplementary=grade.is_supplementary_result,
        )


# ======================================================================
# SUPPLEMENTARY EXAMS
# ======================================================================

class SupplementaryService:
    """
    A failing-but-recoverable grade (band.is_supplementary_band) puts the
    unit on the student's outstanding list. The student must pay a
    supplementary invoice, get a receipt, then register (and sit) the
    unit the NEXT time it is offered — which, per the department's
    curriculum map, might be taught to a different year/programme
    altogether. LecturerUnitAllocation.roster() already folds these
    students in automatically once UnitRegistrationService creates their
    Enrollment.
    """

    SUPPLEMENTARY_FEE = Decimal("3000.00")  # override via settings/FeeStructure if it should vary

    @staticmethod
    def outstanding_units(student: m.Student):
        failed_course_ids = (
            m.Grade.objects.filter(
                enrollment__student=student, requires_supplementary=True,
            )
            .exclude(
                # Already resolved by a later PASSING supplementary attempt
                enrollment__course__in=m.Grade.objects.filter(
                    enrollment__student=student, is_supplementary_result=True, is_pass=True
                ).values_list("enrollment__course", flat=True)
            )
            .values_list("enrollment__course", flat=True)
        )
        return m.Course.objects.filter(id__in=failed_course_ids)

    @staticmethod
    def flag_unit(grade: m.Grade):
        """Marks a unit as needing a supplementary sitting (already reflected via Grade.requires_supplementary)."""
        return grade

    @staticmethod
    @transaction.atomic
    def create_supplementary_invoice(student: m.Student, course: m.Course, semester: m.Semester) -> m.Invoice:
        invoice = m.Invoice.objects.create(
            student=student, invoice_type=m.Invoice.InvoiceType.SUPPLEMENTARY,
            semester=semester, amount_due=SupplementaryService.SUPPLEMENTARY_FEE,
            description=f"Supplementary exam fee - {course.code}",
        )
        return invoice

    @staticmethod
    @transaction.atomic
    def register_supplementary(student: m.Student, course: m.Course, semester: m.Semester) -> m.UnitRegistration:
        invoice = SupplementaryService.create_supplementary_invoice(student, course, semester)
        registration, _ = m.UnitRegistration.objects.update_or_create(
            student=student, course=course, semester=semester,
            defaults={"registration_type": m.UnitRegistration.RegType.SUPPLEMENTARY,
                      "supplementary_invoice": invoice},
        )
        return registration

    @staticmethod
    def is_cleared_to_sit(registration: m.UnitRegistration) -> bool:
        """A supplementary registration only allows exam entry once its invoice is fully paid."""
        if registration.registration_type != m.UnitRegistration.RegType.SUPPLEMENTARY:
            return True
        invoice = registration.supplementary_invoice
        if not invoice:
            return False
        return FeeService.invoice_balance(invoice) <= 0


# ======================================================================
# FEES
# ======================================================================

class FeeService:
    """
    Payment reconciliation rules
    -----------------------------
    - Banks push a payment identified by (registration_number, payer
      name, amount). We locate the Student purely by registration
      number (authoritative); the name is only cross-checked for fraud
      flags via utils.names_roughly_match.
    - The payment amount is first parked in FeePayment, then allocated
      oldest-invoice-first via InvoiceAllocation.
    - Any amount left over after every open invoice is fully settled is
      pushed into StudentFeeAccount.credit_balance and auto-consumed the
      next time an invoice is raised for that student (see
      raise_semester_invoice below). This is how a Ksh 31,000 payment
      against a Ksh 20,000 fee correctly leaves Ksh 11,000 credit
      instead of over-paying or bouncing.
    """

    @staticmethod
    def invoice_balance(invoice: m.Invoice) -> Decimal:
        applied = invoice.allocations.aggregate(total=Sum("amount_applied"))["total"] or Decimal("0")
        return (invoice.amount_due - applied).quantize(Decimal("0.01"))

    @staticmethod
    def student_open_invoices(student: m.Student):
        return [inv for inv in student.invoices.filter(is_active=True).order_by("created_at")
                if FeeService.invoice_balance(inv) > 0]

    @staticmethod
    @transaction.atomic
    def raise_semester_invoice(student: m.Student, semester: m.Semester) -> m.Invoice:
        fee_structure = m.FeeStructure.objects.filter(
            programme=student.programme, academic_year=semester.academic_year,
            year=student.current_year, semester=student.current_semester,
        ).first()
        if not fee_structure:
            raise ValueError("No FeeStructure configured for this programme/year/semester.")

        invoice = m.Invoice.objects.create(
            student=student, invoice_type=m.Invoice.InvoiceType.SEMESTER_FEE,
            fee_structure=fee_structure, semester=semester,
            amount_due=fee_structure.net_fee(),
            description=f"Semester fee Y{student.current_year}S{student.current_semester}",
        )
        # Auto-consume any existing wallet credit (e.g. leftover from last semester's overpayment).
        FeeService._auto_apply_credit(student, invoice)
        return invoice

    @staticmethod
    def _auto_apply_credit(student: m.Student, invoice: m.Invoice):
        account, _ = m.StudentFeeAccount.objects.get_or_create(student=student)
        if account.credit_balance <= 0:
            return
        balance_due = FeeService.invoice_balance(invoice)
        amount_to_apply = min(account.credit_balance, balance_due)
        if amount_to_apply <= 0:
            return
        # A "virtual" payment record documents where the money came from.
        synthetic_payment = m.FeePayment.objects.create(
            student=student, method=m.FeePayment.Method.BANK, amount=amount_to_apply,
            payer_name_on_slip="WALLET CREDIT CARRY-FORWARD",
            registration_number_on_slip=student.registration_number,
            bank_reference=f"CREDIT-{student.registration_number}-{timezone.now().timestamp()}",
            receipt_number=utils.generate_receipt_number("CR", m.FeePayment),
            payment_date=timezone.now(), is_reconciled=True,
        )
        m.InvoiceAllocation.objects.create(payment=synthetic_payment, invoice=invoice, amount_applied=amount_to_apply)
        account.credit_balance -= amount_to_apply
        account.save(update_fields=["credit_balance"])

    @staticmethod
    @transaction.atomic
    def process_bank_notification(*, registration_number: str, payer_name: str, amount: Decimal,
                                   bank_name: str, bank_reference: str, payment_date=None) -> m.FeePayment:
        """
        Entry point for the bank webhook/ERP integration. Any bank can
        push here — students "just give out names and registration
        number" at the till, the bank's own back-office forwards the
        transaction to this endpoint (see views.BankPaymentWebhookView).
        """
        student = m.Student.objects.filter(registration_number=registration_number).first()
        if not student:
            raise ValueError(f"No student found for registration number {registration_number}")

        flagged = not utils.names_roughly_match(payer_name, student.user.get_full_name())

        payment = m.FeePayment.objects.create(
            student=student, bank_name=bank_name, method=m.FeePayment.Method.BANK, amount=amount,
            payer_name_on_slip=payer_name, registration_number_on_slip=registration_number,
            bank_reference=bank_reference, payment_date=payment_date or timezone.now(),
            reconciliation_notes="NAME_MISMATCH_FLAGGED_FOR_REVIEW" if flagged else "",
        )
        payment.receipt_number = utils.generate_receipt_number("FPR", m.FeePayment)
        payment.save(update_fields=["receipt_number"])

        FeeService.allocate_payment(payment)
        return payment

    @staticmethod
    @transaction.atomic
    def allocate_payment(payment: m.FeePayment):
        """
        Oldest-invoice-first allocation. Leftover becomes wallet credit.
        Handles under-payment (invoice stays open with a smaller
        balance) and over-payment (excess -> credit_balance) uniformly.
        """
        remaining = payment.amount
        for invoice in FeeService.student_open_invoices(payment.student):
            if remaining <= 0:
                break
            balance = FeeService.invoice_balance(invoice)
            applied = min(balance, remaining)
            m.InvoiceAllocation.objects.create(payment=payment, invoice=invoice, amount_applied=applied)
            remaining -= applied

        if remaining > 0:
            account, _ = m.StudentFeeAccount.objects.get_or_create(student=payment.student)
            account.credit_balance += remaining
            account.save(update_fields=["credit_balance"])

        payment.is_reconciled = True
        payment.save(update_fields=["is_reconciled"])

    @staticmethod
    def student_balance_summary(student: m.Student) -> dict:
        open_invoices = FeeService.student_open_invoices(student)
        total_due = sum((FeeService.invoice_balance(i) for i in open_invoices), Decimal("0"))
        account, _ = m.StudentFeeAccount.objects.get_or_create(student=student)
        return {
            "total_outstanding": total_due,
            "wallet_credit": account.credit_balance,
            "open_invoices": open_invoices,
        }
        
        
    @staticmethod
    def _student_row(student, invoice):
        if invoice:
            balance = FeeService.invoice_balance(invoice)
            return {
                "student": student, "invoice": invoice,
                "amount_due": invoice.amount_due, "balance": balance,
                "is_paid": balance <= 0, "has_invoice": True,
            }
        return {
            "student": student, "invoice": None,
            "amount_due": None, "balance": None,
            "is_paid": False, "has_invoice": False,
        }

    @staticmethod
    def students_for_fee_structure(fee_structure: m.FeeStructure):
        """
        Every student currently sitting in this fee structure's
        programme/year, joined against any invoice already raised
        against this specific fee structure — plus any student who has
        such an invoice but has since moved on to a later year (so
        historical balances stay visible).
        """
        students_qs = m.Student.objects.filter(
            programme=fee_structure.programme, current_year=fee_structure.year,
        ).select_related("user")
        invoices = m.Invoice.objects.filter(
            fee_structure=fee_structure, is_active=True
        ).select_related("student__user")
        invoice_by_student = {inv.student_id: inv for inv in invoices}

        rows, seen_ids = [], set()
        for student in students_qs:
            seen_ids.add(student.id)
            rows.append(FeeService._student_row(student, invoice_by_student.get(student.id)))
        for student_id, invoice in invoice_by_student.items():
            if student_id not in seen_ids:
                rows.append(FeeService._student_row(invoice.student, invoice))
        return rows

    @staticmethod
    @transaction.atomic
    def raise_invoice_for_fee_structure(student: m.Student, fee_structure: m.FeeStructure) -> m.Invoice:
        existing = m.Invoice.objects.filter(student=student, fee_structure=fee_structure).first()
        if existing:
            return existing
        semester = m.Semester.objects.filter(
            academic_year=fee_structure.academic_year, semester_number=fee_structure.semester
        ).first()
        if not semester:
            raise ValueError("No Semester record matches this fee structure's academic year and semester number.")
        invoice = m.Invoice.objects.create(
            student=student, invoice_type=m.Invoice.InvoiceType.SEMESTER_FEE,
            fee_structure=fee_structure, semester=semester,
            amount_due=fee_structure.net_fee(),
            description=f"Semester fee Y{fee_structure.year}S{fee_structure.semester}",
        )
        FeeService._auto_apply_credit(student, invoice)
        return invoice

    @staticmethod
    @transaction.atomic
    def record_manual_payment(*, student: m.Student, amount: Decimal, method: str = m.FeePayment.Method.CASH,
                               payment_date=None, recorded_by=None) -> m.FeePayment:
        """
        Manual/counter payment entry (admin or finance recording cash,
        or confirming an M-Pesa/HELB payment by hand) — the counterpart
        to process_bank_notification, which is the automated bank
        webhook path. Uses the same allocate_payment() so oldest-
        invoice-first and wallet-credit overflow behave identically.
        """
        payment = m.FeePayment.objects.create(
            student=student, method=method, amount=amount,
            payer_name_on_slip=student.user.get_full_name(),
            registration_number_on_slip=student.registration_number,
            bank_reference=f"MANUAL-{student.registration_number}-{timezone.now().timestamp()}",
            payment_date=payment_date or timezone.now(),
            reconciliation_notes=f"Recorded manually by {recorded_by}" if recorded_by else "Recorded manually",
        )
        payment.receipt_number = utils.generate_receipt_number("FPR", m.FeePayment)
        payment.save(update_fields=["receipt_number"])
        FeeService.allocate_payment(payment)
        return payment
        
        
    @staticmethod
    def dashboard_summary():
        invoices_due = m.Invoice.objects.filter(is_active=True).aggregate(t=Sum("amount_due"))["t"] or 0
        collected = m.InvoiceAllocation.objects.filter(
            invoice__is_active=True).aggregate(t=Sum("amount_applied"))["t"] or 0
        payments_by_method = list(
            m.FeePayment.objects.values("method").annotate(count=Count("id"), total=Sum("amount")).order_by("-total")
        )
        flagged_count = m.FeePayment.objects.exclude(reconciliation_notes="").count()
        trend_qs = (
            m.FeePayment.objects.annotate(month=TruncMonth("payment_date"))
            .values("month").annotate(total=Sum("amount")).order_by("month")
        )
        collections_trend = [{"month": row["month"].strftime("%b %Y"), "total": float(row["total"])} for row in trend_qs]
        recent_payments = m.FeePayment.objects.select_related("student__user").order_by("-received_at")[:10]

        return {
            "totals": {
                "invoiced": float(invoices_due), "collected": float(collected),
                "outstanding": float(invoices_due) - float(collected),
            },
            "payments_by_method": [
                {"method": r["method"], "count": r["count"], "total": float(r["total"])} for r in payments_by_method
            ],
            "flagged_count": flagged_count,
            "collections_trend": collections_trend,
            "recent_payments": recent_payments,  # serialized in the view
        }

    @staticmethod
    @transaction.atomic
    def reassign_payment(payment: m.FeePayment, new_student: m.Student) -> m.FeePayment:
        """
        Moves a misapplied payment to the correct student. Existing allocations
        against the WRONG student's invoices are removed (that student's balance
        reverts to unpaid); the payment is then re-allocated fresh against the
        correct student's open invoices.

        CAVEAT: if part of this payment had already spilled into the wrong
        student's StudentFeeAccount.credit_balance as an overpayment, that
        portion is NOT automatically clawed back — the wallet is a pooled
        balance not tagged by source payment. Finance should manually check
        the old student's wallet after reassigning an overpaid transaction.
        """
        m.InvoiceAllocation.objects.filter(payment=payment).delete()
        payment.student = new_student
        payment.registration_number_on_slip = new_student.registration_number
        payment.reconciliation_notes = "REASSIGNED_BY_FINANCE"
        payment.save(update_fields=["student", "registration_number_on_slip", "reconciliation_notes"])
        FeeService.allocate_payment(payment)
        return payment


# ======================================================================
# PROMOTION (auto move students to next year/semester)
# ======================================================================

class PromotionService:
    MAX_CARRIED_SUPPLEMENTARIES = 4

    @classmethod
    @transaction.atomic
    def promote_student(cls, student: m.Student):
        if student.status != m.Student.Status.ACTIVE:
            return {"student": student, "action": "skipped", "reason": f"status={student.status}"}

        outstanding = SupplementaryService.outstanding_units(student)
        if cls.MAX_CARRIED_SUPPLEMENTARIES is not None and outstanding.count() > cls.MAX_CARRIED_SUPPLEMENTARIES:
            student.status = m.Student.Status.SUSPENDED
            student.save(update_fields=["status"])
            return {"student": student, "action": "suspended",
                     "reason": f"{outstanding.count()} outstanding supplementaries"}

        programme = student.programme
        prev_year, prev_sem = student.current_year, student.current_semester
        next_year, next_sem = utils.next_year_semester(
            student.current_year, student.current_semester, programme.semesters_per_year
        )

        if next_year > programme.duration_years:
            student.status = m.Student.Status.GRADUATED
            student.save(update_fields=["status"])
            return {"student": student, "action": "graduated", "reason": f"Completed Y{prev_year}S{prev_sem}"}

        student.current_year, student.current_semester = next_year, next_sem
        student.save(update_fields=["current_year", "current_semester"])
        return {"student": student, "action": "promoted",
                 "reason": f"Y{prev_year}S{prev_sem} -> Y{next_year}S{next_sem}"}

    @classmethod
    def promote_all_active(cls):
        return [cls.promote_student(s) for s in m.Student.objects.filter(status=m.Student.Status.ACTIVE)]



# ======================================================================
# DEFERMENT / RESUMPTION
# ======================================================================

class DefermentService:
    @staticmethod
    @transaction.atomic
    def apply(student: m.Student, reason: str, current_semester: m.Semester,
              requested_resume_semester: m.Semester = None, document=None) -> m.StudentDeferment:
        deferment = m.StudentDeferment.objects.create(
            student=student, reason=reason, deferred_from_semester=current_semester,
            year_at_deferment=student.current_year, semester_at_deferment=student.current_semester,
            requested_resume_semester=requested_resume_semester, supporting_document=document,
        )
        return deferment

    @staticmethod
    @transaction.atomic
    def approve(deferment: m.StudentDeferment, processed_by: m.User):
        deferment.status = m.StudentDeferment.Status.APPROVED
        deferment.processed_by = processed_by
        deferment.processed_at = timezone.now()
        deferment.save()

        student = deferment.student
        student.status = m.Student.Status.DEFERRED
        student.save(update_fields=["status"])
        return deferment

    @staticmethod
    @transaction.atomic
    def resume(deferment: m.StudentDeferment):
        """
        Reactivate the student at EXACTLY the year/semester they left —
        no marks or fee history are touched, they simply re-enter the
        pipeline (unit registration/billing) at that point.
        """
        student = deferment.student
        student.current_year = deferment.year_at_deferment
        student.current_semester = deferment.semester_at_deferment
        student.status = m.Student.Status.ACTIVE
        student.save(update_fields=["current_year", "current_semester", "status"])

        deferment.status = m.StudentDeferment.Status.RESUMED
        deferment.resumed_at = timezone.now()
        deferment.save(update_fields=["status", "resumed_at"])
        return student


# ======================================================================
# HOSTEL BOOKING
# ======================================================================

class HostelService:
    @staticmethod
    def is_eligible_to_book(student: m.Student, semester: m.Semester) -> bool:
        """Only students who have REPORTED for Year-1 Semester-1 of their intake may book."""
        if student.current_year != 1 or student.current_semester != 1:
            return False
        return m.StudentReporting.objects.filter(
            student=student, semester=semester, status=m.StudentReporting.Status.APPROVED
        ).exists()

    @staticmethod
    @transaction.atomic
    def book_bed(student: m.Student, bed: m.Bed, semester: m.Semester) -> m.HostelBooking:
        if not HostelService.is_eligible_to_book(student, semester):
            raise ValueError("Only reported Year-1 Semester-1 students may book a hostel bed.")
        if not bed.is_available:
            raise ValueError("Selected bed is not available.")

        booking = m.HostelBooking.objects.create(
            student=student, bed=bed, academic_year=semester.academic_year,
            status=m.HostelBooking.Status.APPROVED,
        )
        bed.is_available = False
        bed.save(update_fields=["is_available"])
        return booking
    
    @staticmethod
    @transaction.atomic
    def manual_book(student, bed, academic_year, status=None):
        status = status or m.HostelBooking.Status.APPROVED
        if not bed.is_available:
            raise ValueError("Selected bed is not available.")
        booking = m.HostelBooking.objects.create(
            student=student, bed=bed, academic_year=academic_year, status=status
        )
        bed.is_available = False
        bed.save(update_fields=["is_available"])
        return booking

    @staticmethod
    @transaction.atomic
    def check_in(booking):
        booking.status = m.HostelBooking.Status.CHECKED_IN
        booking.checked_in_at = timezone.now()
        booking.save(update_fields=["status", "checked_in_at"])
        return booking

    @staticmethod
    @transaction.atomic
    def check_out(booking):
        booking.status = m.HostelBooking.Status.CHECKED_OUT
        booking.checked_out_at = timezone.now()
        booking.save(update_fields=["status", "checked_out_at"])
        booking.bed.is_available = True
        booking.bed.save(update_fields=["is_available"])
        return booking

    @staticmethod
    @transaction.atomic
    def cancel(booking):
        booking.status = m.HostelBooking.Status.CANCELLED
        booking.save(update_fields=["status"])
        booking.bed.is_available = True
        booking.bed.save(update_fields=["is_available"])
        return booking

    @staticmethod
    def dashboard_summary(academic_year=None):
        ay = academic_year or m.AcademicYear.objects.filter(is_current=True).first()
        beds = m.Bed.objects.filter(academic_year=ay) if ay else m.Bed.objects.none()
        total_beds = beds.count()
        occupied = beds.filter(is_available=False).count()
        by_hostel = list(
            beds.values("room__hostel__name")
            .annotate(total=Count("id"), occupied=Count("id", filter=Q(is_available=False)))
        )
        bookings = m.HostelBooking.objects.filter(academic_year=ay) if ay else m.HostelBooking.objects.none()
        by_status = {row["status"]: row["c"] for row in bookings.values("status").annotate(c=Count("id"))}
        recent_bookings = bookings.select_related("student__user", "bed__room__hostel").order_by("-booked_at")[:10]
        return {
            "academic_year": ay.year if ay else None,
            "total_beds": total_beds, "occupied_beds": occupied, "available_beds": total_beds - occupied,
            "occupancy_by_hostel": by_hostel,
            "bookings_by_status": by_status,
            "recent_bookings": recent_bookings,  # serialized in the view
        }


# ======================================================================
# CLEARANCE (graduation etc.)
# ======================================================================

class ClearanceService:
    @staticmethod
    def is_eligible(student: m.Student) -> bool:
        programme = student.programme
        return utils.is_final_semester(
            student.current_year, student.current_semester,
            programme.duration_years, programme.semesters_per_year,
        )

    @staticmethod
    @transaction.atomic
    def request_clearance(student: m.Student, clearance_type: str) -> m.ClearanceRequest:
        if not ClearanceService.is_eligible(student):
            raise ValueError("Clearance is only available to final-year, final-semester students.")
        clearance, _ = m.ClearanceRequest.objects.get_or_create(
            student=student, clearance_type=clearance_type,
            defaults={"status": m.ClearanceRequest.Status.PENDING},
        )
        return clearance
    
    
    @staticmethod
    @transaction.atomic
    def approve(clearance: m.ClearanceRequest, processed_by: m.User, remarks=""):
        clearance.status = m.ClearanceRequest.Status.APPROVED
        clearance.processed_by = processed_by
        clearance.processed_at = timezone.now()
        clearance.remarks = remarks
        clearance.save()
        return clearance

    @staticmethod
    @transaction.atomic
    def reject(clearance: m.ClearanceRequest, processed_by: m.User, remarks=""):
        clearance.status = m.ClearanceRequest.Status.REJECTED
        clearance.processed_by = processed_by
        clearance.processed_at = timezone.now()
        clearance.remarks = remarks
        clearance.save()
        return clearance


class StaffService:
    @staticmethod
    @transaction.atomic
    def admit_lecturer(*, first_name, last_name, gender, department, academic_rank="", joining_date=None):
        employee_no = utils.generate_employee_number("LEC", m.Lecturer)
        user = m.User.objects.create_user(
            username=employee_no, password=employee_no, first_name=first_name,
            last_name=last_name, gender=gender, user_type=m.User.UserType.LECTURER,
        )
        user.must_change_password = True
        user.save(update_fields=["must_change_password"])
        return m.Lecturer.objects.create(
            user=user, employee_number=employee_no, department=department,
            academic_rank=academic_rank, joining_date=joining_date or timezone.now().date(),
        )

    @staticmethod
    @transaction.atomic
    def admit_staff(*, first_name, last_name, gender, department=None, designation="",
                     user_type=m.User.UserType.STAFF):
        employee_no = utils.generate_employee_number("STF", m.Staff)
        user = m.User.objects.create_user(
            username=employee_no, password=employee_no, first_name=first_name,
            last_name=last_name, gender=gender, user_type=user_type,
        )
        user.must_change_password = True
        user.save(update_fields=["must_change_password"])
        return m.Staff.objects.create(
            user=user, employee_number=employee_no, department=department, designation=designation,
        )


class UserManagementService:
    """
    Generic account management for roles that don't have a dedicated
    admit flow with a linked profile (Student/Lecturer/Staff already
    have AdmissionService/StaffService — this is for admin, registrar,
    dean, cod, finance, hostel_warden, exam_office, and raw staff
    accounts, plus password resets for anyone).
    """

    @staticmethod
    @transaction.atomic
    def create_user(*, username, first_name, last_name, user_type, email="", phone="",
                     gender="", password=None):
        if m.User.objects.filter(username=username).exists():
            raise ValueError("A user with this username already exists.")
        temp_password = password or secrets.token_urlsafe(8)
        user = m.User.objects.create_user(
            username=username, password=temp_password, first_name=first_name,
            last_name=last_name, email=email, phone=phone, gender=gender,
            user_type=user_type,
        )
        user.must_change_password = True
        user.save(update_fields=["must_change_password"])
        return user, temp_password

    @staticmethod
    def set_password(user: m.User, new_password: str, force_change: bool = True):
        user.set_password(new_password)
        user.must_change_password = force_change
        user.save(update_fields=["password", "must_change_password"])
        return user

class ReportService:
    @staticmethod
    def summary():
        students = m.Student.objects.all()
        by_status = {row["status"]: row["c"] for row in students.values("status").annotate(c=Count("id"))}
        by_programme = list(
            students.values("programme__code", "programme__name").annotate(c=Count("id")).order_by("-c")[:15]
        )
        admissions_qs = (
            students.values("intake__academic_year__year")
            .annotate(c=Count("id")).order_by("intake__academic_year__year")
        )
        admissions_by_academic_year = [
            {"year": r["intake__academic_year__year"], "count": r["c"]} for r in admissions_qs
        ]

        grades = m.Grade.objects.filter(published_at__isnull=False)
        pass_count = grades.filter(is_pass=True).count()
        total_graded = grades.count()
        grade_distribution = [
            {"letter_grade": r["letter_grade"], "count": r["c"]}
            for r in grades.values("letter_grade").annotate(c=Count("id")).order_by("letter_grade")
        ]

        invoices_due = m.Invoice.objects.filter(is_active=True).aggregate(total=Sum("amount_due"))["total"] or 0
        allocations_paid = m.InvoiceAllocation.objects.filter(
            invoice__is_active=True
        ).aggregate(total=Sum("amount_applied"))["total"] or 0

        upcoming_exams = m.Examination.objects.filter(
            exam_date__gte=timezone.now().date()
        ).select_related("course").order_by("exam_date")[:10]

        return {
            "students_by_status": by_status,
            "students_by_programme": by_programme,
            "admissions_by_academic_year": admissions_by_academic_year,
            "grade_distribution": grade_distribution,
            "grades": {
                "published": total_graded, "pass": pass_count, "fail": total_graded - pass_count,
                "pass_rate": round((pass_count / total_graded) * 100, 1) if total_graded else None,
            },
            "fees": {
                "total_invoiced": float(invoices_due), "total_collected": float(allocations_paid),
                "total_outstanding": float(invoices_due) - float(allocations_paid),
            },
            "deferments_pending": m.StudentDeferment.objects.filter(
                status=m.StudentDeferment.Status.PENDING).count(),
            "clearances_pending": m.ClearanceRequest.objects.filter(
                status=m.ClearanceRequest.Status.PENDING).count(),
            "upcoming_examinations": [
                {"course": e.course.code, "type": e.exam_type, "date": e.exam_date, "venue": e.venue}
                for e in upcoming_exams
            ],
        }



ROLE_PAGE_PERMISSIONS = {
    "admin": ["faculties", "programmes", "courses", "calendar", "students", "lecturers",
              "deferments", "resultsmanagement", "unitallocations", "promotions",
              "examinations", "clearances", "reports"],
    "registrar": ["faculties", "programmes", "courses", "calendar", "students",
                  "deferments", "promotions", "examinations", "clearances", "reports"],
    "dean": ["programmes", "courses", "clearances", "reports"],
    "cod": ["courses", "lecturers", "unitallocations", "examinations"],
    "exam_office": ["calendar", "resultsmanagement", "examinations", "clearances", "reports"],
    "staff": [],
    "finance": ["finance_dashboard", "fee_structures", "payments", "awards"],
    "hostel_warden": ["hostel_dashboard", "hostel_management", "hostel_bookings"],
}