from django.db import migrations, models


class Migration(migrations.Migration):
    """v2: real catalog rating signals on Product (Amazon Reviews 2023 import)."""

    dependencies = [
        ('core', '0003_v2_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='rating',
            field=models.FloatField(default=0.0),
        ),
        migrations.AddField(
            model_name='product',
            name='rating_count',
            field=models.IntegerField(default=0),
        ),
    ]
