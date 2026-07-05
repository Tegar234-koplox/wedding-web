from rest_framework import serializers

from common.models import AuditEvent
from orders.models import Order
from payments.models import PaymentInvoice, PaymentRecord
from payments.services import sync_order_payment_status


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


class PaymentRecordSerializer(serializers.ModelSerializer[PaymentRecord]):
    payment_type_label = serializers.CharField(source="get_payment_type_display", read_only=True)
    method_label = serializers.CharField(source="get_method_display", read_only=True)
    review_status_label = serializers.CharField(source="get_review_status_display", read_only=True)
    recorded_by_email = serializers.EmailField(source="recorded_by.email", read_only=True)
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True)

    class Meta:
        model = PaymentRecord
        fields = [
            "id",
            "payment_type",
            "payment_type_label",
            "method",
            "method_label",
            "review_status",
            "review_status_label",
            "amount",
            "currency",
            "proof_url",
            "paid_at",
            "note",
            "rejection_reason",
            "recorded_by_email",
            "reviewed_by_email",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "currency",
            "recorded_by_email",
            "reviewed_by_email",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Nominal pembayaran harus lebih dari 0.")
        return value

    def validate_proof_url(self, value: str) -> str:
        proof_url = value.strip()
        if proof_url and not proof_url.startswith("https://res.cloudinary.com/"):
            raise serializers.ValidationError("Bukti transfer harus berupa URL Cloudinary.")
        return proof_url

    def validate(self, attrs):
        review_status = attrs.get(
            "review_status",
            getattr(self.instance, "review_status", PaymentRecord.ReviewStatus.PENDING),
        )
        rejection_reason = attrs.get(
            "rejection_reason",
            getattr(self.instance, "rejection_reason", ""),
        )
        if review_status == PaymentRecord.ReviewStatus.REJECTED and not rejection_reason.strip():
            raise serializers.ValidationError(
                {"rejection_reason": "Alasan wajib diisi ketika bukti ditolak."}
            )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        order = self.context["order"]
        record = PaymentRecord.objects.create(
            **validated_data,
            order=order,
            recorded_by=request.user,
            reviewed_by=(
                request.user
                if validated_data.get("review_status") != PaymentRecord.ReviewStatus.PENDING
                else None
            ),
        )
        if record.reviewed_by_id:
            from django.utils import timezone

            record.reviewed_at = timezone.now()
            record.save(update_fields=["reviewed_at", "updated_at"])
        sync_order_payment_status(order)
        AuditEvent.objects.create(
            actor=request.user,
            action="payment.manual_record_created",
            resource_type="order",
            resource_reference=order.reference,
            metadata={
                "amount": str(record.amount),
                "payment_type": record.payment_type,
                "review_status": record.review_status,
            },
        )
        return record

    def update(self, instance, validated_data):
        request = self.context["request"]
        old_status = instance.review_status
        record = super().update(instance, validated_data)
        if "review_status" in validated_data and record.review_status != old_status:
            from django.utils import timezone

            record.reviewed_by = request.user
            record.reviewed_at = timezone.now()
            record.save(update_fields=["reviewed_by", "reviewed_at", "updated_at"])
        sync_order_payment_status(record.order)
        AuditEvent.objects.create(
            actor=request.user,
            action="payment.manual_record_updated",
            resource_type="order",
            resource_reference=record.order.reference,
            metadata={
                "amount": str(record.amount),
                "old_status": old_status,
                "review_status": record.review_status,
            },
        )
        return record
