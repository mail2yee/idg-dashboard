from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from app.db import db
from app.util import serialize

router = APIRouter()


async def _latest_snapshot_date():
    doc = await db.maturity_snapshots.find_one(sort=[("snapshot_date", -1)])
    return doc["snapshot_date"] if doc else None


@router.get("/subjects")
async def list_subjects(
    domain: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    search: Optional[str] = None,
):
    latest_date = await _latest_snapshot_date()
    if latest_date is None:
        return {"subjects": []}

    subject_match = {}
    if domain:
        subject_match["domain"] = domain
    if search:
        subject_match["name"] = {"$regex": search, "$options": "i"}

    subjects = await db.data_subjects.find(subject_match).to_list(length=None)
    subject_ids = [s["_id"] for s in subjects]

    snaps = await db.maturity_snapshots.find(
        {"snapshot_date": latest_date, "subject_id": {"$in": subject_ids}}
    ).to_list(length=None)
    snap_by_subject = {s["subject_id"]: s for s in snaps}

    results = []
    for s in subjects:
        snap = snap_by_subject.get(s["_id"])
        score = snap["maturity_score"] if snap else None
        if min_score is not None and (score is None or score < min_score):
            continue
        if max_score is not None and (score is None or score > max_score):
            continue
        item = serialize(s)
        item["maturity_score"] = score
        item["sub_scores"] = serialize(snap["sub_scores"]) if snap else None
        results.append(item)

    results.sort(key=lambda x: (x["maturity_score"] is None, -(x["maturity_score"] or 0)))
    return {"subjects": results}


@router.get("/subjects/trend-summary")
async def subjects_trend_summary(domain: Optional[str] = None, search: Optional[str] = None):
    """Per-subject WoW/MoM deltas + an 8-week score series, for the Trends view.

    Registered before /subjects/{subject_id} so "trend-summary" isn't swallowed
    as a subject_id by that path-param route.
    """
    subject_match = {}
    if domain:
        subject_match["domain"] = domain
    if search:
        subject_match["name"] = {"$regex": search, "$options": "i"}

    subjects = await db.data_subjects.find(subject_match).to_list(length=None)
    subject_ids = [s["_id"] for s in subjects]

    snaps = await db.maturity_snapshots.find(
        {"subject_id": {"$in": subject_ids}}
    ).sort("snapshot_date", 1).to_list(length=None)
    by_subject: dict = {}
    for sn in snaps:
        by_subject.setdefault(sn["subject_id"], []).append(sn)

    results = []
    for s in subjects:
        series = by_subject.get(s["_id"], [])
        if not series:
            continue
        latest = series[-1]
        prev_week = series[-2] if len(series) >= 2 else None
        prev_month = series[-5] if len(series) >= 5 else series[0]
        wow = round(latest["maturity_score"] - prev_week["maturity_score"], 2) if prev_week else 0.0
        mom = round(latest["maturity_score"] - prev_month["maturity_score"], 2) if prev_month else 0.0
        results.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "domain": s["domain"],
            "maturity_score": latest["maturity_score"],
            "wow_delta": wow,
            "mom_delta": mom,
            "series": [sn["maturity_score"] for sn in series],
        })

    results.sort(key=lambda x: -x["maturity_score"])
    return {"subjects": results}


@router.get("/subjects/{subject_id}")
async def subject_detail(subject_id: str):
    try:
        oid = ObjectId(subject_id)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid id")

    subject = await db.data_subjects.find_one({"_id": oid})
    if not subject:
        raise HTTPException(status_code=404, detail="not found")

    latest_date = await _latest_snapshot_date()
    snapshot = await db.maturity_snapshots.find_one({"subject_id": oid, "snapshot_date": latest_date})
    assertions = await db.assertions.find({"subject_id": oid}).to_list(length=None)
    incidents = await db.incidents.find({"subject_id": oid}).to_list(length=None)
    lineage = await db.lineage_edges.find({"subject_id": oid}).to_list(length=None)
    pipeline = await db.pipelines.find_one({"subject_id": oid})
    fields = await db.schema_fields.find({"subject_id": oid}).to_list(length=None)

    return {
        "subject": serialize(subject),
        "snapshot": serialize(snapshot),
        "assertions": serialize(assertions),
        "incidents": serialize(incidents),
        "lineage": serialize(lineage),
        "pipeline": serialize(pipeline),
        "schema_fields": serialize(fields),
    }


@router.get("/subjects/{subject_id}/trend")
async def subject_trend(subject_id: str):
    try:
        oid = ObjectId(subject_id)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid id")
    docs = await db.maturity_snapshots.find({"subject_id": oid}).sort("snapshot_date", 1).to_list(length=None)
    return {"trend": serialize(docs)}
