from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from app.db import db
from app.scoring import max_level as config_max_level, min_level as config_min_level
from app.util import compute_deltas, period_delta, period_window, serialize

router = APIRouter()


async def _latest_snapshot_date():
    doc = await db.maturity_snapshots.find_one(sort=[("snapshot_date", -1)])
    return doc["snapshot_date"] if doc else None


@router.get("/subjects")
async def list_subjects(
    domain: Optional[str] = None,
    min_level: Optional[int] = None,
    max_level: Optional[int] = None,
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
        level = snap["maturity_level"] if snap else None
        if min_level is not None and (level is None or level < min_level):
            continue
        if max_level is not None and (level is None or level > max_level):
            continue
        item = serialize(s)
        item["maturity_level"] = level
        item["sub_scores"] = serialize(snap["sub_scores"]) if snap else None
        results.append(item)

    results.sort(key=lambda x: (x["maturity_level"] is None, -(x["maturity_level"] or 0)))
    return {"subjects": results}


@router.get("/subjects/trend-summary")
async def subjects_trend_summary(
    domain: Optional[str] = None, search: Optional[str] = None, period: str = "week"
):
    """Per-subject WoW/MoM/YoY deltas + a period-windowed level series, for
    the Trends view.

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

    window = period_window(period)
    results = []
    for s in subjects:
        series_docs = by_subject.get(s["_id"], [])
        if not series_docs:
            continue
        levels = [d["maturity_level"] for d in series_docs]
        deltas = compute_deltas(levels)
        results.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "domain": s["domain"],
            "maturity_level": levels[-1],
            **deltas,
            "delta": period_delta(deltas, period),
            "series": levels[-window:],
        })

    results.sort(key=lambda x: -x["maturity_level"])
    return {"subjects": results}


@router.get("/subjects/level-distribution")
async def subjects_level_distribution(
    domain: Optional[str] = None, search: Optional[str] = None, period: str = "week"
):
    """For the Trends page's big chart: how many of the (optionally
    filtered) subjects sit at each Maturity Level at each snapshot date in
    the selected period's window. Registered before /subjects/{subject_id}
    for the same path-shadowing reason as trend-summary above."""
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
    by_date: dict = {}
    for sn in snaps:
        by_date.setdefault(sn["snapshot_date"], []).append(sn["maturity_level"])

    dates = sorted(by_date.keys())[-period_window(period):]
    bottom, top = config_min_level(), config_max_level()

    series = {str(lvl): [] for lvl in range(bottom, top + 1)}
    for date in dates:
        counts = {lvl: 0 for lvl in range(bottom, top + 1)}
        for val in by_date[date]:
            clamped = max(bottom, min(top, val))
            counts[clamped] += 1
        for lvl in range(bottom, top + 1):
            series[str(lvl)].append(counts[lvl])

    return {"dates": [serialize(d) for d in dates], "series": series, "min_level": bottom, "max_level": top}


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
async def subject_trend(subject_id: str, period: str = "week"):
    try:
        oid = ObjectId(subject_id)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid id")
    docs = await db.maturity_snapshots.find({"subject_id": oid}).sort("snapshot_date", 1).to_list(length=None)
    window = period_window(period)
    return {"trend": serialize(docs[-window:])}
