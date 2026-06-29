from rest_framework.permissions import BasePermission

ROLE_LEVELS = {
    "owner": 50,
    "admin": 40,
    "editor": 30,
    "support": 20,
    "viewer": 10,
}


class IsStaffRole(BasePermission):
    minimum_role = "viewer"

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not getattr(user, "is_authenticated", False) or not user.is_staff:
            return False
        required = ROLE_LEVELS.get(getattr(view, "minimum_role", self.minimum_role), 10)
        actual = ROLE_LEVELS.get(getattr(user, "role", "viewer"), 10)
        return user.is_superuser or actual >= required


class IsClientOwner(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            getattr(user, "is_authenticated", False)
            and getattr(user, "role", "") == "client"
            and not getattr(user, "is_staff", False)
        )
