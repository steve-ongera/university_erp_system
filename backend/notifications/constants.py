# notifications/constants.py
#
# portal_api.Notification.notification_type is a plain CharField with
# no `choices=` constraint, so these are just conventions for callers
# to use consistently — the DB will accept any string up to 30 chars
# regardless.

class NotificationType:
    GENERAL = "general"
    COMMUNICATION = "communication"
    CONVERSATION = "conversation"
    GRADE = "grade"
    FEE = "fee"
    CLEARANCE = "clearance"
    HOSTEL = "hostel"
    SECURITY = "security"