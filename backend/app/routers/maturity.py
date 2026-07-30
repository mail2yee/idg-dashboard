from fastapi import APIRouter

from app.db import db
from app.scoring import max_level, min_level
from app.util import serialize

router = APIRouter()


@router.get("/maturity/summary")
async def maturity_summary():
    latest = await db.org_quality_index_snapshots.find_one(
        {"scope_type": "GLOBAL"}, sort=[("snapshot_date", -1)]
    )
    if not latest:
        return {"latest": None, "trend": []}
    cursor = db.org_quality_index_snapshots.find({"scope_type": "GLOBAL"}).sort("snapshot_date", 1)
    trend = await cursor.to_list(length=None)
    return {"latest": serialize(latest), "trend": serialize(trend)}


@router.get("/maturity/distribution")
async def maturity_distribution():
    """Count of subjects at each Maturity Level (L1 through L{max_level} —
    there is no L0; L1 is the floor) — discrete counts, not continuous-score
    buckets, since Level is already an integer ladder position."""
    latest_doc = await db.maturity_snapshots.find_one(sort=[("snapshot_date", -1)])
    bottom, top = min_level(), max_level()
    if not latest_doc:
        return {"levels": [], "max_level": top}
    latest_date = latest_doc["snapshot_date"]
    docs = await db.maturity_snapshots.find({"snapshot_date": latest_date}).to_list(length=None)

    counts = {lvl: 0 for lvl in range(bottom, top + 1)}
    for d in docs:
        counts[d["maturity_level"]] = counts.get(d["maturity_level"], 0) + 1

    return {
        "levels": [{"level": lvl, "count": counts.get(lvl, 0)} for lvl in range(bottom, top + 1)],
        "max_level": top,
    }
