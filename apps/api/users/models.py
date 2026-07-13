import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        CLIENT = "client", "Client"
        STAFF = "staff", "Staff"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.CLIENT)

    REQUIRED_FIELDS = ["email"]


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
