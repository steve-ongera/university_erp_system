from rest_framework import viewsets, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from . import serializers as ns
from . import services as nsvc


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Read-only from the client's point of view — notifications are
    always created server-side via NotificationService, never POSTed
    directly by a client.
    """
    serializer_class = ns.NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return nsvc.NotificationService.for_user(self.request.user)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """
        One call for the navbar: unread count + the most recent
        notifications, so a poll tick is a single round trip instead
        of two.
        """
        qs = self.get_queryset()[:10]
        return Response({
            "unread_count": nsvc.NotificationService.unread_count(request.user),
            "results": ns.NotificationSerializer(qs, many=True).data,
        })

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        nsvc.NotificationService.mark_read(notification)
        return Response(ns.NotificationSerializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = nsvc.NotificationService.mark_all_read(request.user)
        return Response({"marked_read": updated})