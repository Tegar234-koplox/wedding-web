import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from analytics.models import AnalyticsEvent
from common.models import AuditEvent
from invitations.models import Guest
from leads.models import WhatsAppIntent
from orders.models import Order
from payments.models import PaymentInvoice, PaymentWebhookEvent
from tests.factories import create_invitation, create_package, create_theme


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
    create_user(username="staff", email="staff@example.com", role="admin", is_staff=True)

    response = client.post(
        reverse("api-staff-login"),
        {"username": "staff", "password": "password"},
        content_type="application/json",
    )
    me_response = client.get(reverse("api-staff-session-me"))

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"
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
    staff = create_user(username="staff", email="staff@example.com", role="admin", is_staff=True)
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
    staff = create_user(username="staff", email="staff@example.com", role="admin", is_staff=True)
    assignee = create_user(
        username="editor",
        email="editor@example.com",
        role="editor",
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
def test_staff_operations_lists_leads_audit_and_staff_users(client):
    staff = create_user(username="staff", email="staff@example.com", role="admin", is_staff=True)
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
def test_midtrans_webhook_is_idempotent_and_updates_invoice(client):
    staff = create_user(username="staff", email="staff@example.com", role="admin", is_staff=True)
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
    assert staff.role == "admin"


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
