#portal_api/models.py
"""
Muranga University Student Portal — core data models.

Design notes
------------
- Every "structural" academic concept (Faculty/Department/Programme/Course/
  Intake/AcademicYear/Semester) is versioned so that curriculum revisions,
  fee changes and intake changes do not corrupt historical records.
- Money is never mutated in place — a Student always has an append-only
  Invoice/Payment ledger. Balances (over/under payment) are *derived*,
  never stored as a single "amount_owed" field that can drift.
- Grading is pluggable: each Department has a `grading_scheme` (FK to
  GradingScheme) so Nursing and IT can use completely different scales,
  pass marks and supplementary rules without branching in code.
"""
import uuid
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.db import models
from django.utils import timezone


# ======================================================================
# USER / AUTH
# ======================================================================

class User(AbstractUser):
    """
    Login identity for everyone in the system.

    Students log in with their registration number (e.g. SC211/0530/2022).
    Staff/lecturers log in with an employee number.
    Both are stored in `username` (Django's unique login field) — see
    utils.generate_registration_number / generate_employee_number.
    """

    class UserType(models.TextChoices):
        ADMIN = "admin", "System Admin"
        STUDENT = "student", "Student"
        LECTURER = "lecturer", "Lecturer"
        STAFF = "staff", "Staff"
        REGISTRAR = "registrar", "Registrar"
        DEAN = "dean", "Dean"
        COD = "cod", "Chairman of Department"
        HOSTEL_WARDEN = "hostel_warden", "Hostel Warden"
        FINANCE = "finance", "Finance Officer"
        EXAM_OFFICE = "exam_office", "Examinations Office"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(
        max_length=150,
        unique=True,
        validators=[RegexValidator(regex=r'^[\w.@+\-/]+$',
                                    message="Only letters, digits and @/./+/-/_// allowed.")],
        help_text="Registration number for students, employee number for staff.",
    )
    user_type = models.CharField(max_length=20, choices=UserType.choices)
    phone = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    national_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    profile_picture = models.ImageField(upload_to="profiles/", null=True, blank=True)
    must_change_password = models.BooleanField(default=True)
    is_2fa_enrolled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # --- Security / lockout tracking (ADD THESE) ---
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    is_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    @property
    def requires_2fa(self) -> bool:
        """
        2FA is required for every role EXCEPT when settings.DEBUG=True,
        where it is bypassed to speed up local development.
        See services.auth_service.AuthService.login().
        """
        if settings.DEBUG:
            return False
        return True

    def __str__(self):
        return f"{self.username} ({self.user_type})"


class AdminLoginAttempt(models.Model):
    username = models.CharField(max_length=150)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    attempt_time = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=False)
    failure_reason = models.CharField(max_length=100, blank=True)

    class Meta:
        indexes = [models.Index(fields=["username", "attempt_time"])]


class TwoFactorCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="two_factor_codes")
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(minutes=5)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return not self.is_used and timezone.now() <= self.expires_at


# ======================================================================
# SECURITY AUDIT
# ======================================================================

class LoginSession(models.Model):
    """
    One successful login — the device/IP audit trail admins review.
    Created only after 2FA succeeds (or immediately in DEBUG bypass).
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_sessions")
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    device_label = models.CharField(max_length=255, blank=True,
                                     help_text="Parsed browser/OS summary, e.g. 'Chrome on Windows'.")
    otp_bypassed = models.BooleanField(default=False,
                                        help_text="True if this login skipped 2FA because settings.DEBUG=True.")
    login_at = models.DateTimeField(auto_now_add=True)
    logged_out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-login_at"]
        indexes = [models.Index(fields=["user", "login_at"]), models.Index(fields=["ip_address"])]

    def __str__(self):
        return f"{self.user.username} @ {self.ip_address} ({self.login_at:%Y-%m-%d %H:%M})"


class AccountLockEvent(models.Model):
    """
    Every lock/unlock action, automatic or admin-initiated — the audit
    record behind 'why is this account locked / who unlocked it'.
    """
    class Reason(models.TextChoices):
        FAILED_LOGIN = "failed_login", "Too Many Failed Login Attempts"
        ADMIN_MANUAL = "admin_manual", "Manually Locked by Admin"
        SUSPICIOUS = "suspicious", "Suspicious Activity"

    class Action(models.TextChoices):
        LOCKED = "locked", "Locked"
        UNLOCKED = "unlocked", "Unlocked"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="lock_events")
    action = models.CharField(max_length=10, choices=Action.choices)
    reason = models.CharField(max_length=20, choices=Reason.choices, default=Reason.FAILED_LOGIN)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name="performed_lock_actions",
                                      help_text="Admin who locked/unlocked; null means the system did it automatically.")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} — {self.action} ({self.reason})"


class SecurityAlert(models.Model):
    """
    Surfaced to admins on the security dashboard — created automatically
    when something needs their attention (a lockout, a login from an
    unrecognized device, etc).
    """
    class AlertType(models.TextChoices):
        ACCOUNT_LOCKED = "account_locked", "Account Locked"
        SUSPICIOUS_LOGIN = "suspicious_login", "Suspicious Login"
        NEW_DEVICE = "new_device", "New Device Login"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="security_alerts")
    alert_type = models.CharField(max_length=30, choices=AlertType.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="resolved_alerts")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_alert_type_display()} — {self.user.username}"

# ======================================================================
# ACADEMIC STRUCTURE
# ======================================================================

class Faculty(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    dean = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="headed_faculties")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Faculties"

    def __str__(self):
        return f"{self.name} ({self.code})"


class GradingScheme(models.Model):
    """
    A named grading policy, e.g. 'Standard University Scale' or
    'Nursing Council Scale'. Departments point at one of these so the
    same codebase can grade Nursing and IT completely differently.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    pass_mark = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("40.00"))
    supplementary_floor = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("30.00"),
        help_text="Marks below this are an outright FAIL (repeat unit); "
                   "between this and pass_mark => supplementary exam allowed.")

    def __str__(self):
        return self.name


class GradeBand(models.Model):
    """A single row of a GradingScheme, e.g. A: 70-100, 4.0 points."""
    scheme = models.ForeignKey(GradingScheme, on_delete=models.CASCADE, related_name="bands")
    letter = models.CharField(max_length=3)
    min_score = models.DecimalField(max_digits=5, decimal_places=2)
    max_score = models.DecimalField(max_digits=5, decimal_places=2)
    points = models.DecimalField(max_digits=3, decimal_places=2)
    is_supplementary_band = models.BooleanField(default=False)
    is_fail_band = models.BooleanField(default=False)

    class Meta:
        ordering = ["-min_score"]

    def __str__(self):
        return f"{self.scheme.name}: {self.letter} ({self.min_score}-{self.max_score})"


class Department(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name="departments")
    head_of_department = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                            related_name="headed_departments")
    grading_scheme = models.ForeignKey(GradingScheme, on_delete=models.PROTECT,
                                        related_name="departments")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class Programme(models.Model):
    class ProgrammeType(models.TextChoices):
        CERTIFICATE = "certificate", "Certificate"
        DIPLOMA = "diploma", "Diploma"
        BACHELOR = "bachelor", "Bachelor Degree"
        PGD = "postgraduate_diploma", "Postgraduate Diploma"
        MASTER = "master", "Master Degree"
        PHD = "phd", "PhD"

    name = models.CharField(max_length=150)
    code = models.CharField(max_length=15, unique=True,
                             help_text="Registration-number prefix, e.g. SC211 for Bsc.IT")
    programme_type = models.CharField(max_length=25, choices=ProgrammeType.choices)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="programmes")
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name="programmes")
    duration_years = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(8)])
    semesters_per_year = models.IntegerField(validators=[MinValueValidator(2), MaxValueValidator(3)],
                                              default=2,
                                              help_text="2 for most degrees, 3 for programmes that run trimesters.")
    credit_hours_required = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    @property
    def total_semesters(self):
        return self.duration_years * self.semesters_per_year

    def __str__(self):
        return f"{self.name} ({self.code})"


class Course(models.Model):
    """A unit. Reusable across programmes/years via CurriculumUnit."""
    class CourseType(models.TextChoices):
        CORE = "core", "Core"
        ELECTIVE = "elective", "Elective"
        COMMON = "common", "Common / Shared"
        CAPSTONE = "capstone", "Capstone Project"

    name = models.CharField(max_length=150)
    code = models.CharField(max_length=15, unique=True)
    course_type = models.CharField(max_length=20, choices=CourseType.choices, default="core")
    credit_hours = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(15)])
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="courses")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class CurriculumVersion(models.Model):
    """
    A yearly curriculum "snapshot" for a programme. Units get revised every
    year, but a student stays on the curriculum version that was active
    when they were admitted (unless explicitly migrated), which is why
    e.g. a Bsc.IT year-1 student in 2026 and a Software Eng. year-3
    student in 2026 can legitimately share the *same* CurriculumUnit row
    for a common course while each following their own version's map.
    """
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name="curriculum_versions")
    effective_academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE,
                                                  related_name="curriculum_versions")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ["programme", "effective_academic_year"]

    def __str__(self):
        return f"{self.programme.code} curriculum {self.effective_academic_year.year}"


class CurriculumUnit(models.Model):
    """Which course is taken in which year/semester, for a given curriculum version."""
    curriculum_version = models.ForeignKey(CurriculumVersion, on_delete=models.CASCADE, related_name="units")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="curriculum_placements")
    year = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(8)])
    semester = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(3)])
    is_mandatory = models.BooleanField(default=True)

    class Meta:
        unique_together = ["curriculum_version", "course", "year", "semester"]
        ordering = ["year", "semester", "course__name"]

    def __str__(self):
        return f"{self.curriculum_version} - {self.course.code} (Y{self.year}S{self.semester})"


# ======================================================================
# CALENDAR: ACADEMIC YEAR / SEMESTER / INTAKE
# ======================================================================

class AcademicYear(models.Model):
    year = models.CharField(max_length=10, unique=True)  # "2026/2027"
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self.is_current:
            AcademicYear.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.year


class Semester(models.Model):
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="semesters")
    semester_number = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(3)])
    start_date = models.DateField()
    end_date = models.DateField()
    registration_start_date = models.DateField()
    registration_end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        unique_together = ["academic_year", "semester_number"]
        ordering = ["academic_year", "semester_number"]

    def save(self, *args, **kwargs):
        if self.is_current:
            Semester.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.academic_year.year} S{self.semester_number}"


class Intake(models.Model):
    """
    e.g. 'August 2026', 'January 2027', 'May 2027'. New students are
    admitted into an Intake; the Intake determines the Year-1/Sem-1
    Semester a fresh student starts in, and forms part of the
    registration number (admission year).
    """
    name = models.CharField(max_length=50, unique=True)   # "August 2026"
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="intakes")
    starting_semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="intakes")
    application_deadline = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


# ======================================================================
# PEOPLE
# ======================================================================

class Lecturer(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="lecturer_profile")
    employee_number = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="lecturers")
    academic_rank = models.CharField(max_length=30, blank=True)
    joining_date = models.DateField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.employee_number}"


class Staff(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    employee_number = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    designation = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.employee_number}"


class Student(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        DEFERRED = "deferred", "Deferred"
        GRADUATED = "graduated", "Graduated"
        SUSPENDED = "suspended", "Suspended"
        DISCONTINUED = "discontinued", "Discontinued"
        EXPELLED = "expelled", "Expelled"

    class SponsorType(models.TextChoices):
        GOVERNMENT = "government", "Government (HELB)"
        SELF = "self", "Self Sponsored"
        EMPLOYER = "employer", "Employer Sponsored"
        SCHOLARSHIP = "scholarship", "Scholarship"
        BURSARY = "bursary", "Bursary"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    registration_number = models.CharField(max_length=30, unique=True, db_index=True)
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name="students")
    curriculum_version = models.ForeignKey(CurriculumVersion, on_delete=models.PROTECT,
                                            related_name="students",
                                            help_text="Curriculum the student follows (usually the one active at admission).")
    intake = models.ForeignKey(Intake, on_delete=models.PROTECT, related_name="students")

    current_year = models.IntegerField(default=1)
    current_semester = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    sponsor_type = models.CharField(max_length=20, choices=SponsorType.choices, default=SponsorType.SELF)

    admission_date = models.DateField(default=timezone.now)
    expected_graduation_date = models.DateField(null=True, blank=True)
    cumulative_gpa = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    total_credit_hours_earned = models.IntegerField(default=0)

    guardian_name = models.CharField(max_length=100, blank=True)
    guardian_phone = models.CharField(max_length=15, blank=True)
    emergency_contact = models.CharField(max_length=15, blank=True)

    class Meta:
        indexes = [models.Index(fields=["registration_number"])]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.registration_number}"


class StudentDeferment(models.Model):
    """
    A period during which a student is away. While deferred the student
    is excluded from unit registration/billing/promotion. On return,
    ResumptionService re-activates them at the SAME year/semester they
    left at (their marks/fee ledger are untouched — nothing is deleted).
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        RESUMED = "resumed", "Resumed"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="defermenets")
    reason = models.TextField()
    deferred_from_semester = models.ForeignKey(Semester, on_delete=models.CASCADE,
                                                 related_name="deferments_started")
    year_at_deferment = models.IntegerField()
    semester_at_deferment = models.IntegerField()
    requested_resume_semester = models.ForeignKey(Semester, on_delete=models.SET_NULL, null=True, blank=True,
                                                    related_name="deferments_resuming")
    supporting_document = models.FileField(upload_to="deferment_docs/", null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    applied_at = models.DateTimeField(auto_now_add=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name="processed_deferments")
    processed_at = models.DateTimeField(null=True, blank=True)
    resumed_at = models.DateTimeField(null=True, blank=True)
    admin_remarks = models.TextField(blank=True)

    def __str__(self):
        return f"{self.student.registration_number} deferment ({self.status})"


# ======================================================================
# UNIT ALLOCATION / REGISTRATION
# ======================================================================

class LecturerUnitAllocation(models.Model):
    """A lecturer assigned to teach a course in a specific semester (any programme/year)."""
    lecturer = models.ForeignKey(Lecturer, on_delete=models.CASCADE, related_name="unit_allocations")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lecturer_allocations")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="lecturer_allocations")
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name="lecturer_allocations")
    year = models.IntegerField(help_text="Programme year this offering targets, e.g. 2 for a 2.2 unit.")
    programme_semester = models.IntegerField(help_text="Semester-in-year, e.g. 2 for a 2.2 unit.")
    is_supplementary_offering = models.BooleanField(
        default=False,
        help_text="True when this allocation exists specifically to examine supplementary students "
                   "from an earlier cohort alongside the normal class.")
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="assigned_allocations")
    assigned_date = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ["lecturer", "course", "semester", "programme", "year", "programme_semester"]

    def __str__(self):
        return (f"{self.lecturer.user.get_full_name()} - {self.course.code} "
                f"({self.programme.code} Y{self.year}S{self.programme_semester}, {self.semester})")

    def roster(self):
        """
        Everyone this lecturer must grade this semester for this unit:
        the normal current-cohort students AND any supplementary
        students sitting the unit again (e.g. a 1.2 fail resurfacing
        while the lecturer is teaching the 2.2 offering because that's
        when the unit next runs).
        """
        return Enrollment.objects.filter(
            course=self.course, semester=self.semester, is_active=True
        ).select_related("student")


class UnitRegistration(models.Model):
    """A student registering for a unit in the current semester (normal, repeat or supplementary)."""
    class RegType(models.TextChoices):
        NORMAL = "normal", "Normal"
        REPEAT = "repeat", "Repeat (outright fail)"
        SUPPLEMENTARY = "supplementary", "Supplementary"
        AUDIT = "audit", "Audit"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="unit_registrations")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="registrations")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="unit_registrations")
    registration_type = models.CharField(max_length=20, choices=RegType.choices, default=RegType.NORMAL)
    registered_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    # Supplementary units require payment before the student can sit the exam.
    supplementary_invoice = models.ForeignKey("Invoice", on_delete=models.SET_NULL, null=True, blank=True,
                                               related_name="supplementary_registrations")

    class Meta:
        unique_together = ["student", "course", "semester"]

    def __str__(self):
        return f"{self.student.registration_number} - {self.course.code} ({self.registration_type})"


class Enrollment(models.Model):
    """The authoritative record of 'this student is being taught/examined in this unit this semester'."""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="enrollments")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="enrollments")
    lecturer_allocation = models.ForeignKey(LecturerUnitAllocation, on_delete=models.SET_NULL,
                                             null=True, blank=True, related_name="enrollments")
    registration = models.OneToOneField(UnitRegistration, on_delete=models.CASCADE, related_name="enrollment")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ["student", "course", "semester"]

    def __str__(self):
        return f"{self.student.registration_number} - {self.course.code} - {self.semester}"


# ======================================================================
# CATS / ASSESSMENTS / MARKS
# ======================================================================


class CatSubmission(models.Model):
    lecturer_allocation = models.ForeignKey(LecturerUnitAllocation, on_delete=models.CASCADE,
                                             related_name="cat_windows")
    cat_number = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(3)])
    title = models.CharField(max_length=200)
    instructions = models.TextField(blank=True)
    cat_file = models.FileField(upload_to="cat_papers/", null=True, blank=True,
                                 help_text="The CAT question paper (PDF) students download.")
    max_marks = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("30.00"))
    opens_at = models.DateTimeField()
    closes_at = models.DateTimeField()
    is_published = models.BooleanField(default=False)

    class Meta:
        unique_together = ["lecturer_allocation", "cat_number"]

    def __str__(self):
        return f"{self.lecturer_allocation.course.code} CAT{self.cat_number}"

    @property
    def is_open(self):
        now = timezone.now()
        return self.opens_at <= now <= self.closes_at

    @property
    def seconds_remaining(self):
        delta = self.closes_at - timezone.now()
        return max(int(delta.total_seconds()), 0)




class CatAnswerSubmission(models.Model):
    cat = models.ForeignKey(CatSubmission, on_delete=models.CASCADE, related_name="student_submissions")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="cat_submissions")
    answer_file = models.FileField(upload_to="cat_submissions/", null=True, blank=True)
    answer_text = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_late = models.BooleanField(default=False)
    marks_awarded = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    graded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ["cat", "student"]


class Grade(models.Model):
    """
    Final grade for one Enrollment. `save()` intentionally does NOT
    compute the grade — that belongs to services.grading_service so the
    per-department GradingScheme can be honoured. Views/services call
    GradingService.compute_and_save(enrollment_grade).
    """
    enrollment = models.OneToOneField(Enrollment, on_delete=models.CASCADE, related_name="grade")
    cat_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True,
                                     help_text="Aggregated CAT1+CAT2+CAT3, weighted per programme policy.")
    final_exam_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    total_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    letter_grade = models.CharField(max_length=3, blank=True)
    grade_points = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    quality_points = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_pass = models.BooleanField(default=False)
    requires_supplementary = models.BooleanField(default=False)
    is_supplementary_result = models.BooleanField(
        default=False, help_text="True if this grade record is itself the result of a supplementary sitting.")
    exam_date = models.DateField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    entered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # --- ADD THESE ---
    is_verified = models.BooleanField(
        default=False,
        help_text="True once the department's COD has reviewed and signed off this entered grade.")
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="verified_grades")
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.enrollment} -> {self.letter_grade or 'ungraded'}"


class TranscriptEntry(models.Model):
    """
    Denormalised, append-only academic-history row kept forever, so a
    student's full Year1 Sem1 -> Year4 Sem2/3 record survives even if the
    underlying Grade is later corrected (a correction adds a new
    TranscriptEntry with a higher `version`, never mutates history).
    """
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="transcript_entries")
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    semester_number = models.IntegerField()
    programme_year = models.IntegerField()
    letter_grade = models.CharField(max_length=3)
    grade_points = models.DecimalField(max_digits=3, decimal_places=2)
    credit_hours = models.IntegerField()
    quality_points = models.DecimalField(max_digits=6, decimal_places=2)
    is_supplementary = models.BooleanField(default=False)
    version = models.IntegerField(default=1)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["academic_year", "semester_number", "course__name"]


# ======================================================================
# FEES / PAYMENTS
# ======================================================================

class FeeStructure(models.Model):
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name="fee_structures")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="fee_structures")
    year = models.IntegerField()
    semester = models.IntegerField()
    tuition_fee = models.DecimalField(max_digits=10, decimal_places=2)
    other_fees = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    government_subsidy = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        unique_together = ["programme", "academic_year", "year", "semester"]

    def total_fee(self):
        return self.tuition_fee + self.other_fees

    def net_fee(self):
        return self.total_fee() - self.government_subsidy

    def __str__(self):
        return f"{self.programme.code} {self.academic_year.year} Y{self.year}S{self.semester}"


class Invoice(models.Model):
    """
    One billing event for a student (a semester's fee, or a
    supplementary-exam fee). `balance` is ALWAYS derived from
    payments, never stored — see services.fee_service.
    """
    class InvoiceType(models.TextChoices):
        SEMESTER_FEE = "semester_fee", "Semester Fee"
        SUPPLEMENTARY = "supplementary", "Supplementary Exam Fee"
        HOSTEL = "hostel", "Hostel Fee"
        OTHER = "other", "Other"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="invoices")
    invoice_type = models.CharField(max_length=20, choices=InvoiceType.choices, default=InvoiceType.SEMESTER_FEE)
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name="invoices")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="invoices")
    amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.student.registration_number} - {self.invoice_type} - {self.semester}"


class StudentFeeAccount(models.Model):
    """
    One running wallet per student. All bank payments land here first
    (via FeePaymentService.process_bank_notification), then get
    allocated against open Invoices oldest-first. Anything left over
    stays as `credit_balance` and is auto-applied to the NEXT invoice
    raised for that student — this is how a Ksh 31,000 payment against a
    Ksh 20,000 invoice correctly leaves a Ksh 11,000 credit instead of
    being lost or rejected.
    """
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name="fee_account")
    credit_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student.registration_number} wallet: {self.credit_balance}"


class FeePayment(models.Model):
    """
    A single bank/mobile-money transaction reconciled into the ERP.
    Banks push payments identified only by student NAME + REGISTRATION
    NUMBER (no internal invoice ID) — see services.fee_service for the
    reconciliation/matching logic.
    """
    class Method(models.TextChoices):
        BANK = "bank", "Bank Transfer"
        MPESA = "mpesa", "M-Pesa"
        HELB = "helb", "HELB Disbursement"
        BURSARY = "bursary", "Bursary"
        CASH = "cash", "Cash"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="fee_payments")
    bank_name = models.CharField(max_length=100, blank=True)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.BANK)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payer_name_on_slip = models.CharField(max_length=150,
                                           help_text="Name exactly as sent by the bank feed.")
    registration_number_on_slip = models.CharField(max_length=30)
    bank_reference = models.CharField(max_length=100, unique=True)
    receipt_number = models.CharField(max_length=50, unique=True, blank=True)
    payment_date = models.DateTimeField()
    is_reconciled = models.BooleanField(default=False)
    reconciliation_notes = models.TextField(blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.registration_number_on_slip} - {self.amount} ({self.bank_reference})"


class InvoiceAllocation(models.Model):
    """How much of a given FeePayment was applied to a given Invoice (many-to-many with amount)."""
    payment = models.ForeignKey(FeePayment, on_delete=models.CASCADE, related_name="allocations")
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="allocations")
    amount_applied = models.DecimalField(max_digits=10, decimal_places=2)
    allocated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["payment", "invoice"]


class HelbBursaryAward(models.Model):
    class Source(models.TextChoices):
        HELB = "helb", "HELB Loan"
        BURSARY = "bursary", "County/CDF Bursary"
        SCHOLARSHIP = "scholarship", "Scholarship"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="financial_awards")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    source = models.CharField(max_length=20, choices=Source.choices)
    amount_awarded = models.DecimalField(max_digits=10, decimal_places=2)
    reference_number = models.CharField(max_length=100, blank=True)
    disbursed = models.BooleanField(default=False)
    disbursed_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.student.registration_number} - {self.source} - {self.amount_awarded}"


# ======================================================================
# HOSTELS
# ======================================================================

class Hostel(models.Model):
    class HostelType(models.TextChoices):
        BOYS = "boys", "Boys Hostel"
        GIRLS = "girls", "Girls Hostel"
        MIXED = "mixed", "Mixed"

    name = models.CharField(max_length=100)
    hostel_type = models.CharField(max_length=10, choices=HostelType.choices)
    warden = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="managed_hostels")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Room(models.Model):
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name="rooms")
    room_number = models.CharField(max_length=10)
    capacity = models.IntegerField(default=4)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ["hostel", "room_number"]

    def __str__(self):
        return f"{self.hostel.name} - {self.room_number}"


class Bed(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="beds")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="beds")
    bed_number = models.CharField(max_length=20)
    is_available = models.BooleanField(default=True)

    class Meta:
        unique_together = ["room", "academic_year", "bed_number"]

    def __str__(self):
        return f"{self.room} - {self.bed_number}"


class HostelBooking(models.Model):
    """
    Only students who are REPORTING (StudentReporting.status=approved)
    for Year-1 Semester-1 of a fresh intake may book — see
    services.hostel_service.HostelService.book(). Continuing students in
    later years follow whatever the university's normal continuing-student
    allocation window allows, enforced the same way.
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Pending Approval"
        APPROVED = "approved", "Approved"
        CHECKED_IN = "checked_in", "Checked In"
        CHECKED_OUT = "checked_out", "Checked Out"
        CANCELLED = "cancelled", "Cancelled"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="hostel_bookings")
    bed = models.ForeignKey(Bed, on_delete=models.CASCADE, related_name="bookings")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="hostel_bookings")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    booking_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    booked_at = models.DateTimeField(auto_now_add=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    checked_out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ["student", "academic_year"]

    def __str__(self):
        return f"{self.student.registration_number} - {self.bed}"


# ======================================================================
# REPORTING / CLEARANCE
# ======================================================================

class StudentReporting(models.Model):
    """Semester reporting (online or physical) — Year-1 Sem-1 reporting also unlocks hostel booking."""
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="reportings")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="reportings")
    reporting_type = models.CharField(max_length=10, choices=[("online", "Online"), ("physical", "Physical")],
                                       default="online")
    reporting_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ["student", "semester"]

    def __str__(self):
        return f"{self.student.registration_number} - {self.semester}"


class ClearanceRequest(models.Model):
    """
    Only final-year, final-semester students (current_year==programme
    duration_years AND current_semester== last semester of year) can
    open a graduation clearance — enforced in services.clearance_service.
    """
    class ClearanceType(models.TextChoices):
        LIBRARY = "library", "Library"
        FINANCE = "finance", "Finance"
        DEPARTMENT = "department", "Department"
        HOSTEL = "hostel", "Hostel/Accommodation"
        GRADUATION = "graduation", "Graduation (Overall)"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        REQUIRES_ACTION = "requires_action", "Requires Action"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="clearance_requests")
    clearance_type = models.CharField(max_length=20, choices=ClearanceType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name="processed_clearances")
    processed_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)

    def __str__(self):
        return f"{self.student.registration_number} - {self.clearance_type} ({self.status})"


# ======================================================================
# EXAMINATIONS / TIMETABLE / ATTENDANCE
# ======================================================================

class Examination(models.Model):
    class ExamType(models.TextChoices):
        CAT = "cat", "CAT"
        FINAL = "final", "Final Examination"
        SUPPLEMENTARY = "supplementary", "Supplementary Examination"

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="examinations")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="examinations")
    exam_type = models.CharField(max_length=20, choices=ExamType.choices)
    exam_date = models.DateField()
    start_time = models.TimeField()
    duration_minutes = models.IntegerField(default=120)
    venue = models.CharField(max_length=100, blank=True)
    is_published = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.course.code} - {self.exam_type} - {self.exam_date}"


class Timetable(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="timetable_slots")
    lecturer = models.ForeignKey(Lecturer, on_delete=models.CASCADE, related_name="teaching_slots")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="timetable_slots")
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name="timetable_slots")
    year = models.IntegerField()
    programme_semester = models.IntegerField()
    day_of_week = models.CharField(max_length=10)
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.course.code} - {self.day_of_week} {self.start_time}"


class AttendanceSession(models.Model):
    timetable_slot = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="attendance_sessions")
    session_date = models.DateField()
    session_token = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.timetable_slot.course.code} - {self.session_date}"


class Attendance(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    attendance_session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name="records")
    status = models.CharField(max_length=10, choices=[("present", "Present"), ("absent", "Absent"),
                                                        ("late", "Late"), ("excused", "Excused")],
                               default="present")
    marked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["student", "attendance_session"]


# ======================================================================
# MESSAGING / NOTIFICATIONS / AUDIT
# ======================================================================

class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, default="general")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ActivityLog(models.Model):
    """Append-only audit trail — 'this system keeps track of records'."""
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="activity_logs")
    action = models.CharField(max_length=40)
    description = models.TextField(blank=True)
    object_repr = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [models.Index(fields=["user", "timestamp"]), models.Index(fields=["action", "timestamp"])]


class LectureNote(models.Model):
    """PDF course notes a lecturer publishes for a specific unit offering."""
    lecturer_allocation = models.ForeignKey(LecturerUnitAllocation, on_delete=models.CASCADE,
                                             related_name="lecture_notes")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="lecture_notes/")
    is_published = models.BooleanField(default=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="uploaded_notes")

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.lecturer_allocation.course.code} - {self.title}"