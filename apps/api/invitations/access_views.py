from __future__ import annotations

from uuid import UUID

from django.conf import settings
from django.http import Http404
from django.middleware.csrf import get_token
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from common.permissions import (
    HasStaffRole,
    filter_invitations_for_staff,
    require_recent_staff_mfa,
    require_staff_order_access,
)
from invitations.access import (
    CLIENT_SESSION_COOKIE,
    CLIENT_SESSION_MAX_AGE,
    GUEST_SESSION_COOKIE,
    GUEST_SESSION_MAX_AGE,
    PREVIEW_SESSION_COOKIE,
    PREVIEW_SESSION_MAX_AGE,
    AccessDenied,
    access_from_request,
    change_client_pin,
    issue_client_portal_access,
    login_client_portal,
    redeem_client_bootstrap,
    redeem_guest_access,
    redeem_preview_access,
    revoke_access_session,
)
from invitations.models import AccessSession, ClientPortalCredential, Invitation
from orders.permissions import IsStaffRole
from users.models import User


def _enforce_csrf(request) -> None:
    check = CSRFCheck(lambda _: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f"CSRF Failed: {reason}")


def _set_access_cookie(response: Response, *, kind: str, value: str) -> None:
    if kind == AccessSession.Kind.CLIENT:
        name = getattr(settings, "CLIENT_ACCESS_COOKIE_NAME", CLIENT_SESSION_COOKIE)
        max_age = int(CLIENT_SESSION_MAX_AGE.total_seconds())
    elif kind == AccessSession.Kind.GUEST:
        name = getattr(settings, "GUEST_ACCESS_COOKIE_NAME", GUEST_SESSION_COOKIE)
        max_age = int(GUEST_SESSION_MAX_AGE.total_seconds())
    elif kind == AccessSession.Kind.PREVIEW:
        name = getattr(settings, "PREVIEW_ACCESS_COOKIE_NAME", PREVIEW_SESSION_COOKIE)
        max_age = int(PREVIEW_SESSION_MAX_AGE.total_seconds())
    else:
        raise ValueError("Unsupported access-session kind")
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        secure=bool(getattr(settings, "SESSION_COOKIE_SECURE", False)),
        httponly=True,
        samesite="Strict",
        path="/",
    )


def _delete_access_cookie(response: Response, *, kind: str) -> None:
    if kind == AccessSession.Kind.CLIENT:
        name = getattr(settings, "CLIENT_ACCESS_COOKIE_NAME", CLIENT_SESSION_COOKIE)
    elif kind == AccessSession.Kind.GUEST:
        name = getattr(settings, "GUEST_ACCESS_COOKIE_NAME", GUEST_SESSION_COOKIE)
    elif kind == AccessSession.Kind.PREVIEW:
        name = getattr(settings, "PREVIEW_ACCESS_COOKIE_NAME", PREVIEW_SESSION_COOKIE)
    else:
        raise ValueError("Unsupported access-session kind")
    response.delete_cookie(
        name,
        path="/",
        samesite="Strict",
    )


def _client_site_url(path: str) -> str:
    origin = str(getattr(settings, "CLIENT_SITE_URL", "http://localhost:3000")).rstrip("/")
    return f"{origin}{path}"


def _public_site_url(path: str) -> str:
    origin = str(getattr(settings, "PUBLIC_SITE_URL", "http://localhost:3000")).rstrip("/")
    return f"{origin}{path}"


def _generic_not_found() -> None:
    raise Http404


class StaffClientAccessIssueView(APIView):
    permission_classes = [IsStaffRole, HasStaffRole]
    required_staff_roles = (
        User.StaffRole.OWNER,
        User.StaffRole.SUPPORT,
    )

    def post(self, request, public_slug: str) -> Response:
        require_recent_staff_mfa(request)
        invitation = filter_invitations_for_staff(
            Invitation.objects.select_related("order").filter(public_slug=public_slug),
            request.user,
        ).first()
        if invitation is None:
            raise Http404
        require_staff_order_access(request, invitation)
        issued = issue_client_portal_access(invitation, actor=request.user)
        bootstrap_path = f"/client/access#grant={issued.token}"
        login_path = f"/client/login/{issued.grant.id}"
        AuditEvent.objects.create(
            actor=request.user,
            action="client.access_issued",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
            metadata={
                "grant_id": str(issued.grant.id),
                "expires_at": issued.grant.expires_at.isoformat(),
            },
        )
        return Response(
            {
                "bootstrap_url": _client_site_url(bootstrap_path),
                "return_url": _client_site_url(login_path),
                "initial_pin": issued.initial_pin,
                "expires_at": issued.grant.expires_at,
            },
            status=201,
        )


class ClientBootstrapRedeemView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "client_access"

    def post(self, request) -> Response:
        token = str(request.data.get("token", "")).strip()
        pin = str(request.data.get("pin", ""))
        if not token or not pin:
            _generic_not_found()
        try:
            access = redeem_client_bootstrap(
                token,
                pin,
                user_agent=request.headers.get("User-Agent", ""),
            )
        except (AccessDenied, ClientPortalCredential.DoesNotExist):
            _generic_not_found()
        credential = ClientPortalCredential.objects.get(invitation=access.invitation)
        response = Response(
            {
                "access_id": str(access.session.grant_id),
                "must_change_pin": credential.must_change_pin,
                "csrf_token": get_token(request),
                "redirect_to": "/client/portal",
            }
        )
        _set_access_cookie(
            response,
            kind=AccessSession.Kind.CLIENT,
            value=access.raw_token,
        )
        AuditEvent.objects.create(
            actor=None,
            action="client.access_redeemed",
            resource_type="invitation",
            resource_reference=access.invitation.public_slug,
            metadata={
                "grant_id": str(access.session.grant_id),
                "session_id": str(access.session.id),
            },
        )
        return response


class ClientLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "client_access"

    def post(self, request, grant_id: UUID) -> Response:
        pin = str(request.data.get("pin", ""))
        if not pin:
            _generic_not_found()
        try:
            access = login_client_portal(
                grant_id,
                pin,
                user_agent=request.headers.get("User-Agent", ""),
            )
        except (AccessDenied, ClientPortalCredential.DoesNotExist):
            _generic_not_found()
        credential = ClientPortalCredential.objects.get(invitation=access.invitation)
        response = Response(
            {
                "must_change_pin": credential.must_change_pin,
                "csrf_token": get_token(request),
                "redirect_to": "/client/portal",
            }
        )
        _set_access_cookie(
            response,
            kind=AccessSession.Kind.CLIENT,
            value=access.raw_token,
        )
        return response


class ClientAccessMeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request) -> Response:
        access = access_from_request(request, kind=AccessSession.Kind.CLIENT)
        if access is None:
            _generic_not_found()
        credential = ClientPortalCredential.objects.get(invitation=access.invitation)
        invitation = access.invitation
        content = invitation.content if isinstance(invitation.content, dict) else {}
        couple = content.get("couple") if isinstance(content.get("couple"), dict) else {}
        return Response(
            {
                "access_id": str(access.session.grant_id),
                "public_access_id": str(invitation.public_access_id),
                "public_slug": invitation.public_slug,
                "locale": invitation.default_locale,
                "couple": {
                    "partner_one": couple.get("partnerOne") or couple.get("partner_one") or "",
                    "partner_two": couple.get("partnerTwo") or couple.get("partner_two") or "",
                },
                "must_change_pin": credential.must_change_pin,
                "read_only": access.is_read_only,
                "expires_at": access.session.expires_at,
                "idle_expires_at": access.session.idle_expires_at,
                "csrf_token": get_token(request),
            }
        )


class ClientPinChangeView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "client_access"

    def post(self, request) -> Response:
        _enforce_csrf(request)
        access = access_from_request(request, kind=AccessSession.Kind.CLIENT)
        if access is None or access.is_read_only:
            _generic_not_found()
        current_pin = str(request.data.get("current_pin", ""))
        next_pin = str(request.data.get("next_pin", ""))
        try:
            change_client_pin(access, current_pin, next_pin)
        except AccessDenied as exc:
            raise ValidationError({"next_pin": str(exc)}) from exc
        AuditEvent.objects.create(
            actor=None,
            action="client.pin_changed",
            resource_type="invitation",
            resource_reference=access.invitation.public_slug,
            metadata={"session_id": str(access.session.id)},
        )
        return Response({"changed": True})


class ClientLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        _enforce_csrf(request)
        access = access_from_request(request, kind=AccessSession.Kind.CLIENT)
        if access is not None:
            revoke_access_session(access)
        response = Response(status=204)
        _delete_access_cookie(response, kind=AccessSession.Kind.CLIENT)
        return response


class PreviewAccessRedeemView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "grant_redeem"

    def post(self, request) -> Response:
        token = str(request.data.get("token", "")).strip()
        if not token:
            _generic_not_found()
        try:
            access = redeem_preview_access(
                token,
                user_agent=request.headers.get("User-Agent", ""),
            )
        except AccessDenied:
            _generic_not_found()
        invitation = access.invitation
        response = Response(
            {
                "csrf_token": get_token(request),
                "redirect_to": _public_site_url(
                    f"/{invitation.default_locale}/i/{invitation.public_access_id}"
                ),
            }
        )
        _set_access_cookie(
            response,
            kind=AccessSession.Kind.PREVIEW,
            value=access.raw_token,
        )
        AuditEvent.objects.create(
            actor=None,
            action="preview.access_redeemed",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
            metadata={
                "grant_id": str(access.session.grant_id),
                "session_id": str(access.session.id),
            },
        )
        return response


class PreviewLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        _enforce_csrf(request)
        access = access_from_request(request, kind=AccessSession.Kind.PREVIEW)
        if access is not None:
            revoke_access_session(access)
        response = Response(status=204)
        _delete_access_cookie(response, kind=AccessSession.Kind.PREVIEW)
        return response


class GuestAccessRedeemView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "grant_redeem"

    def post(self, request) -> Response:
        token = str(request.data.get("token", "")).strip()
        if not token:
            _generic_not_found()
        try:
            access = redeem_guest_access(
                token,
                user_agent=request.headers.get("User-Agent", ""),
            )
        except AccessDenied:
            _generic_not_found()
        invitation = access.invitation
        response = Response(
            {
                "csrf_token": get_token(request),
                "redirect_to": _public_site_url(
                    f"/{invitation.default_locale}/i/{invitation.public_access_id}"
                ),
            }
        )
        _set_access_cookie(
            response,
            kind=AccessSession.Kind.GUEST,
            value=access.raw_token,
        )
        AuditEvent.objects.create(
            actor=None,
            action="guest.access_redeemed",
            resource_type="invitation",
            resource_reference=invitation.public_slug,
            metadata={
                "grant_id": str(access.session.grant_id),
                "guest_id": str(access.session.guest_id),
                "session_id": str(access.session.id),
            },
        )
        return response


class GuestAccessMeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request) -> Response:
        access = access_from_request(request, kind=AccessSession.Kind.GUEST)
        if access is None or access.guest is None:
            _generic_not_found()
        return Response(
            {
                "public_access_id": str(access.invitation.public_access_id),
                "public_slug": access.invitation.public_slug,
                "locale": access.invitation.default_locale,
                "display_name": access.guest.display_name,
                "party_size": access.guest.party_size,
                "csrf_token": get_token(request),
            }
        )


class GuestLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        _enforce_csrf(request)
        access = access_from_request(request, kind=AccessSession.Kind.GUEST)
        if access is not None:
            revoke_access_session(access)
        response = Response(status=204)
        _delete_access_cookie(response, kind=AccessSession.Kind.GUEST)
        return response
