"""
Fixtures for the deepeval-based, LLM-judged golden-set suite. Scoped to
this directory only (tests/eval/) so the fast integration suite in
tests/ never needs deepeval installed -- see requirements-eval.txt.

Telemetry opt-out env vars must be set before anything imports deepeval
(same ordering constraint as the parent tests/conftest.py's MONGO_URL/
MONGO_DB, just for a different module), and pytest.importorskip must run
before that import too -- when raised during a conftest.py's own
collection, pytest skips this whole subtree gracefully instead of failing
collection for everyone who hasn't installed requirements-eval.txt.
"""

import os

os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "1")
os.environ.setdefault("DEEPEVAL_DISABLE_DOTENV", "1")
os.environ.setdefault("DEEPEVAL_UPDATE_WARNING_OPT_IN", "0")

# deepeval's default per-attempt provider-call timeout (derived from an 180s
# outer budget split across retry attempts -- works out to ~88s/attempt) is
# tuned for hosted API judges. A local 14B model doing schema-constrained
# generation on this hardware routinely takes longer than that per call
# (confirmed empirically -- 88.5s timeouts firing on calls that would have
# succeeded given more room), so raise it well above what a single local
# judge call actually needs rather than let real completions get killed and
# retried.
os.environ.setdefault("DEEPEVAL_PER_ATTEMPT_TIMEOUT_SECONDS_OVERRIDE", "300")

import pytest

pytest.importorskip("deepeval")

from deepeval.models import OllamaModel

JUDGE_MODEL_NAME = os.environ.get("DEEPEVAL_JUDGE_MODEL", "qwen3:14b")
JUDGE_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")


@pytest.fixture(scope="session")
def judge_model(ollama_reachable):
    if not ollama_reachable:
        pytest.skip("Ollama not reachable -- skipping deepeval judge-based tests")
    return OllamaModel(model=JUDGE_MODEL_NAME, base_url=JUDGE_BASE_URL, temperature=0)
