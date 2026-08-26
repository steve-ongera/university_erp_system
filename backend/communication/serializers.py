from rest_framework import serializers

from . import models as cm

# ----------------------------------------------------------------------
# BROADCASTS
# ----------------------------------------------------------------------

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = cm.Message
        fields = "__all__"
        read_only_fields = ["sender", "sender_role_snapshot", "status", "sent_at", "recipient_count", "created_at"]

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() if obj.sender else "University"


class ComposeMessageSerializer(serializers.Serializer):
    """Payload for POST /messages/compose/. Validation of *who* the
    sender may actually reach happens server-side in
    CommunicationPermissionService — this serializer only checks shape."""
    title = serializers.CharField(max_length=200)
    body = serializers.CharField()
    category = serializers.ChoiceField(choices=cm.MessageCategory.choices, default=cm.MessageCategory.ANNOUNCEMENT)
    audience_type = serializers.ChoiceField(choices=cm.AudienceType.choices)
    filters = serializers.JSONField(required=False, default=dict)
    channels = serializers.ListField(child=serializers.ChoiceField(choices=cm.Channel.choices),
                                      required=False, default=list)
    audience_label = serializers.CharField(required=False, allow_blank=True, default="")
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True, default=None)


class InboxItemSerializer(serializers.ModelSerializer):
    """MessageRecipient flattened with its parent Message's content —
    this is what a person's Inbox actually renders."""
    title = serializers.CharField(source="message.title", read_only=True)
    body = serializers.CharField(source="message.body", read_only=True)
    category = serializers.CharField(source="message.category", read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField(source="message.sender_role_snapshot", read_only=True)
    sent_at = serializers.DateTimeField(source="message.sent_at", read_only=True)
    channels = serializers.JSONField(source="message.channels", read_only=True)
    audience_label = serializers.CharField(source="message.audience_label", read_only=True)

    class Meta:
        model = cm.MessageRecipient
        fields = ["id", "message", "title", "body", "category", "sender_name", "sender_role",
                  "sent_at", "channels", "audience_label", "is_read", "read_at"]

    def get_sender_name(self, obj):
        return obj.message.sender.get_full_name() if obj.message.sender else "University"


# ----------------------------------------------------------------------
# CONVERSATIONS
# ----------------------------------------------------------------------

class ConversationMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField(source="sender.user_type", read_only=True)

    class Meta:
        model = cm.ConversationMessage
        fields = "__all__"
        read_only_fields = ["conversation", "sender", "created_at"]

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() if obj.sender else "Unknown"


class ConversationSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.CharField(source="opened_by.get_full_name", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    target_lecturer_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    faculty_name = serializers.CharField(source="faculty.name", read_only=True, default=None)
    messages = ConversationMessageSerializer(many=True, read_only=True)

    class Meta:
        model = cm.Conversation
        fields = "__all__"
        read_only_fields = ["opened_by", "assigned_to", "status", "created_at", "updated_at"]

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() if obj.assigned_to else None

    def get_target_lecturer_name(self, obj):
        return obj.target_lecturer.user.get_full_name() if obj.target_lecturer else None


class ConversationListSerializer(ConversationSerializer):
    """Same shape, minus the (potentially long) message history — used
    for list views so we don't pull every message for every row."""
    messages = None

    class Meta(ConversationSerializer.Meta):
        pass

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data.pop("messages", None)
        last = instance.messages.order_by("-created_at").first()
        data["last_message"] = ConversationMessageSerializer(last).data if last else None
        return data


class OpenConversationSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=200)
    body = serializers.CharField()
    category = serializers.ChoiceField(choices=cm.ConversationCategory.choices, default=cm.ConversationCategory.ENQUIRY)
    target_type = serializers.ChoiceField(choices=cm.ConversationTargetType.choices)
    target_lecturer = serializers.IntegerField(required=False, allow_null=True, default=None)
    department = serializers.IntegerField(required=False, allow_null=True, default=None)
    faculty = serializers.IntegerField(required=False, allow_null=True, default=None)

    def validate(self, attrs):
        from . import models as m
        if attrs.get("target_lecturer"):
            lecturer = m.Lecturer.objects.filter(pk=attrs["target_lecturer"]).first()
            if not lecturer:
                raise serializers.ValidationError({"target_lecturer": "Lecturer not found."})
            attrs["target_lecturer"] = lecturer
        if attrs.get("department"):
            department = m.Department.objects.filter(pk=attrs["department"]).first()
            if not department:
                raise serializers.ValidationError({"department": "Department not found."})
            attrs["department"] = department
        if attrs.get("faculty"):
            faculty = m.Faculty.objects.filter(pk=attrs["faculty"]).first()
            if not faculty:
                raise serializers.ValidationError({"faculty": "Faculty not found."})
            attrs["faculty"] = faculty
        return attrs


class ReplySerializer(serializers.Serializer):
    body = serializers.CharField()