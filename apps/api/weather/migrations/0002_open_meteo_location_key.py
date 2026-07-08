from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("weather", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="weatherfetchlog",
            name="location_key",
            field=models.CharField(blank=True, db_index=True, max_length=120),
        ),
        migrations.AddField(
            model_name="weatherfetchlog",
            name="provider",
            field=models.CharField(db_index=True, default="BMKG", max_length=40),
        ),
        migrations.AddField(
            model_name="weathersnapshot",
            name="location_key",
            field=models.CharField(blank=True, db_index=True, max_length=120),
        ),
        migrations.AddField(
            model_name="weathersnapshot",
            name="provider",
            field=models.CharField(db_index=True, default="BMKG", max_length=40),
        ),
        migrations.AddIndex(
            model_name="weatherfetchlog",
            index=models.Index(
                fields=["provider", "location_key", "status", "created_at"],
                name="weather_wea_provide_0c0bd7_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="weathersnapshot",
            index=models.Index(
                fields=["provider", "location_key", "expires_at"],
                name="weather_wea_provide_fbc947_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="weathersnapshot",
            constraint=models.UniqueConstraint(
                condition=Q(provider="Open-Meteo"),
                fields=("provider", "location_key", "analysis_at"),
                name="unique_weather_provider_location_analysis",
            ),
        ),
    ]
