from django.contrib import admin

from payments.models import PaymentInvoice, PaymentRecord, PaymentWebhookEvent


@admin.register(PaymentInvoice)
class PaymentInvoiceAdmin(admin.ModelAdmin):
    list_display = ["invoice_number", "order", "status", "amount", "currency", "updated_at"]
    list_filter = ["provider", "status", "currency"]
    search_fields = ["invoice_number", "provider_reference", "order__reference"]


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(admin.ModelAdmin):
    list_display = ["event_id", "provider", "invoice", "processed_at", "created_at"]
    search_fields = ["event_id", "invoice__invoice_number"]


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = [
        "order",
        "payment_type",
        "method",
        "review_status",
        "amount",
        "paid_at",
        "recorded_by",
    ]
    list_filter = ["payment_type", "method", "review_status"]
    search_fields = ["order__reference", "proof_url", "note", "rejection_reason"]
