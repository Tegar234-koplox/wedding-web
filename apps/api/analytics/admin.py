from django.contrib import admin

from analytics.models import AnalyticsEvent


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ["event_type", "resource_type", "resource_reference", "source", "occurred_at"]
    list_filter = ["event_type", "locale", "source"]
    search_fields = ["resource_reference", "campaign", "source"]
