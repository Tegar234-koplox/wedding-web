from rest_framework import serializers

from common.models import AuditEvent
from orders.models import Order
from payments.models import PaymentInvoice


class PaymentInvoiceSerializer(serializers.ModelSerializer[PaymentInvoice]):
    order_reference = serializers.SlugRelatedField(
        source="order",
        slug_field="reference",
        queryset=Order.objects.all(),
    )

    class Meta:
        model = PaymentInvoice
        fields = [
            "id",
            "order_reference",
            "provider",
            "invoice_number",
            "provider_reference",
            "idempotency_key",
            "status",
            "amount",
            "currency",
            "checkout_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "provider", "status", "created_at", "updated_at"]

    def create(self, validated_data):
        invoice = super().create(validated_data)
        AuditEvent.objects.create(
            actor=self.context["request"].user,
            action="payment.invoice_created",
            resource_type="payment_invoice",
            resource_reference=invoice.invoice_number,
            metadata={"order": invoice.order.reference, "amount": str(invoice.amount)},
        )
        return invoice
