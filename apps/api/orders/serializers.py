from rest_framework import serializers

from catalog.models import Package, Theme
from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from invitations.models import Invitation
from leads.models import WhatsAppIntent
from orders.models import Order
from users.models import User


def sync_invitation_selection(
    order: Order,
    *,
    sync_client: bool = True,
    sync_package: bool = True,
    sync_theme: bool = True,
) -> None:
    if not order.invitation_id:
        return

    invitation = order.invitation
    update_fields: list[str] = []

    if sync_package and invitation.package_id != order.package_id:
        invitation.package = order.package
        update_fields.append("package")

    if sync_theme and order.theme_id and invitation.theme_id != order.theme_id:
        invitation.theme = order.theme
        invitation.renderer_key = order.theme.renderer_key
        invitation.renderer_version = order.theme.renderer_version
        invitation.content_schema_version = order.theme.content_schema_version
        update_fields.extend(
            [
                "theme",
                "renderer_key",
                "renderer_version",
                "content_schema_version",
            ],
        )

    if sync_client and order.client_user_id and invitation.client_user_id != order.client_user_id:
        invitation.client_user = order.client_user
        update_fields.append("client_user")

    if update_fields:
        invitation.save(update_fields=[*update_fields, "updated_at"])


class OrderSerializer(serializers.ModelSerializer[Order]):
    theme_slug = serializers.SlugRelatedField(
        source="theme",
        slug_field="slug",
        queryset=Theme.objects.all(),
        allow_null=True,
        required=False,
    )
    package_code = serializers.SlugRelatedField(
        source="package",
        slug_field="code",
        queryset=Package.objects.all(),
        allow_null=True,
        required=False,
    )
    invitation_slug = serializers.SlugRelatedField(
        source="invitation",
        slug_field="public_slug",
        queryset=Invitation.objects.all(),
        allow_null=True,
        required=False,
    )
    whatsapp_intent_id = serializers.PrimaryKeyRelatedField(
        source="whatsapp_intent",
        queryset=WhatsAppIntent.objects.all(),
        allow_null=True,
        required=False,
    )
    assigned_staff_username = serializers.SlugRelatedField(
        source="assigned_staff",
        slug_field="username",
        queryset=User.objects.filter(is_staff=True),
        allow_null=True,
        required=False,
    )
    client_user_email = serializers.SlugRelatedField(
        source="client_user",
        slug_field="email",
        queryset=User.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Order
        fields = [
            "id",
            "reference",
            "status",
            "theme_slug",
            "package_code",
            "invitation_slug",
            "whatsapp_intent_id",
            "assigned_staff_username",
            "client_user_email",
            "client_name",
            "client_email",
            "client_phone",
            "event_date",
            "total_amount",
            "currency",
            "payment_method",
            "proof_url",
            "verified_at",
            "rejection_reason",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "verified_at", "created_at", "updated_at"]

    def create(self, validated_data):
        order = super().create(validated_data)
        sync_invitation_selection(order)
        AuditEvent.objects.create(
            actor=self.context["request"].user,
            action="order.created",
            resource_type="order",
            resource_reference=order.reference,
            metadata={"status": order.status},
        )
        enqueue_client_notification(
            recipient=order.client_user,
            event_type="order.created",
            payload={"order": order.reference, "status": order.status},
        )
        return order

    def update(self, instance, validated_data):
        old_status = instance.status
        sync_all = "invitation" in validated_data
        order = super().update(instance, validated_data)
        sync_invitation_selection(
            order,
            sync_client=sync_all or "client_user" in validated_data,
            sync_package=sync_all or "package" in validated_data,
            sync_theme=sync_all or "theme" in validated_data,
        )
        action = "order.status_changed" if old_status != order.status else "order.updated"
        AuditEvent.objects.create(
            actor=self.context["request"].user,
            action=action,
            resource_type="order",
            resource_reference=order.reference,
            metadata={"old_status": old_status, "status": order.status},
        )
        enqueue_client_notification(
            recipient=order.client_user,
            event_type=action,
            payload={"order": order.reference, "old_status": old_status, "status": order.status},
        )
        return order


class StaffVerificationActionSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=True, required=False, default="")


class StaffRejectOrderSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def validate_reason(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Reason is required.")
        return value.strip()


class StaffClientLifecycleSerializer(serializers.ModelSerializer[Order]):
    wedding_slug = serializers.CharField(source="invitation.public_slug", read_only=True)
    wedding_status = serializers.CharField(source="invitation.status", read_only=True)
    wedding_expires_at = serializers.DateTimeField(source="invitation.expires_at", read_only=True)

    class Meta:
        model = Order
        fields = [
            "reference",
            "client_name",
            "client_email",
            "client_phone",
            "status",
            "wedding_slug",
            "wedding_status",
            "wedding_expires_at",
            "total_amount",
            "currency",
            "updated_at",
        ]
