import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0002_listing_route_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='HealthCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('card_id', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('tier', models.IntegerField(default=1)),
                ('grade', models.CharField(max_length=1)),
                ('confidence', models.FloatField(default=0.0)),
                ('defects', models.JSONField(default=list)),
                ('completeness', models.FloatField(default=1.0)),
                ('condition_summary', models.TextField(blank=True)),
                ('functional', models.BooleanField(default=True)),
                ('box_present', models.BooleanField(default=False)),
                ('inspected_by', models.CharField(
                    choices=[
                        ('ai_only', 'AI Only'),
                        ('ai_agent', 'AI + Doorstep Agent'),
                        ('ai_spn', 'AI + SPN Professional'),
                    ],
                    default='ai_only',
                    max_length=20,
                )),
                ('model_version', models.CharField(blank=True, default='revive-grade-v1.0', max_length=50)),
                ('battery_pct', models.IntegerField(blank=True, null=True)),
                ('imei', models.CharField(blank=True, max_length=20)),
                ('previous_owners', models.IntegerField(default=0)),
                ('guarantee_days', models.IntegerField(default=7)),
                ('guarantee_holder', models.CharField(default='seller_escrow', max_length=50)),
                ('card_hash', models.CharField(blank=True, max_length=64)),
                ('qr_data', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('listing', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='health_card',
                    to='core.listing',
                )),
            ],
        ),
        migrations.CreateModel(
            name='LedgerEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event', models.CharField(
                    choices=[
                        ('graded', 'Item Graded'),
                        ('listed', 'Item Listed'),
                        ('sold', 'Item Sold'),
                        ('delivered', 'Item Delivered'),
                        ('transferred', 'Ownership Transferred'),
                        ('refurb_in', 'Entered Refurb'),
                        ('refurb_out', 'Exited Refurb'),
                        ('donated', 'Donated'),
                        ('recycled', 'Recycled'),
                    ],
                    max_length=20,
                )),
                ('data', models.JSONField(default=dict)),
                ('prev_hash', models.CharField(blank=True, max_length=64)),
                ('this_hash', models.CharField(blank=True, max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('card', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ledger',
                    to='trust.healthcard',
                )),
            ],
            options={'ordering': ['created_at']},
        ),
    ]
