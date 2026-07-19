from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.tasks import deliver_bespoke_otp
from invitations.bespoke import (
    approve_review,
    canonical_checksum,
    create_otp_challenge,
    get_review_session,
)
from invitations.models import ClientReviewSession, Invitation, InvitationRevision
from invitations.preview import preview_token_for
from orders.models import BespokeScopeAgreement, Order


def _scope_payload(scope: BespokeScopeAgreement | None) -> dict | None:
    if scope is None:
        return None
    return {
        "id": str(scope.id),
        "version": scope.version,
        "status": scope.status,
        "scope": scope.scope,
        "total_amount": str(scope.total_amount),
        "currency": scope.currency,
        "revision_limit": scope.revision_limit,
        "production_days_min": scope.production_days_min,
        "production_days_max": scope.production_days_max,
        "checksum": scope.checksum,
        "approved_at": scope.approved_at,
    }


def _review_payload(session: ClientReviewSession) -> dict:
    invitation = session.invitation
    order = invitation.order
    scope = (
        session.scope_agreement
        or order.bespoke_scope_agreements.filter(
            status=BespokeScopeAgreement.Status.APPROVED
        ).first()
    )
    approved = hasattr(session, "approval_record")
    current_checksum = canonical_checksum(invitation.content)
    target = canonical_checksum(session.revision.content) if session.revision else None
    return {
        "purpose": session.purpose,
        "expires_at": session.expires_at,
        "approved": approved,
        "stale": bool(target and target != current_checksum),
        "locale": invitation.default_locale,
        "client_name": order.client_name,
        "order_reference": order.reference,
        "public_slug": invitation.public_slug,
        "preview_token": preview_token_for(invitation),
        "scope": _scope_payload(scope),
        "revision": None
        if session.revision is None
        else {
            "id": str(session.revision.id),
            "revision_number": session.revision.revision_number,
            "note": session.revision.note,
            "checksum": target,
        },
        "revisions_used": invitation.revisions.filter(is_final_check=False).count(),
        "otp": None
        if not session.otp_challenges.exists()
        else {
            "channel": session.otp_challenges.latest("created_at").channel,
            "destination": session.otp_challenges.latest("created_at").destination_masked,
            "delivery_status": session.otp_challenges.latest("created_at").delivery_status,
        },
    }


class BespokeReviewDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str) -> Response:
        return Response(_review_payload(get_review_session(token)))


class BespokeReviewRevisionView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request, token: str) -> Response:
        session = get_review_session(token, lock=True)
        if session.purpose != ClientReviewSession.Purpose.FINAL:
            raise ValidationError({"review": "Revision requests require a final review link."})
        if hasattr(session, "approval_record"):
            raise ValidationError({"review": "An approved review cannot request revisions."})
        note = str(request.data.get("note") or "").strip()
        if not note:
            raise ValidationError({"note": "Revision details are required."})
        order = session.invitation.order
        scope = order.bespoke_scope_agreements.filter(
            status=BespokeScopeAgreement.Status.APPROVED
        ).first()
        limit = scope.revision_limit if scope else 8
        used = session.invitation.revisions.filter(is_final_check=False).count()
        if used >= limit:
            raise ValidationError(
                {
                    "revision": (
                        "Included revision rounds are exhausted; create a paid change request."
                    )
                }
            )
        next_number = (
            session.invitation.revisions.order_by("-revision_number")
            .values_list("revision_number", flat=True)
            .first()
            or 0
        ) + 1
        revision = InvitationRevision.objects.create(
            invitation=session.invitation,
            revision_number=next_number,
            content=session.invitation.content,
            note=note,
            is_final_check=False,
        )
        now = timezone.now()
        session.revoked_at = now
        session.save(update_fields=["revoked_at", "updated_at"])
        order.status = (
            Order.Status.PUBLISHED
            if session.invitation.status == Invitation.Status.PUBLISHED
            else Order.Status.REVISION
        )
        order.save(update_fields=["status", "updated_at"])
        return Response(
            {"status": "revision_requested", "revision_number": revision.revision_number},
            status=201,
        )


class BespokeReviewOtpView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token: str) -> Response:
        session = get_review_session(token)
        if hasattr(session, "approval_record"):
            return Response({"status": "already_approved"})
        if session.revision and canonical_checksum(session.revision.content) != canonical_checksum(
            session.invitation.content
        ):
            raise ValidationError({"review": "This review is stale. Ask staff for a new link."})
        challenge, code, phone, email = create_otp_challenge(session)
        deliver_bespoke_otp.apply_async(
            args=[
                str(challenge.id),
                code,
                phone,
                email,
                session.invitation.default_locale,
            ],
            argsrepr="(<redacted>)",
        )
        return Response(
            {
                "status": challenge.delivery_status,
                "channel": challenge.channel,
                "destination": challenge.destination_masked,
                "expires_in": 300,
            },
            status=202,
        )


class BespokeReviewApproveView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token: str) -> Response:
        code = str(request.data.get("code") or "").strip()
        if len(code) != 6 or not code.isdigit():
            raise ValidationError({"code": "Enter the six-digit OTP."})
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        ip_address = forwarded.split(",", 1)[0].strip() or request.META.get("REMOTE_ADDR", "")
        approval = approve_review(
            raw_token=token,
            code=code,
            ip_address=ip_address,
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
        return Response(
            {
                "status": "approved",
                "approved_at": approval.approved_at,
                "checksum": approval.checksum,
            }
        )
