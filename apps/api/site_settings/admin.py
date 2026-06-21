from django.contrib import admin

from site_settings.models import SiteSetting


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ["key", "description", "updated_at"]
    search_fields = ["key", "description"]
