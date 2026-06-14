from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_listing_route_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='height_in',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='weight_lb',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='bust_in',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='body_type',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='user',
            name='age',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='fit_size_profile',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='product',
            name='fit_item_id',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
    ]
