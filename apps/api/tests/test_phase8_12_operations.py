import importlib
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from analytics.models import AnalyticsEvent
from common.models import AuditEvent
from invitations.models import Guest, Invitation, InvitationMedia, WeddingEvent
from invitations.preview import preview_token_for, wishes_token_for
from leads.models import WhatsAppIntent
from media_library.models import MediaAsset
from orders.lifecycle import ensure_order_transition
from orders.models import Order
from payments.models import PaymentInvoice, PaymentRecord, PaymentWebhookEvent
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


def create_staff_order_fixture(reference: str = "staff-ops-001"):
    staff = create_user(
        username=f"staff-{reference}",
        email=f"{reference}@staff.test",
        role="staff",
        is_staff=True,
    )
    theme = create_theme(slug=f"theme-{reference}")
    package = create_package(code=f"pkg-{reference}")
    invitation = create_invitation(theme=theme, public_slug=f"inv-{reference}", is_sample=False)
    invitation.package = package
    invitation.content = {
        **invitation.content,
        "bank_accounts": [
            {"bank": "BCA", "number": "1234567890", "name": "Niskala Studio"},
        ],
    }
    invitation.save(update_fields=["package", "content", "updated_at"])
    order = Order.objects.create(
        reference=reference,
        status=Order.Status.IN_DESIGN,
        payment_status=Order.PaymentStatus.UNPAID,
        theme=theme,
        package=package,
        invitation=invitation,
        assigned_staff=staff,
        client_name="Alya & Raka",
        client_email="client@example.com",
        client_phone="+62812",
        total_amount="649000",
    )
    WeddingEvent.objects.create(
        invitation=invitation,
        event_type=WeddingEvent.EventType.CEREMONY,
        starts_at=timezone.now(),
        venue_name="Masjid Agung",
        address="Jakarta",
        sort_order=1,
    )
    MediaAsset.objects.create(
        public_id=f"{reference}/photo",
        resource_type=MediaAsset.ResourceType.IMAGE,
        secure_url="https://res.cloudinary.com/demo/image/upload/photo.jpg",
        folder="test",
    )
    asset = MediaAsset.objects.get(public_id=f"{reference}/photo")
    InvitationMedia.objects.create(
        invitation=invitation,
        asset=asset,
        role=InvitationMedia.Role.PHOTO,
    )
    Guest.objects.create(
        invitation=invitation,
        access_token_hash=f"accepted-{reference}",
        display_name="Keluarga Budi",
        email="guest@example.com",
        rsvp_status=Guest.RSVPStatus.ACCEPTED,
        attendance_count=2,
    )
    return staff, order


@pytest.mark.django_db
def test_staff_admin_endpoints_deny_anonymous_users(client):
    orders_response = client.get(reverse("admin-order-list"))
    metrics_response = client.get(reverse("admin-dashboard-metrics"))

    assert orders_response.status_code in {401, 403}
    assert metrics_response.status_code in {401, 403}


@pytest.mark.django_db
def test_staff_order_detail_returns_operational_payload_without_guest_rows(client):
    staff, order = create_staff_order_fixture("staff-detail-001")
    client.force_login(staff)

    response = client.get(reverse("admin-order-detail", kwargs={"reference": order.reference}))

    assert response.status_code == 200
    payload = response.json()
    assert payload["order"]["payment_status"] == Order.PaymentStatus.UNPAID
    assert payload["order"]["workflow_label"] == "Proses"
    assert payload["invitation"]["public_slug"] == order.invitation.public_slug
    assert payload["events"][0]["event_type"] == WeddingEvent.EventType.CEREMONY
    assert payload["media"][0]["role"] == InvitationMedia.Role.PHOTO
    assert payload["rsvp"]["total_invited"] == 2
    assert payload["rsvp"]["total_confirmed"] == 1
    assert "/id/i/inv-staff-detail-001/wishes?access=" in payload["wishes_url"]
    assert "/guest-delivery/" in payload["guest_management_url"]
    assert payload["invitation"]["bank_accounts"][0]["bank"] == "BCA"
    content = response.content.decode()
    assert "Keluarga Budi" not in content
    assert "guest@example.com" not in content


@pytest.mark.django_db
def test_staff_can_update_order_payment_status_from_detail_endpoint(client):
    staff, order = create_staff_order_fixture("staff-payment-001")
    client.force_login(staff)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"payment_status": Order.PaymentStatus.DP},
        content_type="application/json",
    )

    assert response.status_code == 200
    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.DP
    assert response.json()["order"]["payment_status_label"] == "DP"


@pytest.mark.django_db
def test_staff_can_record_manual_dp_payment_and_detail_summary(client):
    staff, order = create_staff_order_fixture("staff-payment-record-001")
    client.force_login(staff)

    response = client.post(
        reverse("admin-order-payment-list", kwargs={"reference": order.reference}),
        {
            "payment_type": PaymentRecord.Type.DP,
            "method": PaymentRecord.Method.BANK_TRANSFER,
            "review_status": PaymentRecord.ReviewStatus.VALID,
            "amount": "100000",
            "proof_url": "https://res.cloudinary.com/demo/image/upload/proof.jpg",
            "paid_at": "2026-09-12T09:00:00+07:00",
            "note": "DP via BCA.",
        },
        content_type="application/json",
    )
    detail_response = client.get(
        reverse("admin-order-detail", kwargs={"reference": order.reference})
    )

    assert response.status_code == 201
    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.DP
    assert order.manual_payments.count() == 1
    detail_payload = detail_response.json()
    assert detail_payload["payment_summary"]["valid_total"] == "100000"
    assert detail_payload["payment_summary"]["payment_status"] == Order.PaymentStatus.DP
    assert detail_payload["payments"][0]["review_status"] == PaymentRecord.ReviewStatus.VALID
    assert AuditEvent.objects.filter(
        action="payment.manual_record_created",
        resource_reference=order.reference,
    ).exists()


@pytest.mark.django_db
def test_staff_can_review_manual_payment_until_order_is_paid(client):
    staff, order = create_staff_order_fixture("staff-payment-review-001")
    client.force_login(staff)
    create_response = client.post(
        reverse("admin-order-payment-list", kwargs={"reference": order.reference}),
        {
            "payment_type": PaymentRecord.Type.SETTLEMENT,
            "method": PaymentRecord.Method.BANK_TRANSFER,
            "review_status": PaymentRecord.ReviewStatus.PENDING,
            "amount": str(order.total_amount),
            "proof_url": "https://res.cloudinary.com/demo/image/upload/lunas.jpg",
        },
        content_type="application/json",
    )
    payment_id = create_response.json()["id"]

    response = client.patch(
        reverse(
            "admin-order-payment-update",
            kwargs={"reference": order.reference, "payment_id": payment_id},
        ),
        {"review_status": PaymentRecord.ReviewStatus.VALID},
        content_type="application/json",
    )

    assert response.status_code == 200
    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.PAID
    assert response.json()["review_status"] == PaymentRecord.ReviewStatus.VALID
    assert response.json()["reviewed_by_email"] == staff.email


@pytest.mark.django_db
def test_staff_rejected_manual_payment_requires_reason(client):
    staff, order = create_staff_order_fixture("staff-payment-reject-001")
    client.force_login(staff)

    response = client.post(
        reverse("admin-order-payment-list", kwargs={"reference": order.reference}),
        {
            "payment_type": PaymentRecord.Type.DP,
            "method": PaymentRecord.Method.BANK_TRANSFER,
            "review_status": PaymentRecord.ReviewStatus.REJECTED,
            "amount": "100000",
            "proof_url": "https://res.cloudinary.com/demo/image/upload/proof.jpg",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "rejection_reason" in response.json()["error"]["details"]


@pytest.mark.django_db
def test_staff_can_add_revision_note_from_order_dashboard(client):
    staff, order = create_staff_order_fixture("staff-revision-001")
    client.force_login(staff)

    response = client.post(
        reverse("admin-order-revisions", kwargs={"reference": order.reference}),
        {"note": "Perbaiki urutan galeri.", "is_final_check": False},
        content_type="application/json",
    )

    assert response.status_code == 201
    revision = order.invitation.revisions.get()
    assert revision.revision_number == 1
    assert revision.note == "Perbaiki urutan galeri."
    assert response.json()["revisions"][0]["label"] == "Revisi 1"


@pytest.mark.django_db
def test_staff_can_archive_order_from_dashboard(client):
    staff, order = create_staff_order_fixture("staff-archive-001")
    client.force_login(staff)

    response = client.delete(reverse("admin-order-detail", kwargs={"reference": order.reference}))
    list_response = client.get(reverse("admin-order-list"))

    order.refresh_from_db()
    assert response.status_code == 204
    assert order.archived_at is not None
    assert order.reference not in list_response.content.decode()


@pytest.mark.django_db
def test_staff_can_export_active_orders_csv(client):
    staff, order = create_staff_order_fixture("staff-export-001")
    Order.objects.create(reference="N999", client_name="Archived", archived_at=timezone.now())
    client.force_login(staff)

    response = client.get(reverse("admin-order-export"), HTTP_ACCEPT="text/csv")
    body = response.content.decode()

    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    assert "order_id,client,email,phone,package,theme,total_amount" in body
    assert order.reference in body
    assert "N999" not in body


@pytest.mark.django_db
def test_client_cannot_export_staff_orders_csv(client):
    user = create_user(username="client-export", email="client-export@example.com")
    client.force_login(user)

    response = client.get(reverse("admin-order-export"))

    assert response.status_code == 403


@pytest.mark.django_db
def test_staff_can_update_manual_order_detail_payload(client):
    staff = create_user(
        username="staff-manual",
        email="manual@staff.test",
        role="staff",
        is_staff=True,
    )
    theme = create_theme(slug="manual-theme")
    package = create_package(code="manual-package")
    order = Order.objects.create(
        reference="manual-detail-001",
        client_name="Fahri",
        theme=theme,
        package=package,
        total_amount="345000",
    )
    client.force_login(staff)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "client_name": "Reno dan Erisa",
            "custom_approval_notes": "Scope custom disetujui via WhatsApp.",
            "custom_brief": "Custom love story, parallax lembut, dan overlay motion.",
            "custom_checklist": {
                "assets_received": True,
                "copy_approved": False,
                "final_approved": False,
                "motion_brief": True,
                "overlay_assets": True,
                "parallax_plan": True,
            },
            "custom_status": Order.CustomStatus.APPROVED,
            "payment_status": Order.PaymentStatus.PAID,
            "status": Order.Status.REVISION,
            "ceremony": {
                "starts_at": "2026-09-12T09:00:00+07:00",
                "venue_name": "Masjid Raya",
                "address": "Jakarta",
                "map_url": "https://maps.google.com",
            },
            "reception": {
                "starts_at": "2026-09-12T11:00:00+07:00",
                "venue_name": "Gedung Resepsi",
                "address": "Jakarta Selatan",
            },
            "bank_accounts": [{"bank": "BCA", "name": "Fahri", "number": "123"}],
            "rsvp_manual": {
                "total_invited": 100,
                "total_confirmed": 80,
                "total_declined": 5,
                "response_rate": 85,
            },
            "media_urls": {
                "photo": "https://res.cloudinary.com/demo/image/upload/photo.jpg",
                "gallery": [
                    "https://res.cloudinary.com/demo/image/upload/gallery-one.jpg",
                    "https://res.cloudinary.com/demo/image/upload/gallery-two.jpg",
                ],
                "backsound": "https://res.cloudinary.com/demo/video/upload/song.mp3",
            },
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    order.refresh_from_db()
    assert order.client_name == "Reno dan Erisa"
    assert order.custom_status == Order.CustomStatus.APPROVED
    assert order.custom_brief.startswith("Custom love story")
    assert order.custom_approval_notes == "Scope custom disetujui via WhatsApp."
    assert order.custom_checklist["motion_brief"] is True
    assert order.payment_status == Order.PaymentStatus.PAID
    assert order.invitation is not None
    assert order.invitation.content["couple"]["partnerOne"] == "Reno"
    assert order.invitation.content["couple"]["partnerTwo"] == "Erisa"
    assert order.invitation.events.count() == 2
    assert order.invitation.media.filter(role=InvitationMedia.Role.PHOTO).count() == 1
    assert order.invitation.media.filter(role=InvitationMedia.Role.GALLERY).count() == 2
    assert order.invitation.media.filter(role=InvitationMedia.Role.BACKSOUND).count() == 1
    assert order.invitation.content["bank_accounts"][0]["bank"] == "BCA"
    assert order.invitation.content["rsvp_manual"]["total_invited"] == 100
    assert response.json()["order"]["custom_status"] == Order.CustomStatus.APPROVED
    assert response.json()["order"]["custom_checklist"]["overlay_assets"] is True
    assert response.json()["preview_url"].startswith("http://testserver/id/i/")
    assert "preview=" in response.json()["preview_url"]

    rename_response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"client_name": "Tirta & Kayla"},
        content_type="application/json",
    )
    order.refresh_from_db()
    order.invitation.refresh_from_db()
    preview_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": order.invitation.public_slug}),
        {"token": preview_token_for(order.invitation)},
    )

    assert rename_response.status_code == 200
    assert order.invitation.content["couple"]["partnerOne"] == "Tirta"
    assert order.invitation.content["couple"]["partnerTwo"] == "Kayla"
    assert preview_response.json()["content"]["couple"]["partnerOne"] == "Tirta"
    assert preview_response.json()["content"]["couple"]["partnerTwo"] == "Kayla"


@pytest.mark.django_db
def test_staff_can_edit_revision_note_from_order_dashboard(client):
    staff, order = create_staff_order_fixture("staff-revision-edit-001")
    client.force_login(staff)
    create_response = client.post(
        reverse("admin-order-revisions", kwargs={"reference": order.reference}),
        {"note": "Revisi awal.", "is_final_check": False},
        content_type="application/json",
    )
    revision_id = create_response.json()["revisions"][0]["id"]

    response = client.patch(
        reverse(
            "admin-order-revision-detail",
            kwargs={"reference": order.reference, "revision_id": revision_id},
        ),
        {"note": "Final check selesai.", "is_final_check": True},
        content_type="application/json",
    )

    assert response.status_code == 200
    revision = order.invitation.revisions.get()
    assert revision.note == "Final check selesai."
    assert revision.is_final_check is True
    assert response.json()["revisions"][0]["label"] == "Final Check"


@pytest.mark.django_db
def test_staff_can_login_and_read_session(client):
    create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)

    response = client.post(
        reverse("api-staff-login"),
        {"username": "staff", "password": "password"},
        content_type="application/json",
    )
    session_response = client.get(reverse("api-staff-session-me"))

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "staff"
    assert session_response.status_code == 200
    assert session_response.json()["user"]["username"] == "staff"


@pytest.mark.django_db
def test_client_user_cannot_login_to_staff_dashboard(client):
    create_user(username="client", email="client@example.com")

    response = client.post(
        reverse("api-staff-login"),
        {"username": "client", "password": "password"},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_postgres_access_sql_keeps_staff_off_guest_rows():
    migration = importlib.import_module("tickets.migrations.0002_access_foundation_sql")

    assert "guest_aggregates_per_wedding" in migration.GUEST_AGGREGATE_VIEW_SQL
    assert "staff_select_guests" not in migration.FORWARD_SQL
    staff_guest_policy = (
        "ON invitations_guest\nFOR SELECT\nUSING (app.current_user_role() = 'staff')"
    )
    assert staff_guest_policy not in migration.FORWARD_SQL
    assert "GRANT SELECT ON guest_aggregates_per_wedding TO staff" in migration.FORWARD_SQL
    assert "display_name" not in migration.GUEST_AGGREGATE_VIEW_SQL
    assert "email" not in migration.GUEST_AGGREGATE_VIEW_SQL
    assert "phone" not in migration.GUEST_AGGREGATE_VIEW_SQL


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
        description="Weather widget does not load.",
    )

    assert ticket.status == Ticket.Status.OPEN
    assert ticket.invitation.client_user == client_user


@pytest.mark.django_db
def test_dns_ticket_resolution_custom_domain_writes_audit(client):
    client_user = create_user(username="dns-client", email="dns-client@example.com")
    staff = create_user(
        username="dns-staff",
        email="dns-staff@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="dns-ticket")
    invitation.client_user = client_user
    invitation.save(update_fields=["client_user", "updated_at"])
    ticket = Ticket.objects.create(
        invitation=invitation,
        created_by=client_user,
        category=Ticket.Category.DNS,
        description="Tolong pasang custom domain undangan.",
    )
    client.force_login(staff)

    progress_response = client.patch(
        reverse("admin-ticket-detail", kwargs={"ticket_id": ticket.id}),
        {"status": Ticket.Status.IN_PROGRESS, "assign_to_self": True},
        content_type="application/json",
    )
    resolve_response = client.patch(
        reverse("admin-ticket-detail", kwargs={"ticket_id": ticket.id}),
        {
            "status": Ticket.Status.RESOLVED,
            "custom_domain": "undangan.example.com",
            "reason": "DNS ownership verified",
            "resolution_note": "Custom domain sudah aktif.",
        },
        content_type="application/json",
    )

    assert progress_response.status_code == 200
    assert resolve_response.status_code == 200
    invitation.refresh_from_db()
    ticket.refresh_from_db()
    assert invitation.custom_domain == "undangan.example.com"
    assert ticket.status == Ticket.Status.RESOLVED
    audit = AuditEvent.objects.get(action="invitation.custom_domain_updated")
    assert audit.resource_reference == invitation.public_slug
    assert audit.metadata["reason"] == "DNS ownership verified"
    assert audit.metadata["custom_domain"] == "undangan.example.com"


@pytest.mark.django_db
def test_ticket_status_transition_cannot_skip_to_resolved(client):
    client_user = create_user(username="skip-client", email="skip-client@example.com")
    staff = create_user(
        username="skip-staff",
        email="skip-staff@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="skip-ticket")
    invitation.client_user = client_user
    invitation.save(update_fields=["client_user", "updated_at"])
    ticket = Ticket.objects.create(
        invitation=invitation,
        created_by=client_user,
        category=Ticket.Category.GENERAL,
        description="General support request.",
    )
    client.force_login(staff)

    response = client.patch(
        reverse("admin-ticket-detail", kwargs={"ticket_id": ticket.id}),
        {"status": Ticket.Status.RESOLVED},
        content_type="application/json",
    )

    assert response.status_code == 400
    ticket.refresh_from_db()
    assert ticket.status == Ticket.Status.OPEN


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
def test_staff_create_order_auto_increments_duplicate_auto_reference(client):
    staff = create_user(
        username="staff-auto-ref",
        email="staff-auto-ref@example.com",
        role="staff",
        is_staff=True,
    )
    Order.objects.create(reference="N001", client_name="Archived", archived_at=timezone.now())
    client.force_login(staff)

    response = client.post(
        reverse("admin-order-list"),
        {
            "reference": "N001",
            "client_name": "Fahri",
            "status": Order.Status.LEAD,
            "total_amount": "99000.00",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json()["reference"] == "N002"
    assert Order.objects.filter(reference="N002", client_name="Fahri").exists()


@pytest.mark.django_db
def test_manual_order_preview_returns_complete_invitation_content(client):
    staff = create_user(
        username="staff-preview",
        email="staff-preview@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme()
    order = Order.objects.create(reference="N010", client_name="Fahri", theme=theme)
    client.force_login(staff)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "ceremony": {
                "starts_at": timezone.now().isoformat(),
                "venue_name": "Venue",
                "address": "Jakarta",
            }
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    order.refresh_from_db()
    preview = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": order.invitation.public_slug}),
        {"token": preview_token_for(order.invitation)},
    )

    assert preview.status_code == 200
    content = preview.json()["content"]
    assert content["couple"]["partnerOne"] == "Fahri"
    assert content["opening"]["title"]
    assert content["event"]["dateLabel"] == "Akad dan Resepsi"
    assert "AM" in content["event"]["ceremonyTime"] or "PM" in content["event"]["ceremonyTime"]
    assert "20" in content["event"]["ceremonyTime"]
    assert content["event"]["venue"] == "Venue"
    assert content["event"]["address"] == "Jakarta"
    assert content["event"]["mapUrl"].startswith("http")
    assert content["closing"]["heading"]


@pytest.mark.django_db
def test_public_preview_uses_theme_story_when_order_story_is_generic(client):
    theme = create_theme(slug="islamic-soft")
    invitation = create_invitation(theme=theme, public_slug="theme-story")

    response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": preview_token_for(invitation)},
    )

    assert response.status_code == 200
    story = response.json()["content"]["story"]["body"]
    assert story.startswith("Dengan niat yang baik")
    assert story != "Kami bertemu dan bertumbuh bersama."


@pytest.mark.django_db
def test_public_preview_keeps_custom_story_body(client):
    theme = create_theme(slug="elegant-classic")
    invitation = create_invitation(theme=theme, public_slug="custom-story")
    invitation.content = {
        **invitation.content,
        "story": {"heading": "Cerita kami", "body": "Cerita custom dari staff."},
    }
    invitation.save(update_fields=["content", "updated_at"])

    response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": preview_token_for(invitation)},
    )

    assert response.status_code == 200
    assert response.json()["content"]["story"]["body"] == "Cerita custom dari staff."


@pytest.mark.django_db
def test_staff_publishing_order_turns_preview_link_into_public_link(client):
    staff = create_user(
        username="staff-final-link",
        email="staff-final-link@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme()
    order = Order.objects.create(reference="N011", client_name="Fahri", theme=theme)
    client.force_login(staff)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"status": Order.Status.PUBLISHED},
        content_type="application/json",
        HTTP_ORIGIN="https://wedding.example",
    )

    assert response.status_code == 200
    order.refresh_from_db()
    order.invitation.refresh_from_db()
    assert order.status == Order.Status.PUBLISHED
    assert order.invitation.status == Invitation.Status.PUBLISHED
    assert order.invitation.approval_status == Invitation.ApprovalStatus.PUBLISHED
    assert response.json()["preview_url"] == "https://wedding.example/id/i/n011"
    assert "preview=" not in response.json()["preview_url"]


@pytest.mark.django_db
def test_client_cannot_access_staff_verification_queue(client):
    client_user = create_user(username="client-queue", email="client-queue@example.com")
    client.force_login(client_user)

    response = client.get(reverse("admin-order-verification-queue"))

    assert response.status_code == 403


@pytest.mark.django_db
def test_staff_verification_queue_lists_pending_oldest_first(client):
    staff = create_user(
        username="queue-staff",
        email="queue-staff@example.com",
        role="staff",
        is_staff=True,
    )
    older = Order.objects.create(
        reference="ord-old",
        client_name="Old",
        status=Order.Status.PENDING,
    )
    newer = Order.objects.create(
        reference="ord-new",
        client_name="New",
        status=Order.Status.PENDING,
    )
    Order.objects.create(
        reference="ord-verified",
        client_name="Done",
        status=Order.Status.VERIFIED,
    )
    older.created_at = timezone.now() - timedelta(days=2)
    older.save(update_fields=["created_at"])
    newer.created_at = timezone.now() - timedelta(days=1)
    newer.save(update_fields=["created_at"])
    client.force_login(staff)

    response = client.get(reverse("admin-order-verification-queue"))

    assert response.status_code == 200
    assert [item["reference"] for item in response.json()] == ["ord-old", "ord-new"]


@pytest.mark.django_db
def test_staff_confirm_order_activates_wedding_and_audits(client):
    staff = create_user(
        username="confirm-staff",
        email="confirm-staff@example.com",
        role="staff",
        is_staff=True,
    )
    client_user = create_user(username="confirm-client", email="confirm-client@example.com")
    theme = create_theme()
    invitation = create_invitation(
        theme=theme,
        status="pending_verification",
        public_slug="confirm-wedding",
    )
    order = Order.objects.create(
        reference="ord-confirm",
        client_name="Client",
        client_user=client_user,
        invitation=invitation,
        status=Order.Status.PENDING,
        proof_url="https://example.com/proof.jpg",
    )
    client.force_login(staff)

    response = client.post(
        reverse("admin-order-confirm", kwargs={"reference": order.reference}),
        {"reason": "Payment proof is valid."},
        content_type="application/json",
    )

    order.refresh_from_db()
    invitation.refresh_from_db()
    assert response.status_code == 200
    assert order.status == Order.Status.VERIFIED
    assert order.verified_by == staff
    assert invitation.status == "active"
    assert AuditEvent.objects.filter(action="order.verified", actor=staff).exists()


@pytest.mark.django_db
def test_staff_reject_order_requires_reason(client):
    staff = create_user(
        username="reject-staff",
        email="reject-staff@example.com",
        role="staff",
        is_staff=True,
    )
    order = Order.objects.create(
        reference="ord-reject",
        client_name="Client",
        status=Order.Status.PENDING,
    )
    client.force_login(staff)

    missing_reason = client.post(
        reverse("admin-order-reject", kwargs={"reference": order.reference}),
        {"reason": ""},
        content_type="application/json",
    )
    rejected = client.post(
        reverse("admin-order-reject", kwargs={"reference": order.reference}),
        {"reason": "Proof is unreadable."},
        content_type="application/json",
    )

    order.refresh_from_db()
    assert missing_reason.status_code == 400
    assert rejected.status_code == 200
    assert order.status == Order.Status.REJECTED
    assert order.rejection_reason == "Proof is unreadable."
    assert AuditEvent.objects.filter(action="order.rejected", actor=staff).exists()


def test_order_status_transition_rejects_invalid_skip():
    with pytest.raises(ValidationError):
        ensure_order_transition(Order.Status.PENDING, Order.Status.COMPLETED)


@pytest.mark.django_db
def test_billing_lifecycle_refresh_marks_expiring_and_expired(client, settings):
    settings.BILLING_CRON_SECRET = "cron-secret"
    settings.BILLING_EXPIRY_WARNING_DAYS = 14
    theme = create_theme()
    expiring = create_invitation(theme=theme, status="active", public_slug="expiring-soon")
    expired = create_invitation(theme=theme, status="active", public_slug="expired-now")
    expiring.expires_at = timezone.now() + timedelta(days=7)
    expiring.save(update_fields=["expires_at", "updated_at"])
    expired.expires_at = timezone.now() - timedelta(hours=1)
    expired.save(update_fields=["expires_at", "updated_at"])

    forbidden = client.post(reverse("billing-lifecycle-refresh"))
    response = client.post(
        reverse("billing-lifecycle-refresh"),
        HTTP_X_CRON_SECRET="cron-secret",
    )

    expiring.refresh_from_db()
    expired.refresh_from_db()
    assert forbidden.status_code == 403
    assert response.status_code == 200
    assert expiring.status == "expiring_soon"
    assert expired.status == "expired"


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
    assert response.json()["order"]["package_code"] == "couture"
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
def test_public_guest_rsvp_create_is_write_only(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="public-write-rsvp")

    response = client.post(
        reverse("invitation-public-rsvp-create", kwargs={"public_slug": invitation.public_slug}),
        {
            "name": "Tamu Publik",
            "contact": "guest@example.com",
            "rsvp_status": Guest.RSVPStatus.ACCEPTED,
            "attendance_count": 2,
            "message": "Selamat menempuh hidup baru",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json() == {"status": Guest.RSVPStatus.ACCEPTED}
    assert Guest.objects.filter(invitation=invitation, display_name="Tamu Publik").exists()
    assert "guest@example.com" not in response.content.decode()
    assert str(invitation.guests.latest("created_at").id) not in response.content.decode()


@pytest.mark.django_db
def test_staff_creates_guest_delivery_link_and_guest_uses_it_for_rsvp(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="delivery-link")
    client.force_login(staff)

    response = client.post(
        reverse("admin-invitation-guest-link-list", kwargs={"public_slug": invitation.public_slug}),
        {
            "display_name": "Syarif",
            "email": "syarif@example.com",
            "phone": "+62812",
            "party_size": 2,
        },
        content_type="application/json",
        HTTP_ORIGIN="https://wedding.example",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["display_name"] == "Syarif"
    assert payload["token_available"] is True
    assert payload["delivery_url"].startswith("https://wedding.example/id/i/delivery-link?guest=")
    token = payload["delivery_url"].split("guest=", 1)[1]

    client.logout()
    invitation_response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug}),
        {"guest": token},
    )
    assert invitation_response.status_code == 200
    assert invitation_response.json()["guest"] == {"displayName": "Syarif"}
    assert "syarif@example.com" not in invitation_response.content.decode()

    rsvp_response = client.post(
        reverse("invitation-rsvp", kwargs={"public_slug": invitation.public_slug}),
        {
            "token": token,
            "rsvp_status": Guest.RSVPStatus.ACCEPTED,
            "attendance_count": 2,
            "wishes": "Selamat!",
        },
        content_type="application/json",
    )

    assert rsvp_response.status_code == 200
    guest = invitation.guests.get(display_name="Syarif")
    assert guest.rsvp_status == Guest.RSVPStatus.ACCEPTED
    assert AuditEvent.objects.filter(action="guest.delivery_link_created").exists()


@pytest.mark.django_db
def test_staff_guest_delivery_link_for_draft_includes_preview_token(client):
    staff = create_user(
        username="staff-draft",
        email="staff-draft@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme()
    invitation = create_invitation(
        theme=theme,
        public_slug="draft-delivery-link",
        status=Invitation.Status.DRAFT,
    )
    client.force_login(staff)

    response = client.post(
        reverse("admin-invitation-guest-link-list", kwargs={"public_slug": invitation.public_slug}),
        {"display_name": "Syarif", "party_size": 1},
        content_type="application/json",
        HTTP_ORIGIN="https://wedding.example",
    )

    assert response.status_code == 201
    delivery_url = response.json()["delivery_url"]
    assert "guest=" in delivery_url
    assert "preview=" in delivery_url


@pytest.mark.django_db
def test_draft_guest_delivery_link_accepts_rsvp_with_preview_token(client):
    staff = create_user(
        username="staff-draft-rsvp",
        email="staff-draft-rsvp@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme()
    invitation = create_invitation(
        theme=theme,
        public_slug="draft-delivery-rsvp",
        status=Invitation.Status.DRAFT,
    )
    client.force_login(staff)

    response = client.post(
        reverse("admin-invitation-guest-link-list", kwargs={"public_slug": invitation.public_slug}),
        {"display_name": "Syarif", "party_size": 1},
        content_type="application/json",
        HTTP_ORIGIN="https://wedding.example",
    )

    assert response.status_code == 201
    query = parse_qs(urlparse(response.json()["delivery_url"]).query)
    guest_token = query["guest"][0]
    preview_token = query["preview"][0]

    client.logout()
    preview_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"guest": guest_token, "token": preview_token},
    )
    assert preview_response.status_code == 200
    assert preview_response.json()["guest"] == {"displayName": "Syarif"}

    rsvp_response = client.post(
        reverse("invitation-rsvp", kwargs={"public_slug": invitation.public_slug}),
        {
            "token": guest_token,
            "preview": preview_token,
            "rsvp_status": Guest.RSVPStatus.ACCEPTED,
            "attendance_count": 1,
            "wishes": "Selamat memulai lembaran baru",
        },
        content_type="application/json",
    )

    assert rsvp_response.status_code == 200
    guest = invitation.guests.get(display_name="Syarif")
    assert guest.rsvp_status == Guest.RSVPStatus.ACCEPTED
    assert guest.attendance_count == 1
    assert guest.wishes == "Selamat memulai lembaran baru"


@pytest.mark.django_db
def test_public_wishes_requires_access_token_and_hides_guest_contact(client):
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="client-wishes")
    invitation.content = {
        **invitation.content,
        "couple": {"partnerOne": "Reno", "partnerTwo": "Erisa"},
    }
    invitation.save(update_fields=["content", "updated_at"])
    Guest.objects.create(
        invitation=invitation,
        access_token_hash="wish-token-1",
        display_name="Syarif",
        email="syarif@example.com",
        phone="+62812",
        party_size=2,
        rsvp_status=Guest.RSVPStatus.ACCEPTED,
        attendance_count=2,
        wishes="Selamat menempuh hidup baru.",
        responded_at=timezone.now(),
    )
    Guest.objects.create(
        invitation=invitation,
        access_token_hash="wish-token-2",
        display_name="Budi",
        phone="+62813",
        party_size=1,
        rsvp_status=Guest.RSVPStatus.PENDING,
        attendance_count=0,
    )

    blocked_response = client.get(
        reverse("invitation-wishes", kwargs={"public_slug": invitation.public_slug})
    )
    response = client.get(
        reverse("invitation-wishes", kwargs={"public_slug": invitation.public_slug}),
        {"access": wishes_token_for(invitation)},
    )

    assert blocked_response.status_code == 404
    assert response.status_code == 200
    payload = response.json()
    assert payload["couple_name"] == "Reno & Erisa"
    assert payload["total_invited"] == 3
    assert payload["total_confirmed"] == 1
    assert payload["total_pending"] == 2
    assert payload["wishes"] == [
        {
            "display_name": "Syarif",
            "rsvp_status": Guest.RSVPStatus.ACCEPTED,
            "attendance_count": 2,
            "wishes": "Selamat menempuh hidup baru.",
            "responded_at": payload["wishes"][0]["responded_at"],
        }
    ]
    assert "email" not in payload["wishes"][0]
    assert "phone" not in payload["wishes"][0]


@pytest.mark.django_db
def test_staff_exports_guest_delivery_links_as_csv(client):
    staff = create_user(username="staff", email="staff@example.com", role="staff", is_staff=True)
    theme = create_theme()
    invitation = create_invitation(theme=theme, public_slug="delivery-export")
    Guest.objects.create(
        invitation=invitation,
        access_token_hash="delivery-token-1",
        display_name="Syarif",
        phone="+62812",
        party_size=1,
        metadata={"delivery_token": "delivery-token-1"},
    )
    client.force_login(staff)

    response = client.get(
        reverse(
            "admin-invitation-guest-link-export",
            kwargs={"public_slug": invitation.public_slug},
        ),
        HTTP_ACCEPT="text/csv",
        HTTP_ORIGIN="https://wedding.example",
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "text/csv"
    content = response.content.decode()
    assert "Syarif" in content
    assert "https://wedding.example/id/i/delivery-export?guest=delivery-token-1" in content


@pytest.mark.django_db
def test_guest_management_link_allows_client_import_and_delivery_tracking(client):
    staff, order = create_staff_order_fixture("guest-management-001")
    client.force_login(staff)
    detail_response = client.get(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        HTTP_ORIGIN="https://wedding.example",
    )
    token = detail_response.json()["guest_management_url"].rsplit("/", 1)[-1]
    client.logout()

    detail = client.get(reverse("guest-management-detail", kwargs={"token": token}))
    assert detail.status_code == 200
    assert detail.json()["invitation"]["public_slug"] == order.invitation.public_slug

    wishes_response = client.get(reverse("guest-management-wishes", kwargs={"token": token}))
    assert wishes_response.status_code == 200
    assert wishes_response.json()["couple_name"] == "Alya & Raka"

    upload = SimpleUploadedFile(
        "guests.csv",
        b"name,phone,email,party_size,group,note\nSyarif,+628123456789,syarif@example.com,2,Keluarga,\n",
        content_type="text/csv",
    )
    preview = client.post(
        f"{reverse('guest-management-guest-link-import', kwargs={'token': token})}?dry_run=true",
        {"file": upload},
        HTTP_ORIGIN="https://wedding.example",
    )
    assert preview.status_code == 200
    assert preview.json()["summary"]["valid_rows"] == 1
    assert Guest.objects.filter(display_name="Syarif").count() == 0

    upload = SimpleUploadedFile(
        "guests.csv",
        b"name,phone,email,party_size,group,note\nSyarif,+628123456789,syarif@example.com,2,Keluarga,\n",
        content_type="text/csv",
    )
    commit = client.post(
        reverse("guest-management-guest-link-import", kwargs={"token": token}),
        {"file": upload},
        HTTP_ORIGIN="https://wedding.example",
    )
    assert commit.status_code == 200
    guest = Guest.objects.get(display_name="Syarif")
    assert guest.metadata["delivery_token"]
    assert AuditEvent.objects.filter(action="guest.delivery_links_imported_by_client").exists()

    delivery = client.patch(
        reverse(
            "guest-management-guest-link-delivery",
            kwargs={"token": token, "guest_id": guest.id},
        ),
        {"sent": True},
        content_type="application/json",
    )
    assert delivery.status_code == 200
    guest.refresh_from_db()
    assert guest.metadata["delivery_sent_at"]


@pytest.mark.django_db
def test_staff_downloads_guest_import_template(client):
    staff = create_user(
        username="staff-template",
        email="staff-template@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme(slug="theme-delivery-template")
    invitation = create_invitation(theme=theme, public_slug="delivery-template")
    client.force_login(staff)

    response = client.get(
        reverse(
            "admin-invitation-guest-link-import-template",
            kwargs={"public_slug": invitation.public_slug},
        )
    )

    assert response.status_code == 200
    content = response.content.decode()
    assert "name,phone,email,party_size,group,note" in content
    assert "delivery-template-guest-import-template.csv" in response["Content-Disposition"]


@pytest.mark.django_db
def test_staff_previews_guest_import_without_creating_rows(client):
    staff = create_user(
        username="staff-import-preview",
        email="staff-import-preview@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme(slug="theme-delivery-import-preview")
    invitation = create_invitation(theme=theme, public_slug="delivery-import-preview")
    initial_guest_count = invitation.guests.count()
    client.force_login(staff)
    uploaded = SimpleUploadedFile(
        "guests.csv",
        b"name,phone,email,party_size,group,note\nSyarif,08123456789,,2,Teman,VIP\n",
        content_type="text/csv",
    )

    response = client.post(
        reverse(
            "admin-invitation-guest-link-import",
            kwargs={"public_slug": invitation.public_slug},
        )
        + "?dry_run=true",
        {"file": uploaded},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["total_rows"] == 1
    assert payload["summary"]["valid_rows"] == 1
    assert payload["summary"]["created_count"] == 1
    assert payload["rows"][0]["phone"] == "+628123456789"
    assert payload["rows"][0]["action"] == "create"
    assert invitation.guests.count() == initial_guest_count


@pytest.mark.django_db
def test_staff_imports_guest_links_and_deduplicates_by_phone(client):
    staff = create_user(
        username="staff-import-commit",
        email="staff-import-commit@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme(slug="theme-delivery-import-commit")
    invitation = create_invitation(theme=theme, public_slug="delivery-import-commit")
    initial_guest_count = invitation.guests.count()
    client.force_login(staff)
    uploaded = SimpleUploadedFile(
        "guests.csv",
        b"name,phone,email,party_size,group,note\n"
        b"Syarif,08123456789,syarif@example.com,2,Teman,VIP\n"
        b"Keluarga Budi,,budi@example.com,3,Keluarga,\n",
        content_type="text/csv",
    )

    response = client.post(
        reverse(
            "admin-invitation-guest-link-import",
            kwargs={"public_slug": invitation.public_slug},
        ),
        {"file": uploaded},
        HTTP_ORIGIN="https://wedding.example",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["created_count"] == 2
    assert invitation.guests.count() == initial_guest_count + 2
    syarif = invitation.guests.get(display_name="Syarif")
    assert syarif.phone == "+628123456789"
    assert syarif.party_size == 2
    assert syarif.metadata["import_group"] == "Teman"
    assert "delivery_token" in syarif.metadata
    assert (
        "https://wedding.example/id/i/delivery-import-commit?guest="
        in payload["rows"][0]["delivery_url"]
    )
    assert AuditEvent.objects.filter(action="guest.delivery_links_imported").exists()

    syarif.rsvp_status = Guest.RSVPStatus.ACCEPTED
    syarif.attendance_count = 2
    syarif.responded_at = timezone.now()
    syarif.save(update_fields=["rsvp_status", "attendance_count", "responded_at", "updated_at"])
    update_upload = SimpleUploadedFile(
        "guests.csv",
        b"name,phone,email,party_size,group,note\nSyarif Updated,08123456789,,4,Teman,\n",
        content_type="text/csv",
    )
    update_response = client.post(
        reverse(
            "admin-invitation-guest-link-import",
            kwargs={"public_slug": invitation.public_slug},
        ),
        {"file": update_upload},
    )

    assert update_response.status_code == 200
    assert update_response.json()["summary"]["updated_count"] == 1
    assert invitation.guests.count() == initial_guest_count + 2
    syarif.refresh_from_db()
    assert syarif.display_name == "Syarif Updated"
    assert syarif.party_size == 4
    assert syarif.rsvp_status == Guest.RSVPStatus.ACCEPTED
    assert syarif.attendance_count == 2


@pytest.mark.django_db
def test_guest_import_reports_invalid_rows(client):
    staff = create_user(
        username="staff-import-invalid",
        email="staff-import-invalid@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme(slug="theme-delivery-import-invalid")
    invitation = create_invitation(theme=theme, public_slug="delivery-import-invalid")
    initial_guest_count = invitation.guests.count()
    client.force_login(staff)
    uploaded = SimpleUploadedFile(
        "guests.csv",
        b"name,phone,email,party_size,group,note\n,0812,bad-email,25,,\n",
        content_type="text/csv",
    )

    response = client.post(
        reverse(
            "admin-invitation-guest-link-import",
            kwargs={"public_slug": invitation.public_slug},
        )
        + "?dry_run=true",
        {"file": uploaded},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["error_rows"] == 1
    assert payload["rows"][0]["status"] == "error"
    assert "Nama tamu wajib diisi." in payload["rows"][0]["errors"]
    assert invitation.guests.count() == initial_guest_count


@pytest.mark.django_db
def test_guest_link_export_escapes_formula_cells(client):
    staff = create_user(
        username="staff-export-safe",
        email="staff-export-safe@example.com",
        role="staff",
        is_staff=True,
    )
    theme = create_theme(slug="theme-delivery-export-safe")
    invitation = create_invitation(theme=theme, public_slug="delivery-export-safe")
    Guest.objects.create(
        invitation=invitation,
        access_token_hash="delivery-token-safe",
        display_name="=cmd|' /C calc'!A0",
        phone="+62812",
        party_size=1,
        metadata={"delivery_token": "delivery-token-safe"},
    )
    client.force_login(staff)

    response = client.get(
        reverse(
            "admin-invitation-guest-link-export",
            kwargs={"public_slug": invitation.public_slug},
        ),
        HTTP_ACCEPT="text/csv",
    )

    assert response.status_code == 200
    content = response.content.decode()
    assert "'=cmd|' /C calc'!A0" in content
    assert ",'+62812," in content


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
