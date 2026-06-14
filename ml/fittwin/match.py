"""
ml/fittwin/match.py
-------------------
Online step: given an item (or its category) and optionally the size the shopper
is considering, summarise how the item REALLY fit other shoppers — WITHOUT asking
for body measurements.

Key properties (so the card never just parrots the selected size):

  * recommended_size is DATA-DRIVEN and STABLE — it is the size real shoppers
    found fit best for this item, independent of what the shopper clicks.
  * good_fit_pct is specific to the SELECTED size when one is given ("of shoppers
    who bought size 8, X% found it a true fit"), else it's the item's overall
    true-fit rate.
  * direction (runs small / large / true) comes from real fit verdicts.
  * twins are a spread across sizes (one chip per size with its typical verdict),
    so the list is informative rather than ten identical chips.

No training, no synthetic labels: the fit verdict is a real human judgement.

Public:
    find_fit_twins(*, item_id=None, category=None, user_size=None, k=25) -> dict
"""
from __future__ import annotations
import logging
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

ARTIFACT_PATH = Path(__file__).resolve().parents[1] / "artifacts" / "fittwin_index.pkl"
MIN_COHORT = 8          # below this, widen item -> category -> all
MIN_SIZE_SUPPORT = 3    # a size needs this many reviews to report a per-size rate

# Behavioral fit-twins (measurement-free): a shopper is "like you" when the sizes
# they buy and keep across categories line up with yours. No body data required.
MIN_OVERLAP = 2         # shared categories needed to call someone a behavioral twin
MAX_TWIN_USERS = 80     # keep the N closest twins who reviewed this item/category

_index = None
_loaded = False

_user_profiles = None   # {user_id: {category: median kept size}} — built once, lazily
_cat_scale = None       # {category: size spread} so a "1 size off" means the same
                        # everywhere when measuring profile distance


def _load():
    global _index, _loaded
    if _loaded:
        return _index
    if ARTIFACT_PATH.exists():
        try:
            with open(ARTIFACT_PATH, "rb") as fh:
                _index = pickle.load(fh)
            logger.info("[fittwin] index loaded: %d rows", len(_index["records"]))
        except Exception as e:                       # pragma: no cover
            logger.warning("[fittwin] could not load index: %s", e)
            _index = None
    else:
        logger.info("[fittwin] no index artifact at %s", ARTIFACT_PATH)
    _loaded = True
    return _index


def _ensure_profiles(df):
    """Build, once per process, every dataset shopper's size profile across
    categories (median kept size per category) plus each category's size spread.
    This is the behavioral fingerprint we match against — no measurements."""
    global _user_profiles, _cat_scale
    if _user_profiles is not None:
        return
    profiles: Dict[str, Dict[str, float]] = {}
    med = df.groupby(["user_id", "category"])["size"].median()
    for (uid, cat), sz in med.items():
        if not uid:
            continue
        profiles.setdefault(uid, {})[cat] = float(sz)
    _user_profiles = profiles
    stds = df.groupby("category")["size"].std()
    _cat_scale = {c: (float(s) if s and s > 1e-6 else 1.0) for c, s in stds.items()}


def _behavioral_twins(cohort, shopper_profile):
    """From the people who reviewed this item/category, return the rows belonging
    to the shoppers whose cross-category size profile is closest to the shopper's.
    Returns None when there is no profile or too few genuine twins (caller then
    falls back to size-based / aggregate)."""
    if not shopper_profile or _user_profiles is None:
        return None
    scored = []
    for uid in cohort["user_id"].unique():
        prof = _user_profiles.get(uid)
        if not prof:
            continue
        shared = [c for c in shopper_profile if c in prof]
        if len(shared) < MIN_OVERLAP:
            continue
        d = sum(((prof[c] - float(shopper_profile[c])) / _cat_scale.get(c, 1.0)) ** 2
                for c in shared)
        scored.append(((d / len(shared)) ** 0.5, uid))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0])
    keep = {uid for _, uid in scored[:MAX_TWIN_USERS]}
    twins = cohort[cohort["user_id"].isin(keep)]
    return twins if len(twins) >= MIN_COHORT else None


def _select_cohort(df, item_id, category):
    if item_id:
        c = df[df["item_id"] == str(item_id)]
        if len(c) >= MIN_COHORT:
            return c, "item"
    if category:
        c = df[df["category"] == str(category).strip().lower()]
        if len(c) >= MIN_COHORT:
            return c, "category"
    return df, "global"


def _direction(cohort) -> str:
    n = len(cohort)
    if n == 0:
        return "true_to_size"
    n_small = int((cohort["fit"] == "small").sum())
    n_large = int((cohort["fit"] == "large").sum())
    thresh = max(2, int(0.15 * n))
    if n_small - n_large >= thresh:
        return "runs_small"
    if n_large - n_small >= thresh:
        return "runs_large"
    return "true_to_size"


def _size_stats(cohort):
    """{size: (fit_rate, n)} for sizes with enough support."""
    stats = {}
    for sz, grp in cohort.groupby("size"):
        if len(grp) >= MIN_SIZE_SUPPORT:
            stats[float(sz)] = (float((grp["fit"] == "fit").mean()), int(len(grp)))
    return stats


def _best_size(cohort, stats):
    """The item's real best-fitting size: highest true-fit rate (tie-break by
    support). Falls back to the median size of shoppers who reported a true fit."""
    if stats:
        return max(stats, key=lambda s: (stats[s][0], stats[s][1]))
    good = cohort[cohort["fit"] == "fit"]
    return float(good["size"].median()) if len(good) else None


def _verdict(grp) -> str:
    """A size's honest verdict: 'fit' only when most buyers actually found it true
    (>= 50%). Otherwise it's whichever miss is more common — so a size that fits
    only 45% of buyers never shows up as a clean 'true fit'."""
    fit_rate = (grp["fit"] == "fit").mean()
    if fit_rate >= 0.5:
        return "fit"
    return "small" if (grp["fit"] == "small").sum() >= (grp["fit"] == "large").sum() else "large"


def _twin_chips(cohort):
    """One chip per size (with enough support): its honest verdict, count and the
    real true-fit rate (for the tooltip)."""
    chips = []
    for sz, grp in sorted(cohort.groupby("size"), key=lambda x: x[0]):
        if len(grp) < MIN_SIZE_SUPPORT:
            continue
        chips.append({
            "size": int(sz) if float(sz).is_integer() else float(sz),
            "fit": _verdict(grp),
            "count": int(len(grp)),
            "fit_pct": round(100 * float((grp["fit"] == "fit").mean())),
        })
    return chips[:12]


def _fmt(sz):
    if sz is None:
        return None
    return int(sz) if float(sz).is_integer() else round(float(sz), 1)


def find_fit_twins(
    *,
    item_id: Optional[str] = None,
    category: Optional[str] = None,
    user_size: Optional[float] = None,
    user_profile: Optional[Dict[str, float]] = None,
    available_sizes: Optional[List[float]] = None,
    k: int = 25,
) -> Dict[str, Any]:
    idx = _load()
    if idx is None:
        return {"available": False, "reason": "no_index", "nudge": "",
                "twins_found": 0, "twins": []}

    df = idx["records"]
    cohort, scope = _select_cohort(df, item_id, category)
    if cohort.empty:
        return {"available": False, "reason": "empty_cohort", "nudge": "",
                "twins_found": 0, "twins": []}

    # Only reason about sizes the storefront actually sells, so we never recommend
    # (or chart) a size the shopper can't buy. Skip the filter if it would leave
    # too little real data to be meaningful.
    if available_sizes:
        avail = {float(s) for s in available_sizes}
        restricted = cohort[cohort["size"].isin(avail)]
        if len(restricted) >= MIN_SIZE_SUPPORT:
            cohort = restricted

    # Narrow to behavioral twins — shoppers whose kept-size pattern matches yours —
    # when we have enough of them. Everything below is then computed over "people
    # like you" instead of the whole crowd. Falls back gracefully otherwise.
    _ensure_profiles(df)
    twins = _behavioral_twins(cohort, user_profile)
    if twins is not None:
        base, twin_mode = twins, "body"
        twin_users = int(twins["user_id"].nunique())
    else:
        base, twin_mode, twin_users = cohort, "crowd", 0

    direction = _direction(base)
    stats = _size_stats(base)
    rec_size = _best_size(base, stats)

    selected = float(user_size) if user_size is not None else None

    # Percentage basis: the selected size if we have data for it, else overall.
    if selected is not None and selected in stats:
        rate, n = stats[selected]
        basis = "size"
    elif selected is not None:
        near = base[(base["size"] - selected).abs() <= 1]
        if len(near) >= MIN_SIZE_SUPPORT:
            rate, n, basis = float((near["fit"] == "fit").mean()), int(len(near)), "near"
        else:
            rate, n, basis = float((base["fit"] == "fit").mean()), int(len(base)), "overall"
    else:
        rate, n, basis = float((base["fit"] == "fit").mean()), int(len(base)), "overall"

    good_fit_pct = round(100 * rate)
    n_fit = round(rate * n)

    matches_pick = (selected is not None and rec_size is not None
                    and abs(selected - rec_size) < 0.5)

    nudge = _nudge(scope, good_fit_pct, n, selected, rec_size, direction, basis,
                   matches_pick, twin_mode)

    return {
        "available": True,
        "scope": scope,                          # item | category | global
        "basis": basis,                          # size | near | overall
        "twin_mode": twin_mode,                  # body (people like you) | crowd
        "twin_users": twin_users,                # distinct behavioral twins used
        "selected_size": _fmt(selected),
        # "personalised" = the headline is tailored to this shopper, either because
        # it's drawn from behavioral twins or it's specific to the size they picked.
        "personalised": twin_mode == "body" or basis in ("size", "near"),
        "twins_found": int(n),
        "good_fit": int(n_fit),
        "good_fit_pct": good_fit_pct,
        "recommended_size": _fmt(rec_size),      # stable, data-driven
        "matches_pick": bool(matches_pick),
        "direction": direction,                  # runs_small | runs_large | true_to_size
        "nudge": nudge,
        "twins": _twin_chips(base),
    }


def _nudge(scope, pct, n, selected, rec_size, direction, basis, matches_pick,
           twin_mode="crowd") -> str:
    rec_txt = "" if rec_size is None else (
        f"{int(rec_size)}" if float(rec_size).is_integer() else f"{rec_size}")
    run = {"runs_small": "tends to run small",
           "runs_large": "tends to run large",
           "true_to_size": "fits true to size"}[direction]
    who = "shoppers with sizing like yours" if twin_mode == "body" else "shoppers"

    if basis in ("size", "near") and selected is not None:
        sel = f"{int(selected)}" if float(selected).is_integer() else f"{selected}"
        head = f"{pct}% of {n} {who} who bought size {sel} found it a true fit."
        if matches_pick:
            tail = f" Size {sel} is the best-fitting size for this item."
        elif rec_size is not None:
            tail = f" This item {run} — most found size {rec_txt} fit best."
        else:
            tail = f" This item {run}."
        return head + tail

    if twin_mode == "body":
        head = f"{pct}% of {n} shoppers with sizing like yours found this true to size."
    else:
        head = f"{pct}% of {n} buyers found this true to size."
    tail = f" It {run}" + (f" — best fit at size {rec_txt}." if rec_size is not None else ".")
    return head + tail


if __name__ == "__main__":
    import json
    for sz in (None, 8, 10, 12):
        o = find_fit_twins(category="gown", user_size=sz, k=25)
        print(f"size={sz}: rec={o['recommended_size']} pct={o['good_fit_pct']} "
              f"basis={o['basis']} dir={o['direction']} :: {o['nudge']}")
