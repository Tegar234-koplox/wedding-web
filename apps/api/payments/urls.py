from django.urls import path

from payments.views import (
    StaffPaymentRecordListCreateView,
    StaffPaymentRecordUpdateView,
)

urlpatterns = [
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
]
