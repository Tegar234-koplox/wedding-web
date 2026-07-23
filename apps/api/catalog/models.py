from django.core.validators import MinValueValidator
from django.db import models

from common.models import ArchivableModel, UUIDTimeStampedModel
from common.validators import SUPPORTED_LOCALES, validate_renderer_key


def locale_choices() -> list[tuple[str, str]]:
    return [(locale, locale.upper()) for locale in sorted(SUPPORTED_LOCALES)]


class Theme(UUIDTimeStampedModel, ArchivableModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        RETIRED = "retired", "Retired"

    slug = models.SlugField(max_length=80, unique=True)
    renderer_key = models.CharField(
        max_length=80, 
        validators=[validate_renderer_key],
    )
    renderer_version = models.PositiveSmallIntegerField(default=2)
    content_schema_version = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    category = models.CharField(max_length=80, db_index=True)
    cover_asset = models.ForeignKey(
        "media_library.MediaAsset",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="theme_covers",
    )
    sort_order = models.PositiveSmallIntegerField(default=0, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["sort_order", "slug"]
        constraints = [
            models.UniqueConstraint(
                fields=["renderer_key", "renderer_version"],
                name="unique_theme_renderer_version",
            )
        ]
        indexes = [models.Index(fields=["status", "is_featured", "sort_order"])]

    def __str__(self) -> str:
        return self.slug


class ThemeTranslation(UUIDTimeStampedModel):
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, related_name="translations")
    locale = models.CharField(max_length=2, choices=locale_choices())
    name = models.CharField(max_length=120)
    tagline = models.CharField(max_length=180)
    description = models.TextField()
    feature_copy = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["locale"]
        constraints = [
            models.UniqueConstraint(
                fields=["theme", "locale"],
                name="unique_theme_translation_locale",
            )
        ]

    def __str__(self) -> str:
        return f"{self.theme.slug}:{self.locale}"


class ThemeMedia(UUIDTimeStampedModel):
    class Role(models.TextChoices):
        COVER = "cover", "Cover"
        GALLERY = "gallery", "Gallery"
        SOCIAL = "social", "Social"
        POSTER = "poster", "Poster"
        AUDIO = "audio", "Audio"

    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, related_name="media")
    asset = models.ForeignKey(
        "media_library.MediaAsset",
        on_delete=models.PROTECT,
        related_name="theme_usages",
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    focal_x = models.DecimalField(max_digits=5, decimal_places=2, default=50)
    focal_y = models.DecimalField(max_digits=5, decimal_places=2, default=50)
    sort_order = models.PositiveSmallIntegerField(default=0)
    alt_text = models.JSONField(default=dict)

    class Meta:
        ordering = ["sort_order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["theme", "asset", "role"],
                name="unique_theme_asset_role",
            )
        ]


class Package(UUIDTimeStampedModel, ArchivableModel):
    code = models.SlugField(max_length=40, unique=True)
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    currency = models.CharField(max_length=3, default="IDR")
    is_active = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "price"]

    def __str__(self) -> str:
        return self.code


class PackageTranslation(UUIDTimeStampedModel):
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="translations")
    locale = models.CharField(max_length=2, choices=locale_choices())
    name = models.CharField(max_length=100)
    summary = models.TextField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["package", "locale"],
                name="unique_package_translation_locale",
            )
        ]


class PackageFeature(UUIDTimeStampedModel):
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="features")
    feature_key = models.SlugField(max_length=80)
    is_included = models.BooleanField(default=True)
    value = models.CharField(max_length=120, blank=True)
    labels = models.JSONField(default=dict)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "feature_key"]
        constraints = [
            models.UniqueConstraint(
                fields=["package", "feature_key"],
                name="unique_package_feature_key",
            )
        ]
