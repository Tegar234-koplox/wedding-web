from django.db import migrations, models


def upgrade_theme_catalog(apps, schema_editor):
    Theme = apps.get_model("catalog", "Theme")
    Theme.objects.update(renderer_version=2)


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="theme",
            name="renderer_version",
            field=models.PositiveSmallIntegerField(default=2),
        ),
        migrations.AlterField(
            model_name="thememedia",
            name="role",
            field=models.CharField(
                choices=[
                    ("cover", "Cover"),
                    ("gallery", "Gallery"),
                    ("social", "Social"),
                    ("poster", "Poster"),
                    ("audio", "Audio"),
                ],
                max_length=16,
            ),
        ),
        migrations.RunPython(upgrade_theme_catalog, migrations.RunPython.noop),
    ]
