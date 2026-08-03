"""
One-command refresh: sync current-state metadata from DataHub into Mongo
(datahub_sync.py), then update the derived historical maturity-level trend
data on top of it. DataHub gives us current state, not "what was the
assertion pass rate 8 weeks ago", so this derived-history layer stays ours
regardless of where the current-state metadata comes from -- but *how* it's
derived depends on MATURITY_HISTORY_MODE:

- "synthetic" (default): the same fake-52-week backward random-walk
  build_maturity_snapshots/build_org_snapshots always used for the pure
  -Faker demo path in seed.py, ending at today's real DataHub-derived score.
  Every run deletes and fully regenerates all history. Fine for a demo
  scenario that's synthetic top to bottom -- NOT real history.
- "accumulate": for a real company DataHub with no timeseries retention of
  its own, this is the only way to ever get real history -- each run
  upserts exactly one dated snapshot (today's real score) per subject/
  domain/global, keyed by (id, this week), and never touches any
  previously-accumulated week. Same accumulation principle datahub_sync.py's
  upsert_usage_point() already uses for usage_stats. Real history then only
  ever grows forward from whenever this mode starts actually being run on a
  recurring schedule (cron/systemd timer) -- there's no way to retroactively
  invent real history DataHub itself never had. See README's "Real history
  at the company" section.

This replaces seed.py's "generate everything from Faker directly into Mongo"
role as the thing deploy.sh invokes on backend startup. seed.py itself is
still used as a shared-constants/helpers module (by datahub_ingest.py and by
this script), just no longer run as its own entrypoint in the DataHub path.
seed.py's own standalone main() (local dev / the fast pytest suite) never
reads MATURITY_HISTORY_MODE and is completely unaffected by either mode here.

Run with the dedicated venv that has the DataHub SDK/requests/pymongo:
    backend/.venv-datahub/bin/python3 refresh.py
    MATURITY_HISTORY_MODE=accumulate backend/.venv-datahub/bin/python3 refresh.py
"""

import os
import random

from pymongo import MongoClient

import datahub_sync
from app.scoring import compute_dimension_scores, compute_maturity_level, max_level
from app.util import compute_deltas
from seed import DOMAINS, build_maturity_snapshots, build_org_snapshots, build_scoring_context, week_start

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB", "idg_dashboard")
MATURITY_HISTORY_MODE = os.environ.get("MATURITY_HISTORY_MODE", "synthetic")
SEED = 42


def build_current_maturity_snapshot(subject, context, sub_scores, assertions, incidents, usage_stats):
    """Accumulate-mode counterpart to seed.build_maturity_snapshots -- builds
    exactly one real dated snapshot (this week) instead of fabricating 52
    fake historical weeks. Same per-subject fields as week 0 there, just
    without the "older weeks" randomization branches that only exist to fake
    a plausible past (there's no past to fake here)."""
    open_incidents = sum(1 for i in incidents if i["status"] == "ACTIVE")
    pass_rates = [a["pass_rate_7d"] for a in assertions if a["pass_rate_7d"] is not None]
    assertion_pass_rate = round(sum(pass_rates) / len(pass_rates), 2) if pass_rates else None
    usage_30d = sum(u["query_count"] for u in usage_stats)

    return {
        "subject_id": subject["_id"],
        # Naive, not week_start()'s tz-aware value -- pymongo always reads
        # datetimes back naive, and this stays consistent with every other
        # snapshot_date already stored elsewhere in this app.
        "snapshot_date": week_start(0).replace(tzinfo=None),
        "maturity_level": compute_maturity_level(context),
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
            "open_incident_count": open_incidents,
            "usage_query_count_30d": usage_30d,
            "deprecated_but_used": subject["is_deprecated"] and usage_30d > 0,
        },
    }


def upsert_accumulated_org_snapshot(db, scope_type, domain, domain_urn, avg, subject_count):
    """Upserts this week's DOMAIN or GLOBAL avg (scope_type/domain/this-week
    is the key), computing wow/mom/yoy deltas from whatever real history has
    actually accumulated so far via app/util.compute_deltas -- already
    handles a short/empty series gracefully (falls back to a 0.0 delta), so
    day-one accumulate mode needs no special-casing here. Previously
    -accumulated weeks are never re-read or rewritten -- a delta only ever
    looks backward from the doc it belongs to, so once written it stays
    correct forever."""
    today = week_start(0)
    # week_start() returns a tz-aware datetime, but pymongo always reads
    # datetimes back naive (BSON has no tz concept) -- comparing aware vs
    # naive via != is never equal in Python, so without stripping tzinfo
    # here, today's own already-upserted doc would never be excluded below.
    today_naive = today.replace(tzinfo=None)
    prior_docs = list(
        db.org_quality_index_snapshots.find({"scope_type": scope_type, "domain": domain}).sort("snapshot_date", 1)
    )
    # Exclude today's own doc (a re-run within the same week would otherwise
    # compare today against itself instead of against real prior weeks).
    prior_levels = [d["avg_maturity_level"] for d in prior_docs if d["snapshot_date"] != today_naive]
    deltas = compute_deltas(prior_levels + [avg])

    doc = {
        "scope_type": scope_type,
        "scope_id": domain_urn,
        "domain": domain,
        "snapshot_date": today_naive,
        "avg_maturity_level": avg,
        "subject_count": subject_count,
        "data_quality_index": round(avg / max_level() * 100, 1),
        **deltas,
    }
    db.org_quality_index_snapshots.update_one(
        {"scope_type": scope_type, "domain": domain, "snapshot_date": today_naive}, {"$set": doc}, upsert=True
    )


def _per_subject_inputs(db, all_subjects):
    def group_by_subject(coll):
        grouped = {}
        for doc in db[coll].find({}):
            grouped.setdefault(doc["subject_id"], []).append(doc)
        return grouped

    schema_fields_by_subject = group_by_subject("schema_fields")
    lineage_by_subject = group_by_subject("lineage_edges")
    assertions_by_subject = group_by_subject("assertions")
    incidents_by_subject = group_by_subject("incidents")
    usage_by_subject = group_by_subject("usage_stats")

    subjects_by_domain = {d: [] for d in DOMAINS}
    for s in all_subjects:
        subjects_by_domain[s["domain"]].append(s)

    inputs = []
    for s in all_subjects:
        inputs.append((
            s,
            schema_fields_by_subject.get(s["_id"], []),
            lineage_by_subject.get(s["_id"], []),
            assertions_by_subject.get(s["_id"], []),
            incidents_by_subject.get(s["_id"], []),
            usage_by_subject.get(s["_id"], []),
        ))
    return subjects_by_domain, inputs


def _run_synthetic_mode(db, all_subjects, subjects_by_domain, inputs):
    random.seed(SEED)  # deterministic history-walk in build_maturity_snapshots

    all_maturity_snapshots = []
    maturity_by_subject = {}
    for s, fields, edges, assertions, incidents, usage in inputs:
        context = build_scoring_context(s, fields, edges, assertions)
        sub_scores = compute_dimension_scores(context)
        snapshots = build_maturity_snapshots(s, context, sub_scores, assertions, incidents, usage)
        all_maturity_snapshots.extend(snapshots)
        maturity_by_subject[s["_id"]] = snapshots  # index 0 = latest (this week)

    org_snapshots = build_org_snapshots(subjects_by_domain, maturity_by_subject)

    db.maturity_snapshots.delete_many({})
    db.org_quality_index_snapshots.delete_many({})
    if all_maturity_snapshots:
        db.maturity_snapshots.insert_many(all_maturity_snapshots)
    if org_snapshots:
        db.org_quality_index_snapshots.insert_many(org_snapshots)

    print(f"Done (synthetic mode): {len(all_maturity_snapshots)} maturity snapshots, {len(org_snapshots)} org snapshots.")


def _run_accumulate_mode(db, all_subjects, subjects_by_domain, inputs):
    subject_count = 0
    levels_by_domain: dict = {}
    for s, fields, edges, assertions, incidents, usage in inputs:
        context = build_scoring_context(s, fields, edges, assertions)
        sub_scores = compute_dimension_scores(context)
        doc = build_current_maturity_snapshot(s, context, sub_scores, assertions, incidents, usage)
        db.maturity_snapshots.update_one(
            {"subject_id": s["_id"], "snapshot_date": doc["snapshot_date"]}, {"$set": doc}, upsert=True
        )
        levels_by_domain.setdefault(s["domain"], []).append(doc["maturity_level"])
        subject_count += 1

    global_levels = []
    for domain, subs in subjects_by_domain.items():
        levels = levels_by_domain.get(domain, [])
        global_levels.extend(levels)
        avg = round(sum(levels) / len(levels), 2) if levels else 0
        domain_urn = subs[0]["domain_urn"] if subs else None
        upsert_accumulated_org_snapshot(db, "DOMAIN", domain, domain_urn, avg, len(levels))

    avg_global = round(sum(global_levels) / len(global_levels), 2) if global_levels else 0
    upsert_accumulated_org_snapshot(db, "GLOBAL", None, None, avg_global, len(global_levels))

    print(f"Done (accumulate mode): upserted this week's snapshot for {subject_count} subjects, "
          f"{len(subjects_by_domain)} domains + global.")


def main():
    print("Step 1/2: syncing current-state metadata from DataHub...")
    all_subjects = datahub_sync.main()

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    subjects_by_domain, inputs = _per_subject_inputs(db, all_subjects)

    if MATURITY_HISTORY_MODE == "accumulate":
        print("Step 2/2: updating maturity-level history (accumulate mode)...")
        _run_accumulate_mode(db, all_subjects, subjects_by_domain, inputs)
    else:
        print("Step 2/2: recomputing maturity-level history (synthetic mode)...")
        _run_synthetic_mode(db, all_subjects, subjects_by_domain, inputs)

    # _has_api/_freshness_days were needed above (build_scoring_context) but
    # aren't part of the public data_subjects shape -- same cleanup intent
    # seed.py always had, just done as a pass at the end here instead of
    # before the initial insert.
    db.data_subjects.update_many({}, {"$unset": {"_has_api": "", "_freshness_days": ""}})


if __name__ == "__main__":
    main()
