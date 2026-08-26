from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views as cv


router = DefaultRouter()

router.register(r"messages", cv.MessageViewSet, basename="messages",)

router.register(r"conversations", cv.ConversationViewSet,basename="conversations",)

communication_urlpatterns = [
    path(
        "me/inbox/",
        cv.MyInboxView.as_view(),
        name="my-inbox",
    ),
    path(
        "me/inbox/<int:pk>/mark-read/",
        cv.MarkMessageReadView.as_view(),
        name="mark-message-read",
    ),
    path(
        "me/conversation-targets/",
        cv.ConversationTargetOptionsView.as_view(),
        name="conversation-targets",
    ),
]


urlpatterns = router.urls + communication_urlpatterns