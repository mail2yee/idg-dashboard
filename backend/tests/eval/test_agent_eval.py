"""
LLM-judged evaluation suite (deepeval) for /agent/chat, separate from the
fast deterministic integration suite in tests/. Opt-in only -- see
pytest.ini's `-m "not eval"` default addopts -- run explicitly via:

    backend/.venv-eval/bin/pytest -m eval -v

Two layers of grading here, matching what "real ground truth" means for an
agent like this one:

  - ToolCorrectnessMetric: fully deterministic, no LLM judge involved --
    compares the *actual* tools stream_agent_reply called (the
    `tools_called` field on the SSE `final` event) against each golden
    case's hand-authored `expected_tools`. This is the real ground-truth
    layer: a fixed, known-correct answer, not a fuzzy judgment call.
  - FaithfulnessMetric: LLM-judged (local Ollama via the `judge_model`
    fixture) -- checks the phrased natural-language reply doesn't state
    anything unsupported by the actual queried data. A second, independent
    check on top of the existing hand-rolled `_reply_is_grounded()`
    number-matching heuristic in app/agent/intents.py -- a judge model can
    catch subtler unsupported claims (wrong attribution, mischaracterized
    trend direction) that pure number-matching can't.
"""

import json
from dataclasses import dataclass, field

import pytest
from deepeval.metrics import FaithfulnessMetric, ToolCorrectnessMetric
from deepeval.test_case import LLMTestCase, ToolCall


@dataclass
class GoldenCase:
    id: str  # ASCII, stable across runs -- Chinese question text as a pytest
    # node id is fragile to select individually from a shell (encoding/
    # quoting issues with -k and exact nodeid matching both observed
    # empirically), so this is what parametrize's `ids=` uses instead.
    question: str
    expected_tools: list = field(default_factory=list)
    category: str = "single_tool"  # "single_tool" | "multi_tool" | "off_topic"


# Covers all 11 whitelisted tools individually, 2 genuine multi-tool
# chains (no single existing intent covers either combination), and 1
# off-topic case with no tool expected. subject_detail's question uses a
# generic table-name-shaped hint (matches the dim_/raw_/agg_/stg_/fact_
# naming convention Faker produces in seed.py) -- which specific subject it
# resolves to doesn't matter for tool-selection grading.
GOLDEN_SET = [
    GoldenCase("top_n_by_maturity", "maturity 最高的三個 Domain 是哪些?", ["top_n_by_maturity"]),
    GoldenCase("top_n_by_delta", "本週進步最多的三個 Domain 是哪些?", ["top_n_by_delta"]),
    GoldenCase("stagnant_domains", "連續兩個月都沒有進步的 Domain 有哪些?", ["stagnant_domains"]),
    GoldenCase("domain_ranking", "列出所有 Domain 依 maturity 排名", ["domain_ranking"]),
    GoldenCase("subject_detail", "幫我查一下 dim_food 這個資料集的詳細資訊", ["subject_detail"]),
    GoldenCase("trend_over_time", "全公司過去的 maturity 趨勢如何?", ["trend_over_time"]),
    GoldenCase("risk_priority", "風險最高的資料集是哪些?", ["risk_priority"]),
    GoldenCase("ownership_coverage", "Ownership 覆蓋率多少?", ["ownership_coverage"]),
    GoldenCase("stewardship", "哪個 team 逾期最多?", ["stewardship"]),
    GoldenCase("lineage_coverage", "哪些資料集完全沒有 lineage 記錄?", ["lineage_coverage"]),
    GoldenCase("subject_growth", "最近有沒有異常成長的 Domain?", ["subject_growth"]),
    GoldenCase(
        "multi_risk_lineage",
        "風險最高的資料集是哪些?另外哪些資料集完全沒有 lineage 記錄?",
        ["risk_priority", "lineage_coverage"],
        category="multi_tool",
    ),
    GoldenCase(
        "multi_delta_ownership",
        "本週進步最多的 Domain 是哪個?目前 Ownership 覆蓋率又是多少?",
        ["top_n_by_delta", "ownership_coverage"],
        category="multi_tool",
    ),
    GoldenCase("off_topic_greeting", "你好,今天天氣真好", [], category="off_topic"),
]


async def _run_agent_chat(client, question: str) -> dict:
    resp = await client.post("/agent/chat", json={"question": question})
    assert resp.status_code == 200
    final = None
    for line in resp.text.splitlines():
        if not line.startswith("data: "):
            continue
        evt = json.loads(line[len("data: "):])
        if evt.get("type") == "final":
            final = evt
    assert final is not None, f"no final SSE event received for: {question!r}"
    return final


@pytest.mark.eval
@pytest.mark.parametrize("case", GOLDEN_SET, ids=[c.id for c in GOLDEN_SET])
async def test_agent_chat_golden_set(client, ollama_reachable, judge_model, case):
    if not ollama_reachable:
        pytest.skip("Ollama not reachable -- skipping deepeval golden-set eval")

    final = await _run_agent_chat(client, case.question)
    tools_called = final.get("tools_called") or []
    reply = final.get("reply", "")
    data = final.get("data")

    test_case = LLMTestCase(
        input=case.question,
        actual_output=reply,
        tools_called=[ToolCall(name=t) for t in tools_called],
        expected_tools=[ToolCall(name=t) for t in case.expected_tools],
        retrieval_context=[json.dumps(data, ensure_ascii=False, default=str)] if data else None,
    )

    # ToolCorrectnessMetric's own comparison logic is deterministic (no LLM
    # call happens inside measure()), but deepeval's BaseMetric.__init__
    # always initializes *a* judge model regardless -- passing judge_model
    # here just keeps that instantiation local instead of silently
    # defaulting to OpenAI's GPTModel (which would fail without
    # OPENAI_API_KEY, exactly the external dependency this suite is
    # supposed to avoid).
    tool_metric = ToolCorrectnessMetric(threshold=1.0, model=judge_model)
    await tool_metric.a_measure(test_case)
    assert tool_metric.is_successful(), (
        f"tool selection mismatch for {case.question!r}: "
        f"called={tools_called} expected={case.expected_tools} -- {tool_metric.reason}"
    )

    if case.expected_tools:
        faithfulness_metric = FaithfulnessMetric(threshold=0.7, model=judge_model)
        await faithfulness_metric.a_measure(test_case)
        assert faithfulness_metric.is_successful(), (
            f"unfaithful reply for {case.question!r} (score={faithfulness_metric.score}): "
            f"{faithfulness_metric.reason}\nreply={reply!r}"
        )
