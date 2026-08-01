from datetime import timedelta

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import Client, override_settings
from django.utils import timezone

from invitations.access import (
    CLIENT_BOOTSTRAP_MAX_AGE,
    AccessDenied,
    access_from_raw_session,
    align_invitation_access_expiry,
    change_client_pin,
    create_grant,
    ensure_guest_grant,
    ensure_preview_grant,
    grant_token,
    issue_client_portal_access,
    login_client_portal,
    redeem_client_bootstrap,
    redeem_guest_access,
    redeem_preview_access,
    rotate_preview_grant,
)
from invitations.models import (
    AccessGrant,
    AccessSession,
    ClientPortalCredential,
    Guest,
    GuestRSVPHistory,
)
from tests.factories import create_invitation, create_package, create_theme


def _staff(username: str):
    return get_user_model().objects.create_user(
        username=username,
        email=f"{username}@example.test",
        password="a-secure-password",
        role="staff",
        is_staff=True,
    )


def _draft_invitation(slug: str):
    return create_invitation(
        theme=create_theme(slug=f"theme-{slug}"),
        status="draft",
        public_slug=slug,
        is_sample=False,
    )


@pytest.mark.django_db
def test_failed_bootstrap_pin_persists_without_consuming_grant():
    invitation = _draft_invitation("bootstrap-failure")
    issued = issue_client_portal_access(invitation, actor=_staff("bootstrap-issuer"))

    with pytest.raises(AccessDenied):
        redeem_client_bootstrap(issued.token, "incorrect-pin")

    credential = ClientPortalCredential.objects.get(invitation=invitation)
    issued.grant.refresh_from_db()
    assert credential.failed_attempts == 1
    assert issued.grant.redeemed_at is None
    assert issued.grant.revoked_at is None


@pytest.mark.django_db
def test_pin_lock_and_tenth_failure_revocation_are_committed():
    invitation = _draft_invitation("bootstrap-lockout")
    issued = issue_client_portal_access(invitation, actor=_staff("lockout-issuer"))
    credential = ClientPortalCredential.objects.get(invitation=invitation)
    credential.failed_attempts = 4
    credential.save(update_fields=["failed_attempts", "updated_at"])

    with pytest.raises(AccessDenied):
        redeem_client_bootstrap(issued.token, "incorrect-pin")

    credential.refresh_from_db()
    assert credential.failed_attempts == 5
    assert credential.locked_until is not None
    assert credential.locked_until > timezone.now()

    with pytest.raises(AccessDenied):
        redeem_client_bootstrap(issued.token, "incorrect-pin")
    credential.refresh_from_db()
    assert credential.failed_attempts == 5

    credential.failed_attempts = 9
    credential.locked_until = timezone.now() - timedelta(seconds=1)
    credential.save(update_fields=["failed_attempts", "locked_until", "updated_at"])
    with pytest.raises(AccessDenied):
        redeem_client_bootstrap(issued.token, "incorrect-pin")

    credential.refresh_from_db()
    issued.grant.refresh_from_db()
    assert credential.failed_attempts == 10
    assert issued.grant.revoked_at is not None


@pytest.mark.django_db
def test_bootstrap_grant_is_short_lived_and_one_time():
    invitation = _draft_invitation("bootstrap-one-time")
    before_issue = timezone.now()
    issued = issue_client_portal_access(invitation, actor=_staff("one-time-issuer"))

    assert issued.grant.expires_at <= before_issue + CLIENT_BOOTSTRAP_MAX_AGE + timedelta(seconds=1)
    access = redeem_client_bootstrap(issued.token, issued.initial_pin or "")
    issued.grant.refresh_from_db()
    assert access.session.kind == AccessSession.Kind.CLIENT
    assert issued.grant.redeemed_at is not None

    with pytest.raises(AccessDenied):
        redeem_client_bootstrap(issued.token, issued.initial_pin or "")


@pytest.mark.django_db
def test_publication_expiry_does_not_extend_unredeemed_bootstrap_grant():
    invitation = _draft_invitation("bootstrap-publication-expiry")
    issued = issue_client_portal_access(invitation, actor=_staff("publication-issuer"))
    original_expiry = issued.grant.expires_at
    invitation.expires_at = timezone.now() + timedelta(days=90)
    invitation.save(update_fields=["expires_at", "updated_at"])

    align_invitation_access_expiry(invitation)

    issued.grant.refresh_from_db()
    assert issued.grant.redeemed_at is None
    assert issued.grant.expires_at == original_expiry


@pytest.mark.django_db
def test_pin_change_persists_failures_and_revokes_other_client_sessions():
    invitation = _draft_invitation("pin-rotation")
    issued = issue_client_portal_access(invitation, actor=_staff("pin-issuer"))
    initial_pin = issued.initial_pin or ""
    primary = redeem_client_bootstrap(issued.token, initial_pin)
    secondary = login_client_portal(issued.grant.id, initial_pin)

    with pytest.raises(AccessDenied):
        change_client_pin(primary, "incorrect-pin", "replacement-passphrase")
    credential = ClientPortalCredential.objects.get(invitation=invitation)
    assert credential.failed_attempts == 1

    change_client_pin(primary, initial_pin, "replacement-passphrase")
    credential.refresh_from_db()
    primary.session.refresh_from_db()
    secondary.session.refresh_from_db()
    assert credential.must_change_pin is False
    assert credential.failed_attempts == 0
    assert primary.session.revoked_at is None
    assert secondary.session.revoked_at is not None
    assert (
        access_from_raw_session(
            secondary.raw_token,
            kind=AccessSession.Kind.CLIENT,
        )
        is None
    )


@pytest.mark.django_db
def test_guest_session_stops_working_when_guest_is_archived():
    invitation = _draft_invitation("archived-guest")
    guest = invitation.guests.get()
    grant = ensure_guest_grant(guest)
    access = redeem_guest_access(grant_token(grant))
    assert access_from_raw_session(access.raw_token, kind=AccessSession.Kind.GUEST) is not None

    guest.archived_at = timezone.now()
    guest.save(update_fields=["archived_at", "updated_at"])

    assert access_from_raw_session(access.raw_token, kind=AccessSession.Kind.GUEST) is None


@pytest.mark.django_db
def test_database_prevents_multiple_active_guest_grants_and_rotation_revokes_old_grant():
    invitation = _draft_invitation("single-active-guest-grant")
    guest = invitation.guests.get()
    first = ensure_guest_grant(guest)

    with pytest.raises(IntegrityError), transaction.atomic():
        create_grant(
            invitation=invitation,
            guest=guest,
            purpose=AccessGrant.Purpose.GUEST_INVITATION,
            scopes=["invitation:read"],
            expires_at=timezone.now() + timedelta(days=1),
        )

    replacement = ensure_guest_grant(guest, rotate=True)
    first.refresh_from_db()
    assert first.revoked_at is not None
    assert replacement.revoked_at is None
    assert (
        AccessGrant.objects.filter(
            guest=guest,
            purpose=AccessGrant.Purpose.GUEST_INVITATION,
            revoked_at__isnull=True,
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_preview_grant_redeems_to_short_lived_http_only_session(client):
    invitation = _draft_invitation("preview-fragment-session")
    grant = ensure_preview_grant(invitation, actor=_staff("preview-issuer"))

    response = client.post(
        "/api/v1/access/preview/redeem",
        {"token": grant_token(grant)},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["redirect_to"].endswith(f"/id/i/{invitation.public_access_id}")
    assert settings.PREVIEW_ACCESS_COOKIE_NAME in response.cookies
    cookie = response.cookies[settings.PREVIEW_ACCESS_COOKIE_NAME]
    assert cookie["httponly"] is True
    assert cookie["samesite"] == "Strict"
    session = AccessSession.objects.get(kind=AccessSession.Kind.PREVIEW)
    assert session.grant == grant
    assert session.expires_at <= timezone.now() + timedelta(hours=1)

    detail = client.get(f"/api/v1/invitations/{invitation.public_access_id}")
    weather = client.get(f"/api/v1/invitations/{invitation.public_access_id}/weather")
    assert detail.status_code == 200
    assert weather.status_code == 200


@pytest.mark.django_db
def test_preview_logout_requires_csrf_and_revokes_the_session():
    client = Client(enforce_csrf_checks=True)
    invitation = _draft_invitation("preview-session-logout")
    grant = ensure_preview_grant(invitation, actor=_staff("preview-logout-issuer"))
    redeem = client.post(
        "/api/v1/access/preview/redeem",
        {"token": grant_token(grant)},
        content_type="application/json",
    )
    csrf_token = redeem.json()["csrf_token"]
    session = AccessSession.objects.get(kind=AccessSession.Kind.PREVIEW)

    rejected = client.post("/api/v1/access/preview/logout")
    accepted = client.post(
        "/api/v1/access/preview/logout",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    session.refresh_from_db()
    assert rejected.status_code == 403
    assert accepted.status_code == 204
    assert session.revoked_at is not None
    assert accepted.cookies[settings.PREVIEW_ACCESS_COOKIE_NAME]["max-age"] == 0


@pytest.mark.django_db
def test_rotating_preview_grant_invalidates_existing_preview_session(client):
    invitation = _draft_invitation("preview-session-rotation")
    grant = ensure_preview_grant(invitation, actor=_staff("preview-rotation-issuer"))
    access = redeem_preview_access(grant_token(grant))
    client.cookies[settings.PREVIEW_ACCESS_COOKIE_NAME] = access.raw_token
    assert client.get(f"/api/v1/invitations/{invitation.public_access_id}").status_code == 200

    rotate_preview_grant(invitation, actor=_staff("preview-rotator"))

    assert client.get(f"/api/v1/invitations/{invitation.public_access_id}").status_code == 404


@pytest.mark.django_db
@override_settings(
    LEGACY_INVITATION_LINKS_ENABLED=False,
    LEGACY_INVITATION_LINK_CUTOFF="",
)
def test_preview_capability_is_not_accepted_in_query_after_legacy_cutoff(client):
    invitation = _draft_invitation("preview-query-disabled")
    grant = ensure_preview_grant(invitation, actor=_staff("preview-query-issuer"))

    response = client.get(
        f"/api/v1/invitations/{invitation.public_access_id}/preview",
        {"token": grant_token(grant)},
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_guest_session_can_read_and_submit_rsvp_for_draft_invitation(client):
    invitation = _draft_invitation("draft-guest-read")
    invitation.package = create_package(code="signature")
    invitation.save(update_fields=["package", "updated_at"])
    guest = invitation.guests.get()
    grant = ensure_guest_grant(guest)
    access = redeem_guest_access(grant_token(grant))
    detail_path = f"/api/v1/invitations/{invitation.public_access_id}"
    rsvp_path = f"{detail_path}/rsvp"

    assert client.get(detail_path).status_code == 404
    client.cookies[settings.GUEST_ACCESS_COOKIE_NAME] = access.raw_token
    detail = client.get(detail_path)
    assert detail.status_code == 200
    assert detail.json()["guest"] == {"displayName": guest.display_name}

    rsvp = client.post(
        rsvp_path,
        {
            "rsvp_status": Guest.RSVPStatus.ACCEPTED,
            "attendance_count": 1,
        },
        content_type="application/json",
    )
    guest.refresh_from_db()
    assert rsvp.status_code == 200
    assert guest.rsvp_status == Guest.RSVPStatus.ACCEPTED
    assert GuestRSVPHistory.objects.filter(
        guest=guest,
        grant=grant,
        source="guest_session",
    ).exists()


@pytest.mark.django_db
def test_client_portal_requires_initial_pin_change_and_export_scope(client):
    invitation = _draft_invitation("portal-pin-change")
    issued = issue_client_portal_access(invitation, actor=_staff("portal-issuer"))
    initial_pin = issued.initial_pin or ""
    access = redeem_client_bootstrap(issued.token, initial_pin)
    client.cookies[settings.CLIENT_ACCESS_COOKIE_NAME] = access.raw_token

    before_change = client.get("/api/v1/client/portal")
    assert before_change.status_code == 404

    change_client_pin(access, initial_pin, "replacement-passphrase")
    after_change = client.get("/api/v1/client/portal")
    assert after_change.status_code == 200

    access.session.scopes = [scope for scope in access.session.scopes if scope != "guests:export"]
    access.session.save(update_fields=["scopes", "updated_at"])
    export = client.get("/api/v1/client/portal/guest-links/export")
    assert export.status_code == 404


@pytest.mark.django_db
def test_guest_redeem_is_one_time_and_rsvp_requires_csrf():
    client = Client(enforce_csrf_checks=True)
    invitation = create_invitation(
        theme=create_theme(slug="theme-guest-rsvp-session"),
        public_slug="guest-rsvp-session",
        is_sample=False,
    )
    invitation.package = create_package(code="signature")
    invitation.save(update_fields=["package", "updated_at"])
    guest = invitation.guests.get()
    grant = ensure_guest_grant(guest)

    redeemed = client.post(
        "/api/v1/access/guest/redeem",
        {"token": grant_token(grant)},
        content_type="application/json",
    )
    assert redeemed.status_code == 200
    csrf_token = redeemed.json()["csrf_token"]
    assert settings.GUEST_ACCESS_COOKIE_NAME in redeemed.cookies

    replay = client.post(
        "/api/v1/access/guest/redeem",
        {"token": grant_token(grant)},
        content_type="application/json",
    )
    assert replay.status_code == 404

    missing_csrf = client.post(
        f"/api/v1/invitations/{invitation.public_access_id}/rsvp",
        {
            "rsvp_status": Guest.RSVPStatus.ACCEPTED,
            "attendance_count": 1,
            "wishes": "Selamat",
        },
        content_type="application/json",
    )
    guest.refresh_from_db()
    assert missing_csrf.status_code == 403
    assert guest.rsvp_status == Guest.RSVPStatus.PENDING

    accepted = client.post(
        f"/api/v1/invitations/{invitation.public_access_id}/rsvp",
        {
            "rsvp_status": Guest.RSVPStatus.ACCEPTED,
            "attendance_count": 1,
            "wishes": "Selamat",
        },
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    guest.refresh_from_db()
    assert accepted.status_code == 200
    assert guest.rsvp_status == Guest.RSVPStatus.ACCEPTED
    assert GuestRSVPHistory.objects.filter(
        guest=guest,
        grant=grant,
        source="guest_session",
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_public_access_id_migration_backfills_distinct_values_for_existing_rows():
    executor = MigrationExecutor(connection)
    executor.migrate([("invitations", "0011_backfill_publication_expiry")])
    try:
        old_apps = executor.loader.project_state(
            [("invitations", "0011_backfill_publication_expiry")]
        ).apps
        Theme = old_apps.get_model("catalog", "Theme")
        HistoricalInvitation = old_apps.get_model("invitations", "Invitation")
        theme = Theme.objects.create(
            slug="public-id-migration-theme",
            renderer_key="public-id-migration-theme",
            status="published",
        )
        for index in range(3):
            HistoricalInvitation.objects.create(
                public_slug=f"existing-invitation-{index}",
                theme_id=theme.id,
                renderer_key=theme.renderer_key,
                content={
                    "couple": {
                        "partnerOne": "Alya",
                        "partnerTwo": "Raka",
                    }
                },
            )

        executor = MigrationExecutor(connection)
        executor.migrate([("invitations", "0012_invitation_access_foundation")])
        migrated_apps = executor.loader.project_state(
            [("invitations", "0012_invitation_access_foundation")]
        ).apps
        MigratedInvitation = migrated_apps.get_model("invitations", "Invitation")
        public_ids = list(
            MigratedInvitation.objects.filter(
                public_slug__startswith="existing-invitation-"
            ).values_list("public_access_id", flat=True)
        )

        assert len(public_ids) == 3
        assert None not in public_ids
        assert len(set(public_ids)) == 3
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
