from rest_framework import serializers

from leads.models import WhatsAppIntent


class StaffWhatsAppIntentSerializer(serializers.ModelSerializer[WhatsAppIntent]):
    class Meta:
        model = WhatsAppIntent
        fields = [
            "id",
            "theme_slug",
            "package_code",
            "locale",
            "campaign",
            "source",
            "created_at",
        ]
