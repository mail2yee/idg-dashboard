"""
Integration-test fixtures. Real HTTP request/response cycles through the
actual FastAPI app (via httpx's ASGI transport, no mocking), against a real
-- but separate -- Mongo database, seeded once per test session with the
same deterministic seed.py already used for local dev/demo data.

Critical ordering constraint: app/db.py builds its Motor client from
MONGO_URL/MONGO_DB env vars at *import* time, and every router does
`from app.db import db` -- there's no FastAPI dependency-injection point to
swap the database after the fact. So the env vars below MUST be set before
anything under `app` (or seed.py, which reads the same env vars the same
way) is imported for the first time. That's why this happens at module
level, before the `from app.main import app` / `import seed` lines below,
rather than inside a fixture function.
"""

import os
import sys
from pathlib import Path

# Make `backend/` importable regardless of how pytest is invoked (bare
# `pytest` vs `python -m pytest`, or from a different cwd) -- both `import
# seed` and `from app.main import app` need backend/ on sys.path, and
# pytest's own import-mode path insertion only guarantees backend/tests/,
# not its parent.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["MONGO_URL"] = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
os.environ["MONGO_DB"] = "idg_dashboard_test"

import asyncio

import httpx
import pytest
import pytest_asyncio
from pymongo import MongoClient

import seed
from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop, overriding pytest-asyncio's function
    -scoped default. app/db.py's Motor client is a single process-global
    (`client = AsyncIOMotorClient(...)`, built once at import time) -- if
    every test function got its own event loop (the default), the client's
    connections would be torn down and reused across a since-closed loop
    the moment a second test ran, raising "Event loop is closed". Since
    the whole app's DB layer is one global client for its entire lifetime
    by design, tests need one shared loop to match, not a fresh one per
    test."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def seeded_db():
    """Seeds idg_dashboard_test once for the whole test session -- every
    endpoint in scope is read-only (GETs, plus a read-only POST /agent/query),
    so a single shared seed is correct and keeps the suite fast. Drops the
    test database afterward so re-runs always start from the same
    deterministic state seed.py produces (it also drops+recreates every
    collection itself on each call, so this is belt-and-suspenders)."""
    seed.main()
    yield
    MongoClient(os.environ["MONGO_URL"]).drop_database(os.environ["MONGO_DB"])


@pytest_asyncio.fixture(scope="session")
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c


@pytest.fixture(scope="session")
def ollama_reachable() -> bool:
    """Gates the one LLM-dependent test (POST /agent/chat's phrasing pass)
    -- everything else in this suite is fully self-contained and needs no
    external service."""
    try:
        resp = httpx.get("http://localhost:11434/api/tags", timeout=2)
        return resp.status_code == 200
    except Exception:
        return False
