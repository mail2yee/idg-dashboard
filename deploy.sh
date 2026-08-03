#!/usr/bin/env bash
# One-command on-prem deploy: builds and runs mongo + backend + frontend as
# containers. Re-run any time (e.g. after `git pull`) to rebuild and restart
# with the latest code — it's idempotent.
#
# Current-state metadata comes from a real DataHub instance, not generated
# fake data: this script brings mongo up first, runs refresh.py (via the
# dedicated backend/.venv-datahub) to sync from DataHub + recompute the
# maturity-level history, THEN starts backend/frontend. Requires:
#   - A running DataHub instance (see docs.datahub.com/docs/quickstart),
#     reachable at DATAHUB_GMS_URL (default http://localhost:8080)
#   - backend/.venv-datahub set up:
#       python3 -m venv backend/.venv-datahub
#       backend/.venv-datahub/bin/pip install -r backend/requirements-datahub.txt
#   - At least one run of backend/datahub_ingest.py to populate DataHub with
#     the fake scenario (only needed once, or after wiping DataHub's data)
#
# refresh.py's maturity-level history defaults to a fabricated demo history
# (MATURITY_HISTORY_MODE=synthetic) -- set MATURITY_HISTORY_MODE=accumulate
# instead (this script doesn't clear the environment, so it's inherited) to
# get real accumulated history when pointed at a real company DataHub. See
# README's "Real history at the company" section -- that mode needs its own
# recurring schedule, not just this script.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT="idg-deploy"
COMPOSE="docker compose -p $PROJECT -f docker-compose.deploy.yml"
MONGO_PORT="${DEPLOY_MONGO_PORT:-27018}"
VENV="backend/.venv-datahub/bin/python3"

$COMPOSE up -d mongo
echo "Waiting for mongo..."
until docker exec "${PROJECT}-mongo-1" mongosh --quiet --eval "db.runCommand('ping')" > /dev/null 2>&1; do
  sleep 1
done

if [ -x "$VENV" ]; then
  echo
  echo "Refreshing data from DataHub..."
  (cd backend && MONGO_URL="mongodb://localhost:${MONGO_PORT}" MONGO_DB="idg_dashboard" \
    ".venv-datahub/bin/python3" refresh.py)
else
  echo
  echo "WARNING: backend/.venv-datahub not found — skipping DataHub refresh."
  echo "         Mongo will be empty until you set it up (see this script's header) and re-run."
fi

$COMPOSE up -d --build

echo
echo "Deployed. Waiting for containers to report healthy..."
sleep 3
$COMPOSE ps

PORT="${FRONTEND_PORT:-8081}"
echo
echo "Dashboard: http://localhost:${PORT}"
echo "Logs:      $COMPOSE logs -f"
echo "Stop:      $COMPOSE down"
