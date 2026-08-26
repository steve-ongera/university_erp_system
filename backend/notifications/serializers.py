# notifications/serializers.py
from rest_framework import serializers

from portal_api import models as pm


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = pm.Notification
        fields = ["id", "title", "message", "notification_type", "is_read", "created_at"]
        read_only_fields = fields