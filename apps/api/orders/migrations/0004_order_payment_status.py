from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0003_order_payment_verification_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("unpaid", "Belum Bayar"),
                    ("dp", "DP"),
                    ("paid", "Lunas"),
                ],
                db_index=True,
                default="unpaid",
                max_length=16,
            ),
        ),
    ]
