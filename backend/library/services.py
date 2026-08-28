"""
library/services.py — business logic layer, mirroring portal_api: views
stay thin, invariants (max books, overdue fines, reservation queueing)
are enforced here exactly once.

Integration note
-----------------
Fines are tracked in LibraryFine, a ledger separate from portal_api's
Invoice/FeeService. If the university later wants library fines paid
through the same M-Pesa/Daraja flow as tuition, the smallest change is:
in FineService.record_payment, instead of (or alongside) marking
LibraryFine.is_paid, call portal_api.services.FeeService's manual
payment path, or create a portal_api.models.Invoice(invoice_type=
Invoice.InvoiceType.OTHER, ...) for the fine amount and let the
existing wallet/allocation logic settle it. Left decoupled for now so
this app has zero write dependency on portal_api's fee tables.
"""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from . import models as lm
from portal_api import models as pm

RESERVATION_HOLD_DAYS = 3


class LibraryError(Exception):
    pass


# ======================================================================
# MEMBERSHIP
# ======================================================================

class MembershipService:
    @staticmethod
    def _generate_card_number(user: pm.User) -> str:
        return f"LIB-{user.username}".upper()

    @staticmethod
    def get_or_create_member(user: pm.User) -> lm.LibraryMember:
        member, _ = lm.LibraryMember.objects.get_or_create(
            user=user,
            defaults={"library_card_number": MembershipService._generate_card_number(user)},
        )
        return member

    @staticmethod
    def suspend(member: lm.LibraryMember, reason: str):
        member.is_suspended = True
        member.suspension_reason = reason
        member.save(update_fields=["is_suspended", "suspension_reason"])
        return member

    @staticmethod
    def reinstate(member: lm.LibraryMember):
        member.is_suspended = False
        member.suspension_reason = ""
        member.save(update_fields=["is_suspended", "suspension_reason"])
        return member

    @staticmethod
    def eligibility(member: lm.LibraryMember) -> dict:
        """Single source of truth for 'can this member borrow right now' —
        used by both the issue-book action and any frontend pre-check."""
        policy = member.policy
        if not policy:
            return {"eligible": False,
                     "reason": f"No loan policy configured for role '{member.user.user_type}'."}
        if member.is_suspended:
            return {"eligible": False, "reason": member.suspension_reason or "Membership is suspended."}
        if member.active_loans_count >= policy.max_books:
            return {"eligible": False, "reason": f"Already at the {policy.max_books}-book limit."}
        if member.outstanding_fines_total > 0:
            return {"eligible": False,
                     "reason": f"Outstanding fines of {member.outstanding_fines_total} must be cleared first."}
        return {"eligible": True, "reason": "", "policy": policy}


# ======================================================================
# CIRCULATION
# ======================================================================

class CirculationService:
    @staticmethod
    @transaction.atomic
    def issue_book(member: lm.LibraryMember, copy: lm.BookCopy, issued_by: pm.User) -> lm.BookLoan:
        if copy.status != lm.BookCopy.Status.AVAILABLE:
            raise LibraryError(f"Copy {copy.accession_number} is not available ({copy.status}).")

        check = MembershipService.eligibility(member)
        if not check["eligible"]:
            raise LibraryError(check["reason"])
        policy = check["policy"]

        loan = lm.BookLoan.objects.create(
            copy=copy, member=member,
            due_date=timezone.now().date() + timezone.timedelta(days=policy.loan_period_days),
            issued_by=issued_by,
        )
        copy.status = lm.BookCopy.Status.BORROWED
        copy.save(update_fields=["status"])
        return loan

    @staticmethod
    @transaction.atomic
    def return_book(loan: lm.BookLoan, received_by: pm.User, is_lost=False, is_damaged=False,
                     condition_notes="") -> lm.BookLoan:
        if loan.status != lm.BookLoan.Status.ACTIVE:
            raise LibraryError("This loan has already been closed.")

        overdue_days = loan.days_overdue  # computed BEFORE closing the loan
        loan.returned_at = timezone.now()
        loan.returned_to = received_by
        loan.status = lm.BookLoan.Status.LOST if is_lost else lm.BookLoan.Status.RETURNED
        loan.save(update_fields=["returned_at", "returned_to", "status"])

        copy = loan.copy
        if is_lost:
            copy.status = lm.BookCopy.Status.LOST
        elif is_damaged:
            copy.status = lm.BookCopy.Status.DAMAGED
            copy.condition_notes = condition_notes or copy.condition_notes
        else:
            copy.status = lm.BookCopy.Status.AVAILABLE
        copy.save(update_fields=["status", "condition_notes"])

        if overdue_days > 0:
            FineService.raise_overdue_fine(loan, overdue_days)
        if is_lost:
            FineService.raise_replacement_fine(loan)
        elif is_damaged:
            FineService.raise_damage_fine(loan)

        if not is_lost and not is_damaged:
            ReservationService.fulfill_next(copy.book)
        return loan

    @staticmethod
    @transaction.atomic
    def renew_loan(loan: lm.BookLoan) -> lm.BookLoan:
        if loan.status != lm.BookLoan.Status.ACTIVE:
            raise LibraryError("Only active loans can be renewed.")
        if loan.is_overdue:
            raise LibraryError("Overdue loans must be returned (and any fine paid) before renewal.")
        policy = loan.member.policy
        if not policy or loan.renewed_count >= policy.max_renewals:
            raise LibraryError("Maximum renewals reached for this loan.")
        if lm.BookReservation.objects.filter(
            book=loan.copy.book, status=lm.BookReservation.Status.PENDING
        ).exists():
            raise LibraryError("This title has pending reservations and cannot be renewed.")

        loan.due_date = loan.due_date + timezone.timedelta(days=policy.loan_period_days)
        loan.renewed_count += 1
        loan.save(update_fields=["due_date", "renewed_count"])
        return loan

    @staticmethod
    def overdue_loans():
        return lm.BookLoan.objects.filter(
            status=lm.BookLoan.Status.ACTIVE, due_date__lt=timezone.now().date()
        ).select_related("member__user", "copy__book")


# ======================================================================
# RESERVATIONS
# ======================================================================

class ReservationService:
    @staticmethod
    @transaction.atomic
    def reserve(member: lm.LibraryMember, book: lm.Book) -> lm.BookReservation:
        if book.available_copies > 0:
            raise LibraryError("Copies are currently available — borrow directly instead of reserving.")
        if lm.BookReservation.objects.filter(
            book=book, member=member, status=lm.BookReservation.Status.PENDING
        ).exists():
            raise LibraryError("You already have a pending reservation for this title.")

        return lm.BookReservation.objects.create(
            book=book, member=member,
            expires_at=timezone.now() + timezone.timedelta(days=RESERVATION_HOLD_DAYS),
        )

    @staticmethod
    def cancel(reservation: lm.BookReservation):
        reservation.status = lm.BookReservation.Status.CANCELLED
        reservation.save(update_fields=["status"])
        return reservation

    @staticmethod
    @transaction.atomic
    def fulfill_next(book: lm.Book):
        """Called automatically when a copy of `book` is returned — hands the
        copy to the oldest pending reservation instead of leaving it open shelf."""
        reservation = (
            lm.BookReservation.objects
            .filter(book=book, status=lm.BookReservation.Status.PENDING)
            .order_by("reserved_at")
            .first()
        )
        if not reservation:
            return None

        copy = book.copies.filter(status=lm.BookCopy.Status.AVAILABLE).first()
        if not copy:
            return None

        copy.status = lm.BookCopy.Status.RESERVED
        copy.save(update_fields=["status"])
        reservation.status = lm.BookReservation.Status.FULFILLED
        reservation.save(update_fields=["status"])
        return reservation

    @staticmethod
    def expire_stale():
        """Run periodically (cron/celery beat) to release holds nobody collected."""
        expired = lm.BookReservation.objects.filter(
            status=lm.BookReservation.Status.PENDING, expires_at__lt=timezone.now()
        )
        return expired.update(status=lm.BookReservation.Status.EXPIRED)


# ======================================================================
# FINES
# ======================================================================

class FineService:
    REPLACEMENT_FEE = Decimal("2500.00")   # override per-book later if needed
    DAMAGE_FEE = Decimal("500.00")

    @staticmethod
    def raise_overdue_fine(loan: lm.BookLoan, overdue_days: int) -> lm.LibraryFine:
        policy = loan.member.policy
        rate = policy.fine_per_day if policy else Decimal("10.00")
        amount = (rate * overdue_days).quantize(Decimal("0.01"))
        return lm.LibraryFine.objects.create(
            member=loan.member, loan=loan, reason=lm.LibraryFine.Reason.OVERDUE, amount=amount,
        )

    @staticmethod
    def raise_replacement_fine(loan: lm.BookLoan) -> lm.LibraryFine:
        return lm.LibraryFine.objects.create(
            member=loan.member, loan=loan, reason=lm.LibraryFine.Reason.LOST,
            amount=FineService.REPLACEMENT_FEE,
        )

    @staticmethod
    def raise_damage_fine(loan: lm.BookLoan) -> lm.LibraryFine:
        return lm.LibraryFine.objects.create(
            member=loan.member, loan=loan, reason=lm.LibraryFine.Reason.DAMAGED,
            amount=FineService.DAMAGE_FEE,
        )

    @staticmethod
    @transaction.atomic
    def record_payment(fine_ids: list, received_by: pm.User) -> int:
        fines = lm.LibraryFine.objects.filter(id__in=fine_ids, is_paid=False, is_waived=False)
        return fines.update(is_paid=True, paid_at=timezone.now())

    @staticmethod
    def waive(fine: lm.LibraryFine, waived_by: pm.User, reason: str):
        fine.is_waived = True
        fine.waived_by = waived_by
        fine.waived_reason = reason
        fine.save(update_fields=["is_waived", "waived_by", "waived_reason"])
        return fine


# ======================================================================
# DASHBOARD
# ======================================================================

class LibraryReportService:
    @staticmethod
    def dashboard_summary():
        from django.db.models import Count, Sum, Q
        from django.db.models.functions import TruncDate
 
        # ---- existing stat-card totals (unchanged) ----
        total_books = lm.Book.objects.filter(is_active=True).count()
        total_copies = lm.BookCopy.objects.filter(is_active=True).count()
        available_copies = lm.BookCopy.objects.filter(status=lm.BookCopy.Status.AVAILABLE).count()
        active_loans = lm.BookLoan.objects.filter(status=lm.BookLoan.Status.ACTIVE).count()
        overdue_loans = CirculationService.overdue_loans().count()
        pending_reservations = lm.BookReservation.objects.filter(
            status=lm.BookReservation.Status.PENDING
        ).count()
        outstanding_fines = lm.LibraryFine.objects.filter(
            is_paid=False, is_waived=False
        ).aggregate(t=Sum("amount"))["t"] or Decimal("0")
 
        popular_books = list(
            lm.Book.objects.annotate(loan_count=Count("copies__loans"))
            .order_by("-loan_count")
            .values("title", "loan_count")[:5]
        )
 
        # ---- NEW: circulation trend — loans issued per day, last 14 days ----
        # Chart 1 (line): shows whether circulation desk activity is rising/falling.
        since_date = (timezone.now() - timezone.timedelta(days=13)).date()
        trend_qs = (
            lm.BookLoan.objects.filter(borrowed_at__date__gte=since_date)
            .annotate(day=TruncDate("borrowed_at"))
            .values("day")
            .annotate(count=Count("id"))
        )
        trend_by_day = {row["day"]: row["count"] for row in trend_qs}
        loans_trend = [
            {
                "date": (since_date + timezone.timedelta(days=i)).isoformat(),
                "loans": trend_by_day.get(since_date + timezone.timedelta(days=i), 0),
            }
            for i in range(14)
        ]
 
        # ---- NEW: catalog composition by category ----
        # Chart 2 (bar): what the collection is actually made of.
        category_distribution = list(
            lm.BookCategory.objects.annotate(
                book_count=Count("books", filter=Q(books__is_active=True))
            )
            .filter(book_count__gt=0)
            .order_by("-book_count")
            .values("name", "book_count")[:8]
        )
        uncategorised = lm.Book.objects.filter(is_active=True, category__isnull=True).count()
        if uncategorised:
            category_distribution.append({"name": "Uncategorised", "book_count": uncategorised})
 
        # ---- NEW: outstanding fines broken down by reason ----
        # Chart 3 (pie): overdue vs lost vs damaged — tells the librarian
        # whether the fines pile is mostly late returns or replacement costs.
        fines_breakdown = list(
            lm.LibraryFine.objects.filter(is_paid=False, is_waived=False)
            .values("reason")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-total")
        )
 
        return {
            "totals": {
                "books": total_books,
                "copies": total_copies,
                "available_copies": available_copies,
                "active_loans": active_loans,
                "overdue_loans": overdue_loans,
                "pending_reservations": pending_reservations,
                "outstanding_fines": float(outstanding_fines),
            },
            "popular_books": popular_books,
            "loans_trend": loans_trend,
            "category_distribution": category_distribution,
            "fines_breakdown": fines_breakdown,
        }
 