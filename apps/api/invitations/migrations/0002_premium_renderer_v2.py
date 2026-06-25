from django.db import migrations, models


def upgrade_samples(apps, schema_editor):
    Invitation = apps.get_model("invitations", "Invitation")
    Package = apps.get_model("catalog", "Package")
    signature = Package.objects.filter(code="signature").first()
    updates = {"renderer_version": 2}
    if signature is not None:
        updates["package_id"] = signature.pk
    Invitation.objects.filter(is_sample=True).update(**updates)


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_premium_renderer_v2"),
        ("invitations", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invitation",
            name="renderer_version",
            field=models.PositiveSmallIntegerField(default=2),
        ),
        migrations.RunPython(upgrade_samples, migrations.RunPython.noop),
    ]
