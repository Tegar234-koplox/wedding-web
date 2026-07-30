import importlib
from datetime import timedelta

import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from invitations.expiration import publication_expires_at, publication_lifetime_days
from invitations.models import Guest, Invitation
from invitations.preview import preview_token_for
from orders.models import Order
from tests.factories import create_invitation, create_package, create_theme


def create_staff_user():
    return get_user_model().objects.create_user(
        username="expiration-editor",
        email="expiration-editor@example.com",
        password="password",
        role="staff",
        is_staff=True,
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("package_code", "lifetime_days"),
    [
        ("essential", 90),
        ("signature", 180),
        ("couture", 365),
    ],
)
def test_publication_expiry_uses_package_lifetime(package_code, lifetime_days):
    invitation = create_invitation(
        theme=create_theme(slug=f"theme-{package_code}"),
        status=Invitation.Status.DRAFT,
        public_slug=f"invite-{package_code}",
        is_sample=False,
    )
    invitation.package = create_package(code=package_code)
    invitation.save(update_fields=["package", "updated_at"])
    published_at = timezone.now()

    assert publication_lifetime_days(invitation) == lifetime_days
    assert publication_expires_at(
        invitation,
        published_at=published_at,
    ) == published_at + timedelta(days=lifetime_days)


@pytest.mark.django_db
def test_staff_publication_sets_signature_expiry(client):
    staff = create_staff_user()
    theme = create_theme(slug="expiration-signature")
    invitation = create_invitation(
        theme=theme,
        status=Invitation.Status.DRAFT,
        public_slug="expiration-signature",
        is_sample=False,
    )
    package = create_package(code="signature")
    invitation.package = package
    invitation.approval_status = Invitation.ApprovalStatus.APPROVED_FOR_PUBLISH
    invitation.save(update_fields=["package", "approval_status", "updated_at"])
    Order.objects.create(
        reference="expiration-signature",
        client_name="Alya & Raka",
        invitation=invitation,
        theme=theme,
        package=package,
        status=Order.Status.APPROVED,
    )
    client.force_login(staff)

    response = client.post(
        reverse("admin-invitation-publish", kwargs={"public_slug": invitation.public_slug})
    )

    invitation.refresh_from_db()
    assert response.status_code == 200
    assert invitation.expires_at == invitation.published_at + timedelta(days=180)


@pytest.mark.django_db
def test_expired_invitation_is_not_public_but_preview_remains_available(client):
    invitation = create_invitation(
        theme=create_theme(slug="expired-public"),
        public_slug="expired-public",
        is_sample=False,
    )
    invitation.expires_at = timezone.now() - timedelta(seconds=1)
    invitation.save(update_fields=["expires_at", "updated_at"])

    public_response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )
    weather_response = client.get(
        reverse("invitation-weather", kwargs={"public_slug": invitation.public_slug})
    )
    preview_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": preview_token_for(invitation)},
    )

    assert public_response.status_code == 404
    assert weather_response.status_code == 404
    assert preview_response.status_code == 200


@pytest.mark.django_db
def test_expired_invitation_rejects_public_rsvp(client):
    invitation = create_invitation(
        theme=create_theme(slug="expired-rsvp"),
        public_slug="expired-rsvp",
        is_sample=False,
    )
    invitation.package = create_package(code="signature")
    invitation.expires_at = timezone.now() - timedelta(seconds=1)
    invitation.save(update_fields=["package", "expires_at", "updated_at"])

    response = client.post(
        reverse("invitation-rsvp", kwargs={"public_slug": invitation.public_slug}),
        {
            "token": f"secret-{invitation.public_slug}",
            "rsvp_status": Guest.RSVPStatus.ACCEPTED,
            "attendance_count": 1,
            "wishes": "Selamat!",
        },
        content_type="application/json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_published_theme_sample_does_not_expire(client):
    invitation = create_invitation(
        theme=create_theme(slug="permanent-sample"),
        public_slug="permanent-sample",
        is_sample=True,
    )
    invitation.expires_at = timezone.now() - timedelta(days=1)
    invitation.save(update_fields=["expires_at", "updated_at"])

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_lifecycle_refresh_marks_published_customer_expired_but_preserves_sample(
    client,
    settings,
):
    customer = create_invitation(
        theme=create_theme(slug="lifecycle-customer"),
        public_slug="lifecycle-customer",
        is_sample=False,
    )
    sample = create_invitation(
        theme=create_theme(slug="lifecycle-sample"),
        public_slug="lifecycle-sample",
        is_sample=True,
    )
    expired_at = timezone.now() - timedelta(seconds=1)
    customer.expires_at = expired_at
    customer.save(update_fields=["expires_at", "updated_at"])
    sample.expires_at = expired_at
    sample.save(update_fields=["expires_at", "updated_at"])
    settings.BILLING_CRON_SECRET = "test-cron-secret"

    response = client.post(
        reverse("billing-lifecycle-refresh"),
        HTTP_X_CRON_SECRET="test-cron-secret",
    )

    customer.refresh_from_db()
    sample.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["expired"] == 1
    assert customer.status == Invitation.Status.EXPIRED
    assert sample.status == Invitation.Status.PUBLISHED


@pytest.mark.django_db
def test_migration_backfills_existing_customer_and_clears_sample_expiry():
    package = create_package(code="signature")
    customer = create_invitation(
        theme=create_theme(slug="migration-customer"),
        public_slug="migration-customer",
        is_sample=False,
    )
    customer.package = package
    customer.expires_at = None
    customer.save(update_fields=["package", "expires_at", "updated_at"])
    sample = create_invitation(
        theme=create_theme(slug="migration-sample"),
        public_slug="migration-sample",
        is_sample=True,
    )
    sample.expires_at = timezone.now() + timedelta(days=1)
    sample.save(update_fields=["expires_at", "updated_at"])

    migration = importlib.import_module(
        "invitations.migrations.0011_backfill_publication_expiry"
    )
    migration.backfill_publication_expiry(apps, None)

    customer.refresh_from_db()
    sample.refresh_from_db()
    assert customer.expires_at == customer.published_at + timedelta(days=180)
    assert sample.expires_at is None
