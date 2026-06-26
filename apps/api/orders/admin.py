from django.contrib import admin

from orders.models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "reference",
        "status",
        "client_name",
        "client_phone",
        "total_amount",
        "updated_at",
    ]
    list_filter = ["status", "currency"]
    search_fields = ["reference", "client_name", "client_email", "client_phone"]
