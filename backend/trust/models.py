import hashlib
import json
import uuid

from django.db import models

from core.models import Listing


class HealthCard(models.Model):
    """
    Tamper-evident product health record generated at grading time.
    card_hash = SHA-256 of all grade/inspection fields — any field change
    invalidates the hash, making tampering detectable.
    """

    class InspectionType(models.TextChoices):
        AI_ONLY  = 'ai_only',  'AI Only'
        AI_AGENT = 'ai_agent', 'AI + Doorstep Agent'
        AI_SPN   = 'ai_spn',  'AI + SPN Professional'

    listing = models.OneToOneField(
        Listing, on_delete=models.CASCADE, related_name='health_card'
    )
    card_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    tier    = models.IntegerField(default=1)

    # Grading fields
    grade             = models.CharField(max_length=1)
    confidence        = models.FloatField(default=0.0)
    defects           = models.JSONField(default=list)
    completeness      = models.FloatField(default=1.0)
    condition_summary = models.TextField(blank=True)
    functional        = models.BooleanField(default=True)
    box_present       = models.BooleanField(default=False)

    # Inspection metadata
    inspected_by  = models.CharField(
        max_length=20, choices=InspectionType.choices, default=InspectionType.AI_ONLY
    )
    model_version = models.CharField(max_length=50, blank=True, default='revive-grade-v1.0')

    # Tier 2/3 extended fields
    battery_pct = models.IntegerField(null=True, blank=True)
    imei        = models.CharField(max_length=20, blank=True)

    # Provenance
    previous_owners = models.IntegerField(default=0)

    # Guarantee terms
    guarantee_days   = models.IntegerField(default=7)
    guarantee_holder = models.CharField(max_length=50, default='seller_escrow')

    # Integrity — computed in save()
    card_hash = models.CharField(max_length=64, blank=True)
    qr_data   = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def _card_payload(self) -> dict:
        return {
            'card_id':           str(self.card_id),
            'listing_id':        self.listing_id,
            'grade':             self.grade,
            'confidence':        self.confidence,
            'defects':           self.defects,
            'completeness':      self.completeness,
            'condition_summary': self.condition_summary,
            'tier':              self.tier,
            'inspected_by':      self.inspected_by,
            'battery_pct':       self.battery_pct,
            'imei':              self.imei,
            'functional':        self.functional,
            'box_present':       self.box_present,
            'previous_owners':   self.previous_owners,
            'guarantee_days':    self.guarantee_days,
            'guarantee_holder':  self.guarantee_holder,
            'model_version':     self.model_version,
        }

    def compute_hash(self) -> str:
        return hashlib.sha256(
            json.dumps(self._card_payload(), sort_keys=True, default=str).encode()
        ).hexdigest()

    def save(self, *args, **kwargs):
        self.card_hash = self.compute_hash()
        if not self.qr_data:
            self.qr_data = f'https://revive.amazon.in/card/{self.card_id}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'HealthCard [{self.grade}] listing={self.listing_id} card={self.card_id}'


class LedgerEntry(models.Model):
    """
    Append-only audit ledger for a HealthCard.
    Each entry chains to the previous via prev_hash -> this_hash (SHA-256).
    UPDATE and DELETE are blocked at the model level to enforce immutability.
    """

    class Event(models.TextChoices):
        GRADED      = 'graded',      'Item Graded'
        LISTED      = 'listed',      'Item Listed'
        SOLD        = 'sold',        'Item Sold'
        DELIVERED   = 'delivered',   'Item Delivered'
        TRANSFERRED = 'transferred', 'Ownership Transferred'
        REFURB_IN   = 'refurb_in',   'Entered Refurb'
        REFURB_OUT  = 'refurb_out',  'Exited Refurb'
        DONATED     = 'donated',     'Donated'
        RECYCLED    = 'recycled',    'Recycled'

    card      = models.ForeignKey(HealthCard, on_delete=models.CASCADE, related_name='ledger')
    event     = models.CharField(max_length=20, choices=Event.choices)
    data      = models.JSONField(default=dict)
    prev_hash = models.CharField(max_length=64, blank=True)
    this_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def delete(self, *args, **kwargs):
        raise PermissionError('LedgerEntry is append-only — delete is blocked.')

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError('LedgerEntry is append-only — update is blocked.')
        super().save(*args, **kwargs)
        # Compute hash after initial save so pk is available
        h = hashlib.sha256(
            json.dumps({
                'pk':        self.pk,
                'card_id':   str(self.card.card_id),
                'event':     self.event,
                'data':      self.data,
                'prev_hash': self.prev_hash,
            }, sort_keys=True, default=str).encode()
        ).hexdigest()
        LedgerEntry.objects.filter(pk=self.pk).update(this_hash=h)
        self.this_hash = h

    def __str__(self):
        return f'LedgerEntry [{self.event}] card={self.card_id}'
