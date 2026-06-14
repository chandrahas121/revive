from django.db import migrations, models


class Migration(migrations.Migration):
    """v2: location capture, risk tier, disposition gate, grades E/F, delist statuses."""

    dependencies = [
        ('core', '0002_listing_route_fields'),
    ]

    operations = [
        # User live location (feeds local demand / "Near me")
        migrations.AddField(
            model_name='user',
            name='lat',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='lng',
            field=models.FloatField(blank=True, null=True),
        ),
        # Listing v2 fields
        migrations.AddField(
            model_name='listing',
            name='risk_tier',
            field=models.CharField(blank=True, default='', max_length=10),
        ),
        migrations.AddField(
            model_name='listing',
            name='disposition',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='listing',
            name='condition_label',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        # Extend grade + status choices (choices are not enforced at DB level,
        # so only the field definition's choices metadata changes).
        migrations.AlterField(
            model_name='listing',
            name='grade',
            field=models.CharField(
                choices=[
                    ('A', 'Grade A – Like New'),
                    ('B', 'Grade B – Very Good'),
                    ('C', 'Grade C – Good'),
                    ('D', 'Grade D – Heavy cosmetic damage (functional)'),
                    ('E', 'Grade E – Functional defect / for parts'),
                    ('F', 'Grade F – Not resellable (recycle)'),
                ],
                default='A', max_length=1,
            ),
        ),
        migrations.AlterField(
            model_name='listing',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending Grading'),
                    ('listed', 'Listed'),
                    ('paused', 'Paused'),
                    ('delisted', 'Delisted'),
                    ('sold', 'Sold'),
                    ('donated', 'Donated'),
                    ('recycled', 'Recycled'),
                    ('warehouse_bound', 'Warehouse Bound'),
                ],
                default='listed', max_length=20,
            ),
        ),
    ]
