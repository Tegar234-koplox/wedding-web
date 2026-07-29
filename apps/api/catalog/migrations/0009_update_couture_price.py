from decimal import Decimal

from django.db import migrations


def update_couture_price(apps, schema_editor):
    Package = apps.get_model("catalog", "Package")
    Package.objects.filter(code="couture").update(price=Decimal("399000.00"))


def restore_couture_price(apps, schema_editor):
    Package = apps.get_model("catalog", "Package")
    Package.objects.filter(code="couture").update(price=Decimal("549000.00"))


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0008_remove_photo_revision_package_benefits"),
    ]

    operations = [
        migrations.RunPython(update_couture_price, restore_couture_price),
    ]
