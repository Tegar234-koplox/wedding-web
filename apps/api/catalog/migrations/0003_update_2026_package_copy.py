from decimal import Decimal

from django.db import migrations

PACKAGES = {
    "essential": {
        "price": Decimal("99000.00"),
        "featured": False,
        "summary": {
            "id": "Untuk pasangan yang membutuhkan undangan digital rapi dan personal.",
            "en": "For couples who need a neat and personal digital invitation.",
        },
        "features": [
            ("theme", "1 tema pilihan", "1 selected theme"),
            ("event-info", "Informasi acara", "Event details"),
            ("gallery-8", "Galeri 8 foto", "8-photo gallery"),
            ("location-map", "Peta lokasi", "Location map"),
            ("gift", "Gift", "Gift"),
            ("backsound", "Musik latar belakang", "Background music"),
            ("revisions-3", "Revisi 3 kali", "3 revisions"),
        ],
    },
    "signature": {
        "price": Decimal("249000.00"),
        "featured": True,
        "summary": {
            "id": "Pengalaman lengkap dengan cerita, RSVP, dan sentuhan editorial.",
            "en": "A complete experience with story, RSVP, and editorial touches.",
        },
        "features": [
            ("essential", "Semua fitur Essential", "Everything in Essential"),
            ("story-timeline", "Love story & timeline", "Love story & timeline"),
            ("rsvp-wishes", "RSVP dan ucapan", "RSVP and wishes"),
            (
                "gallery-plus-3",
                "Galeri +3 foto dari paket Essential",
                "Gallery +3 photos from Essential",
            ),
            (
                "weather",
                "Prakiraan cuaca di lokasi acara",
                "Weather forecast at the event location",
            ),
            ("revisions-5", "Revisi 5 kali", "5 revisions"),
        ],
    },
    "couture": {
        "price": Decimal("549000.00"),
        "featured": False,
        "summary": {
            "id": "Art direction khusus untuk perayaan yang ingin tampil benar-benar berbeda.",
            "en": "Bespoke art direction for celebrations that want to feel truly distinct.",
        },
        "features": [
            ("signature", "Semua fitur Signature", "Everything in Signature"),
            ("art-direction", "Art direction khusus", "Bespoke art direction"),
            (
                "color-typography",
                "Penyesuaian warna dan tipografi",
                "Custom color and typography",
            ),
            ("motion-sequence", "Motion sequence khusus", "Custom motion sequence"),
            ("revisions-8", "Revisi 8 kali", "8 revisions"),
            (
                "gallery-plus-4",
                "Galeri +4 foto dari paket Signature",
                "Gallery +4 photos from Signature",
            ),
        ],
    },
}


def update_package_copy(apps, schema_editor):
    Package = apps.get_model("catalog", "Package")
    PackageTranslation = apps.get_model("catalog", "PackageTranslation")
    PackageFeature = apps.get_model("catalog", "PackageFeature")

    for sort_order, (code, payload) in enumerate(PACKAGES.items()):
        package, _ = Package.objects.update_or_create(
            code=code,
            defaults={
                "price": payload["price"],
                "currency": "IDR",
                "is_active": True,
                "is_featured": payload["featured"],
                "sort_order": sort_order,
            },
        )
        for locale in ("id", "en"):
            PackageTranslation.objects.update_or_create(
                package=package,
                locale=locale,
                defaults={"name": code.title(), "summary": payload["summary"][locale]},
            )

        feature_keys = []
        for feature_order, (feature_key, label_id, label_en) in enumerate(payload["features"]):
            feature_keys.append(feature_key)
            PackageFeature.objects.update_or_create(
                package=package,
                feature_key=feature_key,
                defaults={
                    "is_included": True,
                    "labels": {"id": label_id, "en": label_en},
                    "sort_order": feature_order,
                },
            )
        PackageFeature.objects.filter(package=package).exclude(
            feature_key__in=feature_keys
        ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_premium_renderer_v2"),
    ]

    operations = [
        migrations.RunPython(update_package_copy, migrations.RunPython.noop),
    ]
