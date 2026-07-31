"""
Optional, standalone backfill: pre-populates `usage_stats` with a long
synthetic history (default 400 days, i.e. "over a year") so the dashboard
can be previewed as if `refresh.py` had actually been run daily for that
long, without waiting for real time to pass.

Does NOT touch DataHub, and does NOT change how datahub_ingest.py /
datahub_sync.py / refresh.py behave -- those keep doing exactly what they
already do (one real point per subject per day, accumulated over actual
runs). This script only ever fills in days that don't already have a point
($setOnInsert, not $set), so it can never clobber real accumulated data --
run it before or after refresh.py, in any order, as many times as you like.

Run with either venv (pymongo is a transitive dep of motor, already in
backend/.venv -- no DataHub SDK needed here):
    backend/.venv/bin/python3 seed_usage_history.py [--days 400]
"""

import argparse
import os
import random
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient, UpdateOne

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB", "idg_dashboard")

# Same tiers/ranges/weights datahub_ingest.py uses for "today"'s point, so a
# subject's backfilled history reads consistently with its real recent days
# instead of jumping to a different traffic pattern at the seam.
POPULARITY_WEIGHTS = {"hot": 0.2, "warm": 0.3, "cold": 0.35, "zero": 0.15}
POPULARITY_RANGES = {"hot": (20, 80, 20, 60), "warm": (3, 15, 3, 15), "cold": (0, 3, 0, 2), "zero": (0, 0, 0, 0)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=400, help="how many days of history to backfill (default 400)")
    args = parser.parse_args()

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    subjects = list(db.data_subjects.find({}, {"_id": 1}))
    if not subjects:
        print("No data_subjects found -- run refresh.py first so there's something to backfill history for.")
        return

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    ops = []
    for s in subjects:
        pop = random.choices(list(POPULARITY_WEIGHTS), weights=list(POPULARITY_WEIGHTS.values()))[0]
        lo_q, hi_q, lo_u, hi_u = POPULARITY_RANGES[pop]
        for d in range(1, args.days + 1):  # strictly before today -- never touches today's real point
            day = today - timedelta(days=d)
            doc = {
                "subject_id": s["_id"],
                "date": day,
                "query_count": random.randint(lo_q, hi_q) if hi_q else 0,
                "unique_user_count": random.randint(lo_u, hi_u) if hi_u else 0,
            }
            ops.append(UpdateOne(
                {"subject_id": s["_id"], "date": day},
                {"$setOnInsert": doc},
                upsert=True,
            ))

    result = db.usage_stats.bulk_write(ops, ordered=False)
    print(f"Backfilled {result.upserted_count} new usage_stats days across {len(subjects)} subjects "
          f"({args.days} days requested; existing days were left untouched).")


if __name__ == "__main__":
    main()
