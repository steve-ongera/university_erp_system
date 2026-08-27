"""
library/models.py
Muranga University Student Portal — Library module.

Design notes
------------
- Mirrors portal_api's conventions: FKs into portal_api.User rather than
  duplicating auth; append-only where a historical/financial record
  shouldn't be mutated (LibraryFine, closed BookLoan rows).
- LibraryMember is the bridge table between portal_api.User and library
  borrowing rights — created lazily (see services.MembershipService.
  get_or_create_member) the first time someone borrows, the same way
  portal_api.StudentFeeAccount is created at admission rather than via a
  separate enrolment step.
- BookLoan.status is stored (ACTIVE/RETURNED/LOST) because that
  lifecycle needs an explicit terminal state, but is_overdue/days_overdue
  are always computed live from due_date — never cached, never stale.
- Fines are kept in their own ledger (LibraryFine) rather than folded
  into portal_api.Invoice, so this app has zero write dependency on
  portal_api's fee tables. See services.py for the integration point if
  the university later wants library fines collected through the same
  FeeService/M-Pesa pipeline as tuition.
"""
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from portal_api import models as pm


# ======================================================================
# CATALOG
# ======================================================================

class BookCategory(models.Model):
    """e.g. 'Nursing', 'Computer Science', 'Fiction', 'Reference'. Optionally
    linked to a Department for department-relevant collections, but not
    required — the library also stocks general/fiction titles."""
    name = models.CharField(max_length=100, unique=True)
    department = models.ForeignKey(pm.Department, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="library_categories")
    description = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Book categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Book(models.Model):
    """Title-level catalog record. Individual physical copies are BookCopy."""
    title = models.CharField(max_length=255)
    isbn = models.CharField(max_length=20, unique=True, null=True, blank=True)
    authors = models.CharField(max_length=255, help_text="Comma-separated if multiple.")
    publisher = models.CharField(max_length=150, blank=True)
    edition = models.CharField(max_length=50, blank=True)
    publication_year = models.IntegerField(null=True, blank=True)
    category = models.ForeignKey(BookCategory, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name="books")
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="library/covers/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]
        indexes = [models.Index(fields=["title"]), models.Index(fields=["isbn"])]

    def __str__(self):
        return self.title

    @property
    def total_copies(self):
        return self.copies.count()

    @property
    def available_copies(self):
        return self.copies.filter(status=BookCopy.Status.AVAILABLE).count()


class BookCopy(models.Model):
    """One physical/loanable copy of a Book — what actually gets borrowed."""
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        BORROWED = "borrowed", "Borrowed"
        RESERVED = "reserved", "Reserved"
        LOST = "lost", "Lost"
        DAMAGED = "damaged", "Damaged"
        UNDER_REPAIR = "under_repair", "Under Repair"
        WITHDRAWN = "withdrawn", "Withdrawn"

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="copies")
    accession_number = models.CharField(max_length=30, unique=True,
                                         help_text="Library's internal copy identifier / barcode value.")
    shelf_location = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    condition_notes = models.TextField(blank=True)
    acquired_date = models.DateField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["accession_number"]

    def __str__(self):
        return f"{self.book.title} - {self.accession_number}"


# ======================================================================
# MEMBERSHIP
# ======================================================================

class LoanPolicy(models.Model):
    """
    Per-role borrowing rules — one row per portal_api.User.UserType that
    is allowed to borrow. Lets library/admin staff tune limits without a
    code deploy (e.g. lecturers get 30 days, students get 14).
    """
    user_type = models.CharField(max_length=20, choices=pm.User.UserType.choices, unique=True)
    max_books = models.PositiveSmallIntegerField(default=3)
    loan_period_days = models.PositiveSmallIntegerField(default=14)
    max_renewals = models.PositiveSmallIntegerField(default=1)
    fine_per_day = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("10.00"))
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.get_user_type_display()} policy"


class LibraryMember(models.Model):
    """
    Bridges a portal_api.User into the library system. Created lazily the
    first time a person is issued a book (see MembershipService), rather
    than requiring a separate library-enrolment step.
    """
    user = models.OneToOneField(pm.User, on_delete=models.CASCADE, related_name="library_membership")
    library_card_number = models.CharField(max_length=30, unique=True)
    is_suspended = models.BooleanField(default=False)
    suspension_reason = models.TextField(blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.library_card_number})"

    @property
    def policy(self):
        return LoanPolicy.objects.filter(user_type=self.user.user_type, is_active=True).first()

    @property
    def active_loans_count(self):
        return self.loans.filter(status=BookLoan.Status.ACTIVE).count()

    @property
    def outstanding_fines_total(self):
        from django.db.models import Sum
        return self.fines.filter(is_paid=False, is_waived=False).aggregate(t=Sum("amount"))["t"] or Decimal("0")


# ======================================================================
# CIRCULATION
# ======================================================================

class BookLoan(models.Model):
    """One borrow event."""
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RETURNED = "returned", "Returned"
        LOST = "lost", "Reported Lost"

    copy = models.ForeignKey(BookCopy, on_delete=models.PROTECT, related_name="loans")
    member = models.ForeignKey(LibraryMember, on_delete=models.CASCADE, related_name="loans")
    borrowed_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField()
    returned_at = models.DateTimeField(null=True, blank=True)
    renewed_count = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    issued_by = models.ForeignKey(pm.User, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="issued_loans")
    returned_to = models.ForeignKey(pm.User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="received_returns")

    class Meta:
        ordering = ["-borrowed_at"]
        indexes = [models.Index(fields=["member", "status"]), models.Index(fields=["due_date"])]

    def __str__(self):
        return f"{self.member.user.username} - {self.copy.book.title}"

    @property
    def is_overdue(self):
        if self.status != self.Status.ACTIVE:
            return False
        return timezone.now().date() > self.due_date

    @property
    def days_overdue(self):
        if not self.is_overdue:
            return 0
        return (timezone.now().date() - self.due_date).days


class BookReservation(models.Model):
    """A hold placed on a Book (title-level, not a specific copy) while all copies are out."""
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        FULFILLED = "fulfilled", "Fulfilled"
        CANCELLED = "cancelled", "Cancelled"
        EXPIRED = "expired", "Expired"

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reservations")
    member = models.ForeignKey(LibraryMember, on_delete=models.CASCADE, related_name="reservations")
    reserved_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    fulfilled_loan = models.ForeignKey(BookLoan, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name="fulfilled_reservation")

    class Meta:
        ordering = ["reserved_at"]

    def __str__(self):
        return f"{self.member.user.username} - {self.book.title} ({self.status})"


# ======================================================================
# FINES
# ======================================================================

class LibraryFine(models.Model):
    """
    Append-only, like portal_api.Invoice: a fine is never mutated once
    raised, only marked paid/waived. See services.FineService for the
    portal_api.Invoice/FeeService integration note.
    """
    class Reason(models.TextChoices):
        OVERDUE = "overdue", "Overdue Return"
        LOST = "lost", "Lost Book"
        DAMAGED = "damaged", "Damaged Book"

    member = models.ForeignKey(LibraryMember, on_delete=models.CASCADE, related_name="fines")
    loan = models.ForeignKey(BookLoan, on_delete=models.SET_NULL, null=True, blank=True, related_name="fines")
    reason = models.CharField(max_length=20, choices=Reason.choices)
    amount = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    is_paid = models.BooleanField(default=False)
    is_waived = models.BooleanField(default=False)
    waived_by = models.ForeignKey(pm.User, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="waived_fines")
    waived_reason = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.member.user.username} - {self.reason} - {self.amount}"