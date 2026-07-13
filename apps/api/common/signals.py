import hashlib

from axes.signals import user_locked_out
from django.contrib.auth import get_user_model
from django.dispatch import receiver

from common.models import AuditEvent


@receiver(user_locked_out)
def audit_staff_lockout(sender, request, username, ip_address, **kwargs) -> None:
    del sender, ip_address, kwargs
    identifier = str(username or "").strip().lower()
    digest = hashlib.sha256(identifier.encode("utf-8")).hexdigest()
    actor = get_user_model().objects.filter(username__iexact=identifier).first()
    AuditEvent.objects.create(
        actor=actor,
        action="staff.login_locked",
        resource_type="staff_auth",
        resource_reference=f"staff-auth:{digest[:24]}",
        metadata={"request_id": getattr(request, "request_id", "")},
    )
