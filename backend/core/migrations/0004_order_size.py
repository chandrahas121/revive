from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_user_fit_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='size',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
