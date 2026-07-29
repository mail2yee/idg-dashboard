from fastapi import APIRouter, HTTPException

from app.db import db
from app.scoring import dimension_keys
from app.util import serialize

router = APIRouter()


@router.get("/domains/ranking")
async def domains_ranking():
    latest_doc = await db.org_quality_index_snapshots.find_one(
        {"scope_type": "DOMAIN"}, sort=[("snapshot_date", -1)]
    )
    if not latest_doc:
        return {"domains": []}
    latest_date = latest_doc["snapshot_date"]
    cursor = db.org_quality_index_snapshots.find(
        {"scope_type": "DOMAIN", "snapshot_date": latest_date}
    ).sort("avg_maturity_score", -1)
    docs = await cursor.to_list(length=None)
    return {"domains": serialize(docs)}


@router.get("/domains/trend-summary")
async def domains_trend_summary():
    """Per-domain WoW/MoM deltas + an 8-week score series, for the Trends view."""
    docs = await db.org_quality_index_snapshots.find({"scope_type": "DOMAIN"}).sort("snapshot_date", 1).to_list(length=None)
    by_domain: dict = {}
    for d in docs:
        by_domain.setdefault(d["domain"], []).append(d)

    results = []
    for domain, series in by_domain.items():
        latest = series[-1]
        results.append({
            "domain": domain,
            "avg_maturity_score": latest["avg_maturity_score"],
            "wow_delta": latest["wow_delta"],
            "mom_delta": latest["mom_delta"],
            "series": [s["avg_maturity_score"] for s in series],
        })
    results.sort(key=lambda x: -x["avg_maturity_score"])
    return {"domains": results}


@router.get("/domains/dimension-breakdown")
async def domains_dimension_breakdown():
    """Every domain's average score on each of the 5 maturity dimensions,
    for comparing a single KPI (e.g. Alerting) across the whole org."""
    latest_snap_doc = await db.maturity_snapshots.find_one(sort=[("snapshot_date", -1)])
    if not latest_snap_doc:
        return {"domains": []}
    latest_date = latest_snap_doc["snapshot_date"]

    subjects = await db.data_subjects.find({}).to_list(length=None)
    subject_domain = {s["_id"]: s["domain"] for s in subjects}
    snaps = await db.maturity_snapshots.find({"snapshot_date": latest_date}).to_list(length=None)

    dims = dimension_keys()
    sums: dict = {}
    counts: dict = {}
    for sn in snaps:
        domain = subject_domain.get(sn["subject_id"])
        if not domain:
            continue
        sums.setdefault(domain, {d: 0.0 for d in dims})
        counts[domain] = counts.get(domain, 0) + 1
        for d in dims:
            sums[domain][d] += sn["sub_scores"].get(d, 0)

    results = []
    for domain, dim_sums in sums.items():
        n = counts[domain]
        row = {"domain": domain}
        row.update({d: round(dim_sums[d] / n, 2) for d in dims})
        results.append(row)
    return {"domains": results}


@router.get("/domains/{domain}/detail")
async def domain_detail(domain: str):
    """Drill-down for the Trends view: score history, dimension breakdown,
    and every subject in the domain with its own WoW delta."""
    docs = await db.org_quality_index_snapshots.find(
        {"scope_type": "DOMAIN", "domain": domain}
    ).sort("snapshot_date", 1).to_list(length=None)
    if not docs:
        raise HTTPException(status_code=404, detail="domain not found")
    latest = docs[-1]

    subjects = await db.data_subjects.find({"domain": domain}).to_list(length=None)
    subject_ids = [s["_id"] for s in subjects]
    snaps = await db.maturity_snapshots.find(
        {"subject_id": {"$in": subject_ids}}
    ).sort("snapshot_date", 1).to_list(length=None)
    by_subject: dict = {}
    for sn in snaps:
        by_subject.setdefault(sn["subject_id"], []).append(sn)

    dims = dimension_keys()
    sub_score_sums = {d: 0.0 for d in dims}
    subject_rows = []
    n = 0
    for s in subjects:
        series = by_subject.get(s["_id"], [])
        if not series:
            continue
        latest_snap = series[-1]
        prev_week = series[-2] if len(series) >= 2 else None
        wow = round(latest_snap["maturity_score"] - prev_week["maturity_score"], 2) if prev_week else 0.0
        subject_rows.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "maturity_score": latest_snap["maturity_score"],
            "wow_delta": wow,
        })
        for d in dims:
            sub_score_sums[d] += latest_snap["sub_scores"].get(d, 0)
        n += 1

    avg_sub_scores = {d: round(v / n, 2) for d, v in sub_score_sums.items()} if n else {}
    subject_rows.sort(key=lambda x: -x["maturity_score"])

    return serialize({
        "domain": domain,
        "avg_maturity_score": latest["avg_maturity_score"],
        "wow_delta": latest["wow_delta"],
        "mom_delta": latest["mom_delta"],
        "series": [{"date": d["snapshot_date"], "score": d["avg_maturity_score"]} for d in docs],
        "avg_sub_scores": avg_sub_scores,
        "subjects": subject_rows,
    })
