"""
Seeds MongoDB with fake DataHub-shaped data so the dashboard UI can be
built and iterated on without a real DataHub sync in place.

Deterministic (Faker.seed + random.seed) so re-running gives reproducible
data during UI iteration. Drops and recreates all collections each run.
"""

import os
import random
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from faker import Faker
from pymongo import MongoClient

from app.scoring import compute_dimension_scores, compute_maturity_level, max_level, min_level

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB", "idg_dashboard")

SEED = 42
random.seed(SEED)
fake = Faker()
Faker.seed(SEED)

DOMAINS = ["Sales", "Finance", "Marketing", "Product", "Risk", "Platform"]
PLATFORMS = ["bigquery", "snowflake", "airflow", "kafka", "postgres"]
NATIVE_TYPES = ["STRING", "INT64", "FLOAT64", "BOOLEAN", "TIMESTAMP", "ARRAY", "RECORD"]
ASSERTION_TYPES = ["FRESHNESS", "VOLUME", "SCHEMA", "COLUMN", "SQL"]
INCIDENT_CATEGORIES = ["Data Quality", "Pipeline Failure", "Schema Change", "Access Issue"]
TABLE_PREFIXES = ["fact", "dim", "stg", "agg", "raw"]
SNAPSHOT_WEEKS = 52  # a full year of weekly snapshots, so week/month/year trend views all have real data
SUBJECTS_PER_DOMAIN = 7

# IT ownership sits with one shared platform team; Data Owner/Steward sit
# with the business-side team accountable for that domain's data (mostly
# domain-aligned, occasionally centrally owned) — this is what the
# owner-team leaderboard aggregates by.
IT_TEAM = "Platform Engineering"

now = datetime.now(timezone.utc)


def business_team_for(domain: str) -> str:
    return f"{domain} Data Team" if random.random() < 0.85 else "Central Data Office"


def week_start(n_weeks_ago: int) -> datetime:
    """Monday-aligned snapshot date, n_weeks_ago weeks before this week's Monday."""
    monday = now - timedelta(days=now.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    return monday - timedelta(weeks=n_weeks_ago)


def make_subject(domain: str):
    prefix = random.choice(TABLE_PREFIXES)
    name = f"{prefix}_{fake.word()}_{fake.word()}"
    platform = random.choice(PLATFORMS)
    subject_type = "dataProduct" if random.random() < 0.15 else "dataset"
    is_deprecated = random.random() < 0.10
    business_team = business_team_for(domain)
    owners = []
    if random.random() < 0.90:
        owners.append({
            "urn": f"urn:li:corpuser:{fake.user_name()}",
            "name": fake.name(),
            "email": fake.email(),
            "role": "DATA_OWNER",
            "team": business_team,
        })
    if random.random() < 0.75:
        owners.append({
            "urn": f"urn:li:corpuser:{fake.user_name()}",
            "name": fake.name(),
            "email": fake.email(),
            "role": "DATA_STEWARD",
            "team": business_team,
        })
    if random.random() < 0.80:
        owners.append({
            "urn": f"urn:li:corpuser:{fake.user_name()}",
            "name": fake.name(),
            "email": fake.email(),
            "role": "IT_OWNER",
            "team": IT_TEAM,
        })

    subject = {
        "_id": ObjectId(),
        "datahub_urn": f"urn:li:dataset:(urn:li:dataPlatform:{platform},{domain.lower()}.{name},PROD)",
        "name": name,
        "type": subject_type,
        "domain": domain,
        "domain_urn": f"urn:li:domain:{domain.lower()}",
        "platform": platform,
        "owners": owners,
        "description": fake.sentence() if random.random() < 0.75 else "",
        "tags": random.sample(["pii", "critical", "gold", "silver", "bronze"], k=random.randint(0, 2)),
        "glossary_terms": random.sample(
            ["Revenue", "Order", "Customer", "Campaign", "Risk Score", "Inventory"], k=random.randint(0, 2)
        ),
        "is_deprecated": is_deprecated,
        "status": "DEPRECATED" if is_deprecated else "ACTIVE",
        "created_at": now - timedelta(days=random.randint(60, 900)),
        "last_synced_at": now - timedelta(hours=random.randint(1, 48)),
        # internal-only generation attributes, not part of the "real" DataHub shape,
        # kept here so downstream generators can derive coherent scores/history
        "_has_api": random.random() < 0.5,
        "_doc_quality": random.uniform(0.2, 0.97),
        "_quality_baseline": random.uniform(0.5, 0.99),
        "_popularity": random.choice(["hot", "warm", "cold", "zero"]),
        "_freshness_days": random.choice([0, 1, 2, 3, 5, 8, 14, 21]),
    }
    return subject


def make_schema_fields(subject):
    n_fields = random.randint(5, 15)
    fields = []
    for i in range(n_fields):
        has_desc = random.random() < subject["_doc_quality"]
        fields.append({
            "_id": ObjectId(),
            "subject_id": subject["_id"],
            "field_path": fake.word() + ("_id" if i == 0 else ""),
            "native_type": random.choice(NATIVE_TYPES),
            "description": fake.sentence() if has_desc else "",
            "is_nullable": i != 0 and random.random() < 0.4,
            "is_primary_key": i == 0,
            "tags": ["pii"] if random.random() < 0.1 else [],
        })
    return fields


def make_lineage_edges(subject, all_subjects):
    edges = []
    if random.random() < 0.15:
        return edges  # intentional orphan
    others = [s for s in all_subjects if s["_id"] != subject["_id"]]
    for direction, max_n in (("upstream", 2), ("downstream", 2)):
        for _ in range(random.randint(0, max_n)):
            related = random.choice(others) if others and random.random() < 0.7 else None
            edges.append({
                "_id": ObjectId(),
                "subject_id": subject["_id"],
                "direction": direction,
                "related_urn": related["datahub_urn"] if related else f"urn:li:dataset:(urn:li:dataPlatform:external,{fake.word()},PROD)",
                "related_name": related["name"] if related else fake.word(),
                "via_datajob_urn": f"urn:li:dataJob:(airflow,{subject['name']}_dag,{fake.word()}_task)" if random.random() < 0.6 else None,
            })
    return edges


def make_pipeline(subject):
    if random.random() >= 0.7:
        return None
    return {
        "_id": ObjectId(),
        "subject_id": subject["_id"],
        "dataflow_urn": f"urn:li:dataFlow:(airflow,{subject['name']}_dag,PROD)",
        "datajob_urn": f"urn:li:dataJob:(airflow,{subject['name']}_dag,load_task)",
        "name": f"{subject['name']}_dag",
        "schedule": random.choice(["0 * * * *", "0 0 * * *", "0 6 * * 1", "*/15 * * * *"]),
        "last_run_status": "SUCCESS" if random.random() < 0.85 else "FAILED",
        "last_run_at": now - timedelta(hours=random.randint(1, 30)),
    }


def make_assertions(subject):
    n = random.choices([0, 1, 2], weights=[0.3, 0.4, 0.3])[0]
    assertions = []
    baseline = subject["_quality_baseline"]
    for _ in range(n):
        pass_rate_7d = round(min(1.0, max(0.0, baseline + random.uniform(-0.1, 0.05))), 2)
        pass_rate_30d = round(min(1.0, max(0.0, baseline + random.uniform(-0.15, 0.05))), 2)
        assertions.append({
            "_id": ObjectId(),
            "subject_id": subject["_id"],
            "assertion_urn": f"urn:li:assertion:{fake.uuid4()}",
            "type": random.choice(ASSERTION_TYPES),
            "is_active": True,
            "last_run_status": "PASS" if random.random() < baseline else "FAIL",
            "last_run_at": now - timedelta(hours=random.randint(1, 24)),
            "pass_rate_7d": pass_rate_7d,
            "pass_rate_30d": pass_rate_30d,
        })
    return assertions


def make_incidents(subject):
    n = random.choices([0, 1, 2], weights=[0.6, 0.3, 0.1])[0]
    incidents = []
    for _ in range(n):
        created = now - timedelta(days=random.randint(1, 60))
        resolved = random.random() < 0.7
        resolved_at = created + timedelta(hours=random.randint(1, 96)) if resolved else None
        incidents.append({
            "_id": ObjectId(),
            "subject_id": subject["_id"],
            "incident_urn": f"urn:li:incident:{fake.uuid4()}",
            "title": f"{random.choice(INCIDENT_CATEGORIES)} on {subject['name']}",
            "status": "RESOLVED" if resolved else "ACTIVE",
            "priority": random.choice(["P1", "P2", "P3"]),
            "category": random.choice(INCIDENT_CATEGORIES),
            "created_at": created,
            "resolved_at": resolved_at,
            "resolution_time_hours": round((resolved_at - created).total_seconds() / 3600, 1) if resolved_at else None,
        })
    return incidents


def make_usage_stats(subject):
    pop_map = {"hot": (200, 800, 20, 60), "warm": (30, 150, 3, 15), "cold": (0, 10, 0, 2), "zero": (0, 0, 0, 0)}
    lo_q, hi_q, lo_u, hi_u = pop_map[subject["_popularity"]]
    stats = []
    for d in range(30):
        date = now - timedelta(days=d)
        stats.append({
            "_id": ObjectId(),
            "subject_id": subject["_id"],
            "date": date.replace(hour=0, minute=0, second=0, microsecond=0),
            "query_count": random.randint(lo_q, hi_q) if hi_q else 0,
            "unique_user_count": random.randint(lo_u, hi_u) if hi_u else 0,
        })
    return stats


def make_operation(subject):
    return {
        "_id": ObjectId(),
        "subject_id": subject["_id"],
        "last_updated_timestamp": now - timedelta(days=subject["_freshness_days"]),
        "operation_type": random.choice(["INSERT", "UPDATE", "DELETE"]),
    }


def build_scoring_context(subject, schema_fields, lineage_edges, assertions):
    """Raw signals used by config/maturity_dimensions.json's rules. Adding a
    new dimension to that config only needs a new field here if the signal
    isn't already present — the scoring math itself stays config-only."""
    with_desc = sum(1 for f in schema_fields if f["description"])
    field_description_coverage = with_desc / len(schema_fields) if schema_fields else 0
    return {
        "has_api": subject["_has_api"],
        "has_description": bool(subject["description"]),
        "field_description_coverage": field_description_coverage,
        "has_owner": any(o["role"] == "DATA_OWNER" for o in subject["owners"]),
        "has_domain": True,  # all subjects are assigned a domain in this seed set
        "has_glossary": bool(subject["glossary_terms"]),
        "has_lineage": bool(lineage_edges),
        "freshness_days": subject["_freshness_days"],
        "assertions": assertions,
    }


def build_maturity_snapshots(subject, context, sub_scores, assertions, incidents, usage_stats):
    """Maturity Level (L1-L5, cumulative ladder — no L0, L1 is the floor) is
    the headline metric per snapshot; `sub_scores` (the continuous per-KPI
    dimension values used by the heatmap/breakdown views) only ever gets
    read from the *latest* snapshot by every consumer, so it's stored
    unchanged across historical weeks rather than re-derived — only the
    level needs a plausible history.
    """
    latest_level = compute_maturity_level(context)
    top, bottom = max_level(), min_level()

    # walk backward from the real latest level: mostly flat, small chance of
    # a +/-1 step most weeks, so a year of history reads as "slow drift with
    # occasional level-ups/downs" rather than a random walk on 5 raw signals
    levels_by_week = [None] * SNAPSHOT_WEEKS
    levels_by_week[0] = latest_level
    for w in range(1, SNAPSHOT_WEEKS):
        r = random.random()
        step = -1 if r < 0.08 else (1 if r < 0.16 else 0)
        levels_by_week[w] = min(top, max(bottom, levels_by_week[w - 1] + step))

    open_incidents = sum(1 for i in incidents if i["status"] == "ACTIVE")
    pass_rates = [a["pass_rate_7d"] for a in assertions if a["pass_rate_7d"] is not None]
    assertion_pass_rate = round(sum(pass_rates) / len(pass_rates), 2) if pass_rates else None
    usage_30d = sum(u["query_count"] for u in usage_stats)

    snapshots = []
    for w in range(SNAPSHOT_WEEKS):
        snapshots.append({
            "_id": ObjectId(),
            "subject_id": subject["_id"],
            "snapshot_date": week_start(w),
            "maturity_level": levels_by_week[w],
            "sub_scores": sub_scores,
            "kpis": {
                "description_coverage_field": sub_scores["metadata"],
                "ownership_coverage": 1 if subject["owners"] else 0,
                "domain_coverage": 1,
                "assertion_coverage": 1 if assertions else 0,
                "assertion_pass_rate_7d": assertion_pass_rate,
                "lineage_completeness": sub_scores["lineage"],
                "is_orphan": sub_scores["lineage"] == 0,
                "freshness_sla_met": sub_scores["freshness"] == 1,
                "open_incident_count": open_incidents if w == 0 else random.randint(0, open_incidents + 1),
                "usage_query_count_30d": usage_30d,
                "deprecated_but_used": subject["is_deprecated"] and usage_30d > 0,
            },
        })
    return snapshots


def build_org_snapshots(subjects_by_domain, maturity_by_subject):
    org_snapshots = []
    for w in range(SNAPSHOT_WEEKS):
        snapshot_date = week_start(w)
        global_levels = []
        for domain, subs in subjects_by_domain.items():
            domain_levels = [maturity_by_subject[s["_id"]][w]["maturity_level"] for s in subs]
            global_levels.extend(domain_levels)
            avg = round(sum(domain_levels) / len(domain_levels), 2) if domain_levels else 0
            org_snapshots.append({
                "_id": ObjectId(),
                "scope_type": "DOMAIN",
                "scope_id": subs[0]["domain_urn"] if subs else None,
                "domain": domain,
                "snapshot_date": snapshot_date,
                "avg_maturity_level": avg,
                "subject_count": len(subs),
            })
        avg_global = round(sum(global_levels) / len(global_levels), 2) if global_levels else 0
        org_snapshots.append({
            "_id": ObjectId(),
            "scope_type": "GLOBAL",
            "scope_id": None,
            "domain": None,
            "snapshot_date": snapshot_date,
            "avg_maturity_level": avg_global,
            "subject_count": len(global_levels),
        })

    # now compute data_quality_index + wow/mom/yoy deltas per (scope_type, scope_id) series
    def key(doc):
        return (doc["scope_type"], doc["scope_id"])

    series = {}
    for doc in org_snapshots:
        series.setdefault(key(doc), []).append(doc)
    top = max_level()
    for docs in series.values():
        docs.sort(key=lambda d: d["snapshot_date"])
        for i, doc in enumerate(docs):
            doc["data_quality_index"] = round(doc["avg_maturity_level"] / top * 100, 1)
            doc["wow_delta"] = round(doc["avg_maturity_level"] - docs[i - 1]["avg_maturity_level"], 2) if i > 0 else 0.0
            mom_ref = i - 4 if i - 4 >= 0 else 0
            doc["mom_delta"] = round(doc["avg_maturity_level"] - docs[mom_ref]["avg_maturity_level"], 2) if i > 0 else 0.0
            yoy_ref = i - 52 if i - 52 >= 0 else 0
            doc["yoy_delta"] = round(doc["avg_maturity_level"] - docs[yoy_ref]["avg_maturity_level"], 2) if i > 0 else 0.0

    return org_snapshots


def main():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    collections = [
        "data_subjects", "schema_fields", "lineage_edges", "pipelines",
        "assertions", "incidents", "usage_stats", "operations",
        "maturity_snapshots", "org_quality_index_snapshots",
    ]
    for name in collections:
        db[name].drop()

    all_subjects = []
    subjects_by_domain = {d: [] for d in DOMAINS}
    for domain in DOMAINS:
        for _ in range(SUBJECTS_PER_DOMAIN):
            s = make_subject(domain)
            all_subjects.append(s)
            subjects_by_domain[domain].append(s)

    all_schema_fields = []
    all_lineage_edges = []
    all_pipelines = []
    all_assertions = []
    all_incidents = []
    all_usage_stats = []
    all_operations = []
    all_maturity_snapshots = []
    maturity_by_subject = {}

    for s in all_subjects:
        fields = make_schema_fields(s)
        edges = make_lineage_edges(s, all_subjects)
        pipeline = make_pipeline(s)
        assertions = make_assertions(s)
        incidents = make_incidents(s)
        usage = make_usage_stats(s)
        operation = make_operation(s)

        context = build_scoring_context(s, fields, edges, assertions)
        sub_scores = compute_dimension_scores(context)
        snapshots = build_maturity_snapshots(s, context, sub_scores, assertions, incidents, usage)

        all_schema_fields.extend(fields)
        all_lineage_edges.extend(edges)
        if pipeline:
            all_pipelines.append(pipeline)
        all_assertions.extend(assertions)
        all_incidents.extend(incidents)
        all_usage_stats.extend(usage)
        all_operations.append(operation)
        all_maturity_snapshots.extend(snapshots)
        maturity_by_subject[s["_id"]] = snapshots  # index 0 = latest (this week)

    org_snapshots = build_org_snapshots(subjects_by_domain, maturity_by_subject)

    # strip internal-only generation attributes before persisting subjects
    clean_subjects = []
    for s in all_subjects:
        s = dict(s)
        for k in list(s.keys()):
            if k.startswith("_") and k != "_id":
                del s[k]
        clean_subjects.append(s)

    if clean_subjects:
        db["data_subjects"].insert_many(clean_subjects)
    if all_schema_fields:
        db["schema_fields"].insert_many(all_schema_fields)
    if all_lineage_edges:
        db["lineage_edges"].insert_many(all_lineage_edges)
    if all_pipelines:
        db["pipelines"].insert_many(all_pipelines)
    if all_assertions:
        db["assertions"].insert_many(all_assertions)
    if all_incidents:
        db["incidents"].insert_many(all_incidents)
    if all_usage_stats:
        db["usage_stats"].insert_many(all_usage_stats)
    if all_operations:
        db["operations"].insert_many(all_operations)
    if all_maturity_snapshots:
        db["maturity_snapshots"].insert_many(all_maturity_snapshots)
    if org_snapshots:
        db["org_quality_index_snapshots"].insert_many(org_snapshots)

    print("Seed complete:")
    for name in collections:
        print(f"  {name}: {db[name].count_documents({})}")


if __name__ == "__main__":
    main()
