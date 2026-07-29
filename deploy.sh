#!/usr/bin/env bash
# One-command on-prem deploy: builds and runs mongo + backend + frontend as
# containers. Re-run any time (e.g. after `git pull`) to rebuild and restart
# with the latest code — it's idempotent.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT="idg-deploy"
COMPOSE="docker compose -p $PROJECT -f docker-compose.deploy.yml"

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
