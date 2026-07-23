from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("invitations", "0009_remove_bespoke_review_models"),
        ("orders", "0006_bespoke_scope_agreements"),
    ]

    operations = [
        migrations.DeleteModel(name="BespokeChangeRequest"),
        migrations.DeleteModel(name="BespokeScopeAgreement"),
    ]
