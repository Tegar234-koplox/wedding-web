from django.contrib import admin

from invitations.models import (
    EventLocation,
    Guest,
    Invitation,
    InvitationMedia,
    InvitationRevision,
    WeddingEvent,
)


class WeddingEventInline(admin.StackedInline):
    model = WeddingEvent
    extra = 0


class InvitationMediaInline(admin.TabularInline):
    model = InvitationMedia
    extra = 0
    autocomplete_fields = ["asset"]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = [
        "public_slug",
        "status",
        "approval_status",
        "theme",
        "package",
        "client_user",
        "is_sample",
        "published_at",
    ]
    list_filter = [
        "status",
        "approval_status",
        "is_sample",
        "default_locale",
        "renderer_key",
    ]
    search_fields = [
        "public_slug",
        "client_user__email",
        "client_user__username",
        "order__reference",
    ]
    autocomplete_fields = ["theme", "package", "client_user"]
    inlines = [WeddingEventInline, InvitationMediaInline]


@admin.register(EventLocation)
class EventLocationAdmin(admin.ModelAdmin):
    list_display = ["event", "province", "regency", "village", "bmkg_adm4"]
    search_fields = ["province", "regency", "district", "village", "bmkg_adm4"]
    autocomplete_fields = ["event"]


@admin.register(WeddingEvent)
class WeddingEventAdmin(admin.ModelAdmin):
    list_display = ["invitation", "event_type", "starts_at", "venue_name"]
    search_fields = ["invitation__public_slug", "venue_name", "address"]
    autocomplete_fields = ["invitation"]


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ["display_name", "invitation", "party_size", "archived_at"]
    search_fields = ["display_name", "invitation__public_slug"]
    exclude = ["access_token_hash"]


@admin.register(InvitationRevision)
class InvitationRevisionAdmin(admin.ModelAdmin):
    list_display = ["invitation", "revision_number", "created_by", "created_at"]
    readonly_fields = ["invitation", "revision_number", "content", "created_by", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
