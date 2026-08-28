"""
library/management/commands/seed_library.py
Muranga University Student Portal — Library module seeder.

Usage
-----
    python manage.py seed_library
    python manage.py seed_library --clear
    python manage.py seed_library --members 40 --loans 60

Design notes
------------
- This command does NOT create portal_api data (Users, Students,
  Lecturers, Staff, Departments). It assumes portal_api has already
  been seeded/populated and simply FETCHES what it needs from there —
  mirroring how library/models.py's LibraryMember is meant to be a thin
  bridge over portal_api.User rather than a parallel identity store.
- If no suitable portal_api data exists (no Users, no Departments) the
  command aborts early with a clear message telling the operator to
  seed portal_api first, instead of silently creating fake people.
- Idempotent-ish: uses get_or_create for catalog data (categories,
  books, copies, policies) so re-running without --clear won't
  duplicate the catalog. Membership/circulation data is only created
  for users that don't already have a LibraryMember, so re-running is
  safe there too. Use --clear to wipe library app data and start over.
"""
import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from library import models as lm
from portal_api import models as pm


# ======================================================================
# STATIC SEED DATA (catalog only — no people, no departments invented)
# ======================================================================

GENERAL_CATEGORIES = [
    ("Fiction", "General fiction and literature."),
    ("Reference", "Dictionaries, encyclopaedias and general reference works."),
    ("Periodicals", "Journals, magazines and serials."),
    ("Biography", "Biographies and memoirs."),
]

# (title, authors, publisher, edition, year, isbn)
SAMPLE_BOOKS = [
    ("Introduction to Algorithms", "Cormen, Leiserson, Rivest, Stein", "MIT Press", "3rd", 2009, "9780262033848"),
    ("Clean Code", "Robert C. Martin", "Prentice Hall", "1st", 2008, "9780132350884"),
    ("Design Patterns", "Gamma, Helm, Johnson, Vlissides", "Addison-Wesley", "1st", 1994, "9780201633610"),
    ("Database System Concepts", "Silberschatz, Korth, Sudarshan", "McGraw-Hill", "7th", 2019, "9780078022159"),
    ("Computer Networking: A Top-Down Approach", "Kurose, Ross", "Pearson", "7th", 2016, "9780133594140"),
    ("Operating System Concepts", "Silberschatz, Galvin, Gagne", "Wiley", "10th", 2018, "9781118063330"),
    ("Fundamentals of Nursing", "Potter, Perry", "Elsevier", "10th", 2020, "9780323677721"),
    ("Gray's Anatomy for Students", "Drake, Vogl, Mitchell", "Elsevier", "4th", 2019, "9780323393041"),
    ("Principles of Economics", "N. Gregory Mankiw", "Cengage", "8th", 2017, "9781305585126"),
    ("Financial Accounting", "Weygandt, Kimmel, Kieso", "Wiley", "10th", 2018, "9781119494575"),
    ("Business Statistics", "Levine, Szabat, Stephan", "Pearson", "4th", 2016, "9780134685712"),
    ("Things Fall Apart", "Chinua Achebe", "Heinemann", "1st", 1958, "9780435905255"),
    ("Half of a Yellow Sun", "Chimamanda Ngozi Adichie", "Farafina", "1st", 2006, "9780007200283"),
    ("A River Between", "Ngugi wa Thiong'o", "Heinemann", "1st", 1965, "9780435905488"),
    ("The Concise Oxford English Dictionary", "Oxford", "Oxford University Press", "12th", 2011, "9780199601080"),
    ("Research Methods for Business Students", "Saunders, Lewis, Thornhill", "Pearson", "8th", 2019, "9781292208787"),
    ("Human Resource Management", "Gary Dessler", "Pearson", "16th", 2020, "9780135172780"),
    ("Marketing Management", "Philip Kotler, Kevin Lane Keller", "Pearson", "15th", 2016, "9780133856460"),
    ("Software Engineering", "Ian Sommerville", "Pearson", "10th", 2015, "9780133943030"),
    ("Artificial Intelligence: A Modern Approach", "Russell, Norvig", "Pearson", "4th", 2020, "9780134610993"),
]

SHELF_PREFIXES = ["A", "B", "C", "D", "E"]


class Command(BaseCommand):
    help = "Seed the library app using existing portal_api data (users/departments)."

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true",
                             help="Delete existing library app data before seeding.")
        parser.add_argument("--members", type=int, default=30,
                             help="Max number of existing portal_api Users to turn into LibraryMembers.")
        parser.add_argument("--loans", type=int, default=40,
                             help="Approximate number of BookLoan records to create.")
        parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")

    def handle(self, *args, **options):
        random.seed(options["seed"])

        if options["clear"]:
            self._clear()

        with transaction.atomic():
            departments = list(pm.Department.objects.filter(is_active=True))
            if not departments:
                self.stdout.write(self.style.ERROR(
                    "No portal_api.Department records found. Seed portal_api first — "
                    "this command only fetches existing data, it does not create it."))
                return

            categories = self._seed_categories(departments)
            books = self._seed_books(categories)
            copies = self._seed_copies(books)
            policies = self._seed_policies()

            eligible_users = self._fetch_eligible_users(options["members"])
            if not eligible_users:
                self.stdout.write(self.style.WARNING(
                    "No eligible portal_api.User records found (student/lecturer/staff). "
                    "Catalog was seeded but no members/loans/fines were created."))
                self._summary(categories, books, copies, policies, [], [], [], [])
                return

            members = self._seed_members(eligible_users)
            loans = self._seed_loans(members, copies, target_count=options["loans"])
            reservations = self._seed_reservations(members, books)
            fines = self._seed_fines(loans)

            self._summary(categories, books, copies, policies, members, loans, reservations, fines)

    # ------------------------------------------------------------------
    # CLEAR
    # ------------------------------------------------------------------
    def _clear(self):
        self.stdout.write("Clearing existing library data...")
        lm.LibraryFine.objects.all().delete()
        lm.BookReservation.objects.all().delete()
        lm.BookLoan.objects.all().delete()
        lm.LibraryMember.objects.all().delete()
        lm.BookCopy.objects.all().delete()
        lm.Book.objects.all().delete()
        lm.BookCategory.objects.all().delete()
        lm.LoanPolicy.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("Library data cleared."))

    # ------------------------------------------------------------------
    # CATALOG
    # ------------------------------------------------------------------
    def _seed_categories(self, departments):
        categories = []
        for name, description in GENERAL_CATEGORIES:
            cat, _ = lm.BookCategory.objects.get_or_create(
                name=name, defaults={"description": description})
            categories.append(cat)

        # One department-linked category per existing Department, reusing
        # the department's own name rather than inventing a new subject.
        for dept in departments:
            cat, _ = lm.BookCategory.objects.get_or_create(
                name=f"{dept.name} Collection",
                defaults={"description": f"Department collection for {dept.name}.", "department": dept})
            categories.append(cat)

        self.stdout.write(self.style.SUCCESS(f"Categories ready: {len(categories)}"))
        return categories

    def _seed_books(self, categories):
        books = []
        for title, authors, publisher, edition, year, isbn in SAMPLE_BOOKS:
            book, _ = lm.Book.objects.get_or_create(
                isbn=isbn,
                defaults={
                    "title": title,
                    "authors": authors,
                    "publisher": publisher,
                    "edition": edition,
                    "publication_year": year,
                    "category": random.choice(categories),
                },
            )
            books.append(book)
        self.stdout.write(self.style.SUCCESS(f"Books ready: {len(books)}"))
        return books

    def _seed_copies(self, books):
        copies = []
        for book in books:
            n_copies = random.randint(2, 5)
            existing = book.copies.count()
            for i in range(existing, n_copies):
                accession = f"LIB-{book.pk:04d}-{i + 1:02d}"
                copy, _ = lm.BookCopy.objects.get_or_create(
                    accession_number=accession,
                    defaults={
                        "book": book,
                        "shelf_location": f"{random.choice(SHELF_PREFIXES)}-{random.randint(1, 30):02d}",
                        "status": lm.BookCopy.Status.AVAILABLE,
                    },
                )
                copies.append(copy)
            copies.extend(book.copies.all())
        copies = list({c.pk: c for c in copies}.values())  # dedupe
        self.stdout.write(self.style.SUCCESS(f"Book copies ready: {len(copies)}"))
        return copies

    def _seed_policies(self):
        defaults_by_type = {
            pm.User.UserType.STUDENT: dict(max_books=3, loan_period_days=14, max_renewals=1,
                                            fine_per_day=Decimal("10.00")),
            pm.User.UserType.LECTURER: dict(max_books=10, loan_period_days=30, max_renewals=2,
                                             fine_per_day=Decimal("5.00")),
            pm.User.UserType.STAFF: dict(max_books=5, loan_period_days=21, max_renewals=2,
                                          fine_per_day=Decimal("5.00")),
            pm.User.UserType.LIBRARIAN: dict(max_books=15, loan_period_days=30, max_renewals=3,
                                              fine_per_day=Decimal("0.00")),
        }
        policies = []
        # Only create policies for user_types that actually exist among
        # portal_api users, rather than every choice in the enum.
        present_types = set(pm.User.objects.values_list("user_type", flat=True).distinct())
        for user_type in present_types:
            defaults = defaults_by_type.get(
                user_type,
                dict(max_books=3, loan_period_days=14, max_renewals=1, fine_per_day=Decimal("10.00")),
            )
            policy, _ = lm.LoanPolicy.objects.get_or_create(user_type=user_type, defaults=defaults)
            policies.append(policy)
        self.stdout.write(self.style.SUCCESS(f"Loan policies ready: {len(policies)}"))
        return policies

    # ------------------------------------------------------------------
    # PEOPLE — fetched from portal_api, never created here
    # ------------------------------------------------------------------
    def _fetch_eligible_users(self, limit):
        """Borrowing rights extend to students, lecturers, staff and librarians.
        Pulled straight from portal_api.User — no new identities are created."""
        eligible_types = [
            pm.User.UserType.STUDENT,
            pm.User.UserType.LECTURER,
            pm.User.UserType.STAFF,
            pm.User.UserType.LIBRARIAN,
        ]
        users = list(
            pm.User.objects.filter(user_type__in=eligible_types, is_active=True)
            .exclude(library_membership__isnull=False)  # skip users already a LibraryMember
            .order_by("?")[:limit]
        )
        self.stdout.write(f"Eligible portal_api users fetched (no existing membership): {len(users)}")
        return users

    def _seed_members(self, users):
        members = []
        for user in users:
            card_number = f"LIB-{user.username}"
            member, created = lm.LibraryMember.objects.get_or_create(
                user=user, defaults={"library_card_number": card_number})
            members.append(member)
        self.stdout.write(self.style.SUCCESS(f"Library members ready: {len(members)}"))
        return members

    # ------------------------------------------------------------------
    # CIRCULATION
    # ------------------------------------------------------------------
    def _seed_loans(self, members, copies, target_count):
        if not members or not copies:
            return []

        loans = []
        available_copies = [c for c in copies if c.status == lm.BookCopy.Status.AVAILABLE]
        random.shuffle(available_copies)
        now = timezone.now()

        target_count = min(target_count, len(available_copies))
        for i in range(target_count):
            copy = available_copies[i]
            member = random.choice(members)
            policy = member.policy
            loan_days = policy.loan_period_days if policy else 14

            # Mix of loan states: ~55% active (some overdue), ~40% returned, ~5% lost.
            roll = random.random()
            borrowed_days_ago = random.randint(1, loan_days + 20)
            due_date = (now - timedelta(days=borrowed_days_ago) + timedelta(days=loan_days)).date()

            if roll < 0.55:
                status = lm.BookLoan.Status.ACTIVE
                copy.status = lm.BookCopy.Status.BORROWED
                returned_at = None
            elif roll < 0.95:
                status = lm.BookLoan.Status.RETURNED
                copy.status = lm.BookCopy.Status.AVAILABLE
                returned_at = now - timedelta(days=max(borrowed_days_ago - random.randint(0, loan_days), 0))
            else:
                status = lm.BookLoan.Status.LOST
                copy.status = lm.BookCopy.Status.LOST
                returned_at = None

            loan = lm.BookLoan.objects.create(
                copy=copy,
                member=member,
                due_date=due_date,
                status=status,
                returned_at=returned_at,
                renewed_count=random.choice([0, 0, 0, 1, 2]),
            )
            # borrowed_at is auto_now_add; backdate it to make due_date coherent.
            lm.BookLoan.objects.filter(pk=loan.pk).update(
                borrowed_at=now - timedelta(days=borrowed_days_ago))
            copy.save(update_fields=["status"])
            loans.append(loan)

        self.stdout.write(self.style.SUCCESS(f"Book loans created: {len(loans)}"))
        return loans

    def _seed_reservations(self, members, books):
        reservations = []
        # Reserve books that currently have zero available copies — a
        # realistic trigger for a hold, computed live rather than guessed.
        fully_borrowed = [b for b in books if b.available_copies == 0]
        now = timezone.now()
        for book in fully_borrowed[:10]:
            member = random.choice(members)
            reservation, created = lm.BookReservation.objects.get_or_create(
                book=book, member=member,
                defaults={
                    "expires_at": now + timedelta(days=random.randint(2, 7)),
                    "status": lm.BookReservation.Status.PENDING,
                },
            )
            if created:
                reservations.append(reservation)
        self.stdout.write(self.style.SUCCESS(f"Book reservations created: {len(reservations)}"))
        return reservations

    def _seed_fines(self, loans):
        fines = []
        for loan in loans:
            if loan.status == lm.BookLoan.Status.LOST:
                fines.append(lm.LibraryFine.objects.create(
                    member=loan.member, loan=loan, reason=lm.LibraryFine.Reason.LOST,
                    amount=Decimal("2000.00")))
                continue

            if loan.is_overdue:
                policy = loan.member.policy
                rate = policy.fine_per_day if policy else Decimal("10.00")
                fines.append(lm.LibraryFine.objects.create(
                    member=loan.member, loan=loan, reason=lm.LibraryFine.Reason.OVERDUE,
                    amount=rate * loan.days_overdue))
            elif loan.status == lm.BookLoan.Status.RETURNED and loan.returned_at \
                    and loan.returned_at.date() > loan.due_date:
                policy = loan.member.policy
                rate = policy.fine_per_day if policy else Decimal("10.00")
                days_late = (loan.returned_at.date() - loan.due_date).days
                fine = lm.LibraryFine.objects.create(
                    member=loan.member, loan=loan, reason=lm.LibraryFine.Reason.OVERDUE,
                    amount=rate * days_late)
                # Roughly half of past fines are already settled.
                if random.random() < 0.5:
                    fine.is_paid = True
                    fine.paid_at = loan.returned_at
                    fine.save(update_fields=["is_paid", "paid_at"])
                fines.append(fine)

        self.stdout.write(self.style.SUCCESS(f"Library fines created: {len(fines)}"))
        return fines

    # ------------------------------------------------------------------
    def _summary(self, categories, books, copies, policies, members, loans, reservations, fines):
        self.stdout.write(self.style.SUCCESS(
            "\nLibrary seeding complete:\n"
            f"  Categories:    {len(categories)}\n"
            f"  Books:         {len(books)}\n"
            f"  Copies:        {len(copies)}\n"
            f"  Loan policies: {len(policies)}\n"
            f"  Members:       {len(members)}\n"
            f"  Loans:         {len(loans)}\n"
            f"  Reservations:  {len(reservations)}\n"
            f"  Fines:         {len(fines)}"
        ))