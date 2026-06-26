from rest_framework import serializers

from analytics.models import AnalyticsEvent


class AnalyticsEventSerializer(serializers.ModelSerializer[AnalyticsEvent]):
    class Meta:
        model = AnalyticsEvent
        fields = [
            "event_type",
            "resource_type",
            "resource_reference",
            "locale",
            "campaign",
            "source",
            "metadata",
        ]


class AnalyticsMetricsSerializer(serializers.Serializer):
    event_type = serializers.CharField()
    count = serializers.IntegerField()
