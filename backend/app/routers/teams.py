from fastapi import APIRouter, HTTPException

from app.db import db
from app.scoring import dimension_keys
from app.util import compute_deltas, period_delta, period_window, serialize

router = APIRouter()


@router.get("/owner-teams/trend-summary")
async def owner_teams_trend_summary(period: str = "week"):
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
        by_team_date.setdefault((team, sn["snapshot_date"]), []).append(sn["maturity_level"])

    dates = sorted({d for (_, d) in by_team_date.keys()})
    teams = sorted({t for (t, _) in by_team_date.keys()})

    window = period_window(period)
    results = []
    for team in teams:
        levels = []
        for d in dates:
            vals = by_team_date.get((team, d), [])
            levels.append(round(sum(vals) / len(vals), 2) if vals else 0.0)
        if not levels:
            continue
        deltas = compute_deltas(levels)
        results.append({
            "team": team,
            "avg_maturity_level": levels[-1],
            **deltas,
            "delta": period_delta(deltas, period),
            "series": levels[-window:],
            "subject_count": sum(1 for t in team_by_subject.values() if t == team),
        })

    results.sort(key=lambda x: -x["avg_maturity_level"])
    return {"teams": results}


@router.get("/owner-teams/{team}/detail")
async def owner_team_detail(team: str, period: str = "week"):
    """Drill-down for the team badge cards: level history, dimension
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
    dates_levels: dict = {}
    n = 0
    for s in team_subjects:
        series = by_subject.get(s["_id"], [])
        if not series:
            continue
        subject_levels = [sn["maturity_level"] for sn in series]
        subject_deltas = compute_deltas(subject_levels)
        subject_rows.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "domain": s["domain"],
            "maturity_level": subject_levels[-1],
            "wow_delta": subject_deltas["wow_delta"],
        })
        for d in dims:
            sub_score_sums[d] += series[-1]["sub_scores"].get(d, 0)
        n += 1
        for sn in series:
            dates_levels.setdefault(sn["snapshot_date"], []).append(sn["maturity_level"])

    avg_sub_scores = {d: round(v / n, 2) for d, v in sub_score_sums.items()} if n else {}
    subject_rows.sort(key=lambda x: -x["maturity_level"])

    dates = sorted(dates_levels.keys())
    levels = [round(sum(dates_levels[d]) / len(dates_levels[d]), 2) for d in dates]
    deltas = compute_deltas(levels)
    window = period_window(period)

    return serialize({
        "team": team,
        "avg_maturity_level": levels[-1] if levels else 0.0,
        **deltas,
        "delta": period_delta(deltas, period),
        "series": [{"date": d, "level": lvl} for d, lvl in zip(dates[-window:], levels[-window:])],
        "avg_sub_scores": avg_sub_scores,
        "subjects": subject_rows,
    })
