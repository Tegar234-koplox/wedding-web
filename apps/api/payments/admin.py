from django.contrib import admin

from payments.models import PaymentInvoice, PaymentWebhookEvent


@admin.register(PaymentInvoice)
class PaymentInvoiceAdmin(admin.ModelAdmin):
    list_display = ["invoice_number", "order", "status", "amount", "currency", "updated_at"]
    list_filter = ["provider", "status", "currency"]
    search_fields = ["invoice_number", "provider_reference", "order__reference"]


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(admin.ModelAdmin):
    list_display = ["event_id", "provider", "invoice", "processed_at", "created_at"]
    search_fields = ["event_id", "invoice__invoice_number"]
