from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.urls import reverse
from django.utils import timezone

from common.validators import validate_invitation_content
from invitations.models import Invitation, InvitationMedia
from invitations.preview import preview_token_for
from media_library.models import MediaAsset
from orders.models import Order
from tests.factories import (
    create_invitation,
    create_package,
    create_theme,
    invitation_content,
)


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
        status=Invitation.Status.DRAFT,
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
    gallery_urls = [
        f"https://res.cloudinary.com/demo/image/upload/gallery-{index}.jpg"
        for index in range(1, 15)
    ]
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
            "couple": {
                "partnerOneDescription": " Putri terkasih dari keluarga. ",
                "partnerTwoDescription": " Putra terkasih dari keluarga. ",
            },
            "media_urls": {"gallery": gallery_urls, "photo": cover_url},
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
    assert detail["invitation"]["couple"] == {
        "partnerOneDescription": "Putri terkasih dari keluarga.",
        "partnerTwoDescription": "Putra terkasih dari keluarga.",
    }
    photo_payload = next(item for item in detail["media"] if item["role"] == "photo")
    assert photo_payload["asset"]["secure_url"] == cover_url
    assert photo_payload["focal_x"] == 24.25
    assert photo_payload["focal_y"] == 73.5

    invitation.refresh_from_db()
    assert invitation.content["cover"] == {
        "secure_url": cover_url,
        "focal_x": 24.25,
        "focal_y": 73.5,
    }
    photo = invitation.media.get(role=InvitationMedia.Role.PHOTO)
    assert photo.asset.secure_url == cover_url
    assert photo.focal_x == Decimal("24.25")
    assert photo.focal_y == Decimal("73.50")
    assert len(invitation.content["gallery"]) == 14

    rename_response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"client_name": "Nadia & Faris"},
        content_type="application/json",
    )
    assert rename_response.status_code == 200
    invitation.refresh_from_db()
    assert invitation.content["couple"] == {
        "partnerOne": "Nadia",
        "partnerOneDescription": "Putri terkasih dari keluarga.",
        "partnerTwo": "Faris",
        "partnerTwoDescription": "Putra terkasih dari keluarga.",
        "monogram": "N&F",
    }

    invitation.status = Invitation.Status.PUBLISHED
    invitation.approval_status = Invitation.ApprovalStatus.PUBLISHED
    invitation.published_at = timezone.now()
    invitation.save(update_fields=["status", "approval_status", "published_at", "updated_at"])

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
        assert payload["content"]["couple"]["partnerOneDescription"] == (
            "Putri terkasih dari keluarga."
        )
        assert payload["content"]["couple"]["partnerTwoDescription"] == (
            "Putra terkasih dari keluarga."
        )
        assert len(payload["content"]["gallery"]) == 14

    clear_response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "story": {"sectionBodies": {}},
            "quote": {"text": "", "attribution": ""},
        },
        content_type="application/json",
    )

    assert clear_response.status_code == 400
    assert "immutable" in clear_response.json()["error"]["details"]["invitation"]


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
        (
            {"couple": {"partnerOneDescription": "x" * 301}},
            "couple.partnerOneDescription",
        ),
        ({"photo_focal": {"focal_x": -1, "focal_y": 50}}, "photo_focal.focal_x"),
        ({"photo_focal": {"focal_x": 50, "focal_y": 101}}, "photo_focal.focal_y"),
    ],
)
def test_staff_rejects_invalid_editable_copy_and_focal_point(client, payload, error_field):
    staff, order, _invitation, _media = _staff_order_with_photo(
        f"invalid-{error_field.replace('.', '-')}"
    )
    client.force_login(staff)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        payload,
        content_type="application/json",
    )

    assert response.status_code == 400
    assert error_field in response.json()["error"]["details"]


def test_invitation_content_validator_accepts_thirty_six_http_gallery_items():
    content = invitation_content()
    content["gallery"] = [None] * 36
    content["gallery"][0] = {
        "src": "https://res.cloudinary.com/demo/image/upload/gallery-1.jpg",
        "alt": "Gallery 1",
    }
    content["gallery"][33] = {
        "src": "https://res.cloudinary.com/demo/image/upload/gallery-34.jpg",
        "alt": "Gallery 34",
    }

    validate_invitation_content(content)

    content["gallery"] = []
    validate_invitation_content(content)

    content["gallery"] = [
        {"src": f"/images/gallery-{index}.jpg", "alt": f"Gallery {index}"} for index in range(1, 38)
    ]
    with pytest.raises(ValidationError, match="at most 36"):
        validate_invitation_content(content)


@pytest.mark.django_db
def test_staff_round_trips_thirty_six_couture_gallery_items_and_rejects_thirty_seven(client):
    staff, order, invitation, _media = _staff_order_with_photo("couture-gallery-036")
    couture = create_package(code="couture")
    client.force_login(staff)
    gallery_urls = [
        f"https://res.cloudinary.com/demo/image/upload/couture-{index}.jpg"
        for index in range(1, 37)
    ]

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "package_code": couture.code,
            "couple": {
                "partnerOneDescription": "Keterangan mempelai wanita Couture.",
                "partnerTwoDescription": "Keterangan mempelai pria Couture.",
            },
            "media_urls": {"gallery": gallery_urls},
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    invitation.refresh_from_db()
    assert len(invitation.content["gallery"]) == 36
    assert invitation.content["couple"]["partnerOneDescription"] == (
        "Keterangan mempelai wanita Couture."
    )
    assert invitation.content["couple"]["partnerTwoDescription"] == (
        "Keterangan mempelai pria Couture."
    )

    rejected = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"media_urls": {"gallery": [*gallery_urls, gallery_urls[0]]}},
        content_type="application/json",
    )

    assert rejected.status_code == 400
    invitation.refresh_from_db()
    assert len(invitation.content["gallery"]) == 36

    invitation.status = Invitation.Status.PUBLISHED
    invitation.approval_status = Invitation.ApprovalStatus.PUBLISHED
    invitation.published_at = timezone.now()
    invitation.save(update_fields=["status", "approval_status", "published_at", "updated_at"])

    public_response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )
    preview_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": preview_token_for(invitation)},
    )
    assert public_response.status_code == 200
    assert preview_response.status_code == 200
    assert len(public_response.json()["content"]["gallery"]) == 36
    assert len(preview_response.json()["content"]["gallery"]) == 36


@pytest.mark.django_db
def test_staff_can_reuse_one_cloudinary_url_in_every_gallery_slot(client):
    staff, order, invitation, _media = _staff_order_with_photo("repeated-gallery-url")
    couture = create_package(code="couture")
    client.force_login(staff)
    repeated_url = "https://res.cloudinary.com/demo/image/upload/repeated-photo.jpg"

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "package_code": couture.code,
            "media_urls": {"gallery": [repeated_url] * 36},
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    invitation.refresh_from_db()
    gallery_media = invitation.media.filter(role=InvitationMedia.Role.GALLERY)
    assert gallery_media.count() == 36
    assert gallery_media.values("asset_id").distinct().count() == 1
    assert list(gallery_media.values_list("sort_order", flat=True)) == list(range(36))
    assert [item["src"] for item in invitation.content["gallery"]] == [repeated_url] * 36

    preview_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": preview_token_for(invitation)},
    )
    assert preview_response.status_code == 200
    assert [item["src"] for item in preview_response.json()["content"]["gallery"]] == [
        repeated_url
    ] * 36


@pytest.mark.django_db
def test_sparse_gallery_slots_keep_every_couture_section_position(client):
    staff, order, invitation, _media = _staff_order_with_photo("sparse-gallery-slots")
    couture = create_package(code="couture")
    client.force_login(staff)
    gallery_slots = [""] * 36
    custom_slots = {
        0: "section-2-groom",
        1: "section-2-bride",
        2: "section-4",
        5: "section-5",
        6: "section-6",
        11: "section-8",
        20: "section-9",
        23: "section-10",
        33: "section-12",
    }
    for index, name in custom_slots.items():
        gallery_slots[index] = f"https://res.cloudinary.com/demo/image/upload/{name}.jpg"

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {
            "package_code": couture.code,
            "media_urls": {"gallery": gallery_slots},
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    invitation.refresh_from_db()
    assert len(invitation.content["gallery"]) == 36
    assert invitation.content["gallery"][0]["src"].endswith("section-2-groom.jpg")
    assert invitation.content["gallery"][1]["src"].endswith("section-2-bride.jpg")
    assert invitation.content["gallery"][3] is None
    assert invitation.content["gallery"][33]["src"].endswith("section-12.jpg")
    assert list(
        invitation.media.filter(role=InvitationMedia.Role.GALLERY).values_list(
            "sort_order", flat=True
        )
    ) == list(custom_slots)

    preview_response = client.get(
        reverse("invitation-preview-detail", kwargs={"public_slug": invitation.public_slug}),
        {"token": preview_token_for(invitation)},
    )
    assert preview_response.status_code == 200
    preview_gallery = preview_response.json()["content"]["gallery"]
    assert preview_gallery[0]["src"].endswith("section-2-groom.jpg")
    assert preview_gallery[1]["src"].endswith("section-2-bride.jpg")
    assert preview_gallery[3] is None
    assert preview_gallery[33]["src"].endswith("section-12.jpg")

    invitation.status = Invitation.Status.PUBLISHED
    invitation.approval_status = Invitation.ApprovalStatus.PUBLISHED
    invitation.published_at = timezone.now()
    invitation.save(update_fields=["status", "approval_status", "published_at", "updated_at"])

    public_response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )
    assert public_response.status_code == 200
    public_gallery = public_response.json()["content"]["gallery"]
    assert public_gallery[0]["src"].endswith("section-2-groom.jpg")
    assert public_gallery[1]["src"].endswith("section-2-bride.jpg")
    assert public_gallery[3] is None
    assert public_gallery[33]["src"].endswith("section-12.jpg")


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


@pytest.mark.django_db
def test_public_cover_falls_back_to_validated_content_snapshot(client):
    theme = create_theme()
    invitation = create_invitation(
        theme=theme,
        public_slug="snapshot-cover",
        is_sample=False,
    )
    invitation.content = {
        **invitation.content,
        "cover": {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/snapshot.jpg",
            "focal_x": 31,
            "focal_y": 62,
        },
    }
    invitation.save(update_fields=["content", "updated_at"])

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    assert response.json()["cover"] == invitation.content["cover"]


@pytest.mark.django_db
def test_public_cover_rejects_untrusted_content_snapshot(client):
    theme = create_theme()
    invitation = create_invitation(
        theme=theme,
        public_slug="untrusted-snapshot-cover",
        is_sample=False,
    )
    invitation.content = {
        **invitation.content,
        "cover": {
            "secure_url": "https://images.example.test/cover.jpg",
            "focal_x": 50,
            "focal_y": 50,
        },
    }
    invitation.save(update_fields=["content", "updated_at"])

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )

    assert response.status_code == 200
    assert response.json()["cover"] is None
