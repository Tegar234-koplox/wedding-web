from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from invitations.access import revoke_invitation_access
from invitations.models import AccessGrant, AccessSession, Guest, Invitation
from orders.models import Order

ORDER_TRANSITIONS = {
    Order.Status.LEAD: {Order.Status.PENDING, Order.Status.CONSULTING, Order.Status.CANCELLED},
    Order.Status.PENDING: {Order.Status.VERIFIED, Order.Status.REJECTED, Order.Status.CANCELLED},
    Order.Status.CONSULTING: {Order.Status.PENDING, Order.Status.CONFIRMED, Order.Status.CANCELLED},
    Order.Status.CONFIRMED: {Order.Status.IN_DESIGN, Order.Status.PENDING, Order.Status.CANCELLED},
    Order.Status.IN_DESIGN: {Order.Status.CLIENT_REVIEW, Order.Status.CANCELLED},
    Order.Status.CLIENT_REVIEW: {
        Order.Status.REVISION,
        Order.Status.APPROVED,
        Order.Status.CANCELLED,
    },
    Order.Status.REVISION: {
        Order.Status.CLIENT_REVIEW,
        Order.Status.APPROVED,
        Order.Status.CANCELLED,
    },
    Order.Status.APPROVED: {Order.Status.PUBLISHED, Order.Status.CANCELLED},
    Order.Status.VERIFIED: {Order.Status.IN_DESIGN, Order.Status.PUBLISHED, Order.Status.COMPLETED},
    Order.Status.REJECTED: {Order.Status.PENDING, Order.Status.CANCELLED},
    Order.Status.PUBLISHED: {Order.Status.COMPLETED, Order.Status.CANCELLED},
    Order.Status.COMPLETED: set(),
    Order.Status.CANCELLED: set(),
}

WEDDING_TRANSITIONS = {
    Invitation.Status.DRAFT: {
        Invitation.Status.PENDING_PAYMENT,
        Invitation.Status.PENDING_VERIFICATION,
        Invitation.Status.ACTIVE,
        Invitation.Status.REVIEW,
    },
    Invitation.Status.PENDING_PAYMENT: {
        Invitation.Status.PENDING_VERIFICATION,
        Invitation.Status.ACTIVE,
        Invitation.Status.ARCHIVED,
    },
    Invitation.Status.PENDING_VERIFICATION: {
        Invitation.Status.ACTIVE,
        Invitation.Status.PENDING_PAYMENT,
        Invitation.Status.ARCHIVED,
    },
    Invitation.Status.ACTIVE: {
        Invitation.Status.EXPIRING_SOON,
        Invitation.Status.EXPIRED,
        Invitation.Status.PUBLISHED,
        Invitation.Status.ARCHIVED,
    },
    Invitation.Status.EXPIRING_SOON: {
        Invitation.Status.EXPIRED,
        Invitation.Status.ACTIVE,
        Invitation.Status.ARCHIVED,
    },
    Invitation.Status.EXPIRED: {Invitation.Status.ARCHIVED, Invitation.Status.ACTIVE},
    Invitation.Status.REVIEW: {Invitation.Status.ACTIVE, Invitation.Status.PUBLISHED},
    Invitation.Status.PUBLISHED: {
        Invitation.Status.EXPIRING_SOON,
        Invitation.Status.EXPIRED,
        Invitation.Status.ARCHIVED,
    },
    Invitation.Status.ARCHIVED: set(),
}


@dataclass(frozen=True)
class LifecycleAuditTarget:
    resource_type: str
    resource_reference: str


def ensure_order_transition(current: str, target: str) -> None:
    if current == target:
        return
    if target not in ORDER_TRANSITIONS.get(current, set()):
        raise ValidationError({"status": f"Invalid order transition: {current} -> {target}."})


def ensure_wedding_transition(current: str, target: str) -> None:
    if current == target:
        return
    if target not in WEDDING_TRANSITIONS.get(current, set()):
        raise ValidationError({"status": f"Invalid wedding transition: {current} -> {target}."})


def audit_and_notify(
    *,
    actor,
    action: str,
    target: LifecycleAuditTarget,
    recipient,
    reason: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    payload = {"reason": reason, **(metadata or {})}
    AuditEvent.objects.create(
        actor=actor,
        action=action,
        resource_type=target.resource_type,
        resource_reference=target.resource_reference,
        metadata=payload,
    )
    enqueue_client_notification(
        recipient=recipient,
        event_type=action,
        payload={
            "target_type": target.resource_type,
            "target_id": target.resource_reference,
            **payload,
        },
    )


def invitation_client_recipient(invitation: Invitation | None):
    if invitation is None:
        return None
    if invitation.client_user_id:
        return invitation.client_user
    try:
        return invitation.order.client_user
    except ObjectDoesNotExist:
        return None


@transaction.atomic
def client_attach_payment_proof(
    *,
    order: Order,
    proof_url: str,
    method: str = "bank_transfer",
) -> Order:
    ensure_order_transition(order.status, Order.Status.PENDING)
    order.payment_method = method or "bank_transfer"
    order.proof_url = proof_url
    order.status = Order.Status.PENDING
    order.save(update_fields=["payment_method", "proof_url", "status", "updated_at"])
    if order.invitation_id:
        invitation = order.invitation
        if invitation.status == Invitation.Status.DRAFT:
            invitation.status = Invitation.Status.PENDING_VERIFICATION
            invitation.save(update_fields=["status", "updated_at"])
    return order


@transaction.atomic
def staff_confirm_order(*, order: Order, actor, reason: str = "") -> Order:
    ensure_order_transition(order.status, Order.Status.VERIFIED)
    order.status = Order.Status.VERIFIED
    order.verified_by = actor
    order.verified_at = timezone.now()
    order.rejection_reason = ""
    order.save(
        update_fields=[
            "status",
            "verified_by",
            "verified_at",
            "rejection_reason",
            "updated_at",
        ]
    )

    invitation = order.invitation if order.invitation_id else None
    if invitation is not None:
        ensure_wedding_transition(invitation.status, Invitation.Status.ACTIVE)
        invitation.status = Invitation.Status.ACTIVE
        invitation.save(update_fields=["status", "updated_at"])

    audit_and_notify(
        actor=actor,
        action="order.verified",
        target=LifecycleAuditTarget("order", order.reference),
        recipient=order.client_user or invitation_client_recipient(invitation),
        reason=reason,
        metadata={"status": order.status, "wedding_status": getattr(invitation, "status", None)},
    )
    return order


@transaction.atomic
def staff_reject_order(*, order: Order, actor, reason: str) -> Order:
    if not reason.strip():
        raise ValidationError({"reason": "Reason is required when rejecting payment."})
    ensure_order_transition(order.status, Order.Status.REJECTED)
    order.status = Order.Status.REJECTED
    order.rejection_reason = reason.strip()
    order.save(update_fields=["status", "rejection_reason", "updated_at"])

    audit_and_notify(
        actor=actor,
        action="order.rejected",
        target=LifecycleAuditTarget("order", order.reference),
        recipient=order.client_user
        or invitation_client_recipient(order.invitation if order.invitation_id else None),
        reason=reason,
        metadata={"status": order.status},
    )
    return order


@transaction.atomic
def archive_expired_wedding(*, invitation: Invitation, actor, reason: str) -> Invitation:
    if invitation.status != Invitation.Status.EXPIRED:
        raise ValidationError({"status": "Only expired weddings can be archived."})
    ensure_wedding_transition(invitation.status, Invitation.Status.ARCHIVED)
    invitation.status = Invitation.Status.ARCHIVED
    invitation.archived_at = timezone.now()
    invitation.save(update_fields=["status", "archived_at", "updated_at"])
    revoke_invitation_access(invitation)
    audit_and_notify(
        actor=actor,
        action="wedding.archived",
        target=LifecycleAuditTarget("invitation", invitation.public_slug),
        recipient=invitation_client_recipient(invitation),
        reason=reason,
        metadata={"status": invitation.status},
    )
    return invitation


@transaction.atomic
def refresh_invitation_lifecycle(*, now=None, warning_days: int | None = None) -> dict[str, int]:
    """Advance invitation expiry state from an internal scheduler.

    This deliberately has no HTTP adapter. Celery Beat is the only production
    caller so an absent or misconfigured cron secret cannot expose a public
    mutation endpoint.
    """

    effective_now = now or timezone.now()
    effective_warning_days = (
        int(getattr(settings, "BILLING_EXPIRY_WARNING_DAYS", 14))
        if warning_days is None
        else warning_days
    )
    warning_at = effective_now + timedelta(days=effective_warning_days)
    expiring = Invitation.objects.filter(
        status=Invitation.Status.ACTIVE,
        expires_at__isnull=False,
        expires_at__lte=warning_at,
        expires_at__gt=effective_now,
    )
    expired = Invitation.objects.filter(
        status__in=[
            Invitation.Status.ACTIVE,
            Invitation.Status.EXPIRING_SOON,
            Invitation.Status.PUBLISHED,
        ],
        expires_at__isnull=False,
        expires_at__lte=effective_now,
    ).exclude(status=Invitation.Status.PUBLISHED, is_sample=True)

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

    expired_invitations = list(expired)
    expired_count = expired.update(
        status=Invitation.Status.EXPIRED,
        updated_at=effective_now,
    )
    expired_ids = [invitation.id for invitation in expired_invitations]
    if expired_ids:
        AccessGrant.objects.filter(
            invitation_id__in=expired_ids,
            purpose__in=[
                AccessGrant.Purpose.CLIENT_PREVIEW,
                AccessGrant.Purpose.GUEST_INVITATION,
            ],
            revoked_at__isnull=True,
        ).update(revoked_at=effective_now, updated_at=effective_now)
        AccessSession.objects.filter(
            invitation_id__in=expired_ids,
            kind=AccessSession.Kind.GUEST,
            revoked_at__isnull=True,
        ).update(revoked_at=effective_now, updated_at=effective_now)

    retention_cutoff = effective_now - timedelta(days=30)
    retention_due = Invitation.objects.filter(is_sample=False).filter(
        Q(
            status=Invitation.Status.EXPIRED,
            expires_at__isnull=False,
            expires_at__lte=retention_cutoff,
        )
        | Q(
            status=Invitation.Status.ARCHIVED,
            archived_at__isnull=False,
            archived_at__lte=retention_cutoff,
        )
        | Q(
            status=Invitation.Status.ARCHIVED,
            archived_at__isnull=True,
            updated_at__lte=retention_cutoff,
        )
    )
    retention_ids = list(retention_due.values_list("id", flat=True))
    anonymized_count = 0
    if retention_ids:
        AccessGrant.objects.filter(
            invitation_id__in=retention_ids,
            revoked_at__isnull=True,
        ).update(revoked_at=effective_now, updated_at=effective_now)
        AccessSession.objects.filter(
            invitation_id__in=retention_ids,
            revoked_at__isnull=True,
        ).update(revoked_at=effective_now, updated_at=effective_now)
        for guest in Guest.objects.filter(
            invitation_id__in=retention_ids,
            anonymized_at__isnull=True,
        ).iterator():
            guest.anonymize()
            guest.save(
                update_fields=[
                    "display_name",
                    "email",
                    "phone",
                    "wishes",
                    "metadata",
                    "anonymized_at",
                    "updated_at",
                ]
            )
            anonymized_count += 1
    return {
        "expiring_soon": expiring_count,
        "expired": expired_count,
        "anonymized_guests": anonymized_count,
    }
