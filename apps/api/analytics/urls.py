from django.urls import path

from analytics.views import AnalyticsEventCreateView, AnalyticsMetricsView

urlpatterns = [
    path("analytics/events", AnalyticsEventCreateView.as_view(), name="analytics-event-create"),
    path("admin/analytics/metrics", AnalyticsMetricsView.as_view(), name="admin-analytics-metrics"),
]
