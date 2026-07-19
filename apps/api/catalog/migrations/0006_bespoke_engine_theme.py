from django.db import migrations


def add_bespoke_engine_theme(apps, schema_editor):
    Theme = apps.get_model("catalog", "Theme")
    ThemeTranslation = apps.get_model("catalog", "ThemeTranslation")
    Package = apps.get_model("catalog", "Package")
    PackageFeature = apps.get_model("catalog", "PackageFeature")

    theme, _ = Theme.objects.update_or_create(
        slug="bespoke-studio",
        defaults={
            "renderer_key": "bespoke",
            "renderer_version": 1,
            "content_schema_version": 2,
            "status": "draft",
            "category": "bespoke",
            "sort_order": 90,
            "is_featured": False,
        },
    )
    copy = {
        "id": (
            "Bespoke Studio",
            "Sistem visual khusus untuk setiap perayaan",
            (
                "Renderer Bespoke tunggal dengan struktur, token visual, dan variasi "
                "section yang dapat dikurasi."
            ),
        ),
        "en": (
            "Bespoke Studio",
            "A visual system tailored to each celebration",
            (
                "One Bespoke renderer with curated structure, visual tokens, and "
                "versioned section variants."
            ),
        ),
    }
    for locale, (name, tagline, description) in copy.items():
        ThemeTranslation.objects.update_or_create(
            theme=theme,
            locale=locale,
            defaults={
                "name": name,
                "tagline": tagline,
                "description": description,
                "feature_copy": [],
            },
        )

    package = Package.objects.filter(code="bespoke").first()
    if package:
        PackageFeature.objects.update_or_create(
            package=package,
            feature_key="starting-price",
            defaults={
                "is_included": True,
                "value": "849000",
                "labels": {"id": "Mulai Rp849K", "en": "Starting from IDR 849K"},
                "sort_order": 0,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("catalog", "0005_update_couture_package_copy")]

    operations = [migrations.RunPython(add_bespoke_engine_theme, migrations.RunPython.noop)]
