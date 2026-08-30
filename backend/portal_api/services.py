"""
Business logic layer. Views should stay thin and call into these
services; services own transactions and invariants so the same rule
(e.g. "final semester only" for clearance) is enforced once, everywhere.
"""
from decimal import Decimal
import secrets
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth


from django.utils import timezone
from django.db.models import Count

from .models import (
    Faculty, Department, Lecturer, Student, ClearanceRequest,
    StudentDeferment, StudentReporting, Examination, Grade,
    UnitRegistration, Course, AcademicYear, Semester,
)

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from . import models as m
from . import utils

import re
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.contrib.auth import authenticate as django_authenticate

from . import models as m

MAX_LOGIN_ATTEMPTS = 3
OTP_EXPIRY_MINUTES = 5


# ======================================================================
# AUTH / 2FA
# ======================================================================



class AuthError(Exception):
    pass


class AuthService:

    @staticmethod
    def bypass_required():
        """DEBUG=True skips OTP entirely — see User.requires_2fa."""
        return settings.DEBUG

    # ------------------------------------------------------------------
    # Step 1: username + password
    # ------------------------------------------------------------------
    @staticmethod
    def authenticate(username, password, ip_address, user_agent=""):
        try:
            user = m.User.objects.get(username=username)
        except m.User.DoesNotExist:
            m.AdminLoginAttempt.objects.create(
                username=username, ip_address=ip_address, user_agent=user_agent,
                success=False, failure_reason="Unknown username",
            )
            raise AuthError("Invalid username or password.")

        if user.is_locked:
            m.AdminLoginAttempt.objects.create(
                username=username, ip_address=ip_address, user_agent=user_agent,
                success=False, failure_reason="Account locked",
            )
            raise AuthError("This account is locked. Contact an administrator to unlock it.")

        if not user.check_password(password) or not user.is_active:
            AuthService._record_failed_attempt(user, ip_address, user_agent)
            remaining = max(0, MAX_LOGIN_ATTEMPTS - user.failed_login_attempts)
            if remaining == 0:
                raise AuthError("Invalid username or password. This account has now been locked.")
            raise AuthError(f"Invalid username or password. {remaining} attempt(s) remaining before lockout.")

        # Successful password check — reset the counter.
        if user.failed_login_attempts:
            user.failed_login_attempts = 0
            user.save(update_fields=["failed_login_attempts"])

        m.AdminLoginAttempt.objects.create(
            username=username, ip_address=ip_address, user_agent=user_agent, success=True,
        )
        return user

    @staticmethod
    def _record_failed_attempt(user, ip_address, user_agent):
        user.failed_login_attempts += 1
        lock_now = user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS

        if lock_now:
            user.is_locked = True
            user.locked_at = timezone.now()
        user.save(update_fields=["failed_login_attempts", "is_locked", "locked_at"])

        m.AdminLoginAttempt.objects.create(
            username=user.username, ip_address=ip_address, user_agent=user_agent,
            success=False, failure_reason="Incorrect password",
        )

        if lock_now:
            m.AccountLockEvent.objects.create(
                user=user, action=m.AccountLockEvent.Action.LOCKED,
                reason=m.AccountLockEvent.Reason.FAILED_LOGIN, ip_address=ip_address,
                notes=f"Locked automatically after {MAX_LOGIN_ATTEMPTS} failed login attempts.",
            )
            alert = m.SecurityAlert.objects.create(
                user=user, alert_type=m.SecurityAlert.AlertType.ACCOUNT_LOCKED,
                ip_address=ip_address,
                message=f"{user.username} ({user.get_full_name()}) was locked out after "
                        f"{MAX_LOGIN_ATTEMPTS} failed login attempts from {ip_address}.",
            )
            AuthService._notify_admins_of_lockout(user, ip_address, alert)

    @staticmethod
    def _notify_admins_of_lockout(user, ip_address, alert):
        admin_emails = list(
            m.User.objects.filter(user_type="admin", is_active=True)
            .exclude(email="").values_list("email", flat=True)
        )
        if not admin_emails:
            return
        try:
            send_mail(
                subject=f"[Security Alert] Account locked: {user.username}",
                message=(
                    f"{user.get_full_name()} ({user.username}, role: {user.user_type}) has been "
                    f"locked out after {MAX_LOGIN_ATTEMPTS} failed login attempts.\n\n"
                    f"IP address: {ip_address}\nTime: {alert.created_at}\n\n"
                    f"Unlock or investigate this from the Security Audit page."
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@muranga.ac.ke"),
                recipient_list=admin_emails,
                fail_silently=True,
            )
        except Exception:
            pass  # email failure should never block the lockout itself

    # ------------------------------------------------------------------
    # Step 2: OTP issue + verify
    # ------------------------------------------------------------------
    @staticmethod
    def issue_otp(user, ip_address):
        code = f"{int.from_bytes(__import__('os').urandom(3), 'big') % 1000000:06d}"
        m.TwoFactorCode.objects.create(
            user=user, code=code,
            expires_at=timezone.now() + timezone.timedelta(minutes=OTP_EXPIRY_MINUTES),
            ip_address=ip_address,
        )
        try:
            send_mail(
                subject="Your Murang'a University login code",
                message=f"Your one-time login code is {code}. It expires in {OTP_EXPIRY_MINUTES} minutes.",
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@muranga.ac.ke"),
                recipient_list=[user.email] if user.email else [],
                fail_silently=True,
            )
        except Exception:
            pass

    @staticmethod
    def verify_otp(user, code, ip_address="", user_agent=""):
        otp = (m.TwoFactorCode.objects
               .filter(user=user, code=code, is_used=False)
               .order_by("-created_at").first())
        if not otp or not otp.is_valid:
            return False
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        AuthService._start_session(user, ip_address, user_agent, otp_bypassed=False)
        return True

    @staticmethod
    def start_bypassed_session(user, ip_address, user_agent=""):
        """Called instead of issue_otp/verify_otp when bypass_required() is True."""
        AuthService._start_session(user, ip_address, user_agent, otp_bypassed=True)

    @staticmethod
    def _start_session(user, ip_address, user_agent, otp_bypassed):
        m.LoginSession.objects.create(
            user=user, ip_address=ip_address, user_agent=user_agent,
            device_label=AuthService._parse_device_label(user_agent),
            otp_bypassed=otp_bypassed,
        )
        is_new_device = not m.LoginSession.objects.filter(
            user=user, ip_address=ip_address
        ).exclude(login_at=None).exists()
        user.last_login_ip = ip_address
        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_ip", "last_login_at"])

        if is_new_device and user.login_sessions.count() > 1:
            m.SecurityAlert.objects.create(
                user=user, alert_type=m.SecurityAlert.AlertType.NEW_DEVICE,
                ip_address=ip_address,
                message=f"{user.username} logged in from a new IP address: {ip_address}.",
            )

    @staticmethod
    def _parse_device_label(user_agent):
        if not user_agent:
            return "Unknown device"
        ua = user_agent.lower()
        browser = next((b for b in ["edg", "chrome", "firefox", "safari", "opera"] if b in ua), "Browser")
        osys = next((o for o in ["windows", "mac os", "android", "iphone", "linux"] if o in ua), "Unknown OS")
        return f"{browser.title()} on {osys.title()}"

    # ------------------------------------------------------------------
    # Admin actions
    # ------------------------------------------------------------------
    @staticmethod
    def unlock_account(user, performed_by, notes=""):
        user.is_locked = False
        user.locked_at = None
        user.failed_login_attempts = 0
        user.save(update_fields=["is_locked", "locked_at", "failed_login_attempts"])
        m.AccountLockEvent.objects.create(
            user=user, action=m.AccountLockEvent.Action.UNLOCKED,
            reason=m.AccountLockEvent.Reason.ADMIN_MANUAL,
            performed_by=performed_by, notes=notes or "Unlocked by admin.",
        )

    @staticmethod
    def lock_account(user, performed_by, reason=m.AccountLockEvent.Reason.ADMIN_MANUAL, notes=""):
        user.is_locked = True
        user.locked_at = timezone.now()
        user.save(update_fields=["is_locked", "locked_at"])
        m.AccountLockEvent.objects.create(
            user=user, action=m.AccountLockEvent.Action.LOCKED, reason=reason,
            performed_by=performed_by, notes=notes,
        )


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
        earlier semesters — but only the ones actually being taught
        this semester (see SupplementaryService.outstanding_units_with_availability).
        Units still frozen (not yet re-offered since the student failed
        them) are skipped here; they'll be picked up automatically in
        whichever future semester they're next allocated to a lecturer.
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

        # Pull forward any pending supplementary/repeat units — but ONLY
        # ones actually being taught this semester. A unit is never open
        # for supplementary registration in the same semester it was
        # failed in, and stays frozen until a LecturerUnitAllocation for
        # that course exists in the current semester (regardless of
        # which programme year/semester slot a curriculum change may
        # have moved it to).
        pending_rows = SupplementaryService.outstanding_units_with_availability(student)
        for row in pending_rows:
            if not row["is_open_for_registration"]:
                continue
            course = row["course"]
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

        # Keep the stored Student.cumulative_gpa field in sync every time
        # a grade is published — nothing else in the codebase ever wrote
        # to it, which is why it was always null/stale.
        cls.recompute_cumulative_gpa(grade.enrollment.student)

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

    @staticmethod
    def compute_cumulative_gpa(student: m.Student):
        """
        Live GPA calculation from every published Grade this student has:
        sum(quality_points) / sum(credit_hours). Used both to refresh the
        stored Student.cumulative_gpa field and as a serializer fallback
        for any student whose stored value hasn't been backfilled yet.
        """
        grades = m.Grade.objects.filter(
            enrollment__student=student, published_at__isnull=False
        ).select_related("enrollment__course")

        total_quality_points = sum(
            (g.quality_points for g in grades if g.quality_points is not None), Decimal("0")
        )
        total_credit_hours = sum(
            (g.enrollment.course.credit_hours for g in grades if g.quality_points is not None), 0
        )
        return round(float(total_quality_points) / total_credit_hours, 2) if total_credit_hours else None

    @classmethod
    def recompute_cumulative_gpa(cls, student: m.Student):
        gpa = cls.compute_cumulative_gpa(student)
        student.cumulative_gpa = gpa
        student.save(update_fields=["cumulative_gpa"])
        return gpa


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

    IMPORTANT: a unit is never open for supplementary registration in the
    SAME semester it was failed in (that exam has already happened), and
    is only open once a LecturerUnitAllocation for that course exists in
    the CURRENT semester — i.e. "whenever it's next actually taught",
    regardless of which programme year/semester slot that ends up being.

    NOTE: outstanding_units() and outstanding_units_with_availability()
    ALWAYS include a unit that is still owed, whether or not it's
    currently open for registration. "Outstanding" and "open for
    registration" are two different questions — freezing a unit never
    removes it from the outstanding count, it only blocks registration
    until the unit is next taught.
    """

    SUPPLEMENTARY_FEE = Decimal("3000.00")  # override via settings/FeeStructure if it should vary

    @staticmethod
    def outstanding_units(student: m.Student):
        """
        Raw list of Course objects still outstanding (failed + not yet
        cleared by a passing supplementary sitting) — no timing gate.
        Kept for backward compatibility with anything that just needs
        "what does this student still owe", not "can they register today".
        """
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
    def outstanding_units_with_availability(student: m.Student):
        """
        Same outstanding list as above, but each entry is annotated with
        whether it can be registered for RIGHT NOW, plus why not if it
        can't. This is what the student-facing Supplementary page (and
        the pull-forward auto-registration) should actually use.

        Every failed-and-not-yet-cleared unit appears here exactly once,
        regardless of is_open_for_registration — freezing a unit does
        NOT remove it from this list.
        """
        current_semester = m.Semester.objects.filter(is_current=True).first()

        failing_grades = (
            m.Grade.objects.filter(enrollment__student=student, requires_supplementary=True)
            .exclude(
                enrollment__course__in=m.Grade.objects.filter(
                    enrollment__student=student, is_supplementary_result=True, is_pass=True
                ).values_list("enrollment__course", flat=True)
            )
            .select_related("enrollment__course", "enrollment__semester__academic_year")
            .order_by("enrollment__course_id", "-enrollment__semester_id")
        )

        seen_course_ids = set()
        results = []
        for grade in failing_grades:
            course = grade.enrollment.course
            if course.id in seen_course_ids:
                continue
            seen_course_ids.add(course.id)

            failed_semester = grade.enrollment.semester
            is_open = False
            note = None
            offering_allocation = None

            if not current_semester:
                note = "No active semester found."
            elif current_semester.id == failed_semester.id:
                note = "You failed this unit this semester. You must wait until it is offered again."
            else:
                offering_allocation = m.LecturerUnitAllocation.objects.filter(
                    course=course, semester=current_semester, is_active=True
                ).first()
                is_open = offering_allocation is not None
                if not is_open:
                    note = "This unit is not being taught this semester yet. You'll be able to register once it's offered again."

            results.append({
                "course": course,
                "failed_semester": failed_semester,
                "current_semester": current_semester,
                "is_open_for_registration": is_open,
                "note": note,
                "offering_allocation": offering_allocation,
            })
        return results

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
        # Guard 1: the unit must actually be taught this semester.
        allocation = m.LecturerUnitAllocation.objects.filter(
            course=course, semester=semester, is_active=True
        ).first()
        if not allocation:
            raise ValueError(
                f"{course.code} is not being offered this semester. "
                "You'll be able to register once it's next taught."
            )

        # Guard 2: never allow registering in the exact semester it was failed.
        failed_this_semester = m.Grade.objects.filter(
            enrollment__student=student, enrollment__course=course,
            enrollment__semester=semester, requires_supplementary=True,
        ).exists()
        if failed_this_semester:
            raise ValueError(
                f"You cannot register a supplementary for {course.code} in the same "
                "semester you failed it. Wait until it is next offered."
            )

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
from django.core.mail import send_mail


class PromotionService:
    MAX_CARRIED_SUPPLEMENTARIES = 4

    @classmethod
    @transaction.atomic
    def _promote_one(cls, student: m.Student, run: m.PromotionRun) -> m.PromotionRecord:
        from_year, from_sem = student.current_year, student.current_semester

        # --- Guard: never promote the same student out of the same slot twice ---
        already = m.PromotionRecord.objects.filter(
            student=student, from_year=from_year, from_semester=from_sem,
            action__in=[m.PromotionRecord.Action.PROMOTED, m.PromotionRecord.Action.GRADUATED],
        ).exists()
        if already:
            return m.PromotionRecord.objects.create(
                run=run, student=student, from_year=from_year, from_semester=from_sem,
                action=m.PromotionRecord.Action.ALREADY_PROMOTED,
                reason="Student was already promoted out of this year/semester in an earlier run.",
            )

        if student.status != m.Student.Status.ACTIVE:
            return m.PromotionRecord.objects.create(
                run=run, student=student, from_year=from_year, from_semester=from_sem,
                action=m.PromotionRecord.Action.SKIPPED, reason=f"status={student.status}",
            )

        outstanding = SupplementaryService.outstanding_units(student)
        outstanding_count = outstanding.count()

        if outstanding_count > cls.MAX_CARRIED_SUPPLEMENTARIES and not run.bypass_result_check:
            student.status = m.Student.Status.SUSPENDED
            student.save(update_fields=["status"])
            record = m.PromotionRecord.objects.create(
                run=run, student=student, from_year=from_year, from_semester=from_sem,
                action=m.PromotionRecord.Action.SUSPENDED,
                reason=f"{outstanding_count} outstanding supplementary units "
                       f"(max allowed is {cls.MAX_CARRIED_SUPPLEMENTARIES}).",
                outstanding_supplementary_count=outstanding_count,
            )
            cls._notify_student(student, record)
            return record

        was_bypassed = run.bypass_result_check and outstanding_count > cls.MAX_CARRIED_SUPPLEMENTARIES

        programme = student.programme
        next_year, next_sem = utils.next_year_semester(
            from_year, from_sem, programme.semesters_per_year
        )

        if next_year > programme.duration_years:
            student.status = m.Student.Status.GRADUATED
            student.save(update_fields=["status"])
            record = m.PromotionRecord.objects.create(
                run=run, student=student, from_year=from_year, from_semester=from_sem,
                action=m.PromotionRecord.Action.GRADUATED,
                reason=f"Completed Y{from_year}S{from_sem}",
                outstanding_supplementary_count=outstanding_count, was_bypassed=was_bypassed,
            )
            cls._notify_student(student, record)
            return record

        student.current_year, student.current_semester = next_year, next_sem
        student.save(update_fields=["current_year", "current_semester"])

        record = m.PromotionRecord.objects.create(
            run=run, student=student, from_year=from_year, from_semester=from_sem,
            to_year=next_year, to_semester=next_sem,
            action=m.PromotionRecord.Action.PROMOTED,
            reason=f"Y{from_year}S{from_sem} -> Y{next_year}S{next_sem}",
            outstanding_supplementary_count=outstanding_count, was_bypassed=was_bypassed,
        )

        # --- Raise the new semester's invoice; never let this block the promotion ---
        try:
            invoice = FeeService.raise_semester_invoice(student, run.academic_year.semesters.filter(
                semester_number=next_sem).first() or student.enrollments.first() and None)
        except Exception:
            invoice = None
        try:
            target_semester = m.Semester.objects.filter(
                academic_year=run.academic_year, semester_number=next_sem
            ).first()
            if target_semester:
                invoice = FeeService.raise_semester_invoice(student, target_semester)
                record.invoice = invoice
            else:
                record.invoice_error = "No Semester record for the target academic year/semester."
        except ValueError as exc:
            record.invoice_error = str(exc)
        record.save(update_fields=["invoice", "invoice_error"])

        cls._notify_student(student, record)
        return record

    @staticmethod
    def _notify_student(student: m.Student, record: m.PromotionRecord):
        if not student.user.email:
            record.email_error = "No email on file."
            record.save(update_fields=["email_error"])
            return

        if record.action in (m.PromotionRecord.Action.PROMOTED, m.PromotionRecord.Action.GRADUATED):
            if record.was_bypassed:
                subject = "Provisional Promotion Notice"
                body = (
                    f"Dear {student.user.get_full_name()},\n\n"
                    f"You have been provisionally promoted to Y{record.to_year}S{record.to_semester} "
                    f"pending final confirmation of your Y{record.from_year}S{record.from_semester} results. "
                    f"This promotion may be reversed if your final results show more than "
                    f"{PromotionService.MAX_CARRIED_SUPPLEMENTARIES} outstanding supplementary units.\n\n"
                    f"Murang'a University Student Portal"
                )
            elif record.action == m.PromotionRecord.Action.GRADUATED:
                subject = "Congratulations — You Have Graduated"
                body = f"Dear {student.user.get_full_name()},\n\nYou have completed {student.programme.name}. Congratulations!"
            else:
                subject = "You Have Been Promoted"
                body = (
                    f"Dear {student.user.get_full_name()},\n\n"
                    f"You have been promoted to Y{record.to_year}S{record.to_semester}. "
                    f"An invoice for the new semester has been raised on your account."
                )
        else:
            subject = "Promotion Not Processed"
            body = (
                f"Dear {student.user.get_full_name()},\n\n"
                f"You were not promoted this cycle. Reason: {record.reason}\n"
                f"Please clear outstanding units/fees and contact the Registrar's office if you have questions."
            )

        try:
            send_mail(subject, body, getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@muranga.ac.ke"),
                       [student.user.email], fail_silently=False)
            record.email_sent = True
        except Exception as exc:
            record.email_error = str(exc)[:255]
        record.save(update_fields=["email_sent", "email_error"])

    @classmethod
    @transaction.atomic
    def run_promotion(cls, *, academic_year: m.AcademicYear, faculty: m.Faculty = None,
                       programme: m.Programme = None, bypass_result_check: bool = False,
                       bypass_reason: str = "", triggered_by: m.User = None) -> m.PromotionRun:
        run = m.PromotionRun.objects.create(
            faculty=faculty, programme=programme, academic_year=academic_year,
            triggered_by=triggered_by, bypass_result_check=bypass_result_check,
            bypass_reason=bypass_reason,
        )
        qs = m.Student.objects.filter(status=m.Student.Status.ACTIVE)
        if programme:
            qs = qs.filter(programme=programme)
        elif faculty:
            qs = qs.filter(programme__faculty=faculty)

        counts = {"promoted": 0, "graduated": 0, "suspended": 0, "skipped": 0, "already_promoted": 0}
        for student in qs.select_related("programme", "user"):
            record = cls._promote_one(student, run)
            counts[record.action] = counts.get(record.action, 0) + 1

        run.promoted_count = counts["promoted"]
        run.graduated_count = counts["graduated"]
        run.suspended_count = counts["suspended"]
        run.skipped_count = counts["skipped"] + counts.get("already_promoted", 0)
        run.save(update_fields=["promoted_count", "graduated_count", "suspended_count", "skipped_count"])
        return run

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
    "cod": ["cod_dashboard", "cod_students", "cod_reports", "cod_enrollments",
            "unitallocations", "cod_verify_marks", "examinations", "profile"],
    "exam_office": ["calendar", "resultsmanagement", "examinations", "clearances", "reports"],
    "staff": [],
    "finance": ["finance_dashboard", "fee_structures", "payments", "awards"],
    "hostel_warden": ["hostel_dashboard", "hostel_management", "hostel_bookings"],
}

# ======================================================================
# TRANSCRIPT
# ======================================================================

class TranscriptService:
    """
    Transcript rows are built directly from Grade — not TranscriptEntry.
    Grade has enrollment = OneToOneField(...), so there is exactly ONE
    row per enrollment, always. Whatever Grade currently says (including
    hand-corrections made in Django admin, which bypass GradingService
    and therefore never touch TranscriptEntry) is exactly what shows
    here — no dedup step needed, no stale duplicate rows possible.
    """

    @staticmethod
    def effective_entries(student: m.Student):
        return (
            m.Grade.objects
            .filter(enrollment__student=student)
            .select_related(
                "enrollment__course",
                "enrollment__semester__academic_year",
                "enrollment__lecturer_allocation",
            )
            .order_by(
                "enrollment__semester__academic_year__year",
                "enrollment__semester__semester_number",
                "enrollment__course__name",
            )
        )
        
        
# ======================================================================
# COD (CHAIRMAN OF DEPARTMENT) HELPERS
# ======================================================================

def get_cod_department(user: m.User):
    """The single Department this COD heads, or None if unassigned/misconfigured."""
    return m.Department.objects.filter(head_of_department=user).first()


class CodReportService:
    """Academic reporting scoped to one department — the COD's dashboard/reports source."""

    @staticmethod
    def department_summary(department: m.Department) -> dict:
        students = m.Student.objects.filter(programme__department=department)
        lecturers = m.Lecturer.objects.filter(department=department, is_active=True)
        courses = m.Course.objects.filter(department=department, is_active=True)

        grades = m.Grade.objects.filter(
            enrollment__course__department=department, published_at__isnull=False
        )
        total_graded = grades.count()
        pass_count = grades.filter(is_pass=True).count()
        pending_verification = grades.filter(is_verified=False).count()

        grade_distribution = [
            {"letter_grade": row["letter_grade"], "count": row["c"]}
            for row in grades.values("letter_grade").annotate(c=Count("id")).order_by("letter_grade")
        ]

        programme_breakdown = list(
            students.values("programme__code", "programme__name")
            .annotate(count=Count("id")).order_by("-count")
        )

        return {
            "department": {"id": department.id, "name": department.name, "code": department.code},
            "stats": {
                "total_students": students.count(),
                "active_students": students.filter(status=m.Student.Status.ACTIVE).count(),
                "total_lecturers": lecturers.count(),
                "total_courses": courses.count(),
                "graded_units": total_graded,
                "pass_rate": round((pass_count / total_graded) * 100, 1) if total_graded else None,
                "pending_verification": pending_verification,
            },
            "grade_distribution": grade_distribution,
            "students_by_programme": programme_breakdown,
        }
        
        
        
        
# ======================================================================
# Add these to services.py, near get_cod_department / CodReportService.
# Written against the models you shared (models.py) — no guessing on
# field names, only on the *shape* of the returned summary dict, which
# you're free to adjust once you see the frontend cards.
# ======================================================================

from . import models as m



def get_dean_faculty(user):
    """A Dean heads exactly one Faculty (Faculty.dean FK). None if unassigned."""
    return Faculty.objects.filter(dean=user).first()


class DeanReportService:
    """Faculty-wide summary for the Dean dashboard/reports page."""

    @staticmethod
    def faculty_summary(faculty: "Faculty") -> dict:
        departments = Department.objects.filter(faculty=faculty)
        department_ids = list(departments.values_list("id", flat=True))

        students = Student.objects.filter(programme__department_id__in=department_ids)
        lecturers = Lecturer.objects.filter(department_id__in=department_ids)

        clearances = ClearanceRequest.objects.filter(
            student__programme__department_id__in=department_ids
        )
        pending_clearances = clearances.filter(status=ClearanceRequest.Status.PENDING)

        department_stats = []
        for dept in departments:
            department_stats.append({
                "id": dept.id,
                "name": dept.name,
                "code": dept.code,
                "head_of_department": dept.head_of_department.get_full_name()
                    if dept.head_of_department else None,
                "student_count": students.filter(programme__department=dept).count(),
                "lecturer_count": lecturers.filter(department=dept).count(),
            })
        department_stats.sort(key=lambda x: x["student_count"], reverse=True)

        recent_clearances = clearances.select_related(
            "student__user", "student__programme"
        ).order_by("-requested_at")[:10]

        return {
            "faculty": {"id": faculty.id, "name": faculty.name, "code": faculty.code},
            "stats": {
                "total_departments": departments.count(),
                "total_lecturers": lecturers.count(),
                "total_students": students.count(),
                "active_students": students.filter(status=Student.Status.ACTIVE).count(),
                "pending_clearances": pending_clearances.count(),
            },
            "department_stats": department_stats,
            "recent_clearances": [
                {
                    "id": c.id,
                    "student": c.student.registration_number,
                    "student_name": c.student.user.get_full_name(),
                    "clearance_type": c.clearance_type,
                    "status": c.status,
                    "requested_at": c.requested_at,
                }
                for c in recent_clearances
            ],
        }





class RegistrarReportService:
    """Institution-wide records summary for the Registrar dashboard."""

    @staticmethod
    def summary() -> dict:
        students = Student.objects.all()
        deferments = StudentDeferment.objects.all()
        clearances = ClearanceRequest.objects.all()
        current_semester = Semester.objects.filter(is_current=True).first()

        pending_reportings = 0
        if current_semester:
            pending_reportings = StudentReporting.objects.filter(
                semester=current_semester, status=StudentReporting.Status.PENDING
            ).count()

        recent_deferments = deferments.filter(
            status=StudentDeferment.Status.PENDING
        ).select_related("student__user").order_by("-applied_at")[:10]

        recent_clearances = clearances.filter(
            status=ClearanceRequest.Status.PENDING
        ).select_related("student__user").order_by("-requested_at")[:10]

        return {
            "stats": {
                "total_students": students.count(),
                "active_students": students.filter(status=Student.Status.ACTIVE).count(),
                "deferred_students": students.filter(status=Student.Status.DEFERRED).count(),
                "graduated_students": students.filter(status=Student.Status.GRADUATED).count(),
                "pending_deferments": deferments.filter(status=StudentDeferment.Status.PENDING).count(),
                "pending_clearances": clearances.filter(status=ClearanceRequest.Status.PENDING).count(),
                "pending_reportings": pending_reportings,
            },
            "current_semester": current_semester.id if current_semester else None,
            "recent_deferments": [
                {
                    "id": d.id,
                    "student": d.student.registration_number,
                    "student_name": d.student.user.get_full_name(),
                    "reason": d.reason,
                    "applied_at": d.applied_at,
                }
                for d in recent_deferments
            ],
            "recent_clearances": [
                {
                    "id": c.id,
                    "student": c.student.registration_number,
                    "student_name": c.student.user.get_full_name(),
                    "clearance_type": c.clearance_type,
                    "requested_at": c.requested_at,
                }
                for c in recent_clearances
            ],
        }




# ======================================================================
# EXAM OFFICE (institution-wide)
# ======================================================================

class ExamOfficeReportService:
    """Institution-wide examinations overview for the Exam Office dashboard."""

    @staticmethod
    def summary() -> dict:
        today = timezone.now().date()

        upcoming_exams = Examination.objects.filter(
            exam_date__gte=today, is_published=True
        ).select_related("course", "semester").order_by("exam_date", "start_time")[:10]

        unpublished_exams = Examination.objects.filter(is_published=False).count()

        pending_verification = Grade.objects.filter(
            published_at__isnull=False, is_verified=False
        ).count()

        outstanding_supplementary = UnitRegistration.objects.filter(
            registration_type=UnitRegistration.RegType.SUPPLEMENTARY, is_active=True
        ).count()

        unpaid_supplementary = UnitRegistration.objects.filter(
            registration_type=UnitRegistration.RegType.SUPPLEMENTARY,
            is_active=True,
            supplementary_invoice__isnull=False,
        ).count()

        return {
            "stats": {
                "upcoming_exams": upcoming_exams.count(),
                "unpublished_exams": unpublished_exams,
                "pending_grade_verifications": pending_verification,
                "outstanding_supplementary": outstanding_supplementary,
                "unpaid_supplementary_invoices": unpaid_supplementary,
            },
            "upcoming_exams": [
                {
                    "id": e.id,
                    "course": e.course.code,
                    "course_name": e.course.name,
                    "exam_type": e.exam_type,
                    "exam_date": e.exam_date,
                    "start_time": e.start_time,
                    "venue": e.venue,
                }
                for e in upcoming_exams
            ],
        }
        
        
