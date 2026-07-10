from decimal import Decimal

from django.db import migrations

FEATURES = [
    ("couture", "Semua fitur Couture", "Everything in Couture"),
    (
        "dedicated-direction",
        "Brief dan art direction khusus",
        "Dedicated brief and art direction",
    ),
    (
        "flexible-sections",
        "Struktur section fleksibel",
        "Flexible section structure",
    ),
    (
        "custom-visual-system",
        "Warna, tipografi, overlay, dan motion khusus",
        "Custom color, typography, overlay, and motion",
    ),
    (
        "concept-options",
        "1 konsep utama + 1 alternatif ringan",
        "1 primary concept + 1 light alternative",
    ),
    (
        "revisions-final-check",
        "Revisi 8 kali + Final Check",
        "8 revisions + Final Check",
    ),
    (
        "production-window",
        "Estimasi 10-14 hari kerja setelah data lengkap",
        "Estimated 10-14 business days after complete materials",
    ),
]


def add_bespoke_package(apps, schema_editor):
    Package = apps.get_model("catalog", "Package")
    PackageFeature = apps.get_model("catalog", "PackageFeature")
    PackageTranslation = apps.get_model("catalog", "PackageTranslation")

    package, _ = Package.objects.update_or_create(
        code="bespoke",
        defaults={
            "price": Decimal("849000.00"),
            "currency": "IDR",
            "is_active": True,
            "is_featured": False,
            "sort_order": 3,
        },
    )
    summaries = {
        "id": (
            "Pengalaman undangan full custom yang dibangun dari brief, karakter, "
            "dan arah visual perayaan Anda."
        ),
        "en": (
            "A fully custom invitation experience shaped around your brief, character, "
            "and visual direction."
        ),
    }
    for locale in ("id", "en"):
        PackageTranslation.objects.update_or_create(
            package=package,
            locale=locale,
            defaults={"name": "Bespoke", "summary": summaries[locale]},
        )

    feature_keys = []
    for sort_order, (feature_key, label_id, label_en) in enumerate(FEATURES):
        feature_keys.append(feature_key)
        PackageFeature.objects.update_or_create(
            package=package,
            feature_key=feature_key,
            defaults={
                "is_included": True,
                "labels": {"id": label_id, "en": label_en},
                "sort_order": sort_order,
            },
        )
    PackageFeature.objects.filter(package=package).exclude(feature_key__in=feature_keys).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0003_update_2026_package_copy"),
    ]

    operations = [
        migrations.RunPython(add_bespoke_package, migrations.RunPython.noop),
    ]
