# IDG Data Quality Dashboard

DataHub-metadata-driven data governance dashboard. Current-state metadata
(datasets, schemas, lineage, ownership, incidents, usage, assertions) is
synced from a real DataHub instance; a derived weekly maturity-level history
is computed and stored on top of that in MongoDB. An on-prem LLM (via Ollama)
powers an AI agent panel that answers governance questions against a
whitelisted set of real queries — it never writes its own database query or
sees anything the whitelisted tools didn't return.

## Stack

- **MongoDB** — Docker container; holds synced current-state metadata plus
  the derived maturity-level history
- **Backend** — Python FastAPI (`backend/`), talks to Mongo via `motor`
- **Frontend** — Vite + React + TypeScript + MUI + ECharts (`frontend/`)
- **DataHub integration** — `backend/datahub_ingest.py` (pushes a synthetic
  scenario into a real DataHub instance — swap this step for your own
  ingestion recipes to point at real company metadata instead),
  `backend/datahub_sync.py` (reads DataHub back into Mongo via GraphQL),
  `backend/refresh.py` (sync + maturity-history recompute — the one command
  `deploy.sh` runs on every deploy)
- **AI agent** (`backend/app/agent/`) — on-prem Ollama models only, never an
  external API:
  - `/agent/query`: single-shot intent classification (`ollama_client.classify_intent`)
    against 11 whitelisted intents, dispatched to hardcoded Mongo queries in
    `intents.py`
  - `/agent/chat`: a bounded native-tool-calling loop (up to 4 rounds) so a
    question needing 2+ whitelisted lookups chained together (e.g. "who
    improved most, and who's their data owner") can be answered without
    hardcoding every combination as its own intent, fronted by an in-memory
    exact-match plan cache. A mechanical grounding check
    (`intents._reply_is_grounded`) verifies every number in the phrased
    reply traces back to real queried data before it's shown to the user.
- **Maturity scoring** — config-driven, not hardcoded: the dimensions that
  sum into a subject's maturity score live in
  `backend/config/maturity_dimensions.json` (key, label, weight, scoring
  rule, responsible role). Add a dimension there and restart the backend —
  every chart, badge, and axis adapts automatically. See
  `backend/app/scoring.py`.

## Company / on-prem installation (fresh environment)

A complete runbook for standing this up on a new machine — e.g. a company
server or a colleague's laptop — from nothing. Everything runs entirely
on-prem: no external API calls, no data leaves the machine, no API keys
needed anywhere in this stack.

### Step 0 — install Docker and Ollama (skip anything already installed)

**Docker:**
- macOS: install **Docker Desktop** from <https://www.docker.com/products/docker-desktop/>,
  or `brew install --cask docker`. Launch it once (it runs as a background
  app/menu-bar icon — Docker isn't "on" until that app is running).
- Linux: install **Docker Engine** — <https://docs.docker.com/engine/install/>
  (follow the instructions for your distro). Add your user to the `docker`
  group so you don't need `sudo` for every command:
  `sudo usermod -aG docker $USER` (log out/in afterward).
- Windows: **Docker Desktop** with WSL2 backend — <https://www.docker.com/products/docker-desktop/>.

Give Docker at least **~12 GB of memory** (Docker Desktop → Settings →
Resources). DataHub's own quickstart stack plus this project's containers
is not lightweight — under-provisioning has caused DataHub's GMS service to
get OOM-killed in practice.

Verify:
```bash
docker run hello-world
```

**Ollama:**
- macOS: `brew install ollama`, or download from <https://ollama.com/download>.
- Linux: `curl -fsSL https://ollama.com/install.sh | sh`
- Windows: installer from <https://ollama.com/download>.

Start it (macOS/Windows: launching the app starts the background service;
Linux: `ollama serve`, or it's already running as a systemd service after
install), then pull the two models this project uses:
```bash
ollama pull qwen2.5:latest   # fast, used for intent classification / tool selection
ollama pull qwen3:14b        # used for the final natural-language phrasing pass (~9 GB, slower to pull)
```

Verify both show up:
```bash
ollama list
```

**Also needed on the host** (not containerized — see why below): **Python 3**
(3.10+) and **Node.js** (18+, only needed if you'll build the frontend
outside Docker, which normally you won't — `deploy.sh` builds it in a
container).

### Step 1 — get a DataHub instance running

If the company already has a shared DataHub instance, skip straight to
**Step 3** and just point `DATAHUB_GMS_URL` at it (see below) — you don't
need your own.

Otherwise, run DataHub's own quickstart on this machine:
```bash
pip install acryl-datahub
datahub docker quickstart
```
(This pulls and starts DataHub's full stack — GMS, MySQL, OpenSearch,
Kafka, its own frontend — as a separate set of containers from this
project's own `docker-compose.deploy.yml`. First run takes a while; it's
downloading several images.)

Verify: <http://localhost:9002> (DataHub's own UI) loads, and:
```bash
curl -s http://localhost:8080/health   # DataHub GMS health check
```

### Step 2 — clone this repo and set up the DataHub tooling venv

```bash
git clone <this repo's URL>
cd idg-dashboard

# Dedicated venv for the ingestion/sync tooling only — kept separate from
# the app's own venv because acryl-datahub is a heavy dependency you don't
# want bloating the FastAPI image that actually serves traffic.
python3 -m venv backend/.venv-datahub
backend/.venv-datahub/bin/pip install -r backend/requirements-datahub.txt
```

### Step 3 — populate DataHub with data

Two options:

- **Demo scenario (synthetic, for trying the dashboard out):**
  ```bash
  cd backend && ../backend/.venv-datahub/bin/python3 datahub_ingest.py && cd ..
  ```
  One-time only (safe to re-run — it upserts the same deterministic
  entities rather than duplicating them). Prints progress per domain and
  ends with `Done. 42 subjects ingested.`
- **Real company metadata:** point this at your company's actual DataHub
  instance instead (see `DATAHUB_GMS_URL` below) and skip `datahub_ingest.py`
  entirely — `datahub_sync.py` just reads whatever domains/datasets/lineage
  already exist there. (You'd still need domains matching this project's
  expected set, or adapt `backend/app/routers/` — this dashboard's scoring
  model assumes a fixed small set of domains, not arbitrary DataHub content.)

Verify DataHub actually has data before moving on:
```bash
curl -s -X POST http://localhost:8080/api/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ search(input: {type: DATASET, query: \"*\", start: 0, count: 0}) { total } }"}'
```
Should report a non-zero `total`.

### Step 4 — deploy

```bash
./deploy.sh
```

This brings up Mongo, syncs current-state metadata from DataHub into it
(via `backend/.venv-datahub` + `refresh.py`), then builds and starts the
backend and frontend containers. Watch for `Deployed. Waiting for
containers to report healthy...` followed by a clean `docker compose ps`
listing all three containers as `Up`.

Open **http://localhost:8081**.

### Re-deploying later (after `git pull` or any code change)

```bash
./deploy.sh
```

Idempotent — safe to re-run any time. Rebuilds the backend/frontend images
and re-syncs from DataHub every time.

### Configuration (only if defaults don't fit)

Override with env vars before running `./deploy.sh`, e.g.
`FRONTEND_PORT=9090 ./deploy.sh`:

| Env var | Default | When to change it |
|---|---|---|
| `FRONTEND_PORT` | `8081` | Port already in use, or multiple deployments on one host |
| `DEPLOY_MONGO_PORT` | `27018` | Port already in use |
| `DATAHUB_GMS_URL` | `http://localhost:8080` | DataHub runs on a different host/port |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama runs on a different host, or you're not on Docker Desktop (Linux's Docker Engine may need the host's real LAN IP instead of `host.docker.internal`) |
| `LLM_BASE_URL` | `http://host.docker.internal:11434/v1` | Same as above (this is Ollama's OpenAI-compatible endpoint, same server, `/v1` suffix) |
| `OLLAMA_MODEL` | `qwen2.5:latest` | Using a different tool-calling-capable local model |
| `LLM_MODEL` | `qwen3:14b` | Using a different local model for phrasing |

### Useful commands

- Logs: `docker compose -p idg-deploy -f docker-compose.deploy.yml logs -f`
- Stop: `docker compose -p idg-deploy -f docker-compose.deploy.yml down`
- Status: `docker compose -p idg-deploy -f docker-compose.deploy.yml ps`

### Troubleshooting

- **Dashboard loads but shows 0 domains / 0 data subjects, everything
  else looks healthy** — DataHub itself has no data (or lost it — see
  "Known constraints" below for why that can happen). Confirm with the
  GraphQL check in Step 3; if `total` is 0, re-run Step 3.
- **DataHub GMS keeps crashing / restarting** — almost always Docker's
  memory allocation (see Step 0). Bump it up and `datahub docker quickstart`
  again, or restart the `datahub-gms` container.
- **Agent chat times out or falls back to the keyword-only reply** —
  Ollama isn't reachable from inside the backend container. Confirm
  `ollama list` works on the host, confirm the backend container can reach
  it: `docker exec idg-deploy-backend-1 curl -s http://host.docker.internal:11434/api/tags`.
  On Linux, `host.docker.internal` may need `OLLAMA_BASE_URL` overridden to
  the host's actual IP instead (see Configuration above).
- **Port already in use** — another process (often a previous, un-stopped
  deploy) is holding `8081`/`27018`. `docker ps` to find it, or override
  the port env vars above.

## Local dev (hot reload)

```bash
# 1. Mongo only
docker compose up -d

# 2. Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Populate Mongo with fake demo data directly (no DataHub needed for this path):
python seed.py                 # safe to re-run, drops & recreates
# ...or sync from a real DataHub instance instead, see "Company / on-prem
# installation" above (backend/.venv-datahub + refresh.py).
uvicorn app.main:app --reload --port 8010

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                    # http://localhost:5173, proxies /api -> :8010
```

Open **http://localhost:5173**.

## Testing

```bash
# Fast integration suite (real HTTP against the FastAPI app, real Mongo,
# separate idg_dashboard_test database — never touches your demo data).
# Also exercises the real Ollama models where reachable, skips gracefully
# where not. Runs in a few minutes.
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-test.txt
.venv/bin/pytest

# LLM-judged golden-set eval suite (deepeval), separate and opt-in — needs
# its own venv (deepeval pulls a newer pydantic than the pinned app version)
# and takes ~5-8 min per question (real agent call + local LLM-as-judge
# grading), so it's excluded from the default `pytest` run.
python3 -m venv backend/.venv-eval
backend/.venv-eval/bin/pip install -r backend/requirements-eval.txt -r backend/requirements-test.txt \
  fastapi "uvicorn[standard]" motor Faker python-dotenv httpx
backend/.venv-eval/bin/pytest -m eval -v
```

## What's there

- **總覽 (Overview)** — headline Data Quality Index (WoW delta + 8-week
  sparkline), maturity distribution (clickable to filter), domain ranking
  (clickable to filter), Leaderboard (badge tiers for domains/owner-teams/
  subjects in stable non-ranked order, weekly/monthly champion cards,
  positive-only "most improved" spotlights), data subject table
- **週 / 月 / 年變化 (Trends)** — WoW/MoM/YoY sortable table by domain or
  subject, with sparklines and a Level-distribution chart (stacked
  composition + per-level trend lines); click a row to drill into detail
- **KPI 拆解** — heatmap of every dimension × every domain/subject, plus
  org-wide per-dimension averages, so you can compare one KPI (e.g.
  Alerting) across the whole org at once
- **治理健康 (Governance Health)** — risk-priority ranking (usage × gap-
  from-max), ownership coverage, stewardship/incident response, lineage
  coverage (with "orphan" datasets that have no lineage at all), and a
  data-subject growth-anomaly check (flags domains where new datasets are
  showing up unusually fast — often a mis-tagging signal)
- **Ownership model** — each subject has a Data Owner / Data Steward / IT
  Owner (name + team). Individual names only ever appear in that one
  subject's detail drawer; the public Leaderboard aggregates by the Data
  Owner's team, never by individual, to avoid publicly naming anyone's
  under-performing data. Each of the 5 KPI dimensions is tagged with which
  role is responsible for it.
- **AI agent panel** (bottom-right FAB) — ask e.g. "目前 data maturity 最高
  的三個 Domain?" or a multi-part question like "本週進步最多的 Domain,以及
  目前 Ownership 覆蓋率多少?"; the answer also highlights the relevant chart.
  See the AI agent bullet under Stack above for how it stays grounded.
- Light/dark mode toggle (top-right), following the `dataviz` skill's
  validated palette in both modes

## Known constraints

- No auth.
- The demo scenario is synthetic (Faker-generated names/domains) pushed into
  DataHub by `datahub_ingest.py` — swap that ingestion step for your own
  recipes to point at real company metadata; nothing else in the pipeline
  needs to change (`datahub_sync.py` just reads whatever's in DataHub).
- **DataHub's built-in daily garbage-collection job** (`datahub-gc`, default
  schedule `0 1 * * *`) purges soft-deleted entities after a 10-day
  retention window. If the ingestion pipeline is ever re-run in a way that
  produces different entity URNs across runs, DataHub will treat the old
  ones as removed, and they'll be permanently purged once that window
  passes — the symptom is the dashboard showing 0 domains/subjects even
  though every container is healthy. Fix: re-run
  `backend/.venv-datahub/bin/python3 datahub_ingest.py` then `./deploy.sh`
  (or `refresh.py` directly) to repopulate.
- `usage_stats` accumulates across repeated `refresh.py` runs (upsert, keyed
  by subject + day) rather than being replaced wholesale like the other
  synced collections — this is intentional, since the target DataHub
  instance has no timeseries retention and only ever reports "today."
