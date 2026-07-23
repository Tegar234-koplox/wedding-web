from django.db import migrations


REMOVED_FEATURE_KEYS = {
    "essential": {"gallery-8", "revisions-3"},
    "signature": {"gallery-plus-3", "revisions-5"},
    "couture": {"gallery-plus-4", "revisions-8"},
}


def remove_photo_revision_benefits(apps, schema_editor):
    PackageFeature = apps.get_model("catalog", "PackageFeature")

    for package_code, feature_keys in REMOVED_FEATURE_KEYS.items():
        PackageFeature.objects.filter(
            package__code=package_code,
            feature_key__in=feature_keys,
        ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0007_remove_bespoke_catalog"),
    ]

    operations = [
        migrations.RunPython(
            remove_photo_revision_benefits,
            migrations.RunPython.noop,
        ),
    ]
