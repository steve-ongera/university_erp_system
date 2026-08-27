"""Main URL configuration for the Muranga University Student Portal project."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("portal_api.urls")),
    path("api/v1/", include("communication.urls")),
    path("api/v1/", include("notifications.urls")),
    path("api/v1", include("library.urls")),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )