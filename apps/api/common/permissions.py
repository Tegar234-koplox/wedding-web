from __future__ import annotations

from collections.abc import Iterable

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q, QuerySet
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from common.mfa import mfa_enrolled
from users.models import StaffOrderAssignment, User


def is_staff_user(user) -> bool:
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
        and getattr(user, "is_staff", False)
        and (getattr(user, "is_superuser", False) or getattr(user, "role", "") == User.Role.STAFF)
    )


def effective_staff_role(user) -> str:
    if getattr(user, "is_superuser", False):
        return User.StaffRole.OWNER
    role = str(getattr(user, "staff_role", ""))
    if role in User.StaffRole.values:
        return role
    return User.StaffRole.VIEWER


def staff_has_any_role(user, roles: Iterable[str]) -> bool:
    return is_staff_user(user) and effective_staff_role(user) in set(roles)


def require_staff_roles(request, *roles: str) -> None:
    if not staff_has_any_role(request.user, roles):
        raise PermissionDenied("Peran staff Anda tidak diizinkan melakukan aksi ini.")


def _order_id_from_object(obj):
    if getattr(getattr(obj, "_meta", None), "label_lower", "") == "orders.order":
        return getattr(obj, "pk", None)

    order_id = getattr(obj, "order_id", None)
    if order_id:
        return order_id

    try:
        order = getattr(obj, "order", None)
    except ObjectDoesNotExist:
        return None
    return getattr(order, "pk", None)


def staff_can_access_order(user, order_or_related_object) -> bool:
    if not is_staff_user(user):
        return False
    if effective_staff_role(user) == User.StaffRole.OWNER:
        return True

    order_id = _order_id_from_object(order_or_related_object)
    if not order_id:
        return False

    legacy_assignee_id = getattr(order_or_related_object, "assigned_staff_id", None)
    if legacy_assignee_id is None:
        try:
            related_order = getattr(order_or_related_object, "order", None)
        except ObjectDoesNotExist:
            related_order = None
        legacy_assignee_id = getattr(related_order, "assigned_staff_id", None)
    if legacy_assignee_id == user.pk:
        return True

    return StaffOrderAssignment.objects.filter(
        staff_id=user.pk,
        order_id=order_id,
    ).exists()


def filter_orders_for_staff(queryset: QuerySet, user) -> QuerySet:
    if not is_staff_user(user):
        return queryset.none()
    if effective_staff_role(user) == User.StaffRole.OWNER:
        return queryset
    return queryset.filter(
        Q(assigned_staff_id=user.pk) | Q(staff_assignments__staff_id=user.pk)
    ).distinct()


def filter_invitations_for_staff(queryset: QuerySet, user) -> QuerySet:
    if not is_staff_user(user):
        return queryset.none()
    if effective_staff_role(user) == User.StaffRole.OWNER:
        return queryset
    return queryset.filter(
        Q(order__assigned_staff_id=user.pk) | Q(order__staff_assignments__staff_id=user.pk)
    ).distinct()


def filter_order_related_for_staff(
    queryset: QuerySet,
    user,
    *,
    order_lookup: str,
) -> QuerySet:
    if not is_staff_user(user):
        return queryset.none()
    if effective_staff_role(user) == User.StaffRole.OWNER:
        return queryset
    return queryset.filter(
        Q(**{f"{order_lookup}__assigned_staff_id": user.pk})
        | Q(**{f"{order_lookup}__staff_assignments__staff_id": user.pk})
    ).distinct()


def require_staff_order_access(request, order_or_related_object) -> None:
    if not staff_can_access_order(request.user, order_or_related_object):
        raise PermissionDenied("Anda tidak memiliki akses ke order ini.")


def has_recent_staff_mfa(request) -> bool:
    if not settings.STAFF_MFA_REQUIRED:
        return True
    if not is_staff_user(request.user) or not mfa_enrolled(request.user):
        return False

    verified_at = request.session.get("staff_mfa_verified_at")
    if not isinstance(verified_at, int | float):
        return False

    age_seconds = timezone.now().timestamp() - verified_at
    return 0 <= age_seconds <= settings.STAFF_MFA_REAUTH_TTL_SECONDS


def require_recent_staff_mfa(request) -> None:
    """Require a recent second factor for sensitive staff mutations."""
    if has_recent_staff_mfa(request):
        return
    if not mfa_enrolled(request.user):
        raise PermissionDenied("MFA staff wajib diaktifkan sebelum melakukan aksi ini.")
    raise PermissionDenied("Verifikasi ulang MFA diperlukan.")


class IsStaffRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        del view
        return is_staff_user(request.user)


class HasStaffRole(BasePermission):
    """Require a view to declare one or more accepted ``required_staff_roles``."""

    def has_permission(self, request, view) -> bool:
        required_roles = getattr(view, "required_staff_roles", ())
        return staff_has_any_role(request.user, required_roles)


class HasOrderAccess(BasePermission):
    """Object-level guard; list views must also call ``filter_orders_for_staff``."""

    def has_permission(self, request, view) -> bool:
        del view
        return is_staff_user(request.user)

    def has_object_permission(self, request, view, obj) -> bool:
        del view
        return staff_can_access_order(request.user, obj)


class HasRecentStaffMFA(BasePermission):
    def has_permission(self, request, view) -> bool:
        del view
        return has_recent_staff_mfa(request)
