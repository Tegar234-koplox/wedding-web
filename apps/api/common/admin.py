from django.contrib import admin

from common.models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor", "action", "resource_type", "resource_reference"]
    list_filter = ["action", "resource_type"]
    search_fields = ["resource_reference"]
    readonly_fields = [
        "actor",
        "action",
        "resource_type",
        "resource_reference",
        "metadata",
        "created_at",
        "updated_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
