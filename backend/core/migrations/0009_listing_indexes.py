from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add composite indexes on the Listing table for the most common storefront
    query patterns: filter by status+source, geohash+status, and product+status.
    These make storefront browsing fast even with 100k+ listings.
    """

    dependencies = [
        ('core', '0008_review'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='listing',
            index=models.Index(fields=['status', 'source'], name='listing_status_source_idx'),
        ),
        migrations.AddIndex(
            model_name='listing',
            index=models.Index(fields=['geohash5', 'status'], name='listing_geohash_status_idx'),
        ),
        migrations.AddIndex(
            model_name='listing',
            index=models.Index(fields=['product', 'status'], name='listing_product_status_idx'),
        ),
        migrations.AddIndex(
            model_name='listing',
            index=models.Index(fields=['-created_at'], name='listing_created_desc_idx'),
        ),
    ]
