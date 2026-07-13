from rest_framework import serializers

from common.mfa import mfa_enrolled
from common.models import AuditEvent
from users.models import User


class StaffSessionUserSerializer(serializers.ModelSerializer[User]):
    display_name = serializers.SerializerMethodField()
    mfa_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "display_name",
            "is_staff",
            "mfa_enrolled",
        ]

    def get_display_name(self, user: User) -> str:
        return user.get_full_name() or user.username

    def get_mfa_enrolled(self, user: User) -> bool:
        return mfa_enrolled(user)


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
