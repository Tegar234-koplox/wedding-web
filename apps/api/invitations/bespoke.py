from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from common.validators import validate_bespoke_config
from invitations.models import (
    ClientApprovalRecord,
    ClientOtpChallenge,
    ClientReviewSession,
    Invitation,
    InvitationPublication,
    InvitationRevision,
)
from orders.models import BespokeChangeRequest, BespokeScopeAgreement, Order
from payments.services import manual_payment_summary

DEFAULT_BESPOKE_CONFIG: dict[str, Any] = {
    "engineVersion": 1,
    "designVersion": "bespoke-initial@1",
    "tokens": {
        "background": "#11110f",
        "surface": "#f3eadb",
        "text": "#f7f1e6",
        "muted": "#aaa294",
        "accent": "#d5ad55",
        "border": "#5d5037",
        "displayFont": "cormorant-garamond",
        "bodyFont": "manrope",
        "spacing": "editorial",
        "radius": "none",
    },
    "motion": {
        "preset": "soft-reveal",
        "intensity": "subtle",
        "parallax": "subtle",
        "reducedMotionFallback": True,
    },
    "sections": [
        {"id": "cover", "type": "cover", "variant": "cover.editorial-split@1", "enabled": True},
        {"id": "event", "type": "event", "variant": "event.editorial-cards@1", "enabled": True},
        {"id": "story", "type": "story", "variant": "story.chapters@1", "enabled": True},
        {
            "id": "gallery",
            "type": "gallery",
            "variant": "gallery.asymmetric-grid@1",
            "enabled": True,
        },
        {"id": "quote", "type": "quote", "variant": "quote.statement@1", "enabled": True},
        {"id": "rsvp", "type": "rsvp", "variant": "rsvp.minimal@1", "enabled": True},
        {"id": "closing", "type": "closing", "variant": "closing.signature@1", "enabled": True},
    ],
}


def canonical_checksum(value: Any) -> str:
    serialized = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def audit_hash(value: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def mask_phone(value: str) -> str:
    digits = "".join(character for character in value if character.isdigit())
    return f"***{digits[-4:]}" if digits else ""


def mask_email(value: str) -> str:
    local, separator, domain = value.partition("@")
    if not separator:
        return ""
    return f"{local[:1]}***@{domain}"


def ensure_bespoke_invitation(order: Order) -> Invitation:
    if not order.invitation_id:
        raise ValidationError({"invitation": "Invitation must be created before Bespoke setup."})
    invitation = order.invitation
    content = dict(invitation.content or {})
    if invitation.status == Invitation.Status.PUBLISHED and (
        invitation.renderer_key != "bespoke" or "bespoke" not in content
    ):
        raise ValidationError({"invitation": "Published invitations cannot be converted in place."})
    if "bespoke" not in content:
        content["bespoke"] = DEFAULT_BESPOKE_CONFIG
    validate_bespoke_config(content["bespoke"])
    invitation.content = content
    invitation.renderer_key = "bespoke"
    invitation.renderer_version = 1
    invitation.content_schema_version = 2
    invitation.save(
        update_fields=[
            "content",
            "renderer_key",
            "renderer_version",
            "content_schema_version",
            "updated_at",
        ]
    )
    return invitation


def update_bespoke_config(order: Order, config: dict[str, Any]) -> Invitation:
    published = bool(order.invitation and order.invitation.status == Invitation.Status.PUBLISHED)
    scope = order.bespoke_scope_agreements.filter(
        status=BespokeScopeAgreement.Status.APPROVED
    ).first()
    approved_change = None
    if published and scope is not None:
        approved_change = order.bespoke_change_requests.filter(
            status=BespokeChangeRequest.Status.APPROVED,
            scope_agreement=scope,
        ).first()
    if published and approved_change is None:
        raise ValidationError(
            {
                "invitation": (
                    "The active publication is immutable. Approve a paid change request first."
                )
            }
        )
    if scope is None:
        raise ValidationError({"scope": "Approve the Bespoke scope before production."})
    summary = manual_payment_summary(order)
    if approved_change is not None:
        previous_total = max(
            scope.total_amount - approved_change.price_delta,
            Decimal("0"),
        )
        required_dp = previous_total + (approved_change.price_delta * Decimal("0.50"))
    else:
        required_dp = scope.total_amount * Decimal("0.50")
    required_dp = required_dp.quantize(Decimal("0.01"))
    if summary["valid_total"] < required_dp:
        raise ValidationError({"payment": "A valid 50% deposit is required before production."})
    validate_bespoke_config(config)
    invitation = ensure_bespoke_invitation(order)
    content = dict(invitation.content or {})
    content["bespoke"] = config
    invitation.content = content
    invitation.approval_status = Invitation.ApprovalStatus.DRAFT
    invitation.save(update_fields=["content", "approval_status", "updated_at"])
    return invitation


@transaction.atomic
def create_scope_agreement(order: Order, data: dict[str, Any]) -> BespokeScopeAgreement:
    order = Order.objects.select_for_update().select_related("package").get(pk=order.pk)
    if order.package_id is None or order.package.code != "bespoke":
        raise ValidationError(
            {"package": "Scope agreements are only available for Bespoke orders."}
        )
    scope = data.get("scope")
    if not isinstance(scope, dict) or not scope:
        raise ValidationError({"scope": "A structured scope is required."})
    version = (order.bespoke_scope_agreements.aggregate(maximum=Max("version"))["maximum"] or 0) + 1
    total_amount = data.get("total_amount") or order.total_amount
    if not total_amount:
        raise ValidationError({"total_amount": "Agreed total amount is required."})
    payload = {
        "scope": scope,
        "total_amount": str(total_amount),
        "currency": data.get("currency") or order.currency,
        "revision_limit": data.get("revision_limit", 8),
        "production_days_min": data.get("production_days_min", 10),
        "production_days_max": data.get("production_days_max", 14),
    }
    return BespokeScopeAgreement.objects.create(
        order=order,
        version=version,
        status=BespokeScopeAgreement.Status.DRAFT,
        checksum=canonical_checksum(payload),
        **payload,
    )


def create_review_session(
    *,
    invitation: Invitation,
    purpose: str,
    scope: BespokeScopeAgreement | None = None,
    revision: InvitationRevision | None = None,
) -> tuple[ClientReviewSession, str]:
    now = timezone.now()
    ClientReviewSession.objects.filter(
        invitation=invitation,
        purpose=purpose,
        revoked_at__isnull=True,
    ).update(revoked_at=now)
    raw_token = secrets.token_urlsafe(32)
    session = ClientReviewSession.objects.create(
        invitation=invitation,
        purpose=purpose,
        scope_agreement=scope,
        revision=revision,
        token_hash=token_hash(raw_token),
        expires_at=now + timedelta(days=14),
    )
    return session, raw_token


def get_review_session(raw_token: str, *, lock: bool = False) -> ClientReviewSession:
    queryset = ClientReviewSession.objects.select_related(
        "invitation",
        "invitation__order",
        "scope_agreement",
        "revision",
    )
    if lock:
        queryset = queryset.select_for_update()
    session = queryset.filter(token_hash=token_hash(raw_token)).first()
    if session is None or session.revoked_at or session.expires_at <= timezone.now():
        raise ValidationError({"token": "Review link is invalid or expired."})
    return session


def target_checksum(session: ClientReviewSession) -> str:
    if session.purpose == ClientReviewSession.Purpose.SCOPE and session.scope_agreement:
        return session.scope_agreement.checksum
    if session.purpose == ClientReviewSession.Purpose.FINAL and session.revision:
        return canonical_checksum(session.revision.content)
    raise ValidationError({"review": "Review target is incomplete."})


@transaction.atomic
def create_otp_challenge(session: ClientReviewSession) -> tuple[ClientOtpChallenge, str, str, str]:
    session = (
        ClientReviewSession.objects.select_for_update()
        .select_related("invitation__order")
        .get(pk=session.pk)
    )
    order = session.invitation.order
    now = timezone.now()
    latest = session.otp_challenges.order_by("-created_at").first()
    if latest and latest.created_at > now - timedelta(seconds=60):
        raise ValidationError({"otp": "Wait 60 seconds before requesting another code."})
    daily_count = session.otp_challenges.filter(created_at__gte=now - timedelta(days=1)).count()
    if daily_count >= 5:
        raise ValidationError({"otp": "Daily OTP request limit reached."})

    use_whatsapp = bool(
        order.client_phone
        and settings.META_WHATSAPP_ACCESS_TOKEN
        and settings.META_WHATSAPP_PHONE_NUMBER_ID
        and settings.META_WHATSAPP_OTP_TEMPLATE_ID
    )
    channel = (
        ClientOtpChallenge.Channel.WHATSAPP if use_whatsapp else ClientOtpChallenge.Channel.EMAIL
    )
    destination = order.client_phone if use_whatsapp else order.client_email
    if not destination:
        raise ValidationError({"contact": "A verified WhatsApp number or email is required."})
    masked = mask_phone(destination) if use_whatsapp else mask_email(destination)
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = ClientOtpChallenge.objects.create(
        review_session=session,
        channel=channel,
        destination_hash=audit_hash(destination.strip().lower()),
        destination_masked=masked,
        code_hash=make_password(code),
        expires_at=now + timedelta(minutes=5),
    )
    return challenge, code, order.client_phone, order.client_email


@transaction.atomic
def approve_review(
    *,
    raw_token: str,
    code: str,
    ip_address: str,
    user_agent: str,
) -> ClientApprovalRecord:
    session = get_review_session(raw_token, lock=True)
    if hasattr(session, "approval_record"):
        return session.approval_record
    challenge = session.otp_challenges.select_for_update().order_by("-created_at").first()
    if challenge is None or challenge.consumed_at or challenge.expires_at <= timezone.now():
        raise ValidationError({"otp": "OTP is invalid or expired."})
    if challenge.attempts >= 5:
        raise ValidationError({"otp": "OTP attempt limit reached."})
    challenge.attempts += 1
    if not check_password(code, challenge.code_hash):
        challenge.save(update_fields=["attempts", "updated_at"])
        raise ValidationError({"otp": "OTP is invalid or expired."})

    now = timezone.now()
    challenge.consumed_at = now
    challenge.save(update_fields=["attempts", "consumed_at", "updated_at"])
    approval = ClientApprovalRecord.objects.create(
        review_session=session,
        checksum=target_checksum(session),
        channel=challenge.channel,
        contact_masked=challenge.destination_masked,
        ip_hash=audit_hash(ip_address) if ip_address else "",
        user_agent=user_agent[:300],
        approved_at=now,
    )
    order = session.invitation.order
    if session.purpose == ClientReviewSession.Purpose.SCOPE:
        scope = session.scope_agreement
        if scope is None:
            raise ValidationError({"scope": "Scope agreement is missing."})
        order.bespoke_scope_agreements.exclude(pk=scope.pk).filter(
            status=BespokeScopeAgreement.Status.APPROVED
        ).update(status=BespokeScopeAgreement.Status.SUPERSEDED)
        scope.status = BespokeScopeAgreement.Status.APPROVED
        scope.approved_at = now
        scope.save(update_fields=["status", "approved_at", "updated_at"])
        scope.change_requests.filter(status=BespokeChangeRequest.Status.SENT).update(
            status=BespokeChangeRequest.Status.APPROVED,
            approved_at=now,
        )
        order.total_amount = scope.total_amount
        order.currency = scope.currency
        order.custom_status = Order.CustomStatus.APPROVED
        order.status = (
            Order.Status.PUBLISHED
            if session.invitation.status == Invitation.Status.PUBLISHED
            else Order.Status.CONFIRMED
        )
        order.save(
            update_fields=["total_amount", "currency", "custom_status", "status", "updated_at"]
        )
    else:
        session.invitation.approval_status = Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH
        session.invitation.save(update_fields=["approval_status", "updated_at"])
        order.status = Order.Status.APPROVED
        order.save(update_fields=["status", "updated_at"])
    return approval


def assert_publishable(invitation: Invitation) -> None:
    if invitation.approval_status != Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH:
        raise ValidationError(
            {"approval_status": "Client final approval is required before publication."}
        )
    if invitation.renderer_key != "bespoke":
        return
    try:
        order = invitation.order
    except Order.DoesNotExist as exc:
        raise ValidationError({"order": "Bespoke invitation must belong to an order."}) from exc
    scope = order.bespoke_scope_agreements.filter(
        status=BespokeScopeAgreement.Status.APPROVED
    ).first()
    if scope is None:
        raise ValidationError({"scope": "Approved Bespoke scope is required."})
    summary = manual_payment_summary(order)
    if summary["payment_status"] != Order.PaymentStatus.PAID:
        raise ValidationError({"payment": "Full payment is required before publication."})
    config = (invitation.content or {}).get("bespoke")
    validate_bespoke_config(config)
    final_session = (
        invitation.review_sessions.filter(
            purpose=ClientReviewSession.Purpose.FINAL,
            approval_record__isnull=False,
        )
        .select_related("revision", "approval_record")
        .order_by("-created_at")
        .first()
    )
    if final_session is None or final_session.revision is None:
        raise ValidationError({"approval": "OTP-backed final approval is required."})
    current_checksum = canonical_checksum(invitation.content)
    if final_session.approval_record.checksum != current_checksum:
        raise ValidationError({"approval": "Invitation changed after client approval."})


@transaction.atomic
def publish_invitation(invitation: Invitation, *, actor=None) -> Invitation:
    invitation = Invitation.objects.select_for_update().get(pk=invitation.pk)
    if (
        invitation.status == Invitation.Status.PUBLISHED
        and invitation.approval_status == Invitation.ApprovalStatus.PUBLISHED
    ):
        return invitation
    assert_publishable(invitation)
    from invitations.serializers import PublicInvitationSerializer

    now = timezone.now()
    invitation.published_at = now
    snapshot = json.loads(json.dumps(PublicInvitationSerializer(invitation).data))
    InvitationPublication.objects.filter(invitation=invitation, is_active=True).update(
        is_active=False
    )
    next_number = (
        InvitationPublication.objects.filter(invitation=invitation).aggregate(
            maximum=Max("publication_number")
        )["maximum"]
        or 0
    ) + 1
    revision = invitation.revisions.order_by("-revision_number").first()
    InvitationPublication.objects.create(
        invitation=invitation,
        revision=revision,
        publication_number=next_number,
        snapshot=snapshot,
        checksum=canonical_checksum(snapshot),
        published_by=actor,
        published_at=now,
    )
    invitation.status = Invitation.Status.PUBLISHED
    invitation.approval_status = Invitation.ApprovalStatus.PUBLISHED
    invitation.published_at = now
    invitation.save(update_fields=["status", "approval_status", "published_at", "updated_at"])
    try:
        order = invitation.order
    except Order.DoesNotExist:
        order = None
    if order is not None:
        order.bespoke_change_requests.filter(status=BespokeChangeRequest.Status.APPROVED).update(
            status=BespokeChangeRequest.Status.APPLIED
        )
    return invitation
