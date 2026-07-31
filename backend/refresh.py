"""
One-command refresh: sync current-state metadata from DataHub into Mongo
(datahub_sync.py), then recompute the derived historical maturity-level
trend data on top of it (the same build_maturity_snapshots/build_org_snapshots
logic seed.py always used -- DataHub gives us current state, not "what was
the assertion pass rate 8 weeks ago", so this derived-history layer stays
ours regardless of where the current-state metadata comes from).

This replaces seed.py's "generate everything from Faker directly into Mongo"
role as the thing deploy.sh invokes on backend startup. seed.py itself is
still used as a shared-constants/helpers module (by datahub_ingest.py and by
this script), just no longer run as its own entrypoint in the DataHub path.

Run with the dedicated venv that has the DataHub SDK/requests/pymongo:
    backend/.venv-datahub/bin/python3 refresh.py
"""

import os
import random

from pymongo import MongoClient

import datahub_sync
from app.scoring import compute_dimension_scores
from seed import DOMAINS, build_maturity_snapshots, build_org_snapshots, build_scoring_context

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB", "idg_dashboard")
SEED = 42


def main():
    random.seed(SEED)  # deterministic history-walk in build_maturity_snapshots

    print("Step 1/2: syncing current-state metadata from DataHub...")
    all_subjects = datahub_sync.main()

    print("Step 2/2: recomputing maturity-level history...")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

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
    all_maturity_snapshots = []
    maturity_by_subject = {}

    for s in all_subjects:
        subjects_by_domain[s["domain"]].append(s)
        fields = schema_fields_by_subject.get(s["_id"], [])
        edges = lineage_by_subject.get(s["_id"], [])
        assertions = assertions_by_subject.get(s["_id"], [])
        incidents = incidents_by_subject.get(s["_id"], [])
        usage = usage_by_subject.get(s["_id"], [])

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

    # _has_api/_freshness_days were needed above (build_scoring_context) but
    # aren't part of the public data_subjects shape -- same cleanup intent
    # seed.py always had, just done as a pass at the end here instead of
    # before the initial insert.
    db.data_subjects.update_many({}, {"$unset": {"_has_api": "", "_freshness_days": ""}})

    print(f"Done: {len(all_maturity_snapshots)} maturity snapshots, {len(org_snapshots)} org snapshots.")


if __name__ == "__main__":
    main()
