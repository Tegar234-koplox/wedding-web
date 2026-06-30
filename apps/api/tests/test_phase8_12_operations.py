import importlib

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from analytics.models import AnalyticsEvent
from common.models import AuditEvent
from invitations.models import Guest, InvitationMedia
from leads.models import WhatsAppIntent
from media_library.models import MediaAsset
from orders.models import Order
from payments.models import PaymentInvoice, PaymentWebhookEvent
from tests.factories import create_invitation, create_package, create_theme
from tickets.models import Ticket


def create_user(*, username: str, email: str, role: str = "client", is_staff: bool = False):
    return get_user_model().objects.create_user(
        username=username,
        email=email,
        password="password",
        role=role,
        is_staff=is_staff,
    )


@pytest.mark.django_db
def test_staff_can_login_from_frontend_session_endpoint(client):
    create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)

    response = client.post(
        reverse("api-staff-login"),
        {"username": "staff", "password": "password"},
        content_type="application/json",
    )
    me_response = client.get(reverse("api-staff-session-me"))

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "staff"
    assert me_response.status_code == 200
    assert me_response.json()["user"]["username"] == "staff"


@pytest.mark.django_db
def test_client_can_login_from_frontend_session_endpoint(client):
    create_user(username="client", email="client@example.com")

    response = client.post(
        reverse("api-client-login"),
        {"username": "client", "password": "password"},
        content_type="application/json",
    )
    profile_response = client.get(reverse("client-profile"))

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "client"
    assert profile_response.status_code == 200
    assert profile_response.json()["user"]["username"] == "client"


@pytest.mark.django_db
def test_staff_user_cannot_use_client_session_endpoint(client):
    staff = create_user(
        username="staff",
        email="staff@example.com",
        role="staff",
        is_staff=True,
    )

    login_response = client.post(
        reverse("api-client-login"),
        {"username": "staff", "password": "password"},
        content_type="application/json",
    )
    client.force_login(staff)
    profile_response = client.get(reverse("client-profile"))

    assert login_response.status_code == 403
    assert profile_response.status_code == 403


@pytest.mark.django_db
def test_non_staff_cannot_login_to_staff_session_endpoint(client):
    create_user(username="client", email="client@example.com")

    response = client.post(
        reverse("api-staff-login"),
        {"username": "client", "password": "password"},
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_staff_admin_endpoints_deny_anonymous_users(client):
    orders_response = client.get(reverse("admin-order-list"))
    metrics_response = client.get(reverse("admin-dashboard-metrics"))

    assert orders_response.status_code in {401, 403}
    assert metrics_response.status_code in {401, 403}


@pytest.mark.django_db
def test_client_endpoints_deny_anonymous_users(client):
    orders_response = client.get(reverse("client-order-list"))
    invitations_response = client.get(reverse("client-invitation-list"))

    assert orders_response.status_code in {401, 403}
    assert invitations_response.status_code in {401, 403}


@pytest.mark.django_db
def test_client_cannot_query_other_clients_guest_list(client):
    client_a = create_user(username="client-a", email="client-a@example.com")
    client_b = create_user(username="client-b", email="client-b@example.com")
    theme = create_theme()
    invitation_a = create_invitation(theme=theme, public_slug="client-a-wedding", is_sample=False)
    invitation_b = create_invitation(theme=theme, public_slug="client-b-wedding", is_sample=False)
    invitation_a.client_user = client_a
    invitation_a.save(update_fields=["client_user", "updated_at"])
    invitation_b.client_user = client_b
    invitation_b.save(update_fields=["client_user", "updated_at"])
    client.force_login(client_a)

    response = client.get(
        reverse(
            "client-guest-list",
            kwargs={"public_slug": invitation_b.public_slug},
        )
    )

    assert response.status_code == 404


def test_postgres_access_sql_keeps_staff_off_guest_rows():
    migration = importlib.import_module("tickets.migrations.0002_access_foundation_sql")

    assert "guest_aggregates_per_wedding" in migration.FORWARD_SQL
    assert "staff_select_guests" not in migration.FORWARD_SQL
    staff_guest_policy = (
        "ON invitations_guest\nFOR SELECT\nUSING (app.current_user_role() = 'staff')"
    )
    assert staff_guest_policy not in migration.FORWARD_SQL
    assert "GRANT SELECT ON guest_aggregates_per_wedding TO staff" in migration.FORWARD_SQL
    view_sql = migration.FORWARD_SQL.split("CREATE OR REPLACE VIEW guest_aggregates_per_wedding")[1]
    assert "display_name" not in view_sql
    assert "email" not in view_sql
    assert "phone" not in view_sql


@pytest.mark.django_db
def test_staff_user_cannot_use_client_data_endpoints(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    client.force_login(staff)

    orders_response = client.get(reverse("client-order-list"))
    invitations_response = client.get(reverse("client-invitation-list"))

    assert orders_response.status_code == 403
    assert invitations_response.status_code == 403


@pytest.mark.django_db
def test_ticket_model_links_to_existing_invitation_and_client_user():
    client_user = create_user(username="ticket-client", email="ticket-client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="ticket-wedding", is_sample=False)
    invitation.client_user = client_user
    invitation.save(update_fields=["client_user", "updated_at"])

    ticket = Ticket.objects.create(
        invitation=invitation,
        created_by=client_user,
        category=Ticket.Category.TECHNICAL,
    )

    assert ticket.status == Ticket.Status.OPEN
    assert ticket.invitation.client_user == client_user


@pytest.mark.django_db
def test_superuser_can_login_to_staff_session_endpoint_with_default_role(client):
    get_user_model().objects.create_superuser(
        username="owner",
        email="owner@example.com",
        password="password",
    )

    response = client.post(
        reverse("api-staff-login"),
        {"username": "owner", "password": "password"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["user"]["username"] == "owner"


@pytest.mark.django_db
def test_staff_creates_manual_order_from_lead_and_writes_audit(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    theme = create_theme()
    package = create_package()
    client.force_login(staff)

    response = client.post(
        reverse("admin-order-list"),
        {
            "reference": "ord-alya-raka",
            "status": Order.Status.CONSULTING,
            "theme_slug": theme.slug,
            "package_code": package.code,
            "client_name": "Alya",
            "client_email": "alya@example.com",
            "client_phone": "+628123",
            "total_amount": "649000.00",
            "currency": "IDR",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert Order.objects.get(reference="ord-alya-raka").status == Order.Status.CONSULTING
    assert AuditEvent.objects.filter(action="order.created", actor=staff).exists()


@pytest.mark.django_db
def test_staff_updates_order_status_and_assignment(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    assignee = create_user(
        username="editor",
        email="editor@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme()
    order = Order.objects.create(reference="ord-edit", client_name="Alya", theme=theme)
    client.force_login(staff)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "status": Order.Status.IN_DESIGN,
            "assigned_staff_username": assignee.username,
        },
        content_type="application/json",
    )

    order.refresh_from_db()
    assert response.status_code == 200
    assert order.status == Order.Status.IN_DESIGN
    assert order.assigned_staff == assignee
    assert AuditEvent.objects.filter(action="order.status_changed").exists()


@pytest.mark.django_db
def test_staff_order_package_update_syncs_linked_invitation_package(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    theme = create_theme()
    essential = create_package(code="essential")
    couture = create_package(code="couture")
    invitation = create_invitation(theme=theme, public_slug="package-sync")
    invitation.package = essential
    invitation.save(update_fields=["package", "updated_at"])
    order = Order.objects.create(
        reference="ord-package-sync",
        client_name="Alya",
        invitation=invitation,
        package=essential,
        theme=theme,
    )
    client.force_login(staff)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"package_code": couture.code},
        content_type="application/json",
    )

    invitation.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["package_code"] == "couture"
    assert invitation.package == couture


@pytest.mark.django_db
def test_staff_operations_lists_leads_audit_and_staff_users(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    create_user(username="client", email="client@example.com")
    WhatsAppIntent.objects.create(
        theme_slug="elegant-classic",
        package_code="signature",
        locale="id",
        campaign="launch",
        source="home",
    )
    AuditEvent.objects.create(
        actor=staff,
        action="order.created",
        resource_type="order",
        resource_reference="ord-001",
    )
    client.force_login(staff)

    leads_response = client.get(reverse("admin-lead-list"))
    audit_response = client.get(reverse("admin-audit-event-list"))
    staff_response = client.get(reverse("admin-staff-user-list"))

    assert leads_response.status_code == 200
    assert leads_response.json()[0]["campaign"] == "launch"
    assert audit_response.status_code == 200
    assert audit_response.json()[0]["resource_reference"] == "ord-001"
    assert staff_response.status_code == 200
    assert [item["username"] for item in staff_response.json()] == ["staff"]


@pytest.mark.django_db
def test_client_order_endpoint_only_returns_owned_orders(client):
    client_user = create_user(username="client", email="client@example.com")
    other_user = create_user(username="other", email="other@example.com")
    theme = create_theme()
    Order.objects.create(
        reference="owned",
        client_name="Owned",
        client_user=client_user,
        theme=theme,
    )
    Order.objects.create(
        reference="hidden",
        client_name="Hidden",
        client_user=other_user,
        theme=theme,
    )
    client.force_login(client_user)

    response = client.get(reverse("client-order-list"))

    assert response.status_code == 200
    assert [item["reference"] for item in response.json()] == ["owned"]


@pytest.mark.django_db
def test_client_can_update_owned_invitation_content_without_changing_approval(client):
    client_user = create_user(username="client", email="client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, status="draft")
    invitation.client_user = client_user
    invitation.approval_status = "draft"
    invitation.save(update_fields=["client_user", "approval_status", "updated_at"])
    client.force_login(client_user)

    response = client.patch(
        reverse("client-invitation-detail", kwargs={"public_slug": invitation.public_slug}),
        {
            "approval_status": "approved_for_publish",
            "content": {
                **invitation.content,
                "couple": {"partnerOne": "Alya", "partnerTwo": "Raka Updated"},
            },
        },
        content_type="application/json",
    )

    invitation.refresh_from_db()
    assert response.status_code == 200
    assert invitation.content["couple"]["partnerTwo"] == "Raka Updated"
    assert invitation.approval_status == "draft"
    assert AuditEvent.objects.filter(action="invitation.client_updated").exists()


@pytest.mark.django_db
def test_client_cannot_edit_invitation_after_publish_approval(client):
    client_user = create_user(username="client", email="client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, status="draft")
    invitation.client_user = client_user
    invitation.approval_status = "approved_for_publish"
    invitation.save(update_fields=["client_user", "approval_status", "updated_at"])
    client.force_login(client_user)

    response = client.patch(
        reverse("client-invitation-detail", kwargs={"public_slug": invitation.public_slug}),
        {"content": {**invitation.content, "couple": {"partnerOne": "Changed"}}},
        content_type="application/json",
    )

    invitation.refresh_from_db()
    assert response.status_code == 400
    assert invitation.content["couple"]["partnerOne"] == "Alya"


@pytest.mark.django_db
def test_client_submit_revision_updates_order_for_staff_queue(client):
    client_user = create_user(username="client", email="client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, status="draft", public_slug="revision-flow")
    order = Order.objects.create(
        reference="ord-revision-flow",
        client_name="Client",
        client_user=client_user,
        invitation=invitation,
        theme=theme,
        status=Order.Status.CLIENT_REVIEW,
    )
    client.force_login(client_user)

    response = client.post(
        reverse(
            "client-invitation-submit-revision",
            kwargs={"public_slug": invitation.public_slug},
        )
    )

    invitation.refresh_from_db()
    order.refresh_from_db()
    assert response.status_code == 200
    assert invitation.status == "review"
    assert invitation.approval_status == "submitted"
    assert order.status == Order.Status.REVISION
    assert AuditEvent.objects.filter(
        action="order.status_changed",
        resource_reference=order.reference,
    ).exists()


@pytest.mark.django_db
def test_client_approve_publish_updates_order_for_staff_publish_queue(client):
    client_user = create_user(username="client", email="client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, status="draft", public_slug="approve-flow")
    order = Order.objects.create(
        reference="ord-approve-flow",
        client_name="Client",
        client_user=client_user,
        invitation=invitation,
        theme=theme,
        status=Order.Status.CLIENT_REVIEW,
    )
    client.force_login(client_user)

    response = client.post(
        reverse(
            "client-invitation-approve-publish",
            kwargs={"public_slug": invitation.public_slug},
        )
    )

    invitation.refresh_from_db()
    order.refresh_from_db()
    assert response.status_code == 200
    assert invitation.approval_status == "approved_for_publish"
    assert order.status == Order.Status.APPROVED
    assert AuditEvent.objects.filter(action="invitation.publish_approved").exists()


@pytest.mark.django_db
def test_staff_publishes_client_approved_invitation(client):
    staff = create_user(username="editor", email="editor@example.com", role="staff", is_staff=True)
    theme = create_theme()
    invitation = create_invitation(theme=theme, status="draft")
    invitation.approval_status = "approved_for_publish"
    invitation.save(update_fields=["approval_status", "updated_at"])
    order = Order.objects.create(
        reference="ord-ready",
        client_name="Ready",
        invitation=invitation,
        theme=theme,
        status=Order.Status.APPROVED,
    )
    client.force_login(staff)

    response = client.post(
        reverse("admin-invitation-publish", kwargs={"public_slug": invitation.public_slug})
    )

    invitation.refresh_from_db()
    order.refresh_from_db()
    assert response.status_code == 200
    assert invitation.status == "published"
    assert invitation.approval_status == "published"
    assert invitation.published_at is not None
    assert order.status == Order.Status.PUBLISHED
    assert AuditEvent.objects.filter(action="order.status_changed").exists()
    assert AuditEvent.objects.filter(action="invitation.published").exists()


@pytest.mark.django_db
def test_staff_cannot_publish_before_client_approval(client):
    staff = create_user(username="editor", email="editor@example.com", role="staff", is_staff=True)
    theme = create_theme()
    invitation = create_invitation(theme=theme, status="draft", public_slug="unapproved")
    invitation.approval_status = "client_review"
    invitation.save(update_fields=["approval_status", "updated_at"])
    client.force_login(staff)

    response = client.post(
        reverse("admin-invitation-publish", kwargs={"public_slug": invitation.public_slug})
    )

    invitation.refresh_from_db()
    assert response.status_code == 400
    assert invitation.status == "draft"
    assert invitation.approval_status == "client_review"


@pytest.mark.django_db
def test_staff_lists_pending_publish_invitations_by_state(client):
    staff = create_user(username="editor", email="editor@example.com", role="staff", is_staff=True)
    theme = create_theme()
    pending = create_invitation(theme=theme, status="draft", public_slug="pending")
    pending.approval_status = "approved_for_publish"
    pending.save(update_fields=["approval_status", "updated_at"])
    published = create_invitation(theme=theme, status="published", public_slug="published")
    published.approval_status = "published"
    published.save(update_fields=["approval_status", "updated_at"])
    client.force_login(staff)

    response = client.get(reverse("admin-invitation-list"), {"state": "pending_publish"})

    assert response.status_code == 200
    assert [item["public_slug"] for item in response.json()] == ["pending"]


@pytest.mark.django_db
def test_public_rsvp_requires_personal_token_and_records_event(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme)

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

    assert response.status_code == 200
    guest = invitation.guests.get()
    guest.refresh_from_db()
    assert guest.rsvp_status == Guest.RSVPStatus.ACCEPTED
    assert guest.retention_expires_at is not None
    assert AnalyticsEvent.objects.filter(
        event_type=AnalyticsEvent.EventType.RSVP_SUBMITTED
    ).exists()


@pytest.mark.django_db
def test_client_guest_export_excludes_anonymized_records(client):
    client_user = create_user(username="client", email="client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme)
    invitation.client_user = client_user
    invitation.save(update_fields=["client_user", "updated_at"])
    guest = invitation.guests.get()
    guest.anonymize()
    guest.save()
    client.force_login(client_user)

    response = client.get(
        reverse("client-guest-export", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    assert "Private Guest" not in response.content.decode()


@pytest.mark.django_db
def test_client_guest_list_and_export_accept_order_owned_invitation(client):
    client_user = create_user(username="client", email="client@example.com")
    other_user = create_user(username="other", email="other@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="order-owned-guest")
    Order.objects.create(
        reference="order-owned",
        client_name="Order Owned",
        client_user=client_user,
        invitation=invitation,
        theme=theme,
    )
    guest = invitation.guests.get()
    guest.rsvp_status = Guest.RSVPStatus.ACCEPTED
    guest.attendance_count = 1
    guest.wishes = "Selamat membuka lembaran baru"
    guest.save(update_fields=["rsvp_status", "attendance_count", "wishes", "updated_at"])

    client.force_login(client_user)
    list_response = client.get(
        reverse("client-guest-list", kwargs={"public_slug": invitation.public_slug})
    )
    export_response = client.get(
        reverse("client-guest-export", kwargs={"public_slug": invitation.public_slug})
    )

    assert list_response.status_code == 200
    assert list_response.json()[0]["rsvp_status"] == Guest.RSVPStatus.ACCEPTED
    assert export_response.status_code == 200
    assert "Selamat membuka lembaran baru" in export_response.content.decode()

    client.force_login(other_user)
    denied_response = client.get(
        reverse("client-guest-list", kwargs={"public_slug": invitation.public_slug})
    )

    assert denied_response.status_code == 404


@pytest.mark.django_db
def test_staff_creates_guest_and_client_can_list_owned_guest(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    client_user = create_user(username="client", email="client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="guest-list")
    invitation.client_user = client_user
    invitation.save(update_fields=["client_user", "updated_at"])
    client.force_login(staff)

    create_response = client.post(
        reverse("admin-invitation-guest-list", kwargs={"public_slug": invitation.public_slug}),
        {
            "display_name": "Budi Family",
            "email": "budi@example.com",
            "phone": "+62812",
            "party_size": 2,
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    assert create_response.json()["personal_token"]
    assert Guest.objects.filter(invitation=invitation, display_name="Budi Family").exists()

    client.force_login(client_user)
    list_response = client.get(
        reverse("client-guest-list", kwargs={"public_slug": invitation.public_slug})
    )

    assert list_response.status_code == 200
    assert "personal_token" not in list_response.json()[0]
    assert {item["display_name"] for item in list_response.json()} == {
        "Private Guest",
        "Budi Family",
    }


@pytest.mark.django_db
def test_staff_archives_guest_and_export_excludes_it(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    client_user = create_user(username="client", email="client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="archive-guest")
    invitation.client_user = client_user
    invitation.save(update_fields=["client_user", "updated_at"])
    guest = invitation.guests.get()
    client.force_login(staff)

    archive_response = client.post(reverse("admin-guest-archive", kwargs={"guest_id": guest.id}))

    assert archive_response.status_code == 200
    guest.refresh_from_db()
    assert guest.archived_at is not None
    assert AuditEvent.objects.filter(action="guest.archived").exists()

    client.force_login(client_user)
    export_response = client.get(
        reverse("client-guest-export", kwargs={"public_slug": invitation.public_slug})
    )

    assert export_response.status_code == 200
    assert "Private Guest" not in export_response.content.decode()


@pytest.mark.django_db
def test_client_sets_backsound_for_owned_invitation(client):
    client_user = create_user(username="client", email="client@example.com")
    theme = create_theme()
    invitation = create_invitation(theme=theme, status="draft", public_slug="music-client")
    invitation.client_user = client_user
    invitation.approval_status = "draft"
    invitation.save(update_fields=["client_user", "approval_status", "updated_at"])
    client.force_login(client_user)

    response = client.patch(
        reverse("client-invitation-music", kwargs={"public_slug": invitation.public_slug}),
        {
            "secure_url": "https://res.cloudinary.com/demo/raw/upload/music-client.mp3",
            "title": "Client song",
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["current"]["asset"]["original_filename"] == "Client song"
    assert InvitationMedia.objects.filter(
        invitation=invitation,
        role=InvitationMedia.Role.BACKSOUND,
    ).exists()


@pytest.mark.django_db
def test_staff_sets_existing_backsound_asset(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    theme = create_theme()
    invitation = create_invitation(theme=theme, status="draft", public_slug="music-staff")
    asset = MediaAsset.objects.create(
        public_id="audio/staff",
        resource_type=MediaAsset.ResourceType.RAW,
        format="ogg",
        secure_url="https://res.cloudinary.com/demo/raw/upload/staff.ogg",
        folder="wedding/invitations",
        original_filename="Staff song",
    )
    client.force_login(staff)

    response = client.patch(
        reverse("admin-invitation-music", kwargs={"public_slug": invitation.public_slug}),
        {"asset_id": str(asset.id)},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["current"]["asset"]["public_id"] == "audio/staff"
    assert AuditEvent.objects.filter(action="invitation.backsound_updated").exists()


@pytest.mark.django_db
def test_midtrans_webhook_is_idempotent_and_updates_invoice(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    theme = create_theme()
    order = Order.objects.create(reference="ord-paid", client_name="Alya", theme=theme)
    invoice = PaymentInvoice.objects.create(
        order=order,
        invoice_number="INV-001",
        idempotency_key="idem-001",
        amount="649000.00",
    )
    payload = {
        "order_id": invoice.invoice_number,
        "transaction_status": "settlement",
        "transaction_id": "midtrans-001",
    }

    first = client.post(reverse("midtrans-webhook"), payload, content_type="application/json")
    second = client.post(reverse("midtrans-webhook"), payload, content_type="application/json")

    invoice.refresh_from_db()
    assert first.status_code == 200
    assert second.json()["status"] == "ignored"
    assert invoice.status == PaymentInvoice.Status.PAID
    assert PaymentWebhookEvent.objects.count() == 1
    assert AuditEvent.objects.filter(action="payment.webhook_processed").exists()
    assert staff.role == "staff"


@pytest.mark.django_db
def test_first_party_analytics_event_ingest(client):
    response = client.post(
        reverse("analytics-event-create"),
        {
            "event_type": AnalyticsEvent.EventType.PREVIEW_OPEN,
            "resource_type": "theme",
            "resource_reference": "elegant-classic",
            "locale": "id",
            "source": "theme-page",
            "metadata": {"package": "signature"},
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert AnalyticsEvent.objects.filter(event_type=AnalyticsEvent.EventType.PREVIEW_OPEN).exists()
