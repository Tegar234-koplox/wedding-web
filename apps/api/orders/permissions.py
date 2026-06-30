from rest_framework.permissions import BasePermission


class IsStaffRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            getattr(user, "is_authenticated", False)
            and getattr(user, "is_staff", False)
            and (getattr(user, "role", "") == "staff" or getattr(user, "is_superuser", False))
        )


class IsClientOwner(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            getattr(user, "is_authenticated", False)
            and getattr(user, "role", "") == "client"
            and not getattr(user, "is_staff", False)
        )
