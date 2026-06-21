from django.contrib import admin

from media_library.models import MediaAsset


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ["public_id", "resource_type", "folder", "width", "height", "archived_at"]
    list_filter = ["resource_type", "folder", "archived_at"]
    search_fields = ["public_id", "original_filename", "checksum"]
    readonly_fields = ["created_at", "updated_at"]
