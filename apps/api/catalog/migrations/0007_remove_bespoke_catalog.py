from django.db import migrations
from django.db.models import Q


def remove_bespoke_catalog(apps, schema_editor):
    Invitation = apps.get_model("invitations", "Invitation")
    Order = apps.get_model("orders", "Order")
    Package = apps.get_model("catalog", "Package")
    Theme = apps.get_model("catalog", "Theme")

    bespoke_theme = Theme.objects.filter(slug="bespoke-studio").first()
    bespoke_package = Package.objects.filter(code="bespoke").first()

    rendering_filter = Q(renderer_key="bespoke")
    if bespoke_theme is not None:
        rendering_filter |= Q(theme_id=bespoke_theme.id)

    rendering_invitation_ids = set(
        Invitation.objects.filter(rendering_filter).values_list("id", flat=True)
    )
    fallback_theme = (
        Theme.objects.filter(slug="elegant-classic").first()
        or Theme.objects.exclude(renderer_key="bespoke").order_by("sort_order", "slug").first()
    )
    if rendering_invitation_ids and fallback_theme is None:
        raise RuntimeError("Cannot remove the legacy renderer without a standard fallback theme.")

    invitation_filter = Q(id__in=rendering_invitation_ids)
    if bespoke_package is not None:
        invitation_filter |= Q(package_id=bespoke_package.id)

    for invitation in Invitation.objects.filter(invitation_filter).iterator():
        update_fields = []
        if invitation.id in rendering_invitation_ids:
            invitation.theme_id = fallback_theme.id
            invitation.renderer_key = fallback_theme.renderer_key
            invitation.renderer_version = fallback_theme.renderer_version
            invitation.content_schema_version = fallback_theme.content_schema_version
            update_fields.extend(
                [
                    "theme",
                    "renderer_key",
                    "renderer_version",
                    "content_schema_version",
                ]
            )

        if bespoke_package is not None and invitation.package_id == bespoke_package.id:
            invitation.package_id = None
            update_fields.append("package")

        content = dict(invitation.content or {})
        if "bespoke" in content:
            content.pop("bespoke")
            invitation.content = content
            update_fields.append("content")

        if update_fields:
            invitation.save(update_fields=update_fields)

    if bespoke_package is not None:
        Order.objects.filter(package_id=bespoke_package.id).update(package_id=None)
    if bespoke_theme is not None:
        replacement_theme_id = fallback_theme.id if fallback_theme is not None else None
        Order.objects.filter(theme_id=bespoke_theme.id).update(theme_id=replacement_theme_id)

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
