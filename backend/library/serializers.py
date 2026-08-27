from rest_framework import serializers

from . import models as lm
from portal_api.serializers import UserSerializer


class BookCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = lm.BookCategory
        fields = "__all__"


class BookCopySerializer(serializers.ModelSerializer):
    class Meta:
        model = lm.BookCopy
        fields = "__all__"


class BookSerializer(serializers.ModelSerializer):
    category_detail = BookCategorySerializer(source="category", read_only=True)
    total_copies = serializers.ReadOnlyField()
    available_copies = serializers.ReadOnlyField()

    class Meta:
        model = lm.Book
        fields = "__all__"


class BookDetailSerializer(BookSerializer):
    copies = BookCopySerializer(many=True, read_only=True)

    class Meta(BookSerializer.Meta):
        pass


class LoanPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = lm.LoanPolicy
        fields = "__all__"


class LibraryMemberSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    active_loans_count = serializers.ReadOnlyField()
    outstanding_fines_total = serializers.ReadOnlyField()

    class Meta:
        model = lm.LibraryMember
        fields = "__all__"
        read_only_fields = ["library_card_number"]


class BookLoanSerializer(serializers.ModelSerializer):
    member_detail = LibraryMemberSerializer(source="member", read_only=True)
    copy_detail = BookCopySerializer(source="copy", read_only=True)
    book_detail = serializers.SerializerMethodField()
    is_overdue = serializers.ReadOnlyField()
    days_overdue = serializers.ReadOnlyField()

    class Meta:
        model = lm.BookLoan
        fields = "__all__"
        read_only_fields = ["borrowed_at", "returned_at", "renewed_count", "status",
                             "issued_by", "returned_to"]

    def get_book_detail(self, obj):
        return BookSerializer(obj.copy.book).data


class IssueLoanSerializer(serializers.Serializer):
    """Payload for CirculationService.issue_book."""
    member = serializers.PrimaryKeyRelatedField(queryset=lm.LibraryMember.objects.all())
    copy = serializers.PrimaryKeyRelatedField(
        queryset=lm.BookCopy.objects.filter(status=lm.BookCopy.Status.AVAILABLE)
    )


class ReturnLoanSerializer(serializers.Serializer):
    condition_notes = serializers.CharField(required=False, allow_blank=True, default="")
    is_lost = serializers.BooleanField(default=False)
    is_damaged = serializers.BooleanField(default=False)


class BookReservationSerializer(serializers.ModelSerializer):
    member_detail = LibraryMemberSerializer(source="member", read_only=True)
    book_detail = BookSerializer(source="book", read_only=True)

    class Meta:
        model = lm.BookReservation
        fields = "__all__"
        read_only_fields = ["reserved_at", "status", "fulfilled_loan"]


class LibraryFineSerializer(serializers.ModelSerializer):
    member_detail = LibraryMemberSerializer(source="member", read_only=True)

    class Meta:
        model = lm.LibraryFine
        fields = "__all__"
        read_only_fields = ["is_paid", "is_waived", "waived_by", "waived_reason", "paid_at", "created_at"]


class PayFineSerializer(serializers.Serializer):
    fine_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)