from django.contrib import admin

from leads.models import WhatsAppIntent


@admin.register(WhatsAppIntent)
class WhatsAppIntentAdmin(admin.ModelAdmin):
    list_display = ["created_at", "locale", "theme_slug", "package_code", "source"]
    list_filter = ["locale", "theme_slug", "package_code"]
    search_fields = ["campaign", "source"]
    readonly_fields = [
        "theme_slug",
        "package_code",
        "locale",
        "campaign",
        "source",
        "created_at",
        "updated_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
