from django.contrib import admin

from tickets.models import Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "invitation",
        "category",
        "status",
        "created_by",
        "assigned_staff",
        "attachment_url",
        "resolved_at",
        "created_at",
    ]
    list_filter = ["category", "status", "assigned_staff"]
    search_fields = [
        "id",
        "invitation__public_slug",
        "description",
        "created_by__email",
        "assigned_staff__email",
    ]
    autocomplete_fields = ["invitation", "created_by", "assigned_staff"]
