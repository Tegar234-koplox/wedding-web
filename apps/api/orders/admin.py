from django.contrib import admin

from orders.models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "reference",
        "status",
        "client_name",
        "client_user",
        "invitation",
        "assigned_staff",
        "client_phone",
        "total_amount",
        "updated_at",
    ]
    list_filter = ["status", "currency", "assigned_staff"]
    search_fields = [
        "reference",
        "client_name",
        "client_email",
        "client_phone",
        "client_user__email",
        "invitation__public_slug",
    ]
    autocomplete_fields = [
        "whatsapp_intent",
        "package",
        "theme",
        "invitation",
        "assigned_staff",
        "client_user",
    ]
