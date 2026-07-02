"""
core/events.py
--------------
Domain events (custom Django signals) — REVIVE's Kafka-free event bus.

A view emits an event (e.g. `return_graded.send(...)`); independent receivers in
core/signals.py react by fanning out to Celery tasks. Unlike a post_save signal,
a custom signal fires ONLY when explicitly sent, so bulk seeding never triggers
the fan-out. One event → N independent consumers, none blocking the others.
"""
from django.dispatch import Signal

# Sent when a returned item has been graded and staged into a second-life listing.
# Providing kwargs: listing (Listing), order (Order), route_result (dict)
return_graded = Signal()
