import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        EDITOR = "editor", "Editor"
        SUPPORT = "support", "Support"
        VIEWER = "viewer", "Viewer"
        CLIENT = "client", "Client"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.CLIENT)

    REQUIRED_FIELDS = ["email"]
