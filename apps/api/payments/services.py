from decimal import Decimal

from django.db.models import Sum

from orders.models import Order
from payments.models import PaymentRecord


def manual_payment_summary(order: Order) -> dict[str, Decimal | str]:
    valid_total = order.manual_payments.filter(
        review_status=PaymentRecord.ReviewStatus.VALID
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    pending_total = order.manual_payments.filter(
        review_status=PaymentRecord.ReviewStatus.PENDING
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    rejected_total = order.manual_payments.filter(
        review_status=PaymentRecord.ReviewStatus.REJECTED
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    total_amount = order.total_amount or Decimal("0")
    outstanding = max(total_amount - valid_total, Decimal("0"))
    if valid_total <= 0:
        payment_status = Order.PaymentStatus.UNPAID
    elif total_amount and valid_total >= total_amount:
        payment_status = Order.PaymentStatus.PAID
    else:
        payment_status = Order.PaymentStatus.DP

    return {
        "valid_total": valid_total,
        "pending_total": pending_total,
        "rejected_total": rejected_total,
        "outstanding": outstanding,
        "payment_status": payment_status,
    }


def sync_order_payment_status(order: Order) -> None:
    summary = manual_payment_summary(order)
    payment_status = str(summary["payment_status"])
    if order.payment_status != payment_status:
        order.payment_status = payment_status
        order.save(update_fields=["payment_status", "updated_at"])
