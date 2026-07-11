from decimal import Decimal

from django.db import migrations

SUMMARY = {
    "id": "Desain lebih kompleks untuk perayaan yang ingin tampil benar-benar berbeda.",
    "en": "More complex designs for celebrations that want to be truly different.",
}

FEATURES = [
    ("signature", "Semua fitur Signature", "Everything in Signature"),
    (
        "complexity-design",
        "Kompleksitas desain dan motion",
        "Complexity of design and motion",
    ),
    ("vivid-display", "Tampilan lebih hidup", "More vivid display"),
    (
        "story-details",
        "Detail love story dan timeline",
        "Love story details and timeline",
    ),
    ("revisions-8", "Revisi 8 kali", "8 revisions"),
    (
        "gallery-plus-4",
        "Galeri +4 foto dari paket Signature",
        "Gallery +4 photos from Signature",
    ),
]


def update_couture_copy(apps, schema_editor):
    Package = apps.get_model("catalog", "Package")
    PackageFeature = apps.get_model("catalog", "PackageFeature")
    PackageTranslation = apps.get_model("catalog", "PackageTranslation")

    package, _ = Package.objects.update_or_create(
        code="couture",
        defaults={
            "price": Decimal("549000.00"),
            "currency": "IDR",
            "is_active": True,
            "is_featured": False,
            "sort_order": 2,
        },
    )

    for locale in ("id", "en"):
        PackageTranslation.objects.update_or_create(
            package=package,
            locale=locale,
            defaults={"name": "Couture", "summary": SUMMARY[locale]},
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
        ("catalog", "0004_add_bespoke_package"),
    ]

    operations = [
        migrations.RunPython(update_couture_copy, migrations.RunPython.noop),
    ]
