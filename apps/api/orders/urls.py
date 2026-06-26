from django.urls import path

from orders.views import (
    ClientOrderListView,
    StaffDashboardMetricsView,
    StaffOrderDetailView,
    StaffOrderListCreateView,
)

urlpatterns = [
    path(
        "admin/dashboard/metrics",
        StaffDashboardMetricsView.as_view(),
        name="admin-dashboard-metrics",
    ),
    path("admin/orders", StaffOrderListCreateView.as_view(), name="admin-order-list"),
    path(
        "admin/orders/<slug:reference>",
        StaffOrderDetailView.as_view(),
        name="admin-order-detail",
    ),
    path("client/orders", ClientOrderListView.as_view(), name="client-order-list"),
]
