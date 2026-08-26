"""
Communication module — data models.

Two distinct shapes, matching the two directions of communication in
the spec:

1. Message / MessageRecipient   — ONE-WAY broadcast ("Announcements").
   Admin -> Everyone, Admin -> Students, Dean -> Lecturers,
   HOD -> Department, Lecturer -> Class, etc. A single Message is
   composed once; it fans out into one MessageRecipient row per
   resolved recipient (this is what powers each person's Inbox and
   read/delivery tracking).

2. Conversation / ConversationMessage — TWO-WAY threads ("Enquiries /
   Complaints / Support"). A student (or anyone) opens a Conversation
   addressed to a person (a lecturer) or an organisational unit
   (department/HOD, faculty/Dean, Finance, Registry, Hostel, Admin).
   Staff reply inside the same thread; the whole history stays
   attached to the student, per the spec.

Drop this file's contents into the same Django app as models.py (or
`from .models import ...` as done below and keep it as its own
module — either works, Django doesn't care which file a model lives
in as long as it's picked up by the app's migrations).
"""
import uuid

from django.db import models

from .models import User, Student, Lecturer, Staff, Faculty, Department


# ======================================================================
# BROADCASTS / ANNOUNCEMENTS  (one sender -> many recipients)
# ======================================================================

class Channel(models.TextChoices):
    SMS = "sms", "SMS"
    EMAIL = "email", "Email"
    ERP = "erp", "ERP Notification"
    PUSH = "push", "Push Notification"


class AudienceType(models.TextChoices):
    ALL = "all", "All Users"
    STUDENTS = "students", "Students"
    LECTURERS = "lecturers", "Lecturers"
    STAFF = "staff", "Non-Academic Staff"
    CLASS = "class", "Specific Class (my current allocation)"
    CUSTOM = "custom", "Custom / Specific Users"


class MessageCategory(models.TextChoices):
    ANNOUNCEMENT = "announcement", "Announcement"
    ALERT = "alert", "Alert"
    REMINDER = "reminder", "Reminder"
    MEETING = "meeting", "Meeting Notice"


class MessageStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SCHEDULED = "scheduled", "Scheduled"
    SENDING = "sending", "Sending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


class Message(models.Model):
    """
    One outbound broadcast. `audience_filters` is a small JSON contract
    describing who resolves into the recipient list — see
    communication_services.CommunicationService.resolve_recipients for
    the shape (faculty/department/programme/year/status/student_ids/
    user_ids/lecturer_allocation, depending on audience_type).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="sent_messages")
    sender_role_snapshot = models.CharField(max_length=20, blank=True)

    title = models.CharField(max_length=200)
    body = models.TextField()
    category = models.CharField(max_length=20, choices=MessageCategory.choices, default=MessageCategory.ANNOUNCEMENT)

    audience_type = models.CharField(max_length=20, choices=AudienceType.choices)
    audience_filters = models.JSONField(default=dict, blank=True)
    audience_label = models.CharField(
        max_length=255, blank=True,
        help_text="Human readable summary, e.g. 'BSc Software Engineering - Year 4 - Active Students'.")

    channels = models.JSONField(default=list, blank=True, help_text="Subset of Channel values, e.g. ['sms','email','erp'].")

    status = models.CharField(max_length=20, choices=MessageStatus.choices, default=MessageStatus.DRAFT)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    recipient_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["sender", "created_at"]), models.Index(fields=["status", "scheduled_at"])]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"


class MessageRecipient(models.Model):
    """
    One row per resolved recipient — the audit trail AND the thing the
    Inbox actually reads from (per-user read state, per-channel
    delivery state).
    """
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="recipients")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_messages")

    erp_delivered = models.BooleanField(default=False)
    email_delivered = models.BooleanField(default=False)
    sms_delivered = models.BooleanField(default=False)
    delivery_error = models.TextField(blank=True)

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["message", "user"]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return f"{self.message.title} -> {self.user.username}"


# ======================================================================
# CONVERSATIONS / SUPPORT THREADS  (two-way)
# ======================================================================

class ConversationCategory(models.TextChoices):
    ENQUIRY = "enquiry", "General Enquiry"
    COMPLAINT = "complaint", "Complaint"
    ACADEMIC = "academic", "Academic"
    FINANCE = "finance", "Finance"
    HOSTEL = "hostel", "Hostel/Accommodation"
    OTHER = "other", "Other"


class ConversationTargetType(models.TextChoices):
    LECTURER = "lecturer", "A Lecturer"
    DEPARTMENT = "department", "Department / HOD"
    DEAN = "dean", "Dean / Faculty"
    REGISTRY = "registry", "Registry"
    FINANCE = "finance", "Finance Office"
    HOSTEL = "hostel", "Hostel Office"
    ADMIN = "admin", "University Admin"


class ConversationStatus(models.TextChoices):
    OPEN = "open", "Open"
    IN_PROGRESS = "in_progress", "In Progress"
    RESOLVED = "resolved", "Resolved"
    CLOSED = "closed", "Closed"


class Conversation(models.Model):
    """
    A two-way thread. Always opened by ONE user and routed to a
    target — a specific person (target_lecturer) or an organisational
    unit / fixed office (department, faculty, or a role bucket like
    Finance/Registry/Hostel/Admin). Staff pick it up via `assigned_to`.
    The full history stays attached to `opened_by` forever.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=ConversationCategory.choices, default=ConversationCategory.ENQUIRY)

    opened_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="opened_conversations")

    target_type = models.CharField(max_length=20, choices=ConversationTargetType.choices)
    target_lecturer = models.ForeignKey(Lecturer, on_delete=models.SET_NULL, null=True, blank=True,
                                         related_name="conversations")
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="conversations")
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="conversations")

    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="assigned_conversations")
    status = models.CharField(max_length=20, choices=ConversationStatus.choices, default=ConversationStatus.OPEN)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["opened_by", "status"]), models.Index(fields=["assigned_to", "status"])]

    def __str__(self):
        return f"{self.subject} ({self.get_status_display()})"


class ConversationMessage(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="conversation_messages")
    body = models.TextField()
    attachment = models.FileField(upload_to="conversation_attachments/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.conversation.subject} - {self.sender.username if self.sender else 'unknown'}"