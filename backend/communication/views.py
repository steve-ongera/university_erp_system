from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from portal_api import models as m
from . import models as cm
from . import serializers as cs
from . import services as csvc
from portal_api.views import IsStaffRole

# ======================================================================
# BROADCASTS
# ======================================================================

class MessageViewSet(viewsets.ModelViewSet):
    """
    Broadcast announcements. Listing is scoped to "messages I sent"
    (admin/registrar see everything). Creation always goes through the
    `compose` action, never the default POST, so
    CommunicationService can enforce the sender hierarchy and resolve
    the recipient list server-side.
    """
    queryset = cm.Message.objects.select_related("sender")
    serializer_class = cs.MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["audience_type", "status", "category"]
    search_fields = ["title", "body"]
    ordering_fields = ["created_at", "sent_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.user_type in ("admin", "registrar"):
            return qs
        return qs.filter(sender=user)

    def create(self, request, *args, **kwargs):
        return Response({"detail": "Use POST /messages/compose/ to send a message."},
                         status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=False, methods=["get"], url_path="audience-options")
    def audience_options(self, request):
        return Response(csvc.CommunicationService.audience_options(request.user))

    @action(detail=False, methods=["post"], url_path="compose")
    def compose(self, request):
        if not csvc.CommunicationPermissionService.can_compose(request.user):
            return Response({"detail": "Your role cannot send broadcast messages."},
                             status=status.HTTP_403_FORBIDDEN)

        serializer = cs.ComposeMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            message = csvc.CommunicationService.create_and_send(
                sender=request.user, title=data["title"], body=data["body"],
                audience_type=data["audience_type"], filters=data.get("filters"),
                channels=data.get("channels"), category=data.get("category"),
                scheduled_at=data.get("scheduled_at"), audience_label=data.get("audience_label", ""),
            )
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(cs.MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="recipients")
    def recipients(self, request, pk=None):
        message = self.get_object()
        rows = message.recipients.select_related("user")
        return Response([{
            "user": row.user.get_full_name(),
            "username": row.user.username,
            "is_read": row.is_read,
            "erp_delivered": row.erp_delivered,
            "email_delivered": row.email_delivered,
            "sms_delivered": row.sms_delivered,
        } for row in rows])


class MyInboxView(APIView):
    """The logged-in user's received announcements."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = (cm.MessageRecipient.objects.filter(user=request.user)
                .select_related("message", "message__sender")
                .order_by("-message__sent_at"))
        unread = rows.filter(is_read=False).count()
        return Response({"unread_count": unread, "results": cs.InboxItemSerializer(rows, many=True).data})


class MarkMessageReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        row = cm.MessageRecipient.objects.filter(pk=pk, user=request.user).first()
        if not row:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        csvc.CommunicationService.mark_read(row)
        return Response(cs.InboxItemSerializer(row).data)


# ======================================================================
# CONVERSATIONS
# ======================================================================

class ConversationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "category", "target_type"]
    search_fields = ["subject"]
    ordering_fields = ["created_at", "updated_at"]
    ordering = ["-updated_at"]

    def get_serializer_class(self):
        return cs.ConversationListSerializer if self.action == "list" else cs.ConversationSerializer

    def get_queryset(self):
        return (csvc.ConversationService.visible_to(self.request.user)
                .select_related("opened_by", "assigned_to", "department", "faculty", "target_lecturer__user")
                .prefetch_related("messages"))

    def create(self, request, *args, **kwargs):
        serializer = cs.OpenConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        conversation = csvc.ConversationService.open_conversation(
            opened_by=request.user, subject=data["subject"], body=data["body"],
            category=data["category"], target_type=data["target_type"],
            target_lecturer=data.get("target_lecturer"), department=data.get("department"),
            faculty=data.get("faculty"),
        )
        return Response(cs.ConversationSerializer(conversation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="reply")
    def reply(self, request, pk=None):
        conversation = self.get_object()
        serializer = cs.ReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        csvc.ConversationService.reply(conversation=conversation, sender=request.user,
                                        body=serializer.validated_data["body"])
        return Response(cs.ConversationSerializer(conversation).data)

    @action(detail=True, methods=["post"], url_path="assign", permission_classes=[IsStaffRole])
    def assign(self, request, pk=None):
        conversation = self.get_object()
        csvc.ConversationService.assign(conversation, request.user)
        return Response(cs.ConversationSerializer(conversation).data)

    @action(detail=True, methods=["post"], url_path="set-status", permission_classes=[IsStaffRole])
    def set_status(self, request, pk=None):
        conversation = self.get_object()
        new_status = request.data.get("status")
        if new_status not in cm.ConversationStatus.values:
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        csvc.ConversationService.set_status(conversation, new_status)
        return Response(cs.ConversationSerializer(conversation).data)


class ConversationTargetOptionsView(APIView):
    """
    What can the current user address a NEW conversation to? Students
    get the lecturers currently teaching them + their own
    department/faculty (for the Department/Dean routes); everyone else
    gets the fixed office list (mainly useful for staff-to-staff
    enquiries, e.g. a lecturer contacting Finance).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        options = {"target_types": list(cm.ConversationTargetType.choices)}
        student = getattr(request.user, "student_profile", None)
        if student:
            lecturer_ids = (m.LecturerUnitAllocation.objects
                             .filter(enrollments__student=student, enrollments__is_active=True, is_active=True)
                             .values_list("lecturer_id", flat=True).distinct())
            lecturers = m.Lecturer.objects.filter(id__in=lecturer_ids).select_related("user")
            options["lecturers"] = [{"id": l.id, "name": l.user.get_full_name()} for l in lecturers]
            if student.programme:
                options["department"] = {"id": student.programme.department_id,
                                          "name": student.programme.department.name}
                options["faculty"] = {"id": student.programme.faculty_id,
                                       "name": student.programme.faculty.name}
        return Response(options)