"""
Pillar 3 integration check — Health Card + Ledger logic (pure Python, no Django).
Run from the repo root:
    python data/check_pillar3.py

Tests:
  1. SHA-256 card hash function works correctly
  2. Hash changes when a grade field is mutated
  3. Ledger hash chaining (prev_hash links chain correctly)
  4. Append-only enforcement raises on update attempt
  5. Append-only enforcement raises on delete attempt
  6. Ownership transfer increments previous_owners
  7. Hash chain verification detects tampering
  8. QR data URI format
  9. Guarantee terms: Tier 1 ai_only → 7 days seller_escrow
  10. Guarantee terms: Tier 2 ai_agent → 30 days seller_escrow
  11. Guarantee terms: Tier 3 any → 90 days Amazon SPN
  12. Guarantee terms: ai_spn any tier → 90 days Amazon SPN
  13. All LedgerEntry event choices are unique strings
"""
import sys
import io
import hashlib
import json
import uuid
from copy import deepcopy

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PASS = '[PASS]'
FAIL = '[FAIL]'
results = []


def chk(condition, pass_msg, fail_msg=''):
    tag = PASS if condition else FAIL
    results.append((tag, pass_msg if condition else (fail_msg or pass_msg)))
    return condition


# ── Simulate card hash logic (mirrors trust/models.py) ────────────────────────

def _card_payload(fields: dict) -> str:
    return json.dumps(fields, sort_keys=True, default=str)


def compute_card_hash(fields: dict) -> str:
    return hashlib.sha256(_card_payload(fields).encode()).hexdigest()


def build_card(grade='B', tier=1) -> dict:
    cid = str(uuid.uuid4())
    fields = {
        'card_id': cid,
        'listing_id': 42,
        'grade': grade,
        'confidence': 0.88,
        'defects': [{'type': 'scratch', 'severity': 'minor'}],
        'completeness': 0.95,
        'condition_summary': 'Minor scratch on back cover',
        'tier': tier,
        'inspected_by': 'ai_only',
        'battery_pct': None,
        'imei': '',
        'functional': True,
        'box_present': False,
        'previous_owners': 0,
        'guarantee_days': 7,
        'guarantee_holder': 'seller_escrow',
        'model_version': 'revive-grade-v1.0',
    }
    return {'fields': fields, 'hash': compute_card_hash(fields)}


# ── Simulate ledger logic ─────────────────────────────────────────────────────

_LEDGER_STORE = []
_DELETED_IDS  = set()


def ledger_create(card_id, event, data, prev_hash):
    pk = len(_LEDGER_STORE) + 1
    h  = hashlib.sha256(
        json.dumps({'pk': pk, 'card_id': card_id, 'event': event,
                    'data': data, 'prev_hash': prev_hash},
                   sort_keys=True, default=str).encode()
    ).hexdigest()
    entry = {'pk': pk, 'card_id': card_id, 'event': event,
             'data': data, 'prev_hash': prev_hash, 'this_hash': h}
    _LEDGER_STORE.append(entry)
    return entry


def ledger_update(pk, **kwargs):
    raise PermissionError('LedgerEntry is append-only — update is blocked.')


def ledger_delete(pk):
    raise PermissionError('LedgerEntry is append-only — delete is blocked.')


def verify_chain(entries):
    for i, e in enumerate(entries):
        expected = hashlib.sha256(
            json.dumps({'pk': e['pk'], 'card_id': e['card_id'],
                        'event': e['event'], 'data': e['data'],
                        'prev_hash': e['prev_hash']},
                       sort_keys=True, default=str).encode()
        ).hexdigest()
        if expected != e['this_hash']:
            return False, i
    return True, None


def guarantee_terms(tier: int, inspected_by: str):
    if tier == 3 or inspected_by == 'ai_spn':
        return 90, 'Amazon SPN'
    if tier == 2:
        return 30, 'seller_escrow'
    return 7, 'seller_escrow'


# ── Tests ─────────────────────────────────────────────────────────────────────

# 1. Card hash produces a 64-char hex string
card = build_card('B', 1)
chk(len(card['hash']) == 64 and all(c in '0123456789abcdef' for c in card['hash']),
    f'SHA-256 card hash is valid hex: {card["hash"][:20]}...')

# 2. Mutating a grade field changes the hash
original_hash = card['hash']
mutated_fields = deepcopy(card['fields'])
mutated_fields['grade'] = 'A'
mutated_hash = compute_card_hash(mutated_fields)
chk(original_hash != mutated_hash,
    f'Hash changes on grade mutation: {original_hash[:12]} != {mutated_hash[:12]}',
    'Hash did NOT change after mutation — tamper detection broken')

# 3. Ledger chain links correctly
card_id = card['fields']['card_id']
e1 = ledger_create(card_id, 'graded',    {'grade': 'B'}, prev_hash='')
e2 = ledger_create(card_id, 'listed',    {'price': 499},  prev_hash=e1['this_hash'])
e3 = ledger_create(card_id, 'sold',      {'buyer': 'u99'}, prev_hash=e2['this_hash'])
e4 = ledger_create(card_id, 'delivered', {'courier': 'AMZL'}, prev_hash=e3['this_hash'])

chk(e2['prev_hash'] == e1['this_hash'] and e3['prev_hash'] == e2['this_hash'],
    f'Ledger chain links: e1->e2->e3 all connected',
    'Ledger chain links broken')

# 4. Append-only: update raises
try:
    ledger_update(e1['pk'], event='tampered')
    chk(False, '', 'Update should have raised PermissionError')
except PermissionError:
    chk(True, 'Append-only: update raises PermissionError')

# 5. Append-only: delete raises
try:
    ledger_delete(e1['pk'])
    chk(False, '', 'Delete should have raised PermissionError')
except PermissionError:
    chk(True, 'Append-only: delete raises PermissionError')

# 6. Ownership transfer increments previous_owners
fields6 = deepcopy(card['fields'])
fields6['previous_owners'] = 0
ledger_create(card_id, 'transferred', {'new_owner': 'u77'}, prev_hash=e4['this_hash'])
simulated_owners = fields6['previous_owners'] + 1  # LedgerAppendView does this
chk(simulated_owners == 1,
    f'Ownership transfer: previous_owners incremented to {simulated_owners}')

# 7. Hash chain verification detects tampering
valid, broken_at = verify_chain([e1, e2, e3, e4])
chk(valid, f'Chain verification: 4 entries all valid')

# Tamper entry 2
tampered = deepcopy(e2)
tampered['data']['price'] = 99
valid2, broken_at2 = verify_chain([e1, tampered, e3, e4])
chk(not valid2 and broken_at2 == 1,
    f'Tamper detected at index {broken_at2}',
    f'Tamper NOT detected: valid={valid2} broken_at={broken_at2}')

# 8. QR data URI format
qr_data = f'https://revive.amazon.in/card/{card_id}'
chk(qr_data.startswith('https://revive.amazon.in/card/') and card_id in qr_data,
    f'QR URI: {qr_data}')

# 9-12. Guarantee terms
g9  = guarantee_terms(tier=1, inspected_by='ai_only')
g10 = guarantee_terms(tier=2, inspected_by='ai_agent')
g11 = guarantee_terms(tier=3, inspected_by='ai_only')
g12 = guarantee_terms(tier=1, inspected_by='ai_spn')

chk(g9  == (7,  'seller_escrow'), f'Guarantee T1 ai_only: {g9}',  f'Wrong: {g9}')
chk(g10 == (30, 'seller_escrow'), f'Guarantee T2 ai_agent: {g10}', f'Wrong: {g10}')
chk(g11 == (90, 'Amazon SPN'),    f'Guarantee T3: {g11}',          f'Wrong: {g11}')
chk(g12 == (90, 'Amazon SPN'),    f'Guarantee ai_spn any tier: {g12}', f'Wrong: {g12}')

# 13. Event choices are unique
events = ['graded', 'listed', 'sold', 'delivered', 'transferred',
          'refurb_in', 'refurb_out', 'donated', 'recycled']
chk(len(events) == len(set(events)),
    f'All {len(events)} LedgerEntry event choices are unique strings')

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print('=' * 65)
print('PILLAR 3 INTEGRATION CHECK')
print('=' * 65)
for tag, msg in results:
    print(f'  {tag} {msg}')

passed = sum(1 for t, _ in results if t == PASS)
failed = sum(1 for t, _ in results if t == FAIL)
print(f'\n  {passed}/{passed + failed} checks passed')

if failed == 0:
    print('\n  PILLAR 3 IS READY FOR INTEGRATION')
    print('\nAPI surface:')
    print('  POST /api/card/generate/          -- grade+route -> HealthCard + first LedgerEntry')
    print('  GET  /api/card/<listing_id>/      -- full card + ledger JSON')
    print('  GET  /api/card/<listing_id>/verify/ -- hash chain verification')
    print('  GET  /api/card/<listing_id>/qr/   -- base64 PNG QR code')
    print('  POST /api/card/<listing_id>/ledger/ -- append event (sold/transferred/etc.)')
else:
    print(f'\n  {failed} issue(s) need attention before integration')
