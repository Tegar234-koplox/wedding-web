from django.db import migrations


def sync_linked_invitation_selection(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    Invitation = apps.get_model("invitations", "Invitation")
    Theme = apps.get_model("catalog", "Theme")

    for order in Order.objects.exclude(invitation_id__isnull=True).iterator():
        updates = {}
        if order.package_id:
            updates["package_id"] = order.package_id
        if order.client_user_id:
            updates["client_user_id"] = order.client_user_id
        if order.theme_id:
            theme = Theme.objects.filter(pk=order.theme_id).first()
            if theme is not None:
                updates.update(
                    {
                        "theme_id": order.theme_id,
                        "renderer_key": theme.renderer_key,
                        "renderer_version": theme.renderer_version,
                        "content_schema_version": theme.content_schema_version,
                    },
                )
        if updates:
            Invitation.objects.filter(pk=order.invitation_id).update(**updates)


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            sync_linked_invitation_selection,
            migrations.RunPython.noop,
        ),
    ]
