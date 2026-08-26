# notifications/services.py
from django.db import transaction

from portal_api import models as pm
from .constants import NotificationType


class NotificationService:
    """
    Single entry point for creating and reading notifications. Callers
    elsewhere in the codebase (communication.services, clearance
    approvals, grade publishing, security alerts, ...) should use this
    instead of touching portal_api.Notification directly — it's the one
    seam a future real-time push would hook into, even though the
    underlying model lives in portal_api.
    """

    @staticmethod
    def notify(recipient, title, message, notification_type=NotificationType.GENERAL):
        return pm.Notification.objects.create(
            recipient=recipient, title=title, message=message, notification_type=notification_type,
        )

    @staticmethod
    @transaction.atomic
    def bulk_notify(recipients, title, message, notification_type=NotificationType.GENERAL):
        rows = [
            pm.Notification(recipient=user, title=title, message=message, notification_type=notification_type)
            for user in recipients
        ]
        return pm.Notification.objects.bulk_create(rows)

    @staticmethod
    def for_user(user):
        return pm.Notification.objects.filter(recipient=user)

    @staticmethod
    def unread_count(user):
        return NotificationService.for_user(user).filter(is_read=False).count()

    @staticmethod
    def mark_read(notification: "pm.Notification"):
        if not notification.is_read:
            notification.is_read = True
            # portal_api.Notification has no read_at field — only update
            # what actually exists on the model.
            notification.save(update_fields=["is_read"])
        return notification

    @staticmethod
    def mark_all_read(user) -> int:
        """Returns the number of rows updated."""
        return NotificationService.for_user(user).filter(is_read=False).update(is_read=True)