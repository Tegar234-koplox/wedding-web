from django.db import migrations, models


def grant_staff_custom_domain_update(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE SCHEMA IF NOT EXISTS app;

            CREATE OR REPLACE FUNCTION app.current_user_role()
            RETURNS text
            LANGUAGE sql
            STABLE
            AS $$
                SELECT NULLIF(current_setting('request.user_role', true), '')
            $$;

            DROP POLICY IF EXISTS staff_update_invitation_custom_domain
            ON invitations_invitation;

            CREATE POLICY staff_update_invitation_custom_domain
            ON invitations_invitation
            FOR UPDATE
            USING (app.current_user_role() = 'staff')
            WITH CHECK (app.current_user_role() = 'staff');

            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'staff') THEN
                    GRANT UPDATE(custom_domain) ON invitations_invitation TO staff;
                END IF;
            END $$;
            """
        )


def revoke_staff_custom_domain_update(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            DROP POLICY IF EXISTS staff_update_invitation_custom_domain
            ON invitations_invitation;

            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'staff') THEN
                    REVOKE UPDATE(custom_domain) ON invitations_invitation FROM staff;
                END IF;
            END $$;
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0004_wedding_lifecycle_statuses"),
    ]

    operations = [
        migrations.AddField(
            model_name="invitation",
            name="custom_domain",
            field=models.CharField(blank=True, db_index=True, max_length=255),
        ),
        migrations.RunPython(grant_staff_custom_domain_update, revoke_staff_custom_domain_update),
    ]
