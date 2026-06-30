from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from common.models import AuditEvent
from common.notifications import enqueue_client_notification
from invitations.models import Invitation
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
    audit_and_notify(
        actor=actor,
        action="wedding.archived",
        target=LifecycleAuditTarget("invitation", invitation.public_slug),
        recipient=invitation_client_recipient(invitation),
        reason=reason,
        metadata={"status": invitation.status},
    )
    return invitation
