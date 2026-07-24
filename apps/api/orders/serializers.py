from urllib.parse import urlencode

from rest_framework import serializers

from catalog.models import Package, Theme
from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from invitations.capabilities import invitation_supports_guest_wishes
from invitations.models import (
    Guest,
    Invitation,
    InvitationMedia,
    InvitationRevision,
    WeddingEvent,
)
from invitations.preview import guest_management_token_for, preview_token_for, wishes_token_for
from leads.models import WhatsAppIntent
from orders.models import Order
from payments.serializers import PaymentRecordSerializer
from payments.services import manual_payment_summary
from users.models import User

WORKFLOW_STATUS_LABELS = {
    Order.Status.LEAD: "Baru",
    Order.Status.PENDING: "Baru",
    Order.Status.CONSULTING: "Baru",
    Order.Status.CONFIRMED: "Data Kurang",
    Order.Status.IN_DESIGN: "Proses",
    Order.Status.VERIFIED: "Proses",
    Order.Status.REVISION: "Revisi",
    Order.Status.CLIENT_REVIEW: "Revisi",
    Order.Status.APPROVED: "Final",
    Order.Status.COMPLETED: "Final",
    Order.Status.PUBLISHED: "Publikasi",
}


PAYMENT_STATUS_LABELS = {
    Order.PaymentStatus.UNPAID: "Belum Bayar",
    Order.PaymentStatus.DP: "DP",
    Order.PaymentStatus.PAID: "Lunas",
}


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
    payment_valid_total = serializers.SerializerMethodField()
    payment_pending_total = serializers.SerializerMethodField()
    payment_outstanding = serializers.SerializerMethodField()

    def get_payment_valid_total(self, obj: Order) -> str:
        return str(manual_payment_summary(obj)["valid_total"])

    def get_payment_pending_total(self, obj: Order) -> str:
        return str(manual_payment_summary(obj)["pending_total"])

    def get_payment_outstanding(self, obj: Order) -> str:
        return str(manual_payment_summary(obj)["outstanding"])

    class Meta:
        model = Order
        fields = [
            "id",
            "reference",
            "status",
            "payment_status",
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
            "payment_valid_total",
            "payment_pending_total",
            "payment_outstanding",
            "verified_at",
            "rejection_reason",
            "notes",
            "custom_status",
            "custom_brief",
            "custom_approval_notes",
            "custom_checklist",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "payment_valid_total",
            "payment_pending_total",
            "payment_outstanding",
            "verified_at",
            "created_at",
            "updated_at",
        ]

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


class StaffOrderRevisionCreateSerializer(serializers.Serializer):
    note = serializers.CharField()
    is_final_check = serializers.BooleanField(required=False, default=False)

    def validate_note(self, value: str) -> str:
        note = value.strip()
        if not note:
            raise serializers.ValidationError("Revision note is required.")
        return note


class StaffOrderDetailSerializer(serializers.Serializer):
    def to_representation(self, order: Order):
        request = self.context.get("request")
        invitation = order.invitation
        base_order = OrderSerializer(order, context=self.context).data
        base_order["workflow_label"] = WORKFLOW_STATUS_LABELS.get(
            order.status,
            order.get_status_display(),
        )
        base_order["payment_status_label"] = PAYMENT_STATUS_LABELS.get(
            order.payment_status,
            order.get_payment_status_display(),
        )

        if invitation is None:
            return {
                "order": base_order,
                "invitation": None,
                "events": [],
                "media": [],
                "rsvp": self._empty_rsvp(),
                "payments": [],
                "payment_summary": self._payment_summary(order),
                "preview_url": "",
                "wishes_url": "",
                "guest_management_url": "",
                "revisions": [],
            }

        return {
            "order": base_order,
            "invitation": self._invitation_payload(invitation),
            "events": [self._event_payload(event) for event in invitation.events.all()],
            "media": [self._media_payload(media) for media in invitation.media.all()],
            "rsvp": self._rsvp_payload(invitation),
            "payments": PaymentRecordSerializer(order.manual_payments.all(), many=True).data,
            "payment_summary": self._payment_summary(order),
            "preview_url": self._preview_url(invitation, request),
            "wishes_url": (
                self._wishes_url(invitation, request)
                if invitation_supports_guest_wishes(invitation)
                else ""
            ),
            "guest_management_url": self._guest_management_url(invitation, request),
            "revisions": [
                self._revision_payload(revision) for revision in invitation.revisions.all()
            ],
        }

    def _invitation_payload(self, invitation: Invitation) -> dict:
        content = invitation.content if isinstance(invitation.content, dict) else {}
        couple = content.get("couple") if isinstance(content.get("couple"), dict) else {}
        story = content.get("story") if isinstance(content.get("story"), dict) else {}
        quote = content.get("quote") if isinstance(content.get("quote"), dict) else {}
        timeline = content.get("timeline") if isinstance(content.get("timeline"), dict) else {}
        return {
            "id": str(invitation.id),
            "public_slug": invitation.public_slug,
            "status": invitation.status,
            "approval_status": invitation.approval_status,
            "default_locale": invitation.default_locale,
            "theme_slug": invitation.theme.slug,
            "package_code": invitation.package.code if invitation.package_id else None,
            "renderer_key": invitation.renderer_key,
            "bank_accounts": content.get("bank_accounts", []),
            "couple": {
                "partnerOneDescription": couple.get("partnerOneDescription", ""),
                "partnerTwoDescription": couple.get("partnerTwoDescription", ""),
            },
            "rsvp_manual": content.get("rsvp_manual", {}),
            "story": story,
            "quote": quote,
            "timeline": timeline,
            "partner_one": couple.get("partner_one") or couple.get("partnerOne", {}),
            "partner_two": couple.get("partner_two") or couple.get("partnerTwo", {}),
        }

    def _event_payload(self, event: WeddingEvent) -> dict:
        location = getattr(event, "location", None)
        return {
            "id": str(event.id),
            "event_type": event.event_type,
            "starts_at": event.starts_at,
            "ends_at": event.ends_at,
            "timezone": event.timezone,
            "venue_name": event.venue_name,
            "address": event.address,
            "map_url": event.map_url,
            "location": None
            if location is None
            else {
                "province": location.province,
                "regency": location.regency,
                "district": location.district,
                "village": location.village,
                "bmkg_adm4": location.bmkg_adm4,
                "latitude": location.latitude,
                "longitude": location.longitude,
            },
        }

    def _media_payload(self, media: InvitationMedia) -> dict:
        asset = media.asset
        return {
            "id": str(media.id),
            "role": media.role,
            "sort_order": media.sort_order,
            "alt_text": media.alt_text,
            "focal_x": float(media.focal_x),
            "focal_y": float(media.focal_y),
            "asset": {
                "id": str(asset.id),
                "public_id": asset.public_id,
                "resource_type": asset.resource_type,
                "format": asset.format,
                "secure_url": asset.secure_url,
                "original_filename": asset.original_filename,
            },
        }

    def _rsvp_payload(self, invitation: Invitation) -> dict:
        guests = invitation.guests.filter(archived_at__isnull=True, anonymized_at__isnull=True)
        total_invited = guests.count()
        total_confirmed = guests.filter(rsvp_status=Guest.RSVPStatus.ACCEPTED).count()
        total_declined = guests.filter(rsvp_status=Guest.RSVPStatus.DECLINED).count()
        response_rate = (
            round(((total_confirmed + total_declined) / total_invited) * 100, 1)
            if total_invited
            else 0
        )
        return {
            "total_invited": total_invited,
            "total_confirmed": total_confirmed,
            "total_declined": total_declined,
            "response_rate": response_rate,
        }

    def _empty_rsvp(self) -> dict:
        return {
            "total_invited": 0,
            "total_confirmed": 0,
            "total_declined": 0,
            "response_rate": 0,
        }

    def _payment_summary(self, order: Order) -> dict[str, str]:
        summary = manual_payment_summary(order)
        return {
            "valid_total": str(summary["valid_total"]),
            "pending_total": str(summary["pending_total"]),
            "rejected_total": str(summary["rejected_total"]),
            "outstanding": str(summary["outstanding"]),
            "payment_status": str(summary["payment_status"]),
        }

    def _preview_url(self, invitation: Invitation, request) -> str:
        path = f"/{invitation.default_locale}/i/{invitation.public_slug}"
        preview_path = (
            path
            if invitation.status == Invitation.Status.PUBLISHED
            else f"{path}?{urlencode({'preview': preview_token_for(invitation)})}"
        )
        if request is None:
            return preview_path
        origin = request.headers.get("Origin", "").rstrip("/")
        if origin:
            return f"{origin}{preview_path}"
        return request.build_absolute_uri(preview_path)

    def _wishes_url(self, invitation: Invitation, request) -> str:
        path = f"/{invitation.default_locale}/i/{invitation.public_slug}/wishes"
        wishes_path = f"{path}?{urlencode({'access': wishes_token_for(invitation)})}"
        if request is None:
            return wishes_path
        origin = request.headers.get("Origin", "").rstrip("/")
        if origin:
            return f"{origin}{wishes_path}"
        return request.build_absolute_uri(wishes_path)

    def _guest_management_url(self, invitation: Invitation, request) -> str:
        path = f"/guest-delivery/{guest_management_token_for(invitation)}"
        if request is None:
            return path
        origin = request.headers.get("Origin", "").rstrip("/")
        if origin:
            return f"{origin}{path}"
        return request.build_absolute_uri(path)

    def _revision_payload(self, revision: InvitationRevision) -> dict:
        return {
            "id": str(revision.id),
            "revision_number": revision.revision_number,
            "label": (
                "Final Check" if revision.is_final_check else f"Revisi {revision.revision_number}"
            ),
            "note": revision.note,
            "is_final_check": revision.is_final_check,
            "created_at": revision.created_at,
            "created_by_email": revision.created_by.email if revision.created_by_id else None,
        }


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
