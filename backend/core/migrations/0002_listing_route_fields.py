from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='chosen_path',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.AddField(
            model_name='listing',
            name='tier',
            field=models.IntegerField(default=1),
        ),
        migrations.AddField(
            model_name='listing',
            name='ev_data',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
