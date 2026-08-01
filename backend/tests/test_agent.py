import pytest

from app.agent.intents import _extract_numbers, _reply_is_grounded, run_subject_detail

# classify_and_run() always tries the on-prem Ollama classifier first and
# only falls back to keyword rules if Ollama is unreachable or returns
# "unknown" -- but the *content* of answer_text/data comes from the same
# whitelisted Python query functions either way, so for an unambiguous
# question both paths dispatch to the same function with the same params.
# The four questions below were traced by hand through
# `_classify_and_run_keywords` (app/agent/intents.py) to confirm the
# keyword fallback alone gets them right, so these tests hold regardless of
# whether Ollama happens to be running on the machine executing the suite.
#
# top_n_by_delta / stagnant_domains have NO keyword-fallback branch at all
# (see intents.py's own comment: "LLM-only") -- those two are only tested
# in the Ollama-gated section below.

KNOWN_DOMAINS = {"Sales", "Finance", "Marketing", "Product", "Risk", "Platform"}


async def test_agent_query_top_n_by_maturity(client):
    resp = await client.post("/agent/query", json={"question": "maturity 最高的三個 Domain"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["chart_directive"]["type"] == "highlight_domains"
    assert len(body["chart_directive"]["domains"]) == 3
    assert set(body["chart_directive"]["domains"]) <= KNOWN_DOMAINS
    assert len(body["data"]) == 3
    assert "分數" in body["answer_text"]


async def test_agent_query_trend_over_time(client):
    resp = await client.post("/agent/query", json={"question": "全公司過去的 maturity 趨勢"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["chart_directive"] == {"type": "show_trend", "domain": None}
    assert "全公司" in body["answer_text"]
    assert len(body["data"]) == 52  # a full year of weekly GLOBAL snapshots


async def test_agent_query_unrecognized_falls_back_to_canned_reply(client):
    # Ollama itself is expected to classify a greeting as "unknown" (it's
    # explicitly not one of the 6 whitelisted intents), and classify_and_run
    # never dispatches on "unknown" -- so this always reaches the keyword
    # classifier's final fallback, regardless of whether Ollama is running.
    resp = await client.post("/agent/query", json={"question": "你好"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["chart_directive"] is None
    assert body["data"] is None
    assert "maturity 最高的三個 Domain" in body["answer_text"]


async def test_agent_query_response_shape(client):
    resp = await client.post("/agent/query", json={"question": "隨便問一句話測試 shape"})
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"answer_text", "chart_directive", "data"}
    assert isinstance(body["answer_text"], str) and body["answer_text"]


async def test_agent_query_llm_only_intents(client, ollama_reachable):
    if not ollama_reachable:
        _skip_if_no_llm()

    resp = await client.post("/agent/query", json={"question": "本週進步最多的三個 Domain"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["chart_directive"]["type"] == "highlight_domains"
    assert len(body["chart_directive"]["domains"]) == 3

    resp2 = await client.post("/agent/query", json={"question": "連續兩個月都沒有進步的 Domain"})
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["chart_directive"]["type"] == "highlight_domains"
    assert "months" in body2["data"]


async def test_agent_chat_sse_stream(client, ollama_reachable):
    if not ollama_reachable:
        _skip_if_no_llm()

    resp = await client.post("/agent/chat", json={"question": "maturity 最高的三個 Domain"})
    assert resp.status_code == 200
    text = resp.text
    assert '"type": "step"' in text
    assert '"type": "final"' in text
    assert '"reply"' in text


def _skip_if_no_llm():
    pytest.skip("Ollama not reachable at localhost:11434 -- skipping LLM-dependent test")


# --- Governance intents: LLM-only (no keyword-fallback branch), same
# rationale as top_n_by_delta/stagnant_domains above. Questions are phrased
# close to ollama_client.SYSTEM_PROMPT's own examples for each intent, to
# maximize correct classification. -----------------------------------------

async def test_agent_query_risk_priority(client, ollama_reachable):
    if not ollama_reachable:
        _skip_if_no_llm()
    resp = await client.post("/agent/query", json={"question": "風險最高的資料集是哪些?"})
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["data"], list)
    if body["data"]:
        assert body["chart_directive"]["type"] == "highlight_subjects"


async def test_agent_query_ownership_coverage(client, ollama_reachable):
    if not ollama_reachable:
        _skip_if_no_llm()
    resp = await client.post("/agent/query", json={"question": "Ownership 覆蓋率多少?"})
    assert resp.status_code == 200
    body = resp.json()
    assert "coverage_pct" in body["data"]
    assert "%" in body["answer_text"]


async def test_agent_query_stewardship(client, ollama_reachable):
    if not ollama_reachable:
        _skip_if_no_llm()
    resp = await client.post("/agent/query", json={"question": "哪個 team 逾期最多?"})
    assert resp.status_code == 200
    body = resp.json()
    assert "teams" in body["data"]


async def test_agent_query_lineage_coverage(client, ollama_reachable):
    if not ollama_reachable:
        _skip_if_no_llm()
    resp = await client.post("/agent/query", json={"question": "哪些資料集沒有 lineage?"})
    assert resp.status_code == 200
    body = resp.json()
    assert "coverage_pct" in body["data"]
    assert "islands" in body["data"]


async def test_agent_query_subject_growth(client, ollama_reachable):
    if not ollama_reachable:
        _skip_if_no_llm()
    resp = await client.post("/agent/query", json={"question": "最近有沒有異常成長的 domain?"})
    assert resp.status_code == 200
    body = resp.json()
    assert "flagged_domains" in body["data"]


# --- run_subject_detail disambiguation: tested by calling the function
# directly (no Ollama/HTTP dependency, always runs) -- "raw" is confirmed
# empirically to match multiple subjects against seed.py's fixed seed=42
# (7 subjects with the "raw_" prefix), unambiguous enough to test the
# disambiguation *mechanism* without depending on the LLM to interpret a
# single word as a subject-lookup question. -----------------------------

async def test_subject_detail_disambiguates_multiple_matches():
    result = await run_subject_detail("raw")
    assert result["chart_directive"] is None
    assert result["data"] is None
    assert "不確定" in result["answer_text"]


async def test_subject_detail_not_found():
    result = await run_subject_detail("this-hint-matches-nothing-xyz")
    assert result["chart_directive"] is None
    assert result["data"] is None
    assert "找不到" in result["answer_text"]


# --- Grounding check: pure logic, no DB/LLM needed, always runs. ----------

def test_extract_numbers_from_scalar():
    assert 42.0 in _extract_numbers(42)
    assert 2.43 in _extract_numbers(2.43)


def test_extract_numbers_ignores_bool():
    # bool is a subclass of int in Python -- explicitly excluded so a
    # stray True/False in the data doesn't get treated as the number 1/0.
    assert _extract_numbers(True) == set()
    assert _extract_numbers(False) == set()


def test_extract_numbers_from_string():
    numbers = _extract_numbers("Finance 的風險分數是 66276,累積查詢 15356 次")
    assert 66276.0 in numbers
    assert 15356.0 in numbers


def test_extract_numbers_from_list_counts_length():
    numbers = _extract_numbers([{"a": 1}, {"a": 2}, {"a": 3}])
    assert 3 in numbers  # the list's own length, a legitimate derived count


def test_reply_is_grounded_true_when_numbers_match():
    data = {"domain": "Finance", "avg_maturity_level": 2.43, "subject_count": 7}
    reply = "Finance 目前平均分數是 2.4,共有 7 個 data subject。"
    assert _reply_is_grounded(reply, data) is True


def test_reply_is_grounded_false_when_number_is_fabricated():
    data = {"domain": "Finance", "avg_maturity_level": 2.43, "subject_count": 7}
    reply = "Finance 目前平均分數是 9.9,共有 7 個 data subject。"
    assert _reply_is_grounded(reply, data) is False


def test_reply_is_grounded_true_when_reply_has_no_numbers():
    assert _reply_is_grounded("這是一段完全沒有數字的回覆。", {"anything": 123}) is True
