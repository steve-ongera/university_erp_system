"""
Standalone helper functions — no Django ORM side effects beyond reads,
so these are easy to unit test in isolation.
"""
import random
import string
from datetime import timedelta

from django.db import transaction
from django.utils import timezone


# ----------------------------------------------------------------------
# Registration numbers
# ----------------------------------------------------------------------
# Format:  <PROGRAMME_CODE>/<SEQUENCE>/<ADMISSION_YEAR>
# Example: SC211/0530/2022
#   SC211 -> Programme.code (Bsc. IT)
#   0530  -> zero-padded sequence number, UNIQUE per programme per
#            admission year (resets to 0001 every new admission year)
#   2022  -> the calendar year the student was admitted (Intake year,
#            not necessarily AcademicYear.year, since an intake like
#            "January 2027" belongs to admission year 2027)

def _next_sequence_for(programme_code: str, admission_year: int, model) -> int:
    """
    Find the highest existing sequence number already used for this
    programme+year and return the next one. Locks the row set via
    select_for_update() (call inside a transaction.atomic() block) so
    concurrent admissions never collide.
    """
    prefix = f"{programme_code}/"
    suffix = f"/{admission_year}"
    existing = (
        model.objects
        .select_for_update()
        .filter(registration_number__startswith=prefix, registration_number__endswith=suffix)
        .values_list("registration_number", flat=True)
    )
    max_seq = 0
    for reg_no in existing:
        try:
            seq_part = reg_no.split("/")[1]
            max_seq = max(max_seq, int(seq_part))
        except (IndexError, ValueError):
            continue
    return max_seq + 1


def generate_registration_number(programme, admission_year: int, student_model) -> str:
    """
    Atomically generate a unique registration number such as
    'SC211/0530/2022' for `programme` (a Programme instance) admitted
    in `admission_year`. `student_model` is passed in (rather than
    imported) to avoid circular imports — call with the Student model.
    """
    with transaction.atomic():
        seq = _next_sequence_for(programme.code, admission_year, student_model)
        return f"{programme.code}/{seq:04d}/{admission_year}"


def generate_employee_number(department_code: str, staff_model, prefix: str = "EMP") -> str:
    """Similar scheme for lecturers/staff: EMP/DEPTCODE/0001."""
    with transaction.atomic():
        existing = (
            staff_model.objects
            .select_for_update()
            .filter(employee_number__startswith=f"{prefix}/{department_code}/")
            .values_list("employee_number", flat=True)
        )
        max_seq = 0
        for emp_no in existing:
            try:
                max_seq = max(max_seq, int(emp_no.split("/")[-1]))
            except (IndexError, ValueError):
                continue
        return f"{prefix}/{department_code}/{max_seq + 1:04d}"


# ----------------------------------------------------------------------
# OTP / 2FA
# ----------------------------------------------------------------------

def generate_otp_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def otp_expiry(minutes: int = 5):
    return timezone.now() + timedelta(minutes=minutes)


# ----------------------------------------------------------------------
# Receipts / references
# ----------------------------------------------------------------------

def generate_receipt_number(prefix: str, payment_model, date_field: str = "received_at") -> str:
    """e.g. FPR/2026/00001 - resets sequence every calendar year."""
    year = timezone.now().year
    count = payment_model.objects.filter(**{f"{date_field}__year": year}).count() + 1
    return f"{prefix}/{year}/{count:05d}"


# ----------------------------------------------------------------------
# Name matching for bank-reconciled fee payments
# ----------------------------------------------------------------------

def normalize_name(name: str) -> str:
    return " ".join(name.strip().upper().split())


def names_roughly_match(bank_name: str, student_full_name: str) -> bool:
    """
    Bank slips rarely spell names identically ('JOHN M KAMAU' vs
    'JOHN MWANGI KAMAU'). We treat it as a match if every token in the
    shorter name appears in the longer name. Registration number is
    still the primary key for matching — this is only a sanity check
    used to flag suspicious mismatches for manual review.
    """
    a_tokens = set(normalize_name(bank_name).split())
    b_tokens = set(normalize_name(student_full_name).split())
    if not a_tokens or not b_tokens:
        return False
    shorter, longer = (a_tokens, b_tokens) if len(a_tokens) <= len(b_tokens) else (b_tokens, a_tokens)
    overlap = shorter & longer
    return len(overlap) >= max(1, len(shorter) - 1)  # allow one non-matching token (middle name, initials)


# ----------------------------------------------------------------------
# Programme/semester arithmetic
# ----------------------------------------------------------------------

def next_year_semester(current_year: int, current_semester: int, semesters_per_year: int):
    """Given a student's position, return (next_year, next_semester)."""
    if current_semester < semesters_per_year:
        return current_year, current_semester + 1
    return current_year + 1, 1


def is_final_semester(current_year: int, current_semester: int, duration_years: int, semesters_per_year: int) -> bool:
    return current_year == duration_years and current_semester == semesters_per_year
