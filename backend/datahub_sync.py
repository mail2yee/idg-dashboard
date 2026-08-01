"""
Reads current-state metadata OUT of DataHub (via GraphQL) and upserts it into
the same Mongo collections `seed.py` used to populate directly from Faker --
data_subjects, schema_fields, lineage_edges, assertions, incidents,
usage_stats -- in the exact same document shapes. This is the one place that
knows how DataHub's metadata model maps onto this app's Mongo schema; every
router (`subjects.py`, `domains.py`, `teams.py`, `governance.py`,
`agent/intents.py`) and the frontend are completely unaware the data source
changed.

Run with the dedicated venv that has the DataHub SDK/requests:
    backend/.venv-datahub/bin/python3 datahub_sync.py

`refresh.py` is the actual entrypoint (this sync step, then the historical
maturity-snapshot recompute) -- this script only handles the DataHub -> Mongo
half.
"""

import hashlib
import os
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient

from datahub_client import graphql
from seed import DOMAINS

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB", "idg_dashboard")

DATASET_QUERY = """
query GetDataset($urn: String!) {
  dataset(urn: $urn) {
    urn
    name
    platform { name }
    properties { description }
    domain { domain { urn properties { name } } }
    ownership { owners { owner { ... on CorpUser { urn properties { departmentName } } } type } }
    tags { tags { tag { properties { name } } } }
    glossaryTerms { terms { term { properties { name } } } }
    schemaMetadata {
      fields { fieldPath description nullable }
    }
    operations(limit: 1) { lastUpdatedTimestamp }
    upstream: lineage(input: { direction: UPSTREAM, start: 0, count: 20 }) {
      relationships { entity { urn ... on Dataset { name } } }
    }
    assertions(start: 0, count: 20) {
      assertions {
        urn
        info { description }
        runEvents(limit: 1) {
          runEvents { timestampMillis result { type } }
        }
      }
    }
    incidents(start: 0, count: 20) {
      incidents { urn title status { state lastUpdated { time } } created { time } }
    }
    usageStats(range: MONTH) {
      buckets { bucket metrics { uniqueUserCount totalSqlQueries } }
    }
  }
}
"""

OWNERSHIP_ROLE_BY_TYPE = {
    "DATAOWNER": "DATA_OWNER",
    "DATA_STEWARD": "DATA_STEWARD",
    "TECHNICAL_OWNER": "IT_OWNER",
}


def list_domain_dataset_urns(domain: str) -> list:
    urn = f"urn:li:domain:{domain.lower()}"
    data = graphql(
        """
        query($urn: String!) {
          domain(urn: $urn) {
            entities(input: { query: "*", count: 100 }) {
              searchResults { entity { urn } }
            }
          }
        }
        """,
        {"urn": urn},
    )
    domain_data = data.get("domain")
    if not domain_data:
        return []
    return [
        r["entity"]["urn"]
        for r in domain_data["entities"]["searchResults"]
        if r["entity"]["urn"].startswith("urn:li:dataset:")
    ]


def fetch_dataset(urn: str) -> dict:
    return graphql(DATASET_QUERY, {"urn": urn})["dataset"]


def stable_object_id(key: str) -> ObjectId:
    """Deterministic ObjectId derived from a DataHub urn, not a random one --
    data_subjects gets wholesale-replaced on every sync, but usage_stats
    accumulates across syncs and is keyed by subject_id; a random _id each
    run would orphan every previously-accumulated usage point the moment
    the next sync replaces data_subjects with fresh random ids."""
    return ObjectId(hashlib.md5(key.encode()).hexdigest()[:24])


def transform_subject(ds: dict, domain: str, first_seen_at: datetime = None) -> dict:
    tag_names = [t["tag"]["properties"]["name"] for t in (ds.get("tags") or {}).get("tags", [])]
    has_api = "has-api" in tag_names
    visible_tags = [t for t in tag_names if t != "has-api"]

    owners = []
    for o in (ds.get("ownership") or {}).get("owners", []):
        role = OWNERSHIP_ROLE_BY_TYPE.get(o["type"])
        owner = o.get("owner") or {}
        owner_urn = owner.get("urn")
        team = (owner.get("properties") or {}).get("departmentName")
        if role and owner_urn:
            owners.append({"urn": owner_urn, "role": role, "team": team})

    operations = ds.get("operations") or []
    last_updated_ms = operations[0]["lastUpdatedTimestamp"] if operations else None
    freshness_days = (
        int((datetime.now(timezone.utc).timestamp() * 1000 - last_updated_ms) / 86_400_000)
        if last_updated_ms
        else 999
    )

    glossary_terms = [t["term"]["properties"]["name"] for t in (ds.get("glossaryTerms") or {}).get("terms", [])]

    return {
        "_id": stable_object_id(ds["urn"]),
        "datahub_urn": ds["urn"],
        "name": ds["name"],
        "type": "dataset",
        "domain": domain,
        "domain_urn": f"urn:li:domain:{domain.lower()}",
        "platform": (ds.get("platform") or {}).get("name", "unknown"),
        "owners": owners,
        "description": (ds.get("properties") or {}).get("description") or "",
        "tags": visible_tags,
        "glossary_terms": glossary_terms,
        "is_deprecated": False,
        "status": "ACTIVE",
        # first time this urn was ever synced -- NOT "now" on every sync.
        # governance_subject_growth (governance.py) depends on this being a
        # real first-seen date to detect "new this week", not a timestamp
        # that resets on every refresh.py run.
        "created_at": first_seen_at or datetime.now(timezone.utc),
        "last_synced_at": datetime.now(timezone.utc),
        "_has_api": has_api,
        "_freshness_days": freshness_days,
    }


def transform_schema_fields(ds: dict, subject_id) -> list:
    fields = (ds.get("schemaMetadata") or {}).get("fields") or []
    return [
        {
            "_id": ObjectId(),
            "subject_id": subject_id,
            "field_path": f["fieldPath"],
            "native_type": "STRING",
            "description": f.get("description") or "",
            "is_nullable": bool(f.get("nullable")),
            "is_primary_key": f["fieldPath"].endswith("_id"),
            "tags": [],
        }
        for f in fields
    ]


def transform_assertions(ds: dict, subject_id) -> list:
    """Only the latest run status -- the real target DataHub has no
    timeseries retention, so a rolling pass-rate window isn't obtainable
    from DataHub itself. (Turns out nothing in this app actually reads
    pass_rate_7d/30d anyway -- compute_dimension_scores' assertion_pass rule
    and the L4 maturity gate only ever look at last_run_status -- so this
    isn't a feature loss, just no longer pretending we have data we don't.)
    A pass-rate *trend* would need refresh.py to accumulate its own history
    the same way it already does for maturity_snapshots; not built here
    since nothing consumes it yet."""
    out = []
    for a in (ds.get("assertions") or {}).get("assertions", []):
        events = (a.get("runEvents") or {}).get("runEvents") or []
        if not events:
            continue
        last = max(events, key=lambda e: e["timestampMillis"])

        description = (a.get("info") or {}).get("description") or ""
        category = description.split(" check on ")[0] if " check on " in description else "SQL"

        out.append({
            "_id": ObjectId(),
            "subject_id": subject_id,
            "assertion_urn": a["urn"],
            "type": category,
            "is_active": True,
            "last_run_status": "PASS" if last["result"]["type"] == "SUCCESS" else "FAIL",
            "last_run_at": datetime.fromtimestamp(last["timestampMillis"] / 1000, tz=timezone.utc),
            "pass_rate_7d": None,
            "pass_rate_30d": None,
        })
    return out


def transform_incidents(ds: dict, subject_id) -> list:
    out = []
    for i in (ds.get("incidents") or {}).get("incidents", []):
        state = i["status"]["state"]
        is_resolved = state == "RESOLVED"
        created_at = datetime.fromtimestamp(i["created"]["time"] / 1000, tz=timezone.utc)
        title = i.get("title") or ""
        category = title.split(" on ")[0] if " on " in title else "Data Quality"

        # datahub_ingest.py sets status.lastUpdated to the resolution time for
        # resolved incidents (and to the creation time for still-ACTIVE ones)
        # -- that's our only signal for "when was this resolved".
        last_updated_ms = (i["status"].get("lastUpdated") or {}).get("time")
        resolved_at = (
            datetime.fromtimestamp(last_updated_ms / 1000, tz=timezone.utc)
            if is_resolved and last_updated_ms
            else None
        )
        resolution_time_hours = (
            round((resolved_at - created_at).total_seconds() / 3600, 1) if resolved_at else None
        )

        out.append({
            "_id": ObjectId(),
            "subject_id": subject_id,
            "incident_urn": i["urn"],
            "title": title,
            "status": "RESOLVED" if is_resolved else "ACTIVE",
            "priority": None,
            "category": category,
            "created_at": created_at,
            "resolved_at": resolved_at,
            "resolution_time_hours": resolution_time_hours,
        })
    return out


def transform_usage_stats(ds: dict, subject_id):
    """Only today's point -- no timeseries retention in the real target
    DataHub means no rolling window is obtainable from it directly. Returns
    None if there's nothing at all. main()/upsert_usage_point() is what
    accumulates these into a real history in our own DB across repeated
    refresh.py runs, the same way maturity_snapshots already accumulates
    weekly history."""
    buckets = (ds.get("usageStats") or {}).get("buckets") or []
    if not buckets:
        return None
    latest = max(buckets, key=lambda b: b["bucket"])
    metrics = latest.get("metrics") or {}
    return {
        "subject_id": subject_id,
        "date": datetime.fromtimestamp(latest["bucket"] / 1000, tz=timezone.utc),
        "query_count": metrics.get("totalSqlQueries") or 0,
        "unique_user_count": metrics.get("uniqueUserCount") or 0,
    }


def build_lineage_edges(urn_to_subject: dict, upstream_by_urn: dict) -> list:
    """upstream_by_urn: dataset urn -> list of upstream dataset urns/names
    (from DataHub's UpstreamLineage aspect, our only real signal). Downstream
    edges are derived by inverting this map -- DataHub itself doesn't store
    "downstream" as a separate aspect, it's inferred the same way."""
    edges = []
    downstream_by_urn: dict = {}
    for urn, upstreams in upstream_by_urn.items():
        for u in upstreams:
            downstream_by_urn.setdefault(u["urn"], []).append({"urn": urn, "name": urn_to_subject.get(urn, {}).get("name", urn)})

    for urn, subject in urn_to_subject.items():
        for u in upstream_by_urn.get(urn, []):
            edges.append({
                "_id": ObjectId(),
                "subject_id": subject["_id"],
                "direction": "upstream",
                "related_urn": u["urn"],
                "related_name": u["name"],
                "via_datajob_urn": None,
            })
        for d in downstream_by_urn.get(urn, []):
            edges.append({
                "_id": ObjectId(),
                "subject_id": subject["_id"],
                "direction": "downstream",
                "related_urn": d["urn"],
                "related_name": d["name"],
                "via_datajob_urn": None,
            })
    return edges


def upsert_usage_point(db, point: dict) -> None:
    """usage_stats accumulates across refresh.py runs instead of being
    replaced -- DataHub only ever gives us "today"'s point (no timeseries
    retention in the real target environment), so a real rolling window has
    to be built up by us, one day at a time, across repeated scheduled
    runs -- same principle as maturity_snapshots' weekly accumulation.
    Keyed by (subject_id, day) so re-running refresh.py the same day updates
    today's point rather than creating a duplicate."""
    day_start = point["date"].replace(hour=0, minute=0, second=0, microsecond=0)
    db.usage_stats.update_one(
        {"subject_id": point["subject_id"], "date": day_start},
        {"$set": {**point, "date": day_start}},
        upsert=True,
    )


def main():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    # snapshot existing created_at values before data_subjects gets wholesale
    # -replaced below, so a urn we've already seen keeps its real first-seen
    # date instead of it resetting to "now" on every sync.
    first_seen_by_urn = {
        s["datahub_urn"]: s["created_at"] for s in db.data_subjects.find({}, {"datahub_urn": 1, "created_at": 1})
    }

    all_subjects = []
    all_schema_fields = []
    all_assertions = []
    all_incidents = []
    today_usage_points = []
    urn_to_subject = {}
    upstream_by_urn = {}

    for domain in DOMAINS:
        urns = list_domain_dataset_urns(domain)
        print(f"{domain}: {len(urns)} datasets")
        for urn in urns:
            ds = fetch_dataset(urn)
            if not ds:
                print(f"  WARNING: {urn} not yet queryable (indexing lag?), skipping")
                continue
            subject = transform_subject(ds, domain, first_seen_by_urn.get(urn))
            all_subjects.append(subject)
            urn_to_subject[urn] = subject

            all_schema_fields.extend(transform_schema_fields(ds, subject["_id"]))
            all_assertions.extend(transform_assertions(ds, subject["_id"]))
            all_incidents.extend(transform_incidents(ds, subject["_id"]))
            usage_point = transform_usage_stats(ds, subject["_id"])
            if usage_point:
                today_usage_points.append(usage_point)

            upstreams = [
                {"urn": r["entity"]["urn"], "name": r["entity"].get("name", r["entity"]["urn"])}
                for r in (ds.get("upstream") or {}).get("relationships", [])
            ]
            upstream_by_urn[urn] = upstreams

    all_lineage_edges = build_lineage_edges(urn_to_subject, upstream_by_urn)

    print(f"Synced {len(all_subjects)} subjects, {len(all_schema_fields)} schema fields, "
          f"{len(all_lineage_edges)} lineage edges, {len(all_assertions)} assertions, "
          f"{len(all_incidents)} incidents, {len(today_usage_points)} usage points for today")

    # data_subjects (and its dependents keyed off subject_id) are a full
    # snapshot of DataHub's current state each run -- safe to replace wholesale.
    for coll, docs in [
        ("data_subjects", all_subjects),
        ("schema_fields", all_schema_fields),
        ("lineage_edges", all_lineage_edges),
        ("assertions", all_assertions),
        ("incidents", all_incidents),
    ]:
        db[coll].delete_many({})
        if docs:
            db[coll].insert_many(docs)

    # usage_stats is the one collection that accumulates instead -- see
    # upsert_usage_point()'s docstring.
    for point in today_usage_points:
        upsert_usage_point(db, point)

    print(f"Mongo collections synced from DataHub ({len(today_usage_points)} usage points upserted).")
    return all_subjects


if __name__ == "__main__":
    main()
