import math

from fastapi import APIRouter

from app.db import db
from app.scoring import max_score
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
    latest_doc = await db.maturity_snapshots.find_one(sort=[("snapshot_date", -1)])
    if not latest_doc:
        return {"buckets": []}
    latest_date = latest_doc["snapshot_date"]
    cursor = db.maturity_snapshots.find({"snapshot_date": latest_date})
    docs = await cursor.to_list(length=None)

    top = math.ceil(max_score())
    buckets = {f"{i}-{i + 1}": 0 for i in range(top)}
    for d in docs:
        idx = min(int(d["maturity_score"]), top - 1)
        buckets[f"{idx}-{idx + 1}"] += 1
    return {"buckets": [{"range": k, "count": v} for k, v in buckets.items()], "max_score": max_score()}
