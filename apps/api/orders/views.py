import hashlib
import re
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Max, Prefetch, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from invitations.models import Invitation, InvitationMedia, InvitationRevision, WeddingEvent
from leads.models import WhatsAppIntent
from media_library.models import MediaAsset
from orders.lifecycle import (
    archive_expired_wedding,
    invitation_client_recipient,
    staff_confirm_order,
    staff_reject_order,
)
from orders.models import Order
from orders.permissions import IsStaffRole
from orders.serializers import (
    OrderSerializer,
    StaffClientLifecycleSerializer,
    StaffOrderDetailSerializer,
    StaffOrderRevisionCreateSerializer,
    StaffRejectOrderSerializer,
    StaffVerificationActionSerializer,
)


def _detail_queryset():
    return Order.objects.select_related(
        "theme",
        "package",
        "invitation",
        "invitation__theme",
        "invitation__package",
        "whatsapp_intent",
        "assigned_staff",
        "client_user",
    ).prefetch_related(
        Prefetch(
            "invitation__events",
            queryset=WeddingEvent.objects.select_related("location"),
        ),
        Prefetch(
            "invitation__media",
            queryset=InvitationMedia.objects.select_related("asset"),
        ),
        Prefetch(
            "invitation__revisions",
            queryset=InvitationRevision.objects.select_related("created_by"),
        ),
        "manual_payments",
    )


def _parse_staff_datetime(value: str):
    if not value:
        return None
    parsed = parse_datetime(value)
    if parsed is None:
        raise ValidationError({"starts_at": "Datetime is not valid."})
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _unique_invitation_slug(reference: str) -> str:
    base_slug = slugify(reference) or f"order-{timezone.now().timestamp():.0f}"
    slug = base_slug
    index = 2
    while Invitation.objects.filter(public_slug=slug).exists():
        slug = f"{base_slug}-{index}"
        index += 1
    return slug


def _next_order_reference() -> str:
    max_number = 0
    for reference in Order.objects.values_list("reference", flat=True):
        match = re.fullmatch(r"n(\d+)", reference, flags=re.IGNORECASE)
        if match:
            max_number = max(max_number, int(match.group(1)))
    return f"N{max_number + 1:03d}"


def _auto_order_reference(reference: str) -> bool:
    return bool(re.fullmatch(r"n\d+", reference.strip(), flags=re.IGNORECASE))


def _ensure_invitation(order: Order) -> Invitation:
    if order.invitation_id:
        return order.invitation
    if order.theme_id is None:
        raise ValidationError({"theme_slug": "Theme is required before editing invitation data."})
    invitation = Invitation.objects.create(
        public_slug=_unique_invitation_slug(order.reference),
        theme=order.theme,
        package=order.package,
        renderer_key=order.theme.renderer_key,
        renderer_version=order.theme.renderer_version,
        content_schema_version=order.theme.content_schema_version,
        content={
            "couple": {
                "partnerOne": order.client_name or "Nama Pasangan",
                "partnerTwo": "Nama Pasangan",
                "monogram": (order.client_name[:1] or "N"),
            },
            "opening": {
                "eyebrow": "Dengan penuh sukacita",
                "title": "Kami mengundang Anda",
                "message": "Untuk hadir di hari pernikahan kami.",
            },
            "event": {
                "dateLabel": "Tanggal acara",
                "ceremonyLabel": "Akad",
                "ceremonyTime": "Waktu akad",
                "receptionLabel": "Resepsi",
                "receptionTime": "Waktu resepsi",
                "venue": "Nama Venue",
                "address": "Alamat venue",
                "mapUrl": "https://maps.google.com",
            },
            "story": {
                "heading": "Cerita kami",
                "body": "Kami bertemu dan bertumbuh bersama.",
            },
            "quote": {
                "text": (
                    "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan "
                    "pasangan-pasangan untukmu."
                ),
                "attribution": "Ar-Rum - 21",
            },
            "gallery": [
                {"src": "/images/one.webp", "alt": "Gallery 1"},
                {"src": "/images/two.webp", "alt": "Gallery 2"},
                {"src": "/images/three.webp", "alt": "Gallery 3"},
            ],
            "closing": {
                "heading": "Sampai bertemu",
                "message": "Terima kasih atas doa dan restunya.",
            },
        },
    )
    order.invitation = invitation
    order.save(update_fields=["invitation", "updated_at"])
    return invitation


def _publish_invitation_for_order(order: Order, actor) -> Invitation:
    invitation = _ensure_invitation(order)
    if invitation.status == Invitation.Status.PUBLISHED:
        return invitation

    invitation.status = Invitation.Status.PUBLISHED
    invitation.approval_status = Invitation.ApprovalStatus.PUBLISHED
    invitation.published_at = invitation.published_at or timezone.now()
    invitation.save(update_fields=["status", "approval_status", "published_at", "updated_at"])
    AuditEvent.objects.create(
        actor=actor,
        action="invitation.published",
        resource_type="invitation",
        resource_reference=invitation.public_slug,
        metadata={"order": order.reference, "source": "staff_order_status"},
    )
    return invitation


def _update_event(invitation: Invitation, event_type: str, data: dict) -> None:
    if not isinstance(data, dict):
        return
    starts_at = _parse_staff_datetime(str(data.get("starts_at", "")).strip())
    event, _created = WeddingEvent.objects.get_or_create(
        invitation=invitation,
        event_type=event_type,
        defaults={
            "starts_at": starts_at or timezone.now(),
            "venue_name": str(data.get("venue_name", "")).strip() or "Belum diisi",
            "address": str(data.get("address", "")).strip() or "Belum diisi",
            "sort_order": 1 if event_type == WeddingEvent.EventType.CEREMONY else 2,
        },
    )
    update_fields: list[str] = []
    if starts_at is not None:
        event.starts_at = starts_at
        update_fields.append("starts_at")
    for field in ["venue_name", "address", "map_url"]:
        if field in data:
            setattr(event, field, str(data.get(field, "")).strip())
            update_fields.append(field)
    if update_fields:
        event.save(update_fields=[*sorted(set(update_fields)), "updated_at"])


def _update_invitation_content(invitation: Invitation, data: dict) -> None:
    content = invitation.content if isinstance(invitation.content, dict) else {}
    changed = False
    if "bank_accounts" in data:
        content["bank_accounts"] = data.get("bank_accounts") or []
        changed = True
    if "rsvp_manual" in data:
        content["rsvp_manual"] = data.get("rsvp_manual") or {}
        changed = True
    if changed:
        invitation.content = content
        invitation.save(update_fields=["content", "updated_at"])


def _asset_from_url(url: str, *, role: str) -> MediaAsset | None:
    secure_url = url.strip()
    if not secure_url:
        return None
    if not secure_url.startswith("https://res.cloudinary.com/"):
        raise ValidationError({role: "Media URL must be a Cloudinary https URL."})
    checksum = hashlib.sha256(secure_url.encode("utf-8")).hexdigest()
    public_id = f"manual-{role}/{checksum[:24]}"
    return MediaAsset.objects.get_or_create(
        public_id=public_id,
        defaults={
            "resource_type": (
                MediaAsset.ResourceType.RAW
                if role == InvitationMedia.Role.BACKSOUND
                else MediaAsset.ResourceType.IMAGE
            ),
            "format": secure_url.rsplit(".", 1)[-1][:16] if "." in secure_url else "",
            "secure_url": secure_url,
            "folder": "wedding/manual",
            "original_filename": role,
            "checksum": checksum,
        },
    )[0]


def _replace_media(invitation: Invitation, role: str, urls: list[str]) -> None:
    InvitationMedia.objects.filter(invitation=invitation, role=role).delete()
    for index, url in enumerate(urls):
        asset = _asset_from_url(url, role=role)
        if asset is None:
            continue
        InvitationMedia.objects.create(
            invitation=invitation,
            asset=asset,
            role=role,
            sort_order=index,
        )


def _manual_order_payload(data) -> dict:
    return {
        key: data[key]
        for key in [
            "reference",
            "status",
            "payment_status",
            "theme_slug",
            "package_code",
            "assigned_staff_username",
            "client_name",
            "client_email",
            "client_phone",
            "event_date",
            "total_amount",
            "currency",
            "notes",
        ]
        if key in data
    }


class StaffDashboardMetricsView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request) -> Response:
        return Response(
            {
                "orders": dict(Order.objects.values_list("status").annotate(count=Count("id"))),
                "revenue_pipeline": Order.objects.exclude(
                    status__in=[Order.Status.CANCELLED, Order.Status.LEAD]
                ).aggregate(total=Sum("total_amount"))["total"]
                or 0,
                "audit_events": AuditEvent.objects.count(),
                "leads": WhatsAppIntent.objects.count(),
            }
        )


class StaffOrderListCreateView(ListCreateAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects.filter(archived_at__isnull=True)
            .select_related("theme", "package", "invitation", "whatsapp_intent")
            .prefetch_related("manual_payments")
        )

    def post(self, request, *args, **kwargs) -> Response:
        data = request.data.copy()
        reference = str(data.get("reference", "")).strip()
        if not reference or (
            _auto_order_reference(reference)
            and Order.objects.filter(reference__iexact=reference).exists()
        ):
            data["reference"] = _next_order_reference()
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)


class StaffOrderDetailView(RetrieveUpdateAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = OrderSerializer
    lookup_field = "reference"

    def get_queryset(self):
        return _detail_queryset().filter(archived_at__isnull=True)

    def get(self, request, *args, **kwargs) -> Response:
        order = self.get_object()
        serializer = StaffOrderDetailSerializer(order, context={"request": request})
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs) -> Response:
        order = self.get_object()
        nested_keys = {"ceremony", "reception", "bank_accounts", "rsvp_manual", "media_urls"}
        serializer = self.get_serializer(
            order,
            data=_manual_order_payload(request.data),
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            updated = serializer.save()
            if updated.status == Order.Status.PUBLISHED:
                _publish_invitation_for_order(updated, request.user)
            if nested_keys.intersection(request.data):
                invitation = _ensure_invitation(updated)
                _update_event(
                    invitation,
                    WeddingEvent.EventType.CEREMONY,
                    request.data.get("ceremony", {}),
                )
                _update_event(
                    invitation,
                    WeddingEvent.EventType.RECEPTION,
                    request.data.get("reception", {}),
                )
                _update_invitation_content(invitation, request.data)
                media_urls = request.data.get("media_urls") or {}
                if isinstance(media_urls, dict):
                    if "photo" in media_urls:
                        _replace_media(
                            invitation,
                            InvitationMedia.Role.PHOTO,
                            [str(media_urls.get("photo") or "")],
                        )
                    if "gallery" in media_urls:
                        _replace_media(
                            invitation,
                            InvitationMedia.Role.GALLERY,
                            [str(item) for item in media_urls.get("gallery") or []],
                        )
                    if "backsound" in media_urls:
                        _replace_media(
                            invitation,
                            InvitationMedia.Role.BACKSOUND,
                            [str(media_urls.get("backsound") or "")],
                        )
                AuditEvent.objects.create(
                    actor=request.user,
                    action="order.manual_detail_updated",
                    resource_type="order",
                    resource_reference=updated.reference,
                    metadata={"nested_fields": sorted(nested_keys.intersection(request.data))},
                )
        updated = _detail_queryset().get(pk=updated.pk)
        detail = StaffOrderDetailSerializer(updated, context={"request": request})
        return Response(detail.data)

    def delete(self, request, *args, **kwargs) -> Response:
        order = self.get_object()
        order.archived_at = timezone.now()
        order.save(update_fields=["archived_at", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="order.archived",
            resource_type="order",
            resource_reference=order.reference,
            metadata={"source": "staff_dashboard"},
        )
        return Response(status=204)


class StaffOrderRevisionListCreateView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, reference: str) -> Response:
        order = Order.objects.select_related("invitation").filter(reference=reference).first()
        if order is None or order.invitation_id is None:
            from django.http import Http404

            raise Http404

        serializer = StaffOrderRevisionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        next_number = (
            order.invitation.revisions.aggregate(max_number=Max("revision_number"))["max_number"]
            or 0
        ) + 1
        revision = InvitationRevision.objects.create(
            invitation=order.invitation,
            revision_number=next_number,
            content=order.invitation.content,
            note=serializer.validated_data["note"],
            is_final_check=serializer.validated_data["is_final_check"],
            created_by=request.user,
        )
        AuditEvent.objects.create(
            actor=request.user,
            action="invitation.revision_noted",
            resource_type="order",
            resource_reference=order.reference,
            metadata={
                "invitation": order.invitation.public_slug,
                "revision_number": revision.revision_number,
                "is_final_check": revision.is_final_check,
            },
        )
        detail = StaffOrderDetailSerializer(
            order,
            context={"request": request},
        )
        return Response(detail.data, status=201)


class StaffOrderRevisionDetailView(APIView):
    permission_classes = [IsStaffRole]

    def patch(self, request, reference: str, revision_id: str) -> Response:
        order = _detail_queryset().filter(reference=reference, archived_at__isnull=True).first()
        if order is None or order.invitation_id is None:
            from django.http import Http404

            raise Http404
        revision = order.invitation.revisions.filter(id=revision_id).first()
        if revision is None:
            from django.http import Http404

            raise Http404
        if "note" in request.data:
            revision.note = str(request.data.get("note", "")).strip()
        if "is_final_check" in request.data:
            revision.is_final_check = bool(request.data.get("is_final_check"))
        revision.save(update_fields=["note", "is_final_check", "updated_at"])
        AuditEvent.objects.create(
            actor=request.user,
            action="invitation.revision_updated",
            resource_type="order",
            resource_reference=order.reference,
            metadata={
                "invitation": order.invitation.public_slug,
                "revision_number": revision.revision_number,
                "is_final_check": revision.is_final_check,
            },
        )
        order = _detail_queryset().get(pk=order.pk)
        detail = StaffOrderDetailSerializer(order, context={"request": request})
        return Response(detail.data)


class StaffVerificationQueueView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Order.objects.filter(status=Order.Status.PENDING)
            .select_related("theme", "package", "invitation", "client_user")
            .order_by("created_at")
        )


class StaffConfirmOrderView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, reference: str) -> Response:
        order = (
            Order.objects.select_related("invitation", "client_user")
            .filter(reference=reference)
            .first()
        )
        if order is None:
            from django.http import Http404

            raise Http404
        serializer = StaffVerificationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = staff_confirm_order(
            order=order,
            actor=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(OrderSerializer(updated, context={"request": request}).data)


class StaffRejectOrderView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, reference: str) -> Response:
        order = (
            Order.objects.select_related("invitation", "client_user")
            .filter(reference=reference)
            .first()
        )
        if order is None:
            from django.http import Http404

            raise Http404
        serializer = StaffRejectOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = staff_reject_order(
            order=order,
            actor=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(OrderSerializer(updated, context={"request": request}).data)


class StaffClientLifecycleListView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = StaffClientLifecycleSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = Order.objects.select_related("invitation").exclude(invitation__isnull=True)
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(Q(status=status) | Q(invitation__status=status))
        return queryset.order_by("client_name", "reference")


class StaffArchiveWeddingView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request, public_slug: str) -> Response:
        invitation = Invitation.objects.filter(public_slug=public_slug).first()
        if invitation is None:
            from django.http import Http404

            raise Http404
        reason = str(request.data.get("reason", "")).strip()
        updated = archive_expired_wedding(invitation=invitation, actor=request.user, reason=reason)
        return Response({"public_slug": updated.public_slug, "status": updated.status})


class BillingLifecycleRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        configured_secret = getattr(settings, "BILLING_CRON_SECRET", "")
        supplied_secret = request.headers.get("X-Cron-Secret", "")
        if configured_secret and supplied_secret != configured_secret:
            return Response({"detail": "Forbidden"}, status=403)

        now = timezone.now()
        warning_days = int(getattr(settings, "BILLING_EXPIRY_WARNING_DAYS", 14))
        warning_at = now + timedelta(days=warning_days)
        expiring = Invitation.objects.filter(
            status=Invitation.Status.ACTIVE,
            expires_at__isnull=False,
            expires_at__lte=warning_at,
            expires_at__gt=now,
        )
        expired = Invitation.objects.filter(
            status__in=[Invitation.Status.ACTIVE, Invitation.Status.EXPIRING_SOON],
            expires_at__isnull=False,
            expires_at__lte=now,
        )

        expiring_count = 0
        for invitation in expiring:
            invitation.status = Invitation.Status.EXPIRING_SOON
            invitation.save(update_fields=["status", "updated_at"])
            enqueue_client_notification(
                recipient=invitation_client_recipient(invitation),
                event_type="wedding.expiring_soon",
                payload={
                    "invitation": invitation.public_slug,
                    "expires_at": invitation.expires_at.isoformat(),
                },
            )
            expiring_count += 1

        expired_count = expired.update(status=Invitation.Status.EXPIRED, updated_at=now)
        return Response({"expiring_soon": expiring_count, "expired": expired_count})
