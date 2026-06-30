from rest_framework import serializers

from tickets.models import Ticket


class TicketSerializer(serializers.ModelSerializer[Ticket]):
    invitation_slug = serializers.CharField(source="invitation.public_slug", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    assigned_staff_username = serializers.CharField(
        source="assigned_staff.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Ticket
        fields = [
            "id",
            "invitation_slug",
            "category",
            "description",
            "attachment_url",
            "status",
            "resolution_note",
            "created_by_email",
            "assigned_staff_username",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "invitation_slug",
            "status",
            "resolution_note",
            "created_by_email",
            "assigned_staff_username",
            "resolved_at",
            "created_at",
            "updated_at",
        ]


class ClientTicketCreateSerializer(serializers.Serializer):
    invitation_slug = serializers.SlugField(max_length=100)
    category = serializers.ChoiceField(choices=Ticket.Category.choices)
    description = serializers.CharField(max_length=5000)
    attachment_url = serializers.URLField(max_length=500, required=False, allow_blank=True)


class StaffTicketUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Ticket.Status.choices, required=False)
    assign_to_self = serializers.BooleanField(required=False, default=False)
    resolution_note = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    custom_domain = serializers.CharField(required=False, allow_blank=True, max_length=255)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=1000)
