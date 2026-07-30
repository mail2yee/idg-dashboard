from datetime import datetime

from bson import ObjectId


def serialize(doc):
    """Recursively converts ObjectId -> str, datetime -> isoformat, and _id -> id."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize(d) for d in doc]
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            key = "id" if k == "_id" else k
            out[key] = serialize(v)
        return out
    return doc


# Shared week/month/year period handling for the Trends views. A subject,
# domain, or owner-team all store/derive an ascending-by-date list of
# maturity_level values — these helpers turn that into the three deltas plus
# whichever single one the caller's selected period wants, without every
# router reimplementing the same offset math.
PERIOD_WINDOW = {"week": 8, "month": 16, "year": 52}
_PERIOD_DELTA_KEY = {"week": "wow_delta", "month": "mom_delta", "year": "yoy_delta"}


def period_window(period: str) -> int:
    return PERIOD_WINDOW.get(period, PERIOD_WINDOW["week"])


def compute_deltas(series_values: list) -> dict:
    """series_values: ascending-by-date numeric values. Deltas are always
    computed off the full history passed in — trim `series` for display
    separately, after calling this."""
    if len(series_values) < 2:
        return {"wow_delta": 0.0, "mom_delta": 0.0, "yoy_delta": 0.0}

    latest = series_values[-1]

    def ref(weeks_back: int) -> float:
        idx = -weeks_back - 1
        return series_values[idx] if len(series_values) > weeks_back else series_values[0]

    return {
        "wow_delta": round(latest - ref(1), 2),
        "mom_delta": round(latest - ref(4), 2),
        "yoy_delta": round(latest - ref(52), 2),
    }


def period_delta(deltas: dict, period: str) -> float:
    return deltas[_PERIOD_DELTA_KEY.get(period, "wow_delta")]
