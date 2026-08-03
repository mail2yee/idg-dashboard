# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repo. See `README.md`
for setup/install/architecture — this file is conventions and gotchas that
aren't obvious from reading the code once.

## Standing rules

- **Never commit or push without explicit user confirmation.** Ask each
  time, even if a similar action was approved earlier in the session.
- **After any backend change, redeploy via `./deploy.sh` and verify against
  the actual running container** (curl the real endpoint, or check the
  dashboard in a browser at `http://localhost:8081`) — not just the dev
  server. The dev server and the deployed container run from different
  builds and can drift (this has caused real confusion: a fix verified only
  against the dev server looked "not fixed" on the deployed dashboard).
- When checking a fix in a browser, **watch for stale cache** — a hard
  reload or a fresh tab is sometimes needed to see a genuinely-deployed
  change, since a plain reload can silently serve a cached bundle.

## Visual conventions

- **MUI icons only. Never emoji, anywhere** — not in React components, not
  in ECharts canvas labels/annotations, not in plain SSE/text strings sent
  to the frontend. This machine's OS lacks a color-emoji font, so any emoji
  renders as a broken/blank glyph. This has bitten multiple surfaces in this
  project (chart quadrant labels, agent chat `step` event text) — check all
  three categories (JSX, chart labels, raw strings), not just UI components.
- Follow the `dataviz` skill's conventions for any chart work (categorical
  color order, legend spacing, hairline gridlines, the six-check palette
  validator, etc.) — don't freehand chart styling.
- **Maturity Level display convention**: a single entity's Maturity Level
  keeps the `L` prefix (`L3`, `L4.2` is meaningless — it's a discrete,
  CMMI-style rung). An **averaged/aggregate** value across multiple entities
  (a domain's average across its subjects, an org-wide average) must
  **never** carry the `L` prefix — show it as a plain score ("分數 2.43"),
  since mixing a discrete-ladder prefix with a continuous averaged number
  reads as a bug even when the math is correct.

## Data model

- **DataHub is the real source of current-state metadata**, not
  Faker-generated fake data, when running via `./deploy.sh` /
  `refresh.py`. `seed.py` (plain Faker → Mongo) is a separate, simpler path
  used only for local dev hot-reload and the fast pytest suite's seed
  fixture — the two paths are not meant to be mixed in one Mongo database.
- `backend/datahub_ingest.py` → `backend/datahub_sync.py` →
  `backend/refresh.py` is the pipeline: ingest pushes a synthetic scenario
  into DataHub (swap point for real company metadata), sync reads current
  state back via GraphQL into Mongo (wholesale replace per collection),
  refresh also recomputes the derived weekly maturity-level history on top.
  Entity URNs in `datahub_ingest.py` must stay **deterministic** (`uuid5`
  derived from the dataset URN, not `uuid4()`) — a non-deterministic re-run
  would make DataHub treat previously-ingested entities as removed
  (soft-delete), and DataHub's built-in daily GC job permanently purges
  soft-deleted entities after 10 days. See README's "Known constraints" for
  the recovery procedure if this happens (dashboard shows 0 domains/subjects
  despite every container being healthy).
- `usage_stats` is the one collection `refresh.py` **accumulates** into
  (upsert keyed by subject + day) rather than wholesale-replacing, because
  the target DataHub instance has no timeseries retention and only ever
  reports "today." `backend/seed_usage_history.py` is a separate, optional,
  `$setOnInsert`-only backfill tool for previewing "lots of history" states
  — it never overwrites real accumulated days.
- `maturity_snapshots`/`org_quality_index_snapshots` have the **same**
  no-real-history problem as `usage_stats`, and `refresh.py` handles it via
  a switch: `MATURITY_HISTORY_MODE` env var, default `"synthetic"` (deletes
  and fabricates a fresh fake 52-week backward walk every run, ending at
  today's real score — fine for the self-contained demo, not real history),
  or `"accumulate"` (upserts exactly one real dated snapshot per subject/
  domain/global per run, keyed by date, never touching prior weeks — same
  principle as `usage_stats`). The accumulate-mode code lives entirely in
  `refresh.py` (`build_current_maturity_snapshot`,
  `upsert_accumulated_org_snapshot`) — `seed.py`'s
  `build_maturity_snapshots`/`build_org_snapshots` are untouched and stay
  the synthetic path only. **Gotcha already hit once**: `seed.week_start()`
  returns a tz-aware datetime, but pymongo always reads datetimes back
  naive — comparing the two with `!=` is silently *always* true in Python,
  so any new code that reads `snapshot_date` back from Mongo to compare
  against a freshly-computed `week_start(...)` must strip tzinfo first
  (`.replace(tzinfo=None)`) or the comparison will never match.
- Maturity scoring is config-driven: `backend/config/maturity_dimensions.json`
  (not hardcoded in `scoring.py`) — add a dimension there and every chart/
  badge/axis adapts automatically.

## AI agent architecture (`backend/app/agent/`)

- `ollama_client.py` — `classify_intent()` (single-shot structured-output
  classification, used by `/agent/query` only) and `call_with_tools()` +
  `TOOL_DEFS` (native Ollama tool-calling, used by `/agent/chat`'s loop).
  Both are independent contracts; don't conflate them.
- `llm_client.py` — `stream_chat_completion()`, the OpenAI-compatible
  streaming call used only for the final natural-language phrasing pass
  (qwen3:14b — chosen over qwen2.5 specifically because it doesn't mix in
  simplified Chinese characters).
- `intents.py` — the whitelisted `run_*` query functions (the model **never**
  writes its own database query, only picks a tool name + typed params from
  a fixed enum/schema), `TOOL_HANDLERS` mapping for the tool-calling loop,
  the in-memory exact-match `_plan_cache` (question string → tool-call plan;
  never caches answer data, only which tools to call — each cache hit still
  re-executes the tools live), and `_reply_is_grounded()` (mechanical
  anti-hallucination check: every number in a phrased reply must trace back
  to the real queried data within a small tolerance).
- `/agent/query` (single-shot) and `/agent/chat` (bounded multi-round
  tool-calling loop, `MAX_TOOL_ROUNDS = 4`) are separate code paths by
  design — `/agent/query` doesn't need the loop's complexity, and the loop
  doesn't replace the simpler single-shot classifier.

## Testing

- `backend/tests/` — fast integration suite (real HTTP via
  `httpx.ASGITransport`, real Mongo in a separate `idg_dashboard_test`
  database, real Ollama where reachable). Default `pytest` run, `backend/.venv`.
  Env vars (`MONGO_URL`/`MONGO_DB`) must be set in `conftest.py` **before**
  `app.main`/`seed` are imported — `app/db.py`'s Motor client is a
  module-level global built at import time.
- `backend/tests/eval/` — deepeval-based, LLM-judged golden-set suite.
  **Opt-in only** (`pytest.ini`'s `addopts = -m "not eval"`), needs its own
  `backend/.venv-eval` (deepeval requires a newer pydantic than the app's
  pinned version — keep it out of the main venv). Judged by a **local**
  Ollama model (`deepeval.models.OllamaModel`), never an external API/key.
  `ToolCorrectnessMetric` is the real ground-truth layer (deterministic,
  compares actual `tools_called` against a hand-authored expected list) —
  `FaithfulnessMetric` is a secondary, LLM-judged layer on top and can have
  false positives/negatives from the local judge model itself; don't treat
  a faithfulness failure as automatically a real bug without checking the
  underlying data by hand first.
- Each case in the eval suite takes several minutes (real local LLM
  inference, twice — once for the agent, at least once for the judge).
  Long-running background shells in this environment have been observed to
  get killed around the 20-25 minute mark regardless of scheduled wakeup
  timing — prefer chaining foreground `Bash` calls (or `TaskOutput` with
  `block: true`) within one turn over `run_in_background` +
  `ScheduleWakeup` for anything that needs to survive that long.
