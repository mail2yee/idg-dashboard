from fastapi import APIRouter, HTTPException

from app.db import db
from app.scoring import dimension_keys
from app.util import serialize

router = APIRouter()


@router.get("/owner-teams/trend-summary")
async def owner_teams_trend_summary():
    """Aggregates by the Data Owner's team (not by individual) — the public,
    non-shaming cut for accountability. Individual owner names stay scoped to
    a single subject's detail view, never a cross-subject public ranking."""
    subjects = await db.data_subjects.find({}).to_list(length=None)
    team_by_subject = {}
    for s in subjects:
        data_owner = next((o for o in s.get("owners", []) if o.get("role") == "DATA_OWNER"), None)
        if data_owner and data_owner.get("team"):
            team_by_subject[s["_id"]] = data_owner["team"]

    subject_ids = list(team_by_subject.keys())
    snaps = await db.maturity_snapshots.find(
        {"subject_id": {"$in": subject_ids}}
    ).sort("snapshot_date", 1).to_list(length=None)

    by_team_date: dict = {}
    for sn in snaps:
        team = team_by_subject.get(sn["subject_id"])
        if not team:
            continue
        by_team_date.setdefault((team, sn["snapshot_date"]), []).append(sn["maturity_score"])

    dates = sorted({d for (_, d) in by_team_date.keys()})
    teams = sorted({t for (t, _) in by_team_date.keys()})

    results = []
    for team in teams:
        series = []
        for d in dates:
            scores = by_team_date.get((team, d), [])
            series.append(round(sum(scores) / len(scores), 2) if scores else 0.0)
        if not series:
            continue
        latest = series[-1]
        wow = round(latest - series[-2], 2) if len(series) >= 2 else 0.0
        ref = -5 if len(series) >= 5 else 0
        mom = round(latest - series[ref], 2) if len(series) >= 2 else 0.0
        results.append({
            "team": team,
            "avg_maturity_score": latest,
            "wow_delta": wow,
            "mom_delta": mom,
            "series": series,
            "subject_count": sum(1 for t in team_by_subject.values() if t == team),
        })

    results.sort(key=lambda x: -x["avg_maturity_score"])
    return {"teams": results}


@router.get("/owner-teams/{team}/detail")
async def owner_team_detail(team: str):
    """Drill-down for the team badge cards: score history, dimension
    breakdown, and every subject that team's Data Owner is accountable for.
    Individual Data Steward/IT Owner names still stay out of this view —
    those only ever appear in a single subject's own detail drawer."""
    subjects = await db.data_subjects.find({}).to_list(length=None)
    team_subjects = []
    for s in subjects:
        data_owner = next((o for o in s.get("owners", []) if o.get("role") == "DATA_OWNER"), None)
        if data_owner and data_owner.get("team") == team:
            team_subjects.append(s)
    if not team_subjects:
        raise HTTPException(status_code=404, detail="team not found")

    subject_ids = [s["_id"] for s in team_subjects]
    snaps = await db.maturity_snapshots.find(
        {"subject_id": {"$in": subject_ids}}
    ).sort("snapshot_date", 1).to_list(length=None)
    by_subject: dict = {}
    for sn in snaps:
        by_subject.setdefault(sn["subject_id"], []).append(sn)

    dims = dimension_keys()
    sub_score_sums = {d: 0.0 for d in dims}
    subject_rows = []
    dates_scores: dict = {}
    n = 0
    for s in team_subjects:
        series = by_subject.get(s["_id"], [])
        if not series:
            continue
        latest_snap = series[-1]
        prev_week = series[-2] if len(series) >= 2 else None
        wow = round(latest_snap["maturity_score"] - prev_week["maturity_score"], 2) if prev_week else 0.0
        subject_rows.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "domain": s["domain"],
            "maturity_score": latest_snap["maturity_score"],
            "wow_delta": wow,
        })
        for d in dims:
            sub_score_sums[d] += latest_snap["sub_scores"].get(d, 0)
        n += 1
        for sn in series:
            dates_scores.setdefault(sn["snapshot_date"], []).append(sn["maturity_score"])

    avg_sub_scores = {d: round(v / n, 2) for d, v in sub_score_sums.items()} if n else {}
    subject_rows.sort(key=lambda x: -x["maturity_score"])

    dates = sorted(dates_scores.keys())
    series_out = [
        {"date": d, "score": round(sum(dates_scores[d]) / len(dates_scores[d]), 2)} for d in dates
    ]
    latest_score = series_out[-1]["score"] if series_out else 0.0
    wow_delta = round(latest_score - series_out[-2]["score"], 2) if len(series_out) >= 2 else 0.0
    ref = -5 if len(series_out) >= 5 else 0
    mom_delta = round(latest_score - series_out[ref]["score"], 2) if len(series_out) >= 2 else 0.0

    return serialize({
        "team": team,
        "avg_maturity_score": latest_score,
        "wow_delta": wow_delta,
        "mom_delta": mom_delta,
        "series": series_out,
        "avg_sub_scores": avg_sub_scores,
        "subjects": subject_rows,
    })
