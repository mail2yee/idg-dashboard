from datetime import datetime, timezone

from fastapi import APIRouter

from app.db import db
from app.scoring import max_level

router = APIRouter()

OWNER_ROLES = ["DATA_OWNER", "DATA_STEWARD", "IT_OWNER"]


async def _latest_levels() -> dict:
    """subject_id -> latest maturity_level, from the most recent snapshot date."""
    latest_doc = await db.maturity_snapshots.find_one(sort=[("snapshot_date", -1)])
    if not latest_doc:
        return {}
    latest_date = latest_doc["snapshot_date"]
    docs = await db.maturity_snapshots.find({"snapshot_date": latest_date}).to_list(length=None)
    return {d["subject_id"]: d["maturity_level"] for d in docs}


@router.get("/governance/risk-priority")
async def governance_risk_priority(limit: int = 15):
    """Risk = 30-day usage x how far the subject is from L{max}. High-traffic,
    low-maturity subjects surface first (highest blast radius if something
    goes wrong); "zombie" subjects (well-governed but essentially unused) are
    called out separately as deprecation/consolidation candidates instead of
    being ranked on the same axis."""
    subjects = await db.data_subjects.find({}).to_list(length=None)
    levels = await _latest_levels()
    top_level = max_level()

    usage_docs = await db.usage_stats.find({}).to_list(length=None)
    usage_by_subject: dict = {}
    for u in usage_docs:
        usage_by_subject[u["subject_id"]] = usage_by_subject.get(u["subject_id"], 0) + u["query_count"]

    rows = []
    for s in subjects:
        level = levels.get(s["_id"])
        if level is None:
            continue
        usage_30d = usage_by_subject.get(s["_id"], 0)
        gap = top_level - level
        rows.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "domain": s["domain"],
            "maturity_level": level,
            "gap": gap,
            "usage_30d": usage_30d,
            "risk_score": usage_30d * gap,
        })

    zombies = sorted(
        (r for r in rows if r["gap"] <= 1 and r["usage_30d"] < 10),
        key=lambda r: -r["maturity_level"],
    )
    rows.sort(key=lambda r: -r["risk_score"])

    return {
        "max_level": top_level,
        "scatter": rows,
        "top_risk": rows[:limit],
        "zombies": zombies[:limit],
    }


@router.get("/governance/ownership-coverage")
async def governance_ownership_coverage():
    """% of subjects with all three owner roles assigned -- an unassigned
    role means nobody is accountable for that subject's data quality, the
    most basic governance gap there is."""
    subjects = await db.data_subjects.find({}).to_list(length=None)
    total = len(subjects)
    missing_by_role: dict = {r: [] for r in OWNER_ROLES}
    fully_covered = 0
    by_domain: dict = {}

    for s in subjects:
        present = {o.get("role") for o in s.get("owners", [])}
        missing = [r for r in OWNER_ROLES if r not in present]
        if not missing:
            fully_covered += 1
        for r in missing:
            missing_by_role[r].append({"id": str(s["_id"]), "name": s["name"], "domain": s["domain"]})

        dom = by_domain.setdefault(s["domain"], {"total": 0, "fully_covered": 0})
        dom["total"] += 1
        if not missing:
            dom["fully_covered"] += 1

    domain_rows = [
        {
            "domain": d,
            "total": v["total"],
            "fully_covered": v["fully_covered"],
            "coverage_pct": round(v["fully_covered"] / v["total"] * 100, 1) if v["total"] else 0.0,
        }
        for d, v in by_domain.items()
    ]
    domain_rows.sort(key=lambda r: -r["coverage_pct"])

    return {
        "total_subjects": total,
        "fully_covered": fully_covered,
        "coverage_pct": round(fully_covered / total * 100, 1) if total else 0.0,
        "role_coverage": {
            r: {
                "missing_count": len(missing_by_role[r]),
                "covered_pct": round((total - len(missing_by_role[r])) / total * 100, 1) if total else 0.0,
            }
            for r in OWNER_ROLES
        },
        "gaps": missing_by_role,
        "by_domain": domain_rows,
    }


@router.get("/governance/stewardship")
async def governance_stewardship():
    """Incident responsiveness by the Data Owner's team -- L4 in the
    maturity ladder only checks "does an assertion exist"; this checks
    "does anyone act when it fails". Overdue = still ACTIVE after 7 days."""
    subjects = await db.data_subjects.find({}).to_list(length=None)
    team_by_subject = {}
    for s in subjects:
        owner = next((o for o in s.get("owners", []) if o.get("role") == "DATA_OWNER"), None)
        if owner and owner.get("team"):
            team_by_subject[s["_id"]] = owner["team"]

    incidents = await db.incidents.find({}).to_list(length=None)
    now = datetime.now(timezone.utc)
    by_team: dict = {}
    for i in incidents:
        team = team_by_subject.get(i["subject_id"])
        if not team:
            continue
        row = by_team.setdefault(team, {
            "team": team, "open_count": 0, "overdue_count": 0,
            "resolved_7d_count": 0, "resolution_hours": [],
        })
        created_at = i["created_at"].replace(tzinfo=timezone.utc) if i["created_at"].tzinfo is None else i["created_at"]
        if i["status"] == "ACTIVE":
            row["open_count"] += 1
            if (now - created_at).days > 7:
                row["overdue_count"] += 1
        else:
            if i.get("resolution_time_hours") is not None:
                row["resolution_hours"].append(i["resolution_time_hours"])
            resolved_at = i.get("resolved_at")
            if resolved_at:
                resolved_at = resolved_at.replace(tzinfo=timezone.utc) if resolved_at.tzinfo is None else resolved_at
                if (now - resolved_at).days <= 7:
                    row["resolved_7d_count"] += 1

    rows = []
    for team, v in by_team.items():
        hrs = v["resolution_hours"]
        rows.append({
            "team": team,
            "open_count": v["open_count"],
            "overdue_count": v["overdue_count"],
            "resolved_7d_count": v["resolved_7d_count"],
            "avg_resolution_hours": round(sum(hrs) / len(hrs), 1) if hrs else None,
        })
    rows.sort(key=lambda r: -r["overdue_count"])

    # Fastest average resolution time, not raw resolved-count -- a team with
    # more total incidents naturally resolves more of them too, which could
    # spotlight the same team that also has the worst overdue backlog. Speed
    # is a volume-independent signal of actually being responsive.
    timed_rows = [r for r in rows if r["avg_resolution_hours"] is not None]
    most_responsive = min(timed_rows, key=lambda r: r["avg_resolution_hours"], default=None)
    return {
        "teams": rows,
        "most_responsive_team": most_responsive["team"] if most_responsive else None,
    }


@router.get("/governance/lineage-coverage")
async def governance_lineage_coverage():
    """Coverage = % of subjects with at least one lineage edge in either
    direction -- a subject with none is a blind spot (impact of a failure
    can't be assessed). risk_hubs cross high downstream fan-out with low
    maturity: these are the subjects whose problems cascade the widest."""
    subjects = await db.data_subjects.find({}).to_list(length=None)
    edges = await db.lineage_edges.find({}).to_list(length=None)
    levels = await _latest_levels()

    has_edge: dict = {}
    downstream_count: dict = {}
    for e in edges:
        has_edge[e["subject_id"]] = True
        if e["direction"] == "downstream":
            downstream_count[e["subject_id"]] = downstream_count.get(e["subject_id"], 0) + 1

    total = len(subjects)
    covered = sum(1 for s in subjects if has_edge.get(s["_id"]))
    islands = [
        {"id": str(s["_id"]), "name": s["name"], "domain": s["domain"]}
        for s in subjects if not has_edge.get(s["_id"])
    ]

    hubs = []
    for s in subjects:
        fan_out = downstream_count.get(s["_id"], 0)
        level = levels.get(s["_id"])
        if fan_out > 0 and level is not None:
            hubs.append({
                "id": str(s["_id"]),
                "name": s["name"],
                "domain": s["domain"],
                "fan_out": fan_out,
                "maturity_level": level,
            })
    hubs.sort(key=lambda r: (-r["fan_out"], r["maturity_level"]))

    return {
        "total_subjects": total,
        "covered": covered,
        "coverage_pct": round(covered / total * 100, 1) if total else 0.0,
        "islands": islands,
        "risk_hubs": hubs[:15],
    }
