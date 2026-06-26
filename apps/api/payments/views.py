import hashlib

from django.utils import timezone
from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from orders.permissions import IsStaffRole
from payments.models import PaymentInvoice, PaymentWebhookEvent
from payments.serializers import PaymentInvoiceSerializer


class PaymentInvoiceCreateView(CreateAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = PaymentInvoiceSerializer


class PaymentInvoiceDetailView(RetrieveAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = PaymentInvoiceSerializer
    lookup_field = "invoice_number"
    queryset = PaymentInvoice.objects.select_related("order")


class MidtransWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        payload = request.data
        order_id = str(payload.get("order_id", ""))
        transaction_status = str(payload.get("transaction_status", ""))
        event_seed = f"{order_id}:{transaction_status}:{payload.get('transaction_id', '')}"
        event_id = hashlib.sha256(event_seed.encode()).hexdigest()
        event, created = PaymentWebhookEvent.objects.get_or_create(
            event_id=event_id,
            defaults={"payload": payload},
        )
        if not created and event.processed_at:
            return Response({"status": "ignored", "reason": "duplicate"})

        invoice = PaymentInvoice.objects.filter(invoice_number=order_id).first()
        if invoice:
            invoice.status = {
                "settlement": PaymentInvoice.Status.PAID,
                "capture": PaymentInvoice.Status.PAID,
                "deny": PaymentInvoice.Status.FAILED,
                "cancel": PaymentInvoice.Status.CANCELLED,
                "expire": PaymentInvoice.Status.EXPIRED,
                "refund": PaymentInvoice.Status.REFUNDED,
            }.get(transaction_status, invoice.status)
            invoice.provider_reference = str(
                payload.get("transaction_id", invoice.provider_reference)
            )
            invoice.raw_response = payload
            invoice.save(
                update_fields=["status", "provider_reference", "raw_response", "updated_at"]
            )
            event.invoice = invoice
            AuditEvent.objects.create(
                action="payment.webhook_processed",
                resource_type="payment_invoice",
                resource_reference=invoice.invoice_number,
                metadata={"status": invoice.status, "provider": "midtrans"},
            )

        event.processed_at = timezone.now()
        event.payload = payload
        event.save(update_fields=["invoice", "payload", "processed_at", "updated_at"])
        return Response({"status": "processed", "invoice": order_id or None})
