from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from invitations.models import InvitationMedia
from invitations.preview import preview_token_for
from media_library.models import MediaAsset
from orders.models import Order
from tests.factories import create_invitation, create_package, create_theme


def _staff_order_with_photo(reference: str):
    staff = get_user_model().objects.create_user(
        username=f"staff-{reference}",
        email=f"{reference}@staff.test",
        password="password",
        role="staff",
        is_staff=True,
    )
    theme = create_theme()
    package = create_package()
    invitation = create_invitation(
        theme=theme,
        public_slug=f"inv-{reference}",
        is_sample=False,
    )
    invitation.package = package
    invitation.save(update_fields=["package", "updated_at"])
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
    asset = MediaAsset.objects.create(
        public_id=f"{reference}/cover",
        resource_type=MediaAsset.ResourceType.IMAGE,
        secure_url="https://res.cloudinary.com/demo/image/upload/original-cover.jpg",
        folder="test",
    )
    media = InvitationMedia.objects.create(
        invitation=invitation,
        asset=asset,
        role=InvitationMedia.Role.PHOTO,
    )
    return staff, order, invitation, media


@pytest.mark.django_db
def test_staff_copy_and_replaced_cover_round_trip_to_preview_and_public(client):
    staff, order, invitation, original_media = _staff_order_with_photo("editable-cover-001")
    assert original_media.focal_x == Decimal("50")
    assert original_media.focal_y == Decimal("50")
    client.force_login(staff)

    cover_url = "https://res.cloudinary.com/demo/image/upload/custom-cover.jpg"
    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "story": {
                "heading": " Kisah kami ",
                "body": " Pembuka yang dapat diganti. ",
                "sectionBodies": {
                    "middle": " Bagian tengah yang dapat diganti. ",
                    "final": " Bagian akhir yang dapat diganti. ",
                    "conflict": " Konflik yang dapat diganti. ",
                    "intimacy": " Kedekatan yang dapat diganti. ",
                    "trust": " Kepercayaan yang dapat diganti. ",
                },
            },
            "quote": {
                "text": " Kutipan pilihan pasangan. ",
                "attribution": " Alya dan Raka ",
            },
            "media_urls": {"photo": cover_url},
            "photo_focal": {"focal_x": "24.25", "focal_y": 73.5},
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    detail = response.json()
    assert detail["invitation"]["story"] == {
        "heading": "Kisah kami",
        "body": "Pembuka yang dapat diganti.",
        "sectionBodies": {
            "middle": "Bagian tengah yang dapat diganti.",
            "final": "Bagian akhir yang dapat diganti.",
            "conflict": "Konflik yang dapat diganti.",
            "intimacy": "Kedekatan yang dapat diganti.",
            "trust": "Kepercayaan yang dapat diganti.",
        },
    }
    assert detail["invitation"]["quote"] == {
        "text": "Kutipan pilihan pasangan.",
        "attribution": "Alya dan Raka",
    }
    photo_payload = next(item for item in detail["media"] if item["role"] == "photo")
    assert photo_payload["asset"]["secure_url"] == cover_url
    assert photo_payload["focal_x"] == 24.25
    assert photo_payload["focal_y"] == 73.5

    invitation.refresh_from_db()
    photo = invitation.media.get(role=InvitationMedia.Role.PHOTO)
    assert photo.asset.secure_url == cover_url
    assert photo.focal_x == Decimal("24.25")
    assert photo.focal_y == Decimal("73.50")

    public_response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )
    preview_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": preview_token_for(invitation)},
    )

    expected_cover = {
        "secure_url": cover_url,
        "focal_x": 24.25,
        "focal_y": 73.5,
    }
    for invitation_response in [public_response, preview_response]:
        assert invitation_response.status_code == 200
        payload = invitation_response.json()
        assert payload["cover"] == expected_cover
        assert payload["content"]["story"]["sectionBodies"]["middle"] == (
            "Bagian tengah yang dapat diganti."
        )
        assert payload["content"]["quote"] == detail["invitation"]["quote"]

    clear_response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "story": {"sectionBodies": {}},
            "quote": {"text": "", "attribution": ""},
        },
        content_type="application/json",
    )

    assert clear_response.status_code == 200
    assert "sectionBodies" not in clear_response.json()["invitation"]["story"]
    assert clear_response.json()["invitation"]["quote"] == {
        "text": (
            "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan "
            "pasangan-pasangan untukmu."
        ),
        "attribution": "Ar-Rum · 21",
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("payload", "error_field"),
    [
        (
            {"story": {"sectionBodies": {"middle": "x" * 1201}}},
            "story.sectionBodies.middle",
        ),
        (
            {"story": {"sectionBodies": {"opening": "Tidak didukung"}}},
            "story.sectionBodies",
        ),
        ({"quote": {"text": "x" * 501}}, "quote.text"),
        ({"quote": {"attribution": "x" * 121}}, "quote.attribution"),
        ({"photo_focal": {"focal_x": -1, "focal_y": 50}}, "photo_focal.focal_x"),
        ({"photo_focal": {"focal_x": 50, "focal_y": 101}}, "photo_focal.focal_y"),
    ],
)
def test_staff_rejects_invalid_editable_copy_and_focal_point(client, payload, error_field):
    staff, order, _invitation, _media = _staff_order_with_photo(
        f"invalid-{error_field.replace('.', '-') }"
    )
    client.force_login(staff)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        payload,
        content_type="application/json",
    )

    assert response.status_code == 400
    assert error_field in response.json()["error"]["details"]


@pytest.mark.django_db
def test_public_and_preview_hide_untrusted_or_archived_cover(client):
    theme = create_theme()
    untrusted = create_invitation(
        theme=theme,
        public_slug="untrusted-cover",
        is_sample=False,
    )
    untrusted_asset = MediaAsset.objects.create(
        public_id="untrusted/cover",
        resource_type=MediaAsset.ResourceType.IMAGE,
        secure_url="https://images.example.test/cover.jpg",
        folder="test",
    )
    InvitationMedia.objects.create(
        invitation=untrusted,
        asset=untrusted_asset,
        role=InvitationMedia.Role.PHOTO,
    )

    archived = create_invitation(
        theme=theme,
        public_slug="archived-cover",
        is_sample=False,
    )
    archived_asset = MediaAsset.objects.create(
        public_id="archived/cover",
        resource_type=MediaAsset.ResourceType.IMAGE,
        secure_url="https://res.cloudinary.com/demo/image/upload/archived-cover.jpg",
        folder="test",
        archived_at=timezone.now(),
    )
    InvitationMedia.objects.create(
        invitation=archived,
        asset=archived_asset,
        role=InvitationMedia.Role.PHOTO,
    )

    for invitation in [untrusted, archived]:
        public_response = client.get(
            reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
        )
        preview_response = client.get(
            reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
            {"token": preview_token_for(invitation)},
        )

        assert public_response.status_code == 200
        assert preview_response.status_code == 200
        assert public_response.json()["cover"] is None
        assert preview_response.json()["cover"] is None
