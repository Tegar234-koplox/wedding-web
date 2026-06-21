from __future__ import annotations

from typing import Any

from rest_framework import serializers

from catalog.models import Package, PackageFeature, Theme, ThemeMedia
from media_library.models import MediaAsset


def localized(items: Any, locale: str) -> Any:
    values = list(items)
    return next(
        (item for item in values if item.locale == locale),
        next((item for item in values if item.locale == "id"), values[0] if values else None),
    )


class PublicMediaSerializer(serializers.ModelSerializer[MediaAsset]):
    class Meta:
        model = MediaAsset
        fields = ["secure_url", "resource_type", "width", "height"]


class ThemeMediaSerializer(serializers.ModelSerializer[ThemeMedia]):
    asset = PublicMediaSerializer(read_only=True)
    alt = serializers.SerializerMethodField()

    class Meta:
        model = ThemeMedia
        fields = ["role", "sort_order", "focal_x", "focal_y", "alt", "asset"]

    def get_alt(self, obj: ThemeMedia) -> str:
        locale = self.context.get("locale", "id")
        return obj.alt_text.get(locale) or obj.alt_text.get("id") or ""


class ThemeSerializer(serializers.ModelSerializer[Theme]):
    name = serializers.SerializerMethodField()
    tagline = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    feature_copy = serializers.SerializerMethodField()
    cover = PublicMediaSerializer(source="cover_asset", read_only=True)
    media = ThemeMediaSerializer(many=True, read_only=True)

    class Meta:
        model = Theme
        fields = [
            "slug",
            "renderer_key",
            "renderer_version",
            "content_schema_version",
            "category",
            "is_featured",
            "name",
            "tagline",
            "description",
            "feature_copy",
            "cover",
            "media",
        ]

    def _translation(self, obj: Theme) -> Any:
        return localized(obj.translations.all(), self.context.get("locale", "id"))

    def get_name(self, obj: Theme) -> str:
        translation = self._translation(obj)
        return translation.name if translation else obj.slug

    def get_tagline(self, obj: Theme) -> str:
        translation = self._translation(obj)
        return translation.tagline if translation else ""

    def get_description(self, obj: Theme) -> str:
        translation = self._translation(obj)
        return translation.description if translation else ""

    def get_feature_copy(self, obj: Theme) -> list[str]:
        translation = self._translation(obj)
        return translation.feature_copy if translation else []


class PackageFeatureSerializer(serializers.ModelSerializer[PackageFeature]):
    label = serializers.SerializerMethodField()

    class Meta:
        model = PackageFeature
        fields = ["feature_key", "is_included", "value", "label"]

    def get_label(self, obj: PackageFeature) -> str:
        locale = self.context.get("locale", "id")
        return obj.labels.get(locale) or obj.labels.get("id") or obj.feature_key


class PackageSerializer(serializers.ModelSerializer[Package]):
    name = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    features = PackageFeatureSerializer(many=True, read_only=True)

    class Meta:
        model = Package
        fields = [
            "code",
            "price",
            "currency",
            "is_featured",
            "name",
            "summary",
            "features",
        ]

    def _translation(self, obj: Package) -> Any:
        return localized(obj.translations.all(), self.context.get("locale", "id"))

    def get_name(self, obj: Package) -> str:
        translation = self._translation(obj)
        return translation.name if translation else obj.code

    def get_summary(self, obj: Package) -> str:
        translation = self._translation(obj)
        return translation.summary if translation else ""
