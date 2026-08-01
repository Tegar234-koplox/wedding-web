from __future__ import annotations

from django.db.models import F
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from users.models import StaffOrderAssignment, User

USER_SECURITY_FIELDS = {
    "password",
    "role",
    "staff_role",
    "is_active",
    "is_staff",
    "is_superuser",
}


@receiver(pre_save, sender=User)
def detect_staff_security_change(sender, instance: User, **kwargs) -> None:
    del sender, kwargs
    instance._staff_security_changed = False
    if instance._state.adding or not instance.pk:
        return

    previous = (
        User.objects.filter(pk=instance.pk)
        .values(*USER_SECURITY_FIELDS, "staff_session_version")
        .first()
    )
    if previous is None:
        return

    if any(getattr(instance, field) != previous[field] for field in USER_SECURITY_FIELDS):
        instance._staff_security_changed = True
        instance._staff_previous_session_version = previous["staff_session_version"]


@receiver(post_save, sender=User)
def revoke_sessions_after_staff_security_change(
    sender,
    instance: User,
    created: bool,
    **kwargs,
) -> None:
    del sender, kwargs
    if created or not getattr(instance, "_staff_security_changed", False):
        return

    previous_version = instance._staff_previous_session_version
    User.objects.filter(
        pk=instance.pk,
        staff_session_version=previous_version,
    ).update(staff_session_version=F("staff_session_version") + 1)
    instance.refresh_from_db(fields=["staff_session_version"])


@receiver(pre_save, sender=StaffOrderAssignment)
def remember_previous_assignment_staff(
    sender,
    instance: StaffOrderAssignment,
    **kwargs,
) -> None:
    del sender, kwargs
    instance._previous_staff_id = None
    if instance._state.adding or not instance.pk:
        return
    instance._previous_staff_id = (
        StaffOrderAssignment.objects.filter(pk=instance.pk)
        .values_list("staff_id", flat=True)
        .first()
    )


@receiver(post_save, sender=StaffOrderAssignment)
def revoke_sessions_after_assignment_change(
    sender,
    instance: StaffOrderAssignment,
    **kwargs,
) -> None:
    del sender, kwargs
    affected_staff_ids = {instance.staff_id, getattr(instance, "_previous_staff_id", None)}
    User.objects.filter(pk__in=[item for item in affected_staff_ids if item]).update(
        staff_session_version=F("staff_session_version") + 1,
    )


@receiver(post_delete, sender=StaffOrderAssignment)
def revoke_sessions_after_assignment_delete(
    sender,
    instance: StaffOrderAssignment,
    **kwargs,
) -> None:
    del sender, kwargs
    User.objects.filter(pk=instance.staff_id).update(
        staff_session_version=F("staff_session_version") + 1,
    )


@receiver(pre_save, sender="orders.Order")
def remember_previous_legacy_assignee(sender, instance, **kwargs) -> None:
    del kwargs
    instance._previous_assigned_staff_id = None
    if instance._state.adding or not instance.pk:
        return
    instance._previous_assigned_staff_id = (
        sender.objects.filter(pk=instance.pk).values_list("assigned_staff_id", flat=True).first()
    )


@receiver(post_save, sender="orders.Order")
def revoke_sessions_after_legacy_assignment_change(
    sender,
    instance,
    created: bool,
    **kwargs,
) -> None:
    del sender, kwargs
    previous_staff_id = getattr(instance, "_previous_assigned_staff_id", None)
    if not created and previous_staff_id == instance.assigned_staff_id:
        return
    affected_staff_ids = {previous_staff_id, instance.assigned_staff_id}
    User.objects.filter(pk__in=[item for item in affected_staff_ids if item]).update(
        staff_session_version=F("staff_session_version") + 1,
    )
