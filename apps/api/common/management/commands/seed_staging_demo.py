from __future__ import annotations

import os
from copy import deepcopy
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice

from catalog.models import Package, Theme
from common.models import AuditEvent
from invitations.models import EventLocation, Guest, Invitation, WeddingEvent
from orders.models import Order


class Command(BaseCommand):
    help = "Create idempotent synthetic staging data using the existing schema."

    def handle(self, *args, **options) -> None:
        del args, options
        if settings.DEPLOYMENT_ENVIRONMENT != "staging":
            raise CommandError("seed_staging_demo may only run in staging")

        password = os.environ.get("STAGING_DEMO_STAFF_PASSWORD", "")
        mfa_key = os.environ.get("STAGING_DEMO_MFA_KEY", "").strip().lower()
        guest_token = os.environ.get("STAGING_DEMO_GUEST_TOKEN", "").strip()
        if not password or not mfa_key or not guest_token:
            raise CommandError(
                "STAGING_DEMO_STAFF_PASSWORD, STAGING_DEMO_MFA_KEY, and "
                "STAGING_DEMO_GUEST_TOKEN are required"
            )
        try:
            key_bytes = bytes.fromhex(mfa_key)
        except ValueError as exc:
            raise CommandError("STAGING_DEMO_MFA_KEY must be hexadecimal") from exc
        if len(key_bytes) != 20:
            raise CommandError("STAGING_DEMO_MFA_KEY must encode exactly 20 bytes")

        self._seed(password, mfa_key, guest_token)

    @transaction.atomic
    def _seed(self, password: str, mfa_key: str, guest_token: str) -> None:
        call_command("seed_demo_content", verbosity=0)

        user_model = get_user_model()
        staff, _ = user_model.objects.update_or_create(
            username="staging-operator",
            defaults={
                "email": "staging-operator@niskala.invalid",
                "first_name": "Staging",
                "last_name": "Operator",
                "role": user_model.Role.STAFF,
                "is_staff": True,
                "is_superuser": False,
                "is_active": True,
            },
        )
        staff.set_password(password)
        staff.save(update_fields=["password"])
        TOTPDevice.objects.update_or_create(
            user=staff,
            name="Niskala Staging",
            defaults={"key": mfa_key, "confirmed": True},
        )

        theme = Theme.objects.get(slug="elegant-classic")
        package = Package.objects.get(code="signature")
        sample = Invitation.objects.get(public_slug="sample-elegant-classic")
        content = deepcopy(sample.content)
        content["couple"] = {
            "partnerOne": "Nara",
            "partnerTwo": "Sena",
            "monogram": "N&S",
        }
        content["opening"] = {
            "eyebrow": "Staging synthetic invitation",
            "title": "Nara & Sena",
            "message": "Data sintetis khusus pengujian staging Niskala.",
        }

        invitation, _ = Invitation.objects.update_or_create(
            public_slug="staging-isolation-demo",
            defaults={
                "theme": theme,
                "package": package,
                "renderer_key": theme.renderer_key,
                "renderer_version": theme.renderer_version,
                "content_schema_version": theme.content_schema_version,
                "default_locale": "id",
                "status": Invitation.Status.PUBLISHED,
                "approval_status": Invitation.ApprovalStatus.PUBLISHED,
                "is_sample": False,
                "published_at": timezone.now(),
                "content": content,
                "archived_at": None,
            },
        )

        event_start = timezone.now().astimezone(ZoneInfo("Asia/Jakarta")) + timedelta(days=7)
        ceremony, _ = WeddingEvent.objects.update_or_create(
            invitation=invitation,
            event_type=WeddingEvent.EventType.CEREMONY,
            defaults={
                "starts_at": event_start,
                "ends_at": event_start + timedelta(hours=1),
                "timezone": "Asia/Jakarta",
                "venue_name": "Staging Venue",
                "address": "Synthetic Test Address, Jakarta",
                "map_url": "https://maps.google.com",
                "sort_order": 0,
            },
        )
        EventLocation.objects.update_or_create(
            event=ceremony,
            defaults={
                "province": "DKI Jakarta",
                "regency": "Jakarta Pusat",
                "district": "Staging District",
                "village": "Staging Village",
                "latitude": "-6.175392",
                "longitude": "106.827153",
            },
        )

        order, _ = Order.objects.update_or_create(
            reference="STG-ISOLATION-CHECK",
            defaults={
                "status": Order.Status.PUBLISHED,
                "payment_status": Order.PaymentStatus.PAID,
                "package": package,
                "theme": theme,
                "invitation": invitation,
                "assigned_staff": staff,
                "client_name": "Synthetic Staging Client",
                "client_email": "synthetic-client@niskala.invalid",
                "client_phone": "+620000000000",
                "event_date": event_start.date(),
                "total_amount": package.price,
                "notes": "Synthetic marker. Never copy this row to production.",
                "archived_at": None,
            },
        )
        Guest.objects.update_or_create(
            access_token_hash=guest_token,
            defaults={
                "invitation": invitation,
                "display_name": "Synthetic Staging Guest",
                "email": "synthetic-guest@niskala.invalid",
                "phone": "+620000000001",
                "party_size": 2,
                "rsvp_status": Guest.RSVPStatus.PENDING,
                "attendance_count": 0,
                "metadata": {
                    "delivery_token": guest_token,
                    "source": "seed_staging_demo",
                    "synthetic": True,
                },
                "archived_at": None,
            },
        )
        AuditEvent.objects.update_or_create(
            action="staging.synthetic_seeded",
            resource_type="order",
            resource_reference=order.reference,
            defaults={"actor": staff, "metadata": {"synthetic": True}},
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Synthetic staging demo ready: STG-ISOLATION-CHECK / "
                "staging-isolation-demo / staging-operator"
            )
        )
