# IDG Data Quality Dashboard — Prototype

DataHub-sourced data-quality / governance dashboard. Fake data for now — see
`backend/seed.py`.

## Stack

- **MongoDB** — Docker container
- **Backend** — Python FastAPI (`backend/`), talks to Mongo via `motor`
- **Frontend** — Vite + React + TypeScript + MUI + ECharts (`frontend/`)
- **AI agent** — rule-based intent stub behind a whitelisted-query contract
  (`backend/app/agent/intents.py`), designed to be swapped for the real
  internal Gemma API later without touching anything else
- **Maturity scoring** — config-driven, not hardcoded: the dimensions that
  sum into a subject's maturity score live in
  `backend/config/maturity_dimensions.json` (key, label, weight, scoring
  rule, responsible role). Add a dimension there and restart the backend —
  every chart, badge, and axis adapts automatically. See
  `backend/app/scoring.py`.

## Deploy (on-prem, one command)

```bash
./deploy.sh
```

Builds and runs mongo + backend + frontend as containers
(`docker-compose.deploy.yml`), backend re-seeds fake data on every start.
Opens on **http://localhost:8081** (override with `FRONTEND_PORT=xxxx
./deploy.sh`).

- Logs: `docker compose -p idg-deploy -f docker-compose.deploy.yml logs -f`
- Stop: `docker compose -p idg-deploy -f docker-compose.deploy.yml down`
- Re-run `./deploy.sh` any time (e.g. after `git pull`) to rebuild with the
  latest code — it's idempotent.

## Local dev (hot reload)

```bash
# 1. Mongo only
docker compose up -d

# 2. Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python seed.py                 # populate fake data (safe to re-run, drops & recreates)
uvicorn app.main:app --reload --port 8010

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                    # http://localhost:5173, proxies /api -> :8010
```

Open **http://localhost:5173**.

## What's there

- **Overview** — headline Data Quality Index (WoW delta + 8-week sparkline),
  maturity distribution (clickable to filter), domain ranking (clickable to
  filter), Leaderboard (badge tiers for domains/owner-teams/subjects in
  stable non-ranked order, weekly/monthly champion cards, positive-only
  "most improved" spotlights), data subject table
- **週 / 月變化 (Trends)** — WoW/MoM sortable table by domain or subject,
  with 8-week sparklines; click a row to drill into detail
- **KPI 拆解** — heatmap of every dimension × every domain/subject, plus
  org-wide per-dimension averages, so you can compare one KPI (e.g.
  Alerting) across the whole org at once
- **Ownership model** — each subject has a Data Owner / Data Steward / IT
  Owner (name + team). Individual names only ever appear in that one
  subject's detail drawer; the public Leaderboard aggregates by the Data
  Owner's team, never by individual, to avoid publicly naming anyone's
  under-performing data. Each of the 5 KPI dimensions is tagged with which
  role is responsible for it.
- **AI agent panel** (bottom-right FAB): ask e.g. "目前 data maturity 最高的
  三個部門?" — the answer also highlights the relevant chart. Rule-based
  stub for now.
- Light/dark mode toggle (top-right), following the `dataviz` skill's
  validated palette in both modes

## Known constraints of this pass

- AI agent is a keyword-matching stub, not the real Gemma API — swap point is
  `backend/app/agent/intents.py::classify_and_run`
- No auth
- `docker-compose.deploy.yml` re-seeds fake data on every container start —
  fine for a demo dataset with no real user writes, but not what you'd want
  once this points at real DataHub data
