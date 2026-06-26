from rest_framework import serializers

from users.models import User


class StaffUserSerializer(serializers.ModelSerializer[User]):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "first_name", "last_name"]
