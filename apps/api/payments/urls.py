from django.urls import path

from payments.views import MidtransWebhookView, PaymentInvoiceCreateView, PaymentInvoiceDetailView

urlpatterns = [
    path("payments/invoices", PaymentInvoiceCreateView.as_view(), name="payment-invoice-create"),
    path(
        "payments/invoices/<slug:invoice_number>",
        PaymentInvoiceDetailView.as_view(),
        name="payment-invoice-detail",
    ),
    path("payments/midtrans/webhook", MidtransWebhookView.as_view(), name="midtrans-webhook"),
]
