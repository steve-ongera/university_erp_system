from django.contrib import admin

from . import models as lm


@admin.register(lm.Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "authors", "isbn", "category", "total_copies", "available_copies", "is_active")
    search_fields = ("title", "authors", "isbn")
    list_filter = ("category", "is_active")


@admin.register(lm.BookCopy)
class BookCopyAdmin(admin.ModelAdmin):
    list_display = ("accession_number", "book", "status", "shelf_location", "is_active")
    search_fields = ("accession_number", "book__title")
    list_filter = ("status", "is_active")


@admin.register(lm.LibraryMember)
class LibraryMemberAdmin(admin.ModelAdmin):
    list_display = ("library_card_number", "user", "is_suspended", "joined_at")
    search_fields = ("library_card_number", "user__username", "user__first_name", "user__last_name")
    list_filter = ("is_suspended",)


@admin.register(lm.BookLoan)
class BookLoanAdmin(admin.ModelAdmin):
    list_display = ("member", "copy", "borrowed_at", "due_date", "status", "is_overdue")
    search_fields = ("member__library_card_number", "copy__accession_number", "copy__book__title")
    list_filter = ("status",)


admin.site.register(lm.BookCategory)
admin.site.register(lm.LoanPolicy)
admin.site.register(lm.BookReservation)
admin.site.register(lm.LibraryFine)