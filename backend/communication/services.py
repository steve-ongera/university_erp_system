"""
Communication module — business logic.

Two service classes carry the actual rules described in the spec:

CommunicationPermissionService
    Enforces the sender hierarchy (who is allowed to broadcast to whom)
    server-side, and *pins* scope-restricted senders (Dean/HOD/Lecturer)
    to their own faculty/department/class so a forged payload can't
    widen their reach.

CommunicationService
    Resolves an audience_type + filters into an actual list of Users,
    fans a Message out into MessageRecipient rows, and "sends" over
    whichever channels were picked (email uses Django's send_mail;
    SMS is stubbed — plug a gateway into _send_sms_stub when ready).

ConversationService
    Opens/replies/assigns/resolves two-way threads and works out who
    is allowed to see which conversations.
"""
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from . import models as m
from . import models as cm


# ======================================================================
# PERMISSIONS / HIERARCHY
# ======================================================================

class CommunicationPermissionService:
    """
    Admin/Registrar -> anyone, any scope.
    Dean            -> lecturers/students within the faculty they head.
    COD (HOD)       -> lecturers/students within the department they head.
    Finance         -> students (fee-related broadcasts).
    Exam Office     -> students/lecturers (results/exam notices).
    Hostel Warden   -> students (accommodation notices).
    Lecturer        -> only students in a class they are CURRENTLY
                       allocated to teach (audience_type=CLASS).
    Everyone else (incl. students) cannot send broadcasts — they can
    still open/reply to Conversations.
    """

    BROADCAST_ROLES = {"admin", "registrar", "dean", "cod", "finance", "exam_office", "lecturer", "hostel_warden"}

    @staticmethod
    def can_compose(user) -> bool:
        return user.user_type in CommunicationPermissionService.BROADCAST_ROLES

    @staticmethod
    def allowed_audience_types(user):
        role = user.user_type
        if role in ("admin", "registrar"):
            return [cm.AudienceType.ALL, cm.AudienceType.STUDENTS, cm.AudienceType.LECTURERS,
                     cm.AudienceType.STAFF, cm.AudienceType.CUSTOM]
        if role in ("dean", "cod"):
            return [cm.AudienceType.LECTURERS, cm.AudienceType.STUDENTS]
        if role == "finance":
            return [cm.AudienceType.STUDENTS]
        if role == "exam_office":
            return [cm.AudienceType.STUDENTS, cm.AudienceType.LECTURERS]
        if role == "hostel_warden":
            return [cm.AudienceType.STUDENTS]
        if role == "lecturer":
            return [cm.AudienceType.CLASS]
        return []

    @staticmethod
    def validate_and_scope_filters(user, audience_type, filters):
        """Raises PermissionError if not allowed; otherwise returns a
        (possibly narrowed) filters dict with scope forcibly pinned."""
        allowed = CommunicationPermissionService.allowed_audience_types(user)
        if audience_type not in allowed:
            raise PermissionError(f"Your role ({user.user_type}) may not send to audience_type='{audience_type}'.")

        filters = dict(filters or {})

        if user.user_type == "dean":
            faculty = m.Faculty.objects.filter(dean=user).first()
            if not faculty:
                raise PermissionError("You are not registered as the Dean of any faculty.")
            filters["faculty"] = faculty.id
            filters.pop("department", None)

        elif user.user_type == "cod":
            department = m.Department.objects.filter(head_of_department=user).first()
            if not department:
                raise PermissionError("You are not registered as HOD of any department.")
            filters["department"] = department.id
            filters.pop("faculty", None)

        elif user.user_type == "lecturer":
            allocation_id = filters.get("lecturer_allocation")
            if not allocation_id:
                raise PermissionError("Select the specific class (unit allocation) you want to message.")
            allocation = m.LecturerUnitAllocation.objects.filter(
                pk=allocation_id, lecturer__user=user, is_active=True
            ).first()
            if not allocation:
                raise PermissionError("You may only message classes you are currently allocated to teach.")
            filters = {"lecturer_allocation": allocation.id}

        return filters


# ======================================================================
# BROADCASTS
# ======================================================================

class CommunicationService:

    # ------------------------------------------------------------------
    # Audience resolution
    # ------------------------------------------------------------------
    @staticmethod
    def resolve_recipients(audience_type, filters):
        filters = filters or {}

        if audience_type == cm.AudienceType.ALL:
            return m.User.objects.filter(is_active=True)

        if audience_type == cm.AudienceType.STUDENTS:
            student_qs = m.Student.objects.select_related("user", "programme")
            if filters.get("faculty"):
                student_qs = student_qs.filter(programme__faculty_id=filters["faculty"])
            if filters.get("department"):
                student_qs = student_qs.filter(programme__department_id=filters["department"])
            if filters.get("programme"):
                student_qs = student_qs.filter(programme_id=filters["programme"])
            if filters.get("year"):
                student_qs = student_qs.filter(current_year=filters["year"])
            if filters.get("status"):
                student_qs = CommunicationService._apply_student_status_filter(student_qs, filters["status"])
            if filters.get("student_ids"):
                student_qs = student_qs.filter(id__in=filters["student_ids"])
            return m.User.objects.filter(id__in=student_qs.values_list("user_id", flat=True))

        if audience_type == cm.AudienceType.LECTURERS:
            lecturer_qs = m.Lecturer.objects.filter(is_active=True)
            if filters.get("faculty"):
                lecturer_qs = lecturer_qs.filter(department__faculty_id=filters["faculty"])
            if filters.get("department"):
                lecturer_qs = lecturer_qs.filter(department_id=filters["department"])
            return m.User.objects.filter(id__in=lecturer_qs.values_list("user_id", flat=True))

        if audience_type == cm.AudienceType.STAFF:
            staff_qs = m.Staff.objects.filter(is_active=True)
            if filters.get("department"):
                staff_qs = staff_qs.filter(department_id=filters["department"])
            return m.User.objects.filter(id__in=staff_qs.values_list("user_id", flat=True))

        if audience_type == cm.AudienceType.CLASS:
            allocation = m.LecturerUnitAllocation.objects.filter(pk=filters.get("lecturer_allocation")).first()
            if not allocation:
                return m.User.objects.none()
            student_ids = allocation.roster().values_list("student__user_id", flat=True)
            return m.User.objects.filter(id__in=student_ids)

        if audience_type == cm.AudienceType.CUSTOM:
            return m.User.objects.filter(id__in=filters.get("user_ids", []))

        return m.User.objects.none()

    @staticmethod
    def _apply_student_status_filter(student_qs, status_filter):
        if status_filter == "active":
            return student_qs.filter(status=m.Student.Status.ACTIVE)
        if status_filter == "outstanding_fees":
            return student_qs.filter(id__in=CommunicationService._students_with_outstanding_fees())
        if status_filter == "not_registered":
            return student_qs.filter(id__in=CommunicationService._students_not_registered())
        return student_qs

    @staticmethod
    def _students_with_outstanding_fees():
        """Bulk equivalent of FeeService.invoice_balance() > 0, without
        an N+1 query per student."""
        due_rows = m.Invoice.objects.filter(is_active=True).values("student").annotate(due=Sum("amount_due"))
        due_by_student = {r["student"]: r["due"] or Decimal("0") for r in due_rows}

        paid_rows = (m.InvoiceAllocation.objects.filter(invoice__is_active=True)
                     .values("invoice__student").annotate(paid=Sum("amount_applied")))
        paid_by_student = {r["invoice__student"]: r["paid"] or Decimal("0") for r in paid_rows}

        return [sid for sid, due in due_by_student.items() if due - paid_by_student.get(sid, Decimal("0")) > 0]

    @staticmethod
    def _students_not_registered(semester=None):
        semester = semester or m.Semester.objects.filter(is_current=True).first()
        if not semester:
            return []
        registered_ids = m.UnitRegistration.objects.filter(
            semester=semester, is_active=True
        ).values_list("student_id", flat=True).distinct()
        return list(m.Student.objects.exclude(id__in=registered_ids).values_list("id", flat=True))

    # ------------------------------------------------------------------
    # Compose / send
    # ------------------------------------------------------------------
    @staticmethod
    @transaction.atomic
    def create_and_send(*, sender, title, body, audience_type, filters=None, channels=None,
                         category=cm.MessageCategory.ANNOUNCEMENT, scheduled_at=None, audience_label=""):
        if not CommunicationPermissionService.can_compose(sender):
            raise PermissionError("Your role is not permitted to send broadcast messages.")

        scoped_filters = CommunicationPermissionService.validate_and_scope_filters(sender, audience_type, filters)

        message = cm.Message.objects.create(
            sender=sender, sender_role_snapshot=sender.user_type, title=title, body=body,
            category=category, audience_type=audience_type, audience_filters=scoped_filters,
            audience_label=audience_label, channels=channels or [cm.Channel.ERP],
            status=cm.MessageStatus.SCHEDULED if scheduled_at else cm.MessageStatus.SENDING,
            scheduled_at=scheduled_at,
        )

        if scheduled_at and scheduled_at > timezone.now():
            # Left as SCHEDULED — a periodic task should call
            # CommunicationService.dispatch(message) once it's due.
            return message

        return CommunicationService.dispatch(message)

    @staticmethod
    @transaction.atomic
    def dispatch(message: cm.Message) -> cm.Message:
        recipients = CommunicationService.resolve_recipients(message.audience_type, message.audience_filters)
        if message.sender_id:
            recipients = recipients.exclude(pk=message.sender_id)
        recipients = list(recipients.distinct())

        rows = []
        for user in recipients:
            row = cm.MessageRecipient(message=message, user=user)
            if cm.Channel.ERP in message.channels:
                row.erp_delivered = True
            if cm.Channel.EMAIL in message.channels:
                row.email_delivered = CommunicationService._send_email_stub(user, message)
            if cm.Channel.SMS in message.channels:
                row.sms_delivered = CommunicationService._send_sms_stub(user, message)
            rows.append(row)

        cm.MessageRecipient.objects.bulk_create(rows, ignore_conflicts=True)

        message.recipient_count = len(rows)
        message.status = cm.MessageStatus.SENT
        message.sent_at = timezone.now()
        message.save(update_fields=["recipient_count", "status", "sent_at"])

        # Also drop a plain in-app Notification so it surfaces in the
        # existing bell-icon notification list, not only the Inbox.
        m.Notification.objects.bulk_create([
            m.Notification(recipient=user, title=message.title, message=message.body,
                            notification_type="communication")
            for user in recipients
        ])
        return message

    @staticmethod
    def _send_email_stub(user, message) -> bool:
        if not user.email:
            return False
        try:
            send_mail(
                subject=message.title, message=message.body,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@muranga.ac.ke"),
                recipient_list=[user.email], fail_silently=True,
            )
            return True
        except Exception:
            return False

    @staticmethod
    def _send_sms_stub(user, message) -> bool:
        # Plug an SMS gateway (e.g. Africa's Talking) in here. Stubbed
        # so the rest of the module works end-to-end before that
        # integration exists.
        return bool(user.phone)

    @staticmethod
    def mark_read(message_recipient: cm.MessageRecipient) -> cm.MessageRecipient:
        if not message_recipient.is_read:
            message_recipient.is_read = True
            message_recipient.read_at = timezone.now()
            message_recipient.save(update_fields=["is_read", "read_at"])
        return message_recipient

    # ------------------------------------------------------------------
    # UI helpers
    # ------------------------------------------------------------------
    @staticmethod
    def audience_options(user):
        """Everything the compose screen needs: which audience_types
        this role may use, plus the option lists (faculties/departments
        /programmes for broad senders, or "classes I teach" for
        lecturers) to build the filter form."""
        options = {"audience_types": CommunicationPermissionService.allowed_audience_types(user)}

        if user.user_type == "lecturer":
            lecturer = getattr(user, "lecturer_profile", None)
            allocations = (m.LecturerUnitAllocation.objects.filter(lecturer=lecturer, is_active=True)
                           .select_related("course", "programme") if lecturer else [])
            options["allocations"] = [
                {"id": a.id, "label": f"{a.course.code} - {a.programme.code} Y{a.year}S{a.programme_semester}"}
                for a in allocations
            ]
        else:
            options["faculties"] = list(m.Faculty.objects.filter(is_active=True).values("id", "name", "code"))
            options["departments"] = list(
                m.Department.objects.filter(is_active=True).values("id", "name", "code", "faculty_id"))
            options["programmes"] = list(
                m.Programme.objects.filter(is_active=True).values("id", "name", "code", "department_id", "faculty_id"))

        return options


# ======================================================================
# CONVERSATIONS
# ======================================================================

class ConversationService:

    @staticmethod
    @transaction.atomic
    def open_conversation(*, opened_by, subject, body, category, target_type,
                           target_lecturer=None, department=None, faculty=None, attachment=None):
        conversation = cm.Conversation.objects.create(
            subject=subject, category=category, opened_by=opened_by, target_type=target_type,
            target_lecturer=target_lecturer, department=department, faculty=faculty,
        )
        cm.ConversationMessage.objects.create(conversation=conversation, sender=opened_by, body=body,
                                               attachment=attachment)
        ConversationService._notify(conversation, exclude={opened_by}, title_prefix="New")
        return conversation

    @staticmethod
    @transaction.atomic
    def reply(*, conversation, sender, body, attachment=None):
        msg = cm.ConversationMessage.objects.create(conversation=conversation, sender=sender, body=body,
                                                      attachment=attachment)
        if conversation.status == cm.ConversationStatus.OPEN:
            conversation.status = cm.ConversationStatus.IN_PROGRESS
        conversation.save(update_fields=["status", "updated_at"])
        ConversationService._notify(conversation, exclude={sender}, title_prefix="New reply on")
        return msg

    @staticmethod
    def assign(conversation, staff_user):
        conversation.assigned_to = staff_user
        if conversation.status == cm.ConversationStatus.OPEN:
            conversation.status = cm.ConversationStatus.IN_PROGRESS
        conversation.save(update_fields=["assigned_to", "status", "updated_at"])
        return conversation

    @staticmethod
    def set_status(conversation, new_status):
        conversation.status = new_status
        conversation.save(update_fields=["status", "updated_at"])
        return conversation

    @staticmethod
    def _resolve_target_users(conversation):
        t = conversation.target_type
        if t == cm.ConversationTargetType.LECTURER and conversation.target_lecturer:
            return [conversation.target_lecturer.user]
        if t == cm.ConversationTargetType.DEPARTMENT and conversation.department:
            hod = conversation.department.head_of_department
            return [hod] if hod else []
        if t == cm.ConversationTargetType.DEAN and conversation.faculty:
            dean = conversation.faculty.dean
            return [dean] if dean else []
        if t == cm.ConversationTargetType.FINANCE:
            return list(m.User.objects.filter(user_type="finance", is_active=True))
        if t == cm.ConversationTargetType.REGISTRY:
            return list(m.User.objects.filter(user_type="registrar", is_active=True))
        if t == cm.ConversationTargetType.HOSTEL:
            return list(m.User.objects.filter(user_type="hostel_warden", is_active=True))
        if t == cm.ConversationTargetType.ADMIN:
            return list(m.User.objects.filter(user_type="admin", is_active=True))
        return []

    @staticmethod
    def _notify(conversation, exclude, title_prefix):
        latest = conversation.messages.order_by("-created_at").first()
        people = {conversation.opened_by}
        if conversation.assigned_to:
            people.add(conversation.assigned_to)
        people.update(ConversationService._resolve_target_users(conversation))
        people -= set(exclude)
        if not people or not latest:
            return
        m.Notification.objects.bulk_create([
            m.Notification(recipient=u, title=f"{title_prefix}: {conversation.subject}",
                            message=latest.body[:200], notification_type="conversation")
            for u in people
        ])

    @staticmethod
    def visible_to(user):
        """Which conversations a given user may see."""
        role = user.user_type
        if role == "student":
            return cm.Conversation.objects.filter(opened_by=user)
        if role == "lecturer":
            lecturer = getattr(user, "lecturer_profile", None)
            return cm.Conversation.objects.filter(Q(target_lecturer=lecturer) | Q(assigned_to=user))
        if role == "cod":
            department = m.Department.objects.filter(head_of_department=user).first()
            return cm.Conversation.objects.filter(Q(department=department) | Q(assigned_to=user))
        if role == "dean":
            faculty = m.Faculty.objects.filter(dean=user).first()
            return cm.Conversation.objects.filter(Q(faculty=faculty) | Q(assigned_to=user))
        if role == "finance":
            return cm.Conversation.objects.filter(Q(target_type=cm.ConversationTargetType.FINANCE) | Q(assigned_to=user))
        if role == "registrar":
            return cm.Conversation.objects.filter(Q(target_type=cm.ConversationTargetType.REGISTRY) | Q(assigned_to=user))
        if role == "hostel_warden":
            return cm.Conversation.objects.filter(Q(target_type=cm.ConversationTargetType.HOSTEL) | Q(assigned_to=user))
        if role == "admin":
            return cm.Conversation.objects.all()
        return cm.Conversation.objects.none()