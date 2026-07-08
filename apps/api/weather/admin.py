from django.contrib import admin

from weather.models import WeatherFetchLog, WeatherSnapshot


@admin.register(WeatherSnapshot)
class WeatherSnapshotAdmin(admin.ModelAdmin):
    list_display = ["provider", "location_key", "analysis_at", "fetched_at", "expires_at"]
    search_fields = ["adm4", "location_key"]
    readonly_fields = [
        "adm4",
        "provider",
        "location_key",
        "analysis_at",
        "location",
        "forecast",
        "raw_checksum",
        "fetched_at",
        "expires_at",
        "created_at",
        "updated_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(WeatherFetchLog)
class WeatherFetchLogAdmin(admin.ModelAdmin):
    list_display = [
        "created_at",
        "provider",
        "location_key",
        "status",
        "latency_ms",
        "failure_category",
    ]
    list_filter = ["provider", "status", "failure_category"]
    search_fields = ["adm4", "location_key"]
    readonly_fields = [
        "adm4",
        "provider",
        "location_key",
        "status",
        "latency_ms",
        "failure_category",
        "analysis_at",
        "created_at",
        "updated_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
