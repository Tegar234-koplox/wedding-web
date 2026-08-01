from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from users.models import StaffOrderAssignment, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            "Wedding access",
            {"fields": ("role", "staff_role", "staff_session_version")},
        ),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Wedding access", {"fields": ("email", "role", "staff_role")}),
    )
    readonly_fields = UserAdmin.readonly_fields + ("staff_session_version",)
    list_display = UserAdmin.list_display + ("email", "role", "staff_role")
    list_filter = UserAdmin.list_filter + ("role", "staff_role")


@admin.register(StaffOrderAssignment)
class StaffOrderAssignmentAdmin(admin.ModelAdmin):
    list_display = ("staff", "order", "assigned_by", "created_at")
    list_filter = ("staff__staff_role",)
    search_fields = ("staff__username", "staff__email", "order__reference")
    autocomplete_fields = ("staff", "order", "assigned_by")
