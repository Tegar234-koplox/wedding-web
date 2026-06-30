from django.db import migrations, models

STAFF_ROLES = {"owner", "admin", "editor", "support", "viewer", "staff"}


def convert_staff_roles(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(role__in=STAFF_ROLES).update(role="staff")


def restore_staff_roles(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(role="staff").update(role="admin")


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_user_role"),
    ]

    operations = [
        migrations.RunPython(convert_staff_roles, restore_staff_roles),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[("client", "Client"), ("staff", "Staff")],
                default="client",
                max_length=16,
            ),
        ),
    ]
