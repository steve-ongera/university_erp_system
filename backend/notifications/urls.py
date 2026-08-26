from rest_framework.routers import DefaultRouter

from . import views as nv

router = DefaultRouter()
router.register(r"notifications", nv.NotificationViewSet, basename="notifications")

urlpatterns = router.urls