from __future__ import annotations

from types import SimpleNamespace

import pytest
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from common.mfa import (
    challenge_user,
    claim_login_challenge,
    create_login_challenge,
    release_login_challenge,
    verify_second_factor,
)
from common.middleware import StaffSessionSecurityMiddleware
from common.models import AuditEvent
from common.permissions import (
    HasStaffRole,
    filter_orders_for_staff,
    staff_can_access_order,
)
from orders.models import Order
from tests.factories import create_invitation, create_theme
from users.models import StaffMFARecoveryCode, StaffOrderAssignment, User
from users.security import (
    SESSION_ISSUED_AT_KEY,
    SESSION_LAST_SEEN_AT_KEY,
    SESSION_VERSION_KEY,
    now_timestamp,
    revoke_all_staff_sessions,
)


def _staff_request(user: User):
    request = RequestFactory().get("/api/v1/auth/me")
    SessionMiddleware(lambda _: HttpResponse()).process_request(request)
    request.session.save()
    request.user = user
    return request


@pytest.mark.django_db
def test_roles_and_assignments_scope_order_access():
    owner = User.objects.create_user(
        username="owner",
        email="owner@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.OWNER,
        is_staff=True,
    )
    editor = User.objects.create_user(
        username="editor",
        email="editor@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.EDITOR,
        is_staff=True,
    )
    other_editor = User.objects.create_user(
        username="other-editor",
        email="other-editor@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.EDITOR,
        is_staff=True,
    )
    assigned_order = Order.objects.create(reference="N-ASSIGNED", client_name="Assigned")
    other_order = Order.objects.create(reference="N-OTHER", client_name="Other")
    StaffOrderAssignment.objects.create(staff=editor, order=assigned_order, assigned_by=owner)

    assert staff_can_access_order(owner, assigned_order)
    assert staff_can_access_order(owner, other_order)
    assert staff_can_access_order(editor, assigned_order)
    assert not staff_can_access_order(editor, other_order)
    assert not staff_can_access_order(other_editor, assigned_order)

    visible = filter_orders_for_staff(Order.objects.all(), editor)
    assert list(visible.values_list("pk", flat=True)) == [assigned_order.pk]


@pytest.mark.django_db
def test_role_permission_is_explicit_and_superuser_is_effective_owner():
    finance = User.objects.create_user(
        username="finance",
        email="finance@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.FINANCE,
        is_staff=True,
    )
    superuser = User.objects.create_superuser(
        username="root",
        email="root@example.com",
        password="a-secure-password",
    )
    finance_request = SimpleNamespace(user=finance)
    superuser_request = SimpleNamespace(user=superuser)
    owner_view = SimpleNamespace(required_staff_roles=(User.StaffRole.OWNER,))

    permission = HasStaffRole()
    assert not permission.has_permission(finance_request, owner_view)
    assert permission.has_permission(superuser_request, owner_view)


@pytest.mark.django_db
def test_security_change_and_assignment_change_revoke_staff_sessions():
    staff = User.objects.create_user(
        username="sessioned",
        email="sessioned@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.VIEWER,
        is_staff=True,
    )
    initial_version = staff.staff_session_version

    staff.staff_role = User.StaffRole.EDITOR
    staff.save(update_fields=["staff_role"])
    assert staff.staff_session_version == initial_version + 1

    order = Order.objects.create(reference="N-SECURITY", client_name="Security")
    StaffOrderAssignment.objects.create(staff=staff, order=order)
    staff.refresh_from_db()
    assert staff.staff_session_version == initial_version + 2

    legacy_order = Order.objects.create(
        reference="N-LEGACY-ASSIGNMENT",
        client_name="Legacy",
        assigned_staff=staff,
    )
    staff.refresh_from_db()
    assert staff.staff_session_version == initial_version + 3

    legacy_order.assigned_staff = None
    legacy_order.save(update_fields=["assigned_staff", "updated_at"])
    staff.refresh_from_db()
    assert staff.staff_session_version == initial_version + 4


@pytest.mark.django_db
def test_order_endpoints_hide_cross_order_data_and_lists_are_assignment_scoped(client):
    editor = User.objects.create_user(
        username="scoped-editor",
        email="scoped-editor@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.EDITOR,
        is_staff=True,
    )
    other_editor = User.objects.create_user(
        username="other-scoped-editor",
        email="other-scoped-editor@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.EDITOR,
        is_staff=True,
    )
    assigned_order = Order.objects.create(
        reference="N-SCOPED-OWN",
        client_name="Assigned",
        assigned_staff=editor,
    )
    other_order = Order.objects.create(
        reference="N-SCOPED-OTHER",
        client_name="Other",
        assigned_staff=other_editor,
    )
    client.force_login(editor)

    listing = client.get(reverse("admin-order-list"))
    cross_order = client.get(
        reverse("admin-order-detail", kwargs={"reference": other_order.reference})
    )

    assert listing.status_code == 200
    assert [item["reference"] for item in listing.json()] == [assigned_order.reference]
    assert cross_order.status_code == 404


@pytest.mark.django_db
def test_viewer_order_detail_does_not_expose_pii_content_or_capability_links(client):
    viewer = User.objects.create_user(
        username="masked-viewer",
        email="masked-viewer@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.VIEWER,
        is_staff=True,
    )
    invitation = create_invitation(
        theme=create_theme(slug="masked-viewer-theme"),
        public_slug="masked-viewer-invitation",
        is_sample=False,
    )
    invitation.content = {
        **invitation.content,
        "bank_accounts": [
            {
                "bank": "Niskala Bank",
                "accountNumber": "1234567890",
                "accountName": "Private Client",
            }
        ],
    }
    invitation.save(update_fields=["content", "updated_at"])
    order = Order.objects.create(
        reference="N-MASKED-VIEWER",
        client_name="Private Client",
        client_email="private@example.com",
        client_phone="+628123456789",
        invitation=invitation,
        assigned_staff=viewer,
    )
    client.force_login(viewer)

    response = client.get(reverse("admin-order-detail", kwargs={"reference": order.reference}))

    assert response.status_code == 200
    payload = response.json()
    assert "client_name" not in payload["order"]
    assert "client_email" not in payload["order"]
    assert "client_phone" not in payload["order"]
    assert "bank_accounts" not in payload["invitation"]
    assert "couple" not in payload["invitation"]
    assert payload["preview_url"] == ""
    assert payload["wishes_url"] == ""
    assert payload["guest_management_url"] == ""
    assert payload["payments"] == []
    assert payload["payment_summary"] == {}


@pytest.mark.django_db
def test_client_lifecycle_list_is_limited_to_owner_and_support(client):
    viewer = User.objects.create_user(
        username="lifecycle-viewer",
        email="lifecycle-viewer@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.VIEWER,
        is_staff=True,
    )
    support = User.objects.create_user(
        username="lifecycle-support",
        email="lifecycle-support@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.SUPPORT,
        is_staff=True,
    )
    invitation = create_invitation(
        theme=create_theme(slug="lifecycle-rbac-theme"),
        public_slug="lifecycle-rbac-invitation",
        is_sample=False,
    )
    order = Order.objects.create(
        reference="N-LIFECYCLE-RBAC",
        client_name="Lifecycle Client",
        client_email="lifecycle@example.com",
        client_phone="+628111111111",
        invitation=invitation,
        assigned_staff=support,
    )
    StaffOrderAssignment.objects.create(staff=viewer, order=order)

    client.force_login(viewer)
    denied = client.get(reverse("admin-client-lifecycle"))
    client.logout()
    client.force_login(support)
    allowed = client.get(reverse("admin-client-lifecycle"))

    assert denied.status_code == 403
    assert allowed.status_code == 200
    assert allowed.json()[0]["client_email"] == order.client_email


@pytest.mark.django_db
def test_order_patch_enforces_field_level_roles(client):
    viewer = User.objects.create_user(
        username="field-viewer",
        email="field-viewer@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.VIEWER,
        is_staff=True,
    )
    finance = User.objects.create_user(
        username="field-finance",
        email="field-finance@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.FINANCE,
        is_staff=True,
    )
    viewer_order = Order.objects.create(
        reference="N-FIELD-VIEWER",
        client_name="Viewer",
        assigned_staff=viewer,
    )
    finance_order = Order.objects.create(
        reference="N-FIELD-FINANCE",
        client_name="Finance",
        assigned_staff=finance,
    )

    client.force_login(viewer)
    viewer_response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": viewer_order.reference}),
        {"notes": "Viewer must remain read only."},
        content_type="application/json",
    )
    client.logout()
    client.force_login(finance)
    finance_response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": finance_order.reference}),
        {"notes": "Finance cannot edit operational notes."},
        content_type="application/json",
    )

    assert viewer_response.status_code == 403
    assert finance_response.status_code == 403
    viewer_order.refresh_from_db()
    finance_order.refresh_from_db()
    assert viewer_order.notes == ""
    assert finance_order.notes == ""


@pytest.mark.django_db
def test_finance_cannot_patch_derived_payment_status(client):
    finance = User.objects.create_user(
        username="derived-payment-finance",
        email="derived-payment-finance@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.FINANCE,
        is_staff=True,
    )
    order = Order.objects.create(
        reference="N-DERIVED-PAYMENT",
        client_name="Payment Client",
        assigned_staff=finance,
    )
    client.force_login(finance)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"payment_status": Order.PaymentStatus.PAID},
        content_type="application/json",
    )

    assert response.status_code == 400
    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.UNPAID


@pytest.mark.django_db
def test_finance_amount_update_records_old_and_new_values(client):
    finance = User.objects.create_user(
        username="amount-finance",
        email="amount-finance@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.FINANCE,
        is_staff=True,
    )
    order = Order.objects.create(
        reference="N-AMOUNT-AUDIT",
        client_name="Amount Client",
        assigned_staff=finance,
        total_amount="99000.00",
        currency="IDR",
    )
    client.force_login(finance)

    response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"total_amount": "149000.00", "currency": "USD"},
        content_type="application/json",
    )

    assert response.status_code == 200
    event = AuditEvent.objects.get(
        actor=finance,
        action="order.updated",
        resource_reference=order.reference,
    )
    assert event.metadata["total_amount"] == {
        "from": "99000.00",
        "to": "149000.00",
    }
    assert event.metadata["currency"] == {"from": "IDR", "to": "USD"}


@pytest.mark.django_db
def test_editor_order_status_patch_is_limited_to_design_workflow(client):
    editor = User.objects.create_user(
        username="workflow-editor",
        email="workflow-editor@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.EDITOR,
        is_staff=True,
    )
    order = Order.objects.create(
        reference="N-EDITOR-WORKFLOW",
        client_name="Workflow Client",
        status=Order.Status.IN_DESIGN,
        assigned_staff=editor,
    )
    client.force_login(editor)

    design_response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"status": Order.Status.CLIENT_REVIEW},
        content_type="application/json",
    )
    cancel_response = client.patch(
        reverse("admin-order-detail", kwargs={"reference": order.reference}),
        {"status": Order.Status.CANCELLED},
        content_type="application/json",
    )

    assert design_response.status_code == 200
    assert cancel_response.status_code == 403
    order.refresh_from_db()
    assert order.status == Order.Status.CLIENT_REVIEW


@pytest.mark.django_db
def test_finance_verification_queue_is_role_and_assignment_scoped(client):
    finance = User.objects.create_user(
        username="queue-finance",
        email="queue-finance@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.FINANCE,
        is_staff=True,
    )
    editor = User.objects.create_user(
        username="queue-editor",
        email="queue-editor@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.EDITOR,
        is_staff=True,
    )
    own_order = Order.objects.create(
        reference="N-QUEUE-OWN",
        client_name="Own",
        status=Order.Status.PENDING,
        assigned_staff=finance,
    )
    Order.objects.create(
        reference="N-QUEUE-OTHER",
        client_name="Other",
        status=Order.Status.PENDING,
        assigned_staff=editor,
    )
    client.force_login(finance)

    response = client.get(reverse("admin-order-verification-queue"))
    client.logout()
    client.force_login(editor)
    denied = client.get(reverse("admin-order-verification-queue"))

    assert response.status_code == 200
    assert [item["reference"] for item in response.json()] == [own_order.reference]
    assert denied.status_code == 403


@pytest.mark.django_db
def test_invitation_staff_endpoints_enforce_assignment_and_role(client):
    support = User.objects.create_user(
        username="invitation-support",
        email="invitation-support@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.SUPPORT,
        is_staff=True,
    )
    editor = User.objects.create_user(
        username="invitation-editor",
        email="invitation-editor@example.com",
        role=User.Role.STAFF,
        staff_role=User.StaffRole.EDITOR,
        is_staff=True,
    )
    own_invitation = create_invitation(
        theme=create_theme(slug="rbac-own-theme"),
        public_slug="rbac-own-invitation",
        is_sample=False,
    )
    other_invitation = create_invitation(
        theme=create_theme(slug="rbac-other-theme"),
        public_slug="rbac-other-invitation",
        is_sample=False,
    )
    Order.objects.create(
        reference="N-INVITATION-OWN",
        client_name="Own",
        invitation=own_invitation,
        assigned_staff=support,
    )
    Order.objects.create(
        reference="N-INVITATION-OTHER",
        client_name="Other",
        invitation=other_invitation,
        assigned_staff=editor,
    )
    client.force_login(support)

    listing = client.get(reverse("admin-invitation-list"))
    own_aggregate = client.get(
        reverse(
            "admin-invitation-guest-list",
            kwargs={"public_slug": own_invitation.public_slug},
        )
    )
    other_aggregate = client.get(
        reverse(
            "admin-invitation-guest-list",
            kwargs={"public_slug": other_invitation.public_slug},
        )
    )
    client.logout()
    client.force_login(editor)
    wrong_role = client.get(
        reverse(
            "admin-invitation-guest-link-list",
            kwargs={"public_slug": other_invitation.public_slug},
        )
    )

    assert listing.status_code == 200
    assert [item["public_slug"] for item in listing.json()] == [own_invitation.public_slug]
    assert own_aggregate.status_code == 200
    assert other_aggregate.status_code == 404
    assert wrong_role.status_code == 403


@pytest.mark.django_db
@override_settings(
    STAFF_SESSION_ABSOLUTE_TTL_SECONDS=28_800,
    STAFF_SESSION_IDLE_TTL_SECONDS=1_800,
    STAFF_SESSION_TOUCH_INTERVAL_SECONDS=60,
)
def test_staff_session_middleware_initializes_legacy_session_and_rejects_revoked_version():
    staff = User.objects.create_user(
        username="session-middleware",
        email="session-middleware@example.com",
        role=User.Role.STAFF,
        is_staff=True,
    )
    request = _staff_request(staff)
    middleware = StaffSessionSecurityMiddleware(lambda _: HttpResponse())

    middleware(request)
    assert request.session[SESSION_VERSION_KEY] == staff.staff_session_version
    assert request.session[SESSION_ISSUED_AT_KEY] == request.session[SESSION_LAST_SEEN_AT_KEY]

    revoke_all_staff_sessions(staff)
    middleware(request)
    assert isinstance(request.user, AnonymousUser)


@pytest.mark.django_db
@override_settings(
    DEPLOYMENT_ENVIRONMENT="production",
    STAFF_SESSION_ABSOLUTE_TTL_SECONDS=28_800,
    STAFF_SESSION_IDLE_TTL_SECONDS=1_800,
    STAFF_SESSION_TOUCH_INTERVAL_SECONDS=60,
)
def test_staff_session_middleware_rejects_legacy_session_in_production():
    staff = User.objects.create_user(
        username="production-legacy-session",
        email="production-legacy-session@example.com",
        role=User.Role.STAFF,
        is_staff=True,
    )
    request = _staff_request(staff)

    StaffSessionSecurityMiddleware(lambda _: HttpResponse())(request)

    assert isinstance(request.user, AnonymousUser)


@pytest.mark.django_db
@override_settings(
    STAFF_SESSION_ABSOLUTE_TTL_SECONDS=28_800,
    STAFF_SESSION_IDLE_TTL_SECONDS=1_800,
    STAFF_SESSION_TOUCH_INTERVAL_SECONDS=60,
)
def test_staff_session_middleware_rejects_idle_timeout():
    staff = User.objects.create_user(
        username="idle-session",
        email="idle-session@example.com",
        role=User.Role.STAFF,
        is_staff=True,
    )
    request = _staff_request(staff)
    now = now_timestamp()
    request.session[SESSION_ISSUED_AT_KEY] = now - 1_801
    request.session[SESSION_LAST_SEEN_AT_KEY] = now - 1_801
    request.session[SESSION_VERSION_KEY] = staff.staff_session_version

    StaffSessionSecurityMiddleware(lambda _: HttpResponse())(request)

    assert isinstance(request.user, AnonymousUser)


@pytest.mark.django_db
def test_recovery_code_is_consumed_only_once_and_challenge_is_version_bound():
    staff = User.objects.create_user(
        username="recovery",
        email="recovery@example.com",
        role=User.Role.STAFF,
        is_staff=True,
    )
    raw_code = "single-use-recovery"

    StaffMFARecoveryCode.objects.create(
        user=staff,
        code_hash=make_password(raw_code),
    )
    challenge = create_login_challenge(staff)

    assert challenge_user(challenge) == staff
    assert verify_second_factor(staff, raw_code) == "recovery_code"
    assert verify_second_factor(staff, raw_code) is None

    revoke_all_staff_sessions(staff)
    assert challenge_user(challenge) is None


@pytest.mark.django_db
def test_login_challenge_can_only_be_claimed_by_one_verification_attempt():
    staff = User.objects.create_user(
        username="challenge-claim",
        email="challenge-claim@example.com",
        role=User.Role.STAFF,
        is_staff=True,
    )
    challenge = create_login_challenge(staff)

    assert claim_login_challenge(challenge) == staff
    assert claim_login_challenge(challenge) is None

    release_login_challenge(challenge)
    assert claim_login_challenge(challenge) == staff


@pytest.mark.django_db
def test_wrong_reauth_password_does_not_consume_recovery_code(client):
    staff = User.objects.create_user(
        username="reauth-recovery",
        email="reauth-recovery@example.com",
        password="correct-password-value",
        role=User.Role.STAFF,
        is_staff=True,
    )
    raw_code = "do-not-consume-this-code"
    recovery = StaffMFARecoveryCode.objects.create(
        user=staff,
        code_hash=make_password(raw_code),
    )
    client.force_login(staff)

    response = client.post(
        reverse("api-staff-reauth"),
        {
            "password": "incorrect-password-value",
            "code": raw_code,
        },
        content_type="application/json",
    )

    recovery.refresh_from_db()
    assert response.status_code == 400
    assert recovery.used_at is None
