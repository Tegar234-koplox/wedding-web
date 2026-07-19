from copy import deepcopy

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from common.middleware import safe_log_path
from invitations.bespoke import (
    DEFAULT_BESPOKE_CONFIG,
    approve_review,
    create_otp_challenge,
    create_review_session,
    create_scope_agreement,
    ensure_bespoke_invitation,
    publish_invitation,
    update_bespoke_config,
)
from invitations.models import (
    ClientReviewSession,
    Invitation,
    InvitationPublication,
    InvitationRevision,
)
from orders.models import BespokeChangeRequest, BespokeScopeAgreement, Order
from payments.models import PaymentRecord
from tests.factories import create_invitation, create_package, create_theme


def bespoke_order(reference: str = "bespoke-001") -> tuple[Order, Invitation]:
    theme = create_theme(slug=f"theme-{reference}")
    package = create_package(code="bespoke")
    invitation = create_invitation(
        theme=theme,
        status=Invitation.Status.DRAFT,
        public_slug=reference,
        is_sample=False,
    )
    invitation.package = package
    invitation.save(update_fields=["package", "updated_at"])
    order = Order.objects.create(
        reference=reference,
        package=package,
        theme=theme,
        invitation=invitation,
        client_name="Alya & Raka",
        client_email="client@example.com",
        client_phone="+628123456789",
        total_amount="849000",
    )
    return order, invitation


def test_review_and_guest_tokens_are_redacted_from_request_logs():
    assert safe_log_path("/api/v1/bespoke-reviews/secret-token/otp") == (
        "/api/v1/bespoke-reviews/<redacted>/otp"
    )
    assert safe_log_path("/api/v1/guest-management/guest-secret/wishes") == (
        "/api/v1/guest-management/<redacted>/wishes"
    )


@pytest.mark.django_db
def test_bespoke_requires_scope_full_payment_and_otp_approval_before_snapshot_publish(client):
    order, invitation = bespoke_order()
    invitation = ensure_bespoke_invitation(order)
    assert invitation.renderer_key == "bespoke"
    assert invitation.content_schema_version == 2

    scope = create_scope_agreement(
        order,
        {
            "scope": {
                "summary": "Editorial wedding invitation",
                "deliverables": ["Custom cover", "RSVP", "Gallery"],
                "exclusions": ["Custom external integration"],
            },
            "total_amount": "849000",
        },
    )
    scope.status = BespokeScopeAgreement.Status.SENT
    scope.save(update_fields=["status", "updated_at"])
    _scope_session, scope_token = create_review_session(
        invitation=invitation,
        purpose=ClientReviewSession.Purpose.SCOPE,
        scope=scope,
    )
    _challenge, scope_code, _phone, _email = create_otp_challenge(_scope_session)
    approve_review(
        raw_token=scope_token,
        code=scope_code,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    scope.refresh_from_db()
    assert scope.status == BespokeScopeAgreement.Status.APPROVED

    PaymentRecord.objects.create(
        order=order,
        payment_type=PaymentRecord.Type.SETTLEMENT,
        review_status=PaymentRecord.ReviewStatus.VALID,
        amount="849000",
    )
    final_revision = InvitationRevision.objects.create(
        invitation=invitation,
        revision_number=1,
        content=invitation.content,
        note="Final check",
        is_final_check=True,
    )
    final_session, final_token = create_review_session(
        invitation=invitation,
        purpose=ClientReviewSession.Purpose.FINAL,
        revision=final_revision,
    )
    _challenge, final_code, _phone, _email = create_otp_challenge(final_session)
    approve_review(
        raw_token=final_token,
        code=final_code,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    staff = get_user_model().objects.create_user(
        username="bespoke-staff",
        email="staff@example.com",
        password="password",
        role="staff",
        is_staff=True,
    )
    published = publish_invitation(invitation, actor=staff)
    assert published.status == Invitation.Status.PUBLISHED
    assert InvitationPublication.objects.filter(invitation=invitation, is_active=True).count() == 1

    snapshot_story = InvitationPublication.objects.get(
        invitation=invitation,
        is_active=True,
    ).snapshot["content"]["story"]["body"]
    invitation.content = {**invitation.content, "story": {"heading": "Changed", "body": "Changed"}}
    invitation.save(update_fields=["content", "updated_at"])

    response = client.get(
        reverse("invitation-detail", kwargs={"public_slug": invitation.public_slug})
    )
    assert response.status_code == 200
    assert response.json()["content"]["story"]["body"] == snapshot_story


@pytest.mark.django_db
def test_published_bespoke_config_cannot_be_mutated_in_place():
    order, invitation = bespoke_order("bespoke-immutable")
    invitation = ensure_bespoke_invitation(order)
    invitation.status = Invitation.Status.PUBLISHED
    invitation.save(update_fields=["status", "updated_at"])
    changed = deepcopy(DEFAULT_BESPOKE_CONFIG)
    changed["tokens"]["accent"] = "#ffffff"

    with pytest.raises(Exception, match="immutable"):
        update_bespoke_config(order, changed)


@pytest.mark.django_db
def test_post_publish_change_requires_half_of_price_delta_before_production():
    order, invitation = bespoke_order("bespoke-paid-change")
    invitation = ensure_bespoke_invitation(order)
    initial_scope = create_scope_agreement(
        order,
        {"scope": {"summary": "Initial scope"}, "total_amount": "849000"},
    )
    initial_scope.status = BespokeScopeAgreement.Status.SUPERSEDED
    initial_scope.save(update_fields=["status", "updated_at"])
    changed_scope = create_scope_agreement(
        order,
        {"scope": {"summary": "Approved extension"}, "total_amount": "949000"},
    )
    changed_scope.status = BespokeScopeAgreement.Status.APPROVED
    changed_scope.save(update_fields=["status", "updated_at"])
    order.total_amount = changed_scope.total_amount
    order.save(update_fields=["total_amount", "updated_at"])
    order.refresh_from_db()
    BespokeChangeRequest.objects.create(
        order=order,
        scope_agreement=changed_scope,
        status=BespokeChangeRequest.Status.APPROVED,
        description="Additional custom scene",
        price_delta="100000",
    )
    invitation.status = Invitation.Status.PUBLISHED
    invitation.save(update_fields=["status", "updated_at"])
    PaymentRecord.objects.create(
        order=order,
        payment_type=PaymentRecord.Type.SETTLEMENT,
        review_status=PaymentRecord.ReviewStatus.VALID,
        amount="849000",
    )
    changed = deepcopy(DEFAULT_BESPOKE_CONFIG)
    changed["tokens"]["accent"] = "#ffffff"

    with pytest.raises(Exception, match="deposit"):
        update_bespoke_config(order, changed)

    PaymentRecord.objects.create(
        order=order,
        payment_type=PaymentRecord.Type.DP,
        review_status=PaymentRecord.ReviewStatus.VALID,
        amount="50000",
    )
    updated = update_bespoke_config(order, changed)

    assert updated.content["bespoke"]["tokens"]["accent"] == "#ffffff"
    assert updated.approval_status == Invitation.ApprovalStatus.DRAFT
