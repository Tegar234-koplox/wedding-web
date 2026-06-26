from rest_framework import serializers

from common.models import AuditEvent


class StaffAuditEventSerializer(serializers.ModelSerializer[AuditEvent]):
    actor_email = serializers.CharField(source="actor.email", read_only=True, allow_null=True)

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "actor_email",
            "action",
            "resource_type",
            "resource_reference",
            "metadata",
            "created_at",
        ]
