from importlib import import_module

import pytest
from django.apps import apps

from catalog.models import Package, Theme
from invitations.models import Invitation
from orders.models import Order
from tests.factories import create_package, create_theme, invitation_content


@pytest.mark.django_db
def test_removal_detaches_legacy_catalog_without_deleting_orders_or_invitations():
    fallback_theme = create_theme()
    standard_package = create_package(code="signature")
    legacy_theme = Theme.objects.create(
        slug="bespoke-studio",
        renderer_key="bespoke",
        renderer_version=1,
        content_schema_version=2,
        status=Theme.Status.DRAFT,
        category="legacy",
    )
    legacy_package = Package.objects.create(code="bespoke", price="849000")
    content = invitation_content()
    content["bespoke"] = {"engineVersion": 1}
    invitation = Invitation.objects.create(
        public_slug="legacy-removal-test",
        theme=legacy_theme,
        package=legacy_package,
        renderer_key="bespoke",
        renderer_version=1,
        content_schema_version=2,
        content=content,
    )
    order = Order.objects.create(
        reference="LEGACY-REMOVAL-TEST",
        client_name="Migration Test",
        package=legacy_package,
        theme=legacy_theme,
        invitation=invitation,
    )

    migration = import_module("catalog.migrations.0007_remove_bespoke_catalog")
    migration.remove_bespoke_catalog(apps, schema_editor=None)

    invitation.refresh_from_db()
    order.refresh_from_db()

    assert order.invitation_id == invitation.id
    assert order.package_id is None
    assert order.theme_id == fallback_theme.id
    assert invitation.package_id is None
    assert invitation.theme_id == fallback_theme.id
    assert invitation.renderer_key == fallback_theme.renderer_key
    assert invitation.renderer_version == fallback_theme.renderer_version
    assert invitation.content_schema_version == fallback_theme.content_schema_version
    assert "bespoke" not in invitation.content
    assert Package.objects.filter(pk=standard_package.pk).exists()
    assert not Package.objects.filter(pk=legacy_package.pk).exists()
    assert not Theme.objects.filter(pk=legacy_theme.pk).exists()
