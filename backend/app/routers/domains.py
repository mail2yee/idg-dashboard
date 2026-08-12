from fastapi import APIRouter, HTTPException

from app.db import db
from app.scoring import dimension_keys, max_level, min_level
from app.util import compute_deltas, period_delta, period_window, serialize

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
    ).sort("avg_maturity_level", -1)
    docs = await cursor.to_list(length=None)
    return {"domains": serialize(docs)}


@router.get("/domains/trend-summary")
async def domains_trend_summary(period: str = "week"):
    """Per-domain WoW/MoM/YoY deltas + a period-windowed level series.

    `dates`/`subject_count_series` are additive (every domain shares the
    same weekly snapshot cadence, so one domain's dates represent them
    all) -- added for the Reports page's monthly-trend chart, which plots
    subject-count history per domain, not just the level sparkline."""
    docs = await db.org_quality_index_snapshots.find({"scope_type": "DOMAIN"}).sort("snapshot_date", 1).to_list(length=None)
    by_domain: dict = {}
    for d in docs:
        by_domain.setdefault(d["domain"], []).append(d)

    window = period_window(period)
    dates: list = []
    results = []
    for domain, series in by_domain.items():
        levels = [s["avg_maturity_level"] for s in series]
        counts = [s["subject_count"] for s in series]
        deltas = compute_deltas(levels)
        if not dates:
            dates = [serialize(s["snapshot_date"]) for s in series[-window:]]
        results.append({
            "domain": domain,
            "avg_maturity_level": levels[-1],
            **deltas,
            "delta": period_delta(deltas, period),
            "series": levels[-window:],
            "subject_count_series": counts[-window:],
        })
    results.sort(key=lambda x: -x["avg_maturity_level"])
    return {"domains": results, "dates": dates}


@router.get("/domains/level-distribution")
async def domains_level_distribution(period: str = "week"):
    """For the Trends page's big chart: how many domains sit at each
    (rounded) Maturity Level at each snapshot date in the selected period's
    window. A domain's own level is fractional (an average across its
    subjects), so it's rounded to the nearest whole rung for this count."""
    docs = await db.org_quality_index_snapshots.find({"scope_type": "DOMAIN"}).sort("snapshot_date", 1).to_list(length=None)
    by_date: dict = {}
    for d in docs:
        by_date.setdefault(d["snapshot_date"], []).append(d["avg_maturity_level"])

    dates = sorted(by_date.keys())[-period_window(period):]
    bottom, top = min_level(), max_level()

    series = {str(lvl): [] for lvl in range(bottom, top + 1)}
    for date in dates:
        counts = {lvl: 0 for lvl in range(bottom, top + 1)}
        for val in by_date[date]:
            rounded = max(bottom, min(top, round(val)))
            counts[rounded] += 1
        for lvl in range(bottom, top + 1):
            series[str(lvl)].append(counts[lvl])

    return {"dates": [serialize(d) for d in dates], "series": series, "min_level": bottom, "max_level": top}


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
async def domain_detail(domain: str, period: str = "week"):
    """Drill-down for the Trends view: level history, dimension breakdown,
    and every subject in the domain with its own WoW delta."""
    docs = await db.org_quality_index_snapshots.find(
        {"scope_type": "DOMAIN", "domain": domain}
    ).sort("snapshot_date", 1).to_list(length=None)
    if not docs:
        raise HTTPException(status_code=404, detail="domain not found")
    levels = [d["avg_maturity_level"] for d in docs]
    deltas = compute_deltas(levels)
    window = period_window(period)

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
        subject_levels = [sn["maturity_level"] for sn in series]
        subject_deltas = compute_deltas(subject_levels)
        subject_rows.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "maturity_level": subject_levels[-1],
            "wow_delta": subject_deltas["wow_delta"],
        })
        for d in dims:
            sub_score_sums[d] += series[-1]["sub_scores"].get(d, 0)
        n += 1

    avg_sub_scores = {d: round(v / n, 2) for d, v in sub_score_sums.items()} if n else {}
    subject_rows.sort(key=lambda x: -x["maturity_level"])

    return serialize({
        "domain": domain,
        "avg_maturity_level": levels[-1],
        **deltas,
        "delta": period_delta(deltas, period),
        "series": [{"date": d["snapshot_date"], "level": lvl} for d, lvl in zip(docs[-window:], levels[-window:])],
        "avg_sub_scores": avg_sub_scores,
        "subjects": subject_rows,
    })
