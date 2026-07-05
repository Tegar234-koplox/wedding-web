from django.urls import path

from payments.views import (
    MidtransWebhookView,
    PaymentInvoiceCreateView,
    PaymentInvoiceDetailView,
    StaffPaymentRecordListCreateView,
    StaffPaymentRecordUpdateView,
)

urlpatterns = [
    path("payments/invoices", PaymentInvoiceCreateView.as_view(), name="payment-invoice-create"),
    path(
        "payments/invoices/<slug:invoice_number>",
        PaymentInvoiceDetailView.as_view(),
        name="payment-invoice-detail",
    ),
    path(
        "admin/orders/<slug:reference>/payments",
        StaffPaymentRecordListCreateView.as_view(),
        name="admin-order-payment-list",
    ),
    path(
        "admin/orders/<slug:reference>/payments/<uuid:payment_id>",
        StaffPaymentRecordUpdateView.as_view(),
        name="admin-order-payment-update",
    ),
    path("payments/midtrans/webhook", MidtransWebhookView.as_view(), name="midtrans-webhook"),
]
