from django.contrib import admin

from catalog.models import (
    Package,
    PackageFeature,
    PackageTranslation,
    Theme,
    ThemeMedia,
    ThemeTranslation,
)


class ThemeTranslationInline(admin.StackedInline):
    model = ThemeTranslation
    extra = 0


class ThemeMediaInline(admin.TabularInline):
    model = ThemeMedia
    extra = 0
    autocomplete_fields = ["asset"]


@admin.register(Theme)
class ThemeAdmin(admin.ModelAdmin):
    list_display = ["slug", "status", "renderer_key", "renderer_version", "is_featured"]
    list_filter = ["status", "is_featured", "category"]
    search_fields = ["slug", "translations__name"]
    prepopulated_fields = {"slug": ("renderer_key",)}
    autocomplete_fields = ["cover_asset"]
    inlines = [ThemeTranslationInline, ThemeMediaInline]


class PackageTranslationInline(admin.StackedInline):
    model = PackageTranslation
    extra = 0


class PackageFeatureInline(admin.TabularInline):
    model = PackageFeature
    extra = 0


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ["code", "price", "currency", "is_active", "is_featured"]
    list_filter = ["is_active", "is_featured", "currency"]
    search_fields = ["code", "translations__name"]
    inlines = [PackageTranslationInline, PackageFeatureInline]
