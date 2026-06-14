from django.db import models
from django.conf import settings


class CreditTransaction(models.Model):
    """
    Green Credits ledger (Pillar 5, final_idea §5).

    Buyer-only. Credits are EARNED by keeping an order (vest at return-window
    close) when the buyer chose kirana self-drop, and SPENT on REVIVE second-life
    items (capped at 20% of price). Sellers/donors/recyclers never earn credits.
    """

    class Kind(models.TextChoices):
        EARN   = 'earn',   'Earned'
        SPEND  = 'spend',  'Spent'
        DONATE = 'donate', 'Donated'

    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pending'      # in return window, not yet vested
        VESTED    = 'vested',    'Vested'       # confirmed
        CANCELLED = 'cancelled', 'Cancelled'    # return initiated → credits cancelled

    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='credit_txns')
    kind       = models.CharField(max_length=10, choices=Kind.choices)
    status     = models.CharField(max_length=10, choices=Status.choices, default=Status.VESTED)
    amount     = models.IntegerField()                       # always positive; meaning set by `kind`
    reason     = models.CharField(max_length=255, blank=True, default='')
    category   = models.CharField(max_length=50, blank=True, default='')
    order      = models.ForeignKey('core.Order', null=True, blank=True, on_delete=models.SET_NULL, related_name='credit_txns')
    created_at = models.DateTimeField(auto_now_add=True)
    vests_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        sign = '+' if self.kind == self.Kind.EARN else '-'
        return f"{self.user_id} {sign}{self.amount} ({self.kind}/{self.status})"
