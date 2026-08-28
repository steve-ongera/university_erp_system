# library/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"library/categories", views.BookCategoryViewSet, basename="library-category")
router.register(r"library/books", views.BookViewSet, basename="library-book")
router.register(r"library/copies", views.BookCopyViewSet, basename="library-copy")
router.register(r"library/policies", views.LoanPolicyViewSet, basename="library-policy")
router.register(r"library/members", views.LibraryMemberViewSet, basename="library-member")
router.register(r"library/loans", views.BookLoanViewSet, basename="library-loan")
router.register(r"library/reservations", views.BookReservationViewSet, basename="library-reservation")
router.register(r"library/fines", views.LibraryFineViewSet, basename="library-fine")

urlpatterns = router.urls + [
    path("library/me/profile/", views.MyLibraryProfileView.as_view(), name="library-my-profile"),
    path("library/me/loans/", views.MyLoansView.as_view(), name="library-my-loans"),
    path("library/dashboard/", views.LibraryDashboardView.as_view(), name="library-dashboard"),
]