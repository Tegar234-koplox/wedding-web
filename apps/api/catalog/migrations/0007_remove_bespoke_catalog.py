from django.db import migrations
from django.db.models import Q


def remove_bespoke_catalog(apps, schema_editor):
    Invitation = apps.get_model("invitations", "Invitation")
    Order = apps.get_model("orders", "Order")
    Package = apps.get_model("catalog", "Package")
    Theme = apps.get_model("catalog", "Theme")

    bespoke_theme = Theme.objects.filter(slug="bespoke-studio").first()
    bespoke_package = Package.objects.filter(code="bespoke").first()

    invitation_filter = Q(renderer_key="bespoke")
    order_filter = Q(pk__in=[])
    if bespoke_theme is not None:
        invitation_filter |= Q(theme_id=bespoke_theme.id)
        order_filter |= Q(theme_id=bespoke_theme.id)
    if bespoke_package is not None:
        invitation_filter |= Q(package_id=bespoke_package.id)
        order_filter |= Q(package_id=bespoke_package.id)

    invitation_ids = set(Invitation.objects.filter(invitation_filter).values_list("id", flat=True))
    if invitation_ids:
        order_filter |= Q(invitation_id__in=invitation_ids)

    affected_orders = Order.objects.filter(order_filter)
    invitation_ids.update(
        invitation_id
        for invitation_id in affected_orders.values_list("invitation_id", flat=True)
        if invitation_id is not None
    )

    affected_orders.delete()
    if invitation_ids:
        Invitation.objects.filter(id__in=invitation_ids).delete()

    if bespoke_theme is not None:
        bespoke_theme.delete()
    if bespoke_package is not None:
        bespoke_package.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0006_bespoke_engine_theme"),
        ("orders", "0007_remove_bespoke_workflow_models"),
    ]

    operations = [
        migrations.RunPython(remove_bespoke_catalog, migrations.RunPython.noop),
    ]
