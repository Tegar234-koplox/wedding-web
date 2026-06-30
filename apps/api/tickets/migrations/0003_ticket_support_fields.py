from django.db import migrations, models


def grant_ticket_support_fields(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'staff') THEN
                    GRANT UPDATE(resolution_note) ON tickets_ticket TO staff;
                END IF;
            END $$;
            """
        )


def revoke_ticket_support_fields(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'staff') THEN
                    REVOKE UPDATE(resolution_note) ON tickets_ticket FROM staff;
                END IF;
            END $$;
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("tickets", "0002_access_foundation_sql"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticket",
            name="attachment_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="ticket",
            name="description",
            field=models.TextField(default=""),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="ticket",
            name="resolution_note",
            field=models.TextField(blank=True),
        ),
        migrations.RunPython(grant_ticket_support_fields, revoke_ticket_support_fields),
    ]
