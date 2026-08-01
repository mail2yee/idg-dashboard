import pytest

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
