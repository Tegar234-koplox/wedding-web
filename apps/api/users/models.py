import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        CLIENT = "client", "Client"
        STAFF = "staff", "Staff"

    class StaffRole(models.TextChoices):
        OWNER = "owner", "Owner"
        FINANCE = "finance", "Finance"
        EDITOR = "editor", "Editor"
        SUPPORT = "support", "Support"
        VIEWER = "viewer", "Viewer"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.CLIENT)
    staff_role = models.CharField(
        max_length=16,
        choices=StaffRole.choices,
        default=StaffRole.VIEWER,
    )
    staff_session_version = models.PositiveBigIntegerField(default=1, editable=False)

    REQUIRED_FIELDS = ["email"]

    @property
    def effective_staff_role(self) -> str:
        if self.is_superuser:
            return self.StaffRole.OWNER
        return self.staff_role


class StaffOrderAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="order_assignments",
        limit_choices_to={"is_staff": True, "role": User.Role.STAFF},
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="staff_assignments",
    )
    assigned_by = models.ForeignKey(
        User,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="order_assignments_created",
        limit_choices_to={"is_staff": True, "role": User.Role.STAFF},
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["staff", "order"],
                name="unique_staff_order_assignment",
            ),
        ]
        indexes = [
            models.Index(fields=["staff", "order"]),
            models.Index(fields=["order", "staff"]),
        ]

    def __str__(self) -> str:
        return f"{self.staff_id} assigned to {self.order_id}"


class StaffMFARecoveryCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="mfa_recovery_codes",
    )
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        state = "used" if self.used_at else "available"
        return f"MFA recovery code for {self.user_id} ({state})"
