from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from users.models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Wedding access", {"fields": ("role",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Wedding access", {"fields": ("email", "role")}),)
    list_display = UserAdmin.list_display + ("email", "role")
    list_filter = UserAdmin.list_filter + ("role",)
