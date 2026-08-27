from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"categories", views.BookCategoryViewSet, basename="library-category")
router.register(r"books", views.BookViewSet, basename="library-book")
router.register(r"copies", views.BookCopyViewSet, basename="library-copy")
router.register(r"policies", views.LoanPolicyViewSet, basename="library-policy")
router.register(r"members", views.LibraryMemberViewSet, basename="library-member")
router.register(r"loans", views.BookLoanViewSet, basename="library-loan")
router.register(r"reservations", views.BookReservationViewSet, basename="library-reservation")
router.register(r"fines", views.LibraryFineViewSet, basename="library-fine")

library_urlpatterns = [
    path("", include(router.urls)),
    path("me/profile/", views.MyLibraryProfileView.as_view(), name="library-my-profile"),
    path("me/loans/", views.MyLoansView.as_view(), name="library-my-loans"),
    path("dashboard/", views.LibraryDashboardView.as_view(), name="library-dashboard"),
]


urlpatterns = router.urls + library_urlpatterns