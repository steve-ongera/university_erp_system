from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from . import models as lm
from . import serializers as s
from . import services
from portal_api import models as pm


class IsLibraryStaff(permissions.BasePermission):
    """
    Who can run circulation/admin actions. Reuses portal_api roles rather
    than inventing a parallel role system. Swap/extend this set — or add
    a dedicated 'librarian' UserType to portal_api.User — if the library
    ever gets staff distinct from general 'staff'/'admin'/'registrar'.
    """
    STAFF_ROLES = {"admin", "staff", "registrar"}

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                     and request.user.user_type in self.STAFF_ROLES)


# ======================================================================
# CATALOG
# ======================================================================

class BookCategoryViewSet(viewsets.ModelViewSet):
    queryset = lm.BookCategory.objects.all()
    serializer_class = s.BookCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering = ["name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsLibraryStaff()]
        return [permissions.IsAuthenticated()]


class BookViewSet(viewsets.ModelViewSet):
    queryset = lm.Book.objects.select_related("category").prefetch_related("copies")
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "authors", "isbn"]
    filterset_fields = ["category", "is_active"]
    ordering_fields = ["title", "publication_year", "added_at"]
    ordering = ["title"]

    def get_serializer_class(self):
        return s.BookDetailSerializer if self.action == "retrieve" else s.BookSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsLibraryStaff()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["get"], url_path="availability")
    def availability(self, request, pk=None):
        book = self.get_object()
        return Response({
            "total_copies": book.total_copies,
            "available_copies": book.available_copies,
            "copies": s.BookCopySerializer(book.copies.all(), many=True).data,
        })


class BookCopyViewSet(viewsets.ModelViewSet):
    queryset = lm.BookCopy.objects.select_related("book")
    serializer_class = s.BookCopySerializer
    permission_classes = [IsLibraryStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["accession_number", "book__title"]
    filterset_fields = ["book", "status", "is_active"]
    ordering_fields = ["accession_number", "acquired_date"]
    ordering = ["accession_number"]


# ======================================================================
# MEMBERSHIP
# ======================================================================

class LoanPolicyViewSet(viewsets.ModelViewSet):
    queryset = lm.LoanPolicy.objects.all()
    serializer_class = s.LoanPolicySerializer
    permission_classes = [IsLibraryStaff]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["user_type", "is_active"]


class LibraryMemberViewSet(viewsets.ModelViewSet):
    queryset = lm.LibraryMember.objects.select_related("user")
    serializer_class = s.LibraryMemberSerializer
    permission_classes = [IsLibraryStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["library_card_number", "user__username", "user__first_name", "user__last_name"]
    filterset_fields = ["is_suspended"]
    ordering_fields = ["joined_at"]
    ordering = ["-joined_at"]

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        """Staff scan/search a user by reg/employee number, auto-creating their
        LibraryMember row on first visit (mirrors get_or_create_member)."""
        username = request.query_params.get("username")
        if not username:
            return Response({"detail": "username is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = pm.User.objects.filter(username=username).first()
        if not user:
            return Response({"detail": "No such user."}, status=status.HTTP_404_NOT_FOUND)
        member = services.MembershipService.get_or_create_member(user)
        eligibility = services.MembershipService.eligibility(member)
        eligibility.pop("policy", None)
        data = s.LibraryMemberSerializer(member).data
        data["eligibility"] = eligibility
        return Response(data)

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        member = self.get_object()
        services.MembershipService.suspend(member, request.data.get("reason", ""))
        return Response(s.LibraryMemberSerializer(member).data)

    @action(detail=True, methods=["post"], url_path="reinstate")
    def reinstate(self, request, pk=None):
        member = self.get_object()
        services.MembershipService.reinstate(member)
        return Response(s.LibraryMemberSerializer(member).data)


class MyLibraryProfileView(APIView):
    """Self-service: any authenticated user's own membership + loan history."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        member = services.MembershipService.get_or_create_member(request.user)
        eligibility = services.MembershipService.eligibility(member)
        eligibility.pop("policy", None)
        return Response({
            "member": s.LibraryMemberSerializer(member).data,
            "eligibility": eligibility,
            "active_loans": s.BookLoanSerializer(
                member.loans.filter(status=lm.BookLoan.Status.ACTIVE), many=True
            ).data,
            "loan_history": s.BookLoanSerializer(
                member.loans.exclude(status=lm.BookLoan.Status.ACTIVE).order_by("-borrowed_at")[:20], many=True
            ).data,
            "reservations": s.BookReservationSerializer(
                member.reservations.order_by("-reserved_at")[:20], many=True
            ).data,
            "fines": s.LibraryFineSerializer(member.fines.order_by("-created_at"), many=True).data,
        })


# ======================================================================
# CIRCULATION
# ======================================================================

class BookLoanViewSet(viewsets.ModelViewSet):
    queryset = lm.BookLoan.objects.select_related("member__user", "copy__book")
    serializer_class = s.BookLoanSerializer
    permission_classes = [IsLibraryStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["member__library_card_number", "member__user__username", "copy__book__title",
                      "copy__accession_number"]
    filterset_fields = ["status", "member"]
    ordering_fields = ["borrowed_at", "due_date"]
    ordering = ["-borrowed_at"]

    def create(self, request, *args, **kwargs):
        serializer = s.IssueLoanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            loan = services.CirculationService.issue_book(
                member=serializer.validated_data["member"],
                copy=serializer.validated_data["copy"],
                issued_by=request.user,
            )
        except services.LibraryError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.BookLoanSerializer(loan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="return")
    def return_book(self, request, pk=None):
        loan = self.get_object()
        serializer = s.ReturnLoanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            loan = services.CirculationService.return_book(
                loan, received_by=request.user, **serializer.validated_data
            )
        except services.LibraryError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.BookLoanSerializer(loan).data)

    @action(detail=True, methods=["post"], url_path="renew")
    def renew(self, request, pk=None):
        loan = self.get_object()
        try:
            loan = services.CirculationService.renew_loan(loan)
        except services.LibraryError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.BookLoanSerializer(loan).data)

    @action(detail=False, methods=["get"], url_path="overdue")
    def overdue(self, request):
        return Response(s.BookLoanSerializer(services.CirculationService.overdue_loans(), many=True).data)


class MyLoansView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        member = services.MembershipService.get_or_create_member(request.user)
        loans = member.loans.select_related("copy__book").order_by("-borrowed_at")
        return Response(s.BookLoanSerializer(loans, many=True).data)


# ======================================================================
# RESERVATIONS
# ======================================================================

class BookReservationViewSet(viewsets.ModelViewSet):
    queryset = lm.BookReservation.objects.select_related("member__user", "book")
    serializer_class = s.BookReservationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["status", "book", "member"]
    ordering_fields = ["reserved_at"]
    ordering = ["-reserved_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type not in IsLibraryStaff.STAFF_ROLES:
            return qs.filter(member__user=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        member = services.MembershipService.get_or_create_member(request.user)
        book = lm.Book.objects.filter(pk=request.data.get("book")).first()
        if not book:
            return Response({"detail": "Book not found."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            reservation = services.ReservationService.reserve(member, book)
        except services.LibraryError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(s.BookReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        services.ReservationService.cancel(reservation)
        return Response(s.BookReservationSerializer(reservation).data)


# ======================================================================
# FINES
# ======================================================================

class LibraryFineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = lm.LibraryFine.objects.select_related("member__user", "loan")
    serializer_class = s.LibraryFineSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["is_paid", "is_waived", "reason", "member"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.user_type not in IsLibraryStaff.STAFF_ROLES:
            return qs.filter(member__user=self.request.user)
        return qs

    @action(detail=False, methods=["post"], url_path="pay", permission_classes=[IsLibraryStaff])
    def pay(self, request):
        serializer = s.PayFineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = services.FineService.record_payment(serializer.validated_data["fine_ids"], request.user)
        return Response({"paid": count})

    @action(detail=True, methods=["post"], url_path="waive", permission_classes=[IsLibraryStaff])
    def waive(self, request, pk=None):
        fine = self.get_object()
        services.FineService.waive(fine, request.user, request.data.get("reason", ""))
        return Response(s.LibraryFineSerializer(fine).data)


# ======================================================================
# DASHBOARD
# ======================================================================

class LibraryDashboardView(APIView):
    permission_classes = [IsLibraryStaff]

    def get(self, request):
        return Response(services.LibraryReportService.dashboard_summary())