from django.db.models import Prefetch, QuerySet

from catalog.models import Package, PackageFeature, Theme, ThemeTranslation


def public_themes() -> QuerySet[Theme]:
    return (
        Theme.objects.filter(status=Theme.Status.PUBLISHED, archived_at__isnull=True)
        .select_related("cover_asset")
        .prefetch_related(
            Prefetch(
                "translations",
                queryset=ThemeTranslation.objects.order_by("locale"),
            ),
            "media__asset",
        )
        .order_by("sort_order", "slug")
    )


def public_packages() -> QuerySet[Package]:
    return (
        Package.objects.filter(is_active=True, archived_at__isnull=True)
        .prefetch_related(
            "translations",
            Prefetch(
                "features",
                queryset=PackageFeature.objects.order_by("sort_order", "feature_key"),
            ),
        )
        .order_by("sort_order", "price")
    )
