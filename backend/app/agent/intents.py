"""
Whitelisted-intent query engine for the AI agent panel.

`classify_and_run` asks the on-prem Ollama model (see ollama_client.py) to
classify the question into a fixed intent name + typed params -- never an
arbitrary query the model writes itself -- then dispatches to a hardcoded
Mongo query in this file. If Ollama is unreachable or returns "unknown",
it falls back to `_classify_and_run_keywords`, a simple keyword-rule
classifier covering the original four intents. Both paths return the same
response shape ({answer_text, chart_directive, data}).

`stream_agent_reply` (used by the SSE /agent/chat endpoint) wraps
`classify_and_run` with a second on-prem LLM pass (llm_client.py) that
rephrases the deterministic answer_text into a more natural reply,
streamed token by token. That second pass only ever sees the already
-verified `data` from the whitelisted query -- it rephrases, it doesn't
retrieve -- and any failure there falls back to the original
deterministic answer_text, so the user-visible answer is always correct
even when the phrasing model is unreachable.
"""

import json
import re
from typing import AsyncIterator, Optional

from app.agent.llm_client import stream_chat_completion
from app.agent.ollama_client import TOOL_CALLING_SYSTEM_PROMPT, call_with_tools, classify_intent
from app.db import db
from app.routers.governance import (
    governance_lineage_coverage,
    governance_ownership_coverage,
    governance_risk_priority,
    governance_stewardship,
    governance_subject_growth,
)
from app.util import compute_deltas, period_delta, serialize

DOMAIN_KEYWORDS = {
    "sales": "Sales", "銷售": "Sales",
    "finance": "Finance", "財務": "Finance", "財政": "Finance",
    "marketing": "Marketing", "行銷": "Marketing",
    "product": "Product", "產品": "Product",
    "risk": "Risk", "風險": "Risk",
    "platform": "Platform", "平台": "Platform",
}

CN_NUMBERS = {
    "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
}


def _extract_n(question: str, default: int = 3) -> int:
    m = re.search(r"(\d+)", question)
    if m:
        return int(m.group(1))
    for cn, val in CN_NUMBERS.items():
        if cn in question:
            return val
    return default


def _extract_domain(question: str) -> Optional[str]:
    lowered = question.lower()
    for kw, domain in DOMAIN_KEYWORDS.items():
        if kw in lowered:
            return domain
    return None


async def _latest_domain_snapshot_date():
    doc = await db.org_quality_index_snapshots.find_one({"scope_type": "DOMAIN"}, sort=[("snapshot_date", -1)])
    return doc["snapshot_date"] if doc else None


async def run_top_n_by_maturity(n: int = 3, group_by: str = "domain", descending: bool = True):
    order = -1 if descending else 1
    label = "最高" if descending else "最低"

    if group_by == "domain":
        latest_date = await _latest_domain_snapshot_date()
        docs = await db.org_quality_index_snapshots.find(
            {"scope_type": "DOMAIN", "snapshot_date": latest_date}
        ).sort("avg_maturity_level", order).limit(n).to_list(length=None)
        names = [d["domain"] for d in docs]
        answer = f"目前 data maturity {label}的 {n} 個 Domain 是:" + "、".join(
            f"{d['domain']}(分數 {d['avg_maturity_level']:.1f})" for d in docs
        )
        return {
            "answer_text": answer,
            "chart_directive": {"type": "highlight_domains", "domains": names},
            "data": serialize(docs),
        }

    latest_snap_doc = await db.maturity_snapshots.find_one(sort=[("snapshot_date", -1)])
    latest_date = latest_snap_doc["snapshot_date"] if latest_snap_doc else None
    docs = await db.maturity_snapshots.find({"snapshot_date": latest_date}).sort(
        "maturity_level", order
    ).limit(n).to_list(length=None)
    subject_ids = [d["subject_id"] for d in docs]
    subjects = await db.data_subjects.find({"_id": {"$in": subject_ids}}).to_list(length=None)
    subj_by_id = {s["_id"]: s for s in subjects}
    answer_parts = [
        f"{subj_by_id[d['subject_id']]['name']}(L{d['maturity_level']})"
        for d in docs if d["subject_id"] in subj_by_id
    ]
    answer = f"目前 maturity {label}的 {n} 個 data subject 是:" + "、".join(answer_parts)
    return {
        "answer_text": answer,
        "chart_directive": {"type": "highlight_subjects", "subject_ids": [str(i) for i in subject_ids]},
        "data": serialize(docs),
    }


PERIOD_DELTA_FIELD = {"week": "wow_delta", "month": "mom_delta", "year": "yoy_delta"}
PERIOD_LABEL = {"week": "這週", "month": "這個月", "year": "這一年"}


async def run_top_n_by_delta(n: int = 3, period: str = "week", group_by: str = "domain", descending: bool = True):
    """Ranks by *change* over the given period (wow/mom/yoy delta), not by
    absolute level -- this is what distinguishes it from top_n_by_maturity,
    which the old keyword classifier couldn't tell apart from "who improved
    the most"."""
    delta_field = PERIOD_DELTA_FIELD.get(period, "wow_delta")
    order = -1 if descending else 1
    verb = "進步" if descending else "退步"
    period_label = PERIOD_LABEL.get(period, "這週")

    if group_by == "domain":
        latest_date = await _latest_domain_snapshot_date()
        docs = await db.org_quality_index_snapshots.find(
            {"scope_type": "DOMAIN", "snapshot_date": latest_date}
        ).sort(delta_field, order).limit(n).to_list(length=None)
        answer = f"{period_label}{verb}最多的 {n} 個 Domain 是:" + "、".join(
            f"{d['domain']}({d[delta_field]:+.2f})" for d in docs
        )
        return {
            "answer_text": answer,
            "chart_directive": {"type": "highlight_domains", "domains": [d["domain"] for d in docs]},
            "data": serialize(docs),
        }

    subjects = await db.data_subjects.find().to_list(length=None)
    subject_ids = [s["_id"] for s in subjects]
    snaps = await db.maturity_snapshots.find(
        {"subject_id": {"$in": subject_ids}}
    ).sort("snapshot_date", 1).to_list(length=None)
    by_subject: dict = {}
    for sn in snaps:
        by_subject.setdefault(sn["subject_id"], []).append(sn["maturity_level"])

    ranked = []
    for s in subjects:
        levels = by_subject.get(s["_id"])
        if not levels:
            continue
        deltas = compute_deltas(levels)
        ranked.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "domain": s["domain"],
            "maturity_level": levels[-1],
            "delta": period_delta(deltas, period),
        })
    ranked.sort(key=lambda x: x["delta"], reverse=descending)
    top = ranked[:n]
    answer = f"{period_label}{verb}最多的 {n} 個 data subject 是:" + "、".join(
        f"{d['name']}({d['delta']:+.2f})" for d in top
    )
    return {
        "answer_text": answer,
        "chart_directive": {"type": "highlight_subjects", "subject_ids": [d["id"] for d in top]},
        "data": top,
    }


async def run_stagnant_domains(months: int = 2):
    """Domains whose avg_maturity_level did not increase across each of the
    trailing N independent 4-week (month) windows -- checked window by
    window against the weekly series, rather than trusting a single stored
    mom_delta, so "2 consecutive months" actually means both months."""
    weeks_needed = months * 4 + 1
    docs = await db.org_quality_index_snapshots.find({"scope_type": "DOMAIN"}).sort("snapshot_date", 1).to_list(length=None)
    by_domain: dict = {}
    for d in docs:
        by_domain.setdefault(d["domain"], []).append(d["avg_maturity_level"])

    stagnant = []
    for domain, levels in by_domain.items():
        series = levels[-weeks_needed:]
        if len(series) < weeks_needed:
            continue
        if all(series[-1 - i * 4] <= series[-1 - (i + 1) * 4] for i in range(months)):
            stagnant.append(domain)

    if stagnant:
        answer = f"連續 {months} 個月都沒有進步的 Domain 是:" + "、".join(stagnant)
    else:
        answer = f"目前沒有連續 {months} 個月都沒有進步的 Domain。"
    return {
        "answer_text": answer,
        "chart_directive": {"type": "highlight_domains", "domains": stagnant},
        "data": {"domains": stagnant, "months": months},
    }


async def run_domain_ranking():
    latest_date = await _latest_domain_snapshot_date()
    docs = await db.org_quality_index_snapshots.find(
        {"scope_type": "DOMAIN", "snapshot_date": latest_date}
    ).sort("avg_maturity_level", -1).to_list(length=None)
    answer = "各 Domain maturity 排名:" + "、".join(f"{d['domain']}(分數 {d['avg_maturity_level']:.1f})" for d in docs)
    return {
        "answer_text": answer,
        "chart_directive": {"type": "show_domain_ranking"},
        "data": serialize(docs),
    }


async def run_subject_detail(name_hint: str):
    matches = await db.data_subjects.find(
        {"name": {"$regex": re.escape(name_hint), "$options": "i"}}
    ).to_list(length=None)
    if not matches:
        return {
            "answer_text": f"找不到名稱包含「{name_hint}」的 data subject。",
            "chart_directive": None,
            "data": None,
        }
    if len(matches) > 1:
        # Silently picking the first match would mean confidently
        # describing the wrong data subject whenever the hint is generic
        # (e.g. a table-name prefix several subjects share) -- surfacing
        # the ambiguity instead of guessing is the whole point of this
        # disambiguation path.
        names = "、".join(m["name"] for m in matches[:8])
        more = f"等 {len(matches)} 個" if len(matches) > 8 else ""
        answer = f"找到 {len(matches)} 個名稱包含「{name_hint}」的 data subject,不確定您指的是哪一個:{names}{more}。可以提供更完整的名稱嗎?"
        return {"answer_text": answer, "chart_directive": None, "data": None}

    subject = matches[0]
    latest_date_doc = await db.maturity_snapshots.find_one(sort=[("snapshot_date", -1)])
    latest_date = latest_date_doc["snapshot_date"] if latest_date_doc else None
    snapshot = await db.maturity_snapshots.find_one({"subject_id": subject["_id"], "snapshot_date": latest_date})
    level = f"L{snapshot['maturity_level']}" if snapshot else "未知"
    answer = f"{subject['name']}(domain: {subject['domain']})目前 maturity level 為 {level}。"
    return {
        "answer_text": answer,
        "chart_directive": {"type": "open_subject_detail", "subject_id": str(subject["_id"])},
        "data": serialize(subject),
    }


async def run_trend_over_time(domain: Optional[str] = None):
    match = {"scope_type": "DOMAIN" if domain else "GLOBAL"}
    if domain:
        match["domain"] = domain
    docs = await db.org_quality_index_snapshots.find(match).sort("snapshot_date", 1).to_list(length=None)
    scope_label = domain or "全公司"
    answer = f"{scope_label} 過去 {len(docs)} 週的 maturity 趨勢已更新在圖表上。"
    return {
        "answer_text": answer,
        "chart_directive": {"type": "show_trend", "domain": domain},
        "data": serialize(docs),
    }


# The five functions below call governance.py's route handlers directly
# (they're plain async functions with no FastAPI-injected state beyond
# typed params with defaults, so this is exactly equivalent to how FastAPI
# itself would invoke them) rather than re-deriving the same Mongo queries
# a second time here. Those endpoints' logic (risk scoring, coverage-gap
# tracking, growth flagging) is materially more involved than the simpler
# queries the other intents above run inline, so duplicating it would risk
# the two copies silently drifting apart -- calling the already
# pytest-covered (tests/test_governance.py) functions means these intents
# inherit that correctness for free.


async def run_risk_priority(limit: int = 5):
    result = await governance_risk_priority(limit=limit)
    top = result["top_risk"][:limit]
    if not top:
        return {
            "answer_text": "目前使用量資料還在累積中,還不足以計算風險優先排序。",
            "chart_directive": None,
            "data": result,
        }
    answer = f"風險優先排序前 {len(top)} 個資料集是:" + "、".join(
        f"{r['name']}({r['domain']}, 風險分數 {r['risk_score']})" for r in top
    )
    return {
        "answer_text": answer,
        "chart_directive": {"type": "highlight_subjects", "subject_ids": [r["id"] for r in top]},
        "data": top,
    }


async def run_ownership_coverage():
    result = await governance_ownership_coverage()
    answer = (
        f"全公司 Ownership 覆蓋率為 {result['coverage_pct']}%"
        f"({result['fully_covered']}/{result['total_subjects']} 個 data subject 三個角色都已指派)。"
    )
    worst = min(result["by_domain"], key=lambda d: d["coverage_pct"]) if result["by_domain"] else None
    if worst:
        answer += f" 覆蓋率最低的是 {worst['domain']}({worst['coverage_pct']}%)。"
    return {
        "answer_text": answer,
        "chart_directive": {"type": "highlight_domains", "domains": [worst["domain"]]} if worst else None,
        "data": result,
    }


async def run_stewardship():
    result = await governance_stewardship()
    teams = result["teams"]
    if not teams:
        return {"answer_text": "目前沒有 incident 資料可供分析。", "chart_directive": None, "data": result}
    worst = max(teams, key=lambda t: t["overdue_count"])
    answer = f"目前逾期 incident 最多的是 {worst['team']}(逾期 {worst['overdue_count']} 件)。"
    if result["most_responsive_team"]:
        answer += f" 回應最快的是 {result['most_responsive_team']}。"
    return {"answer_text": answer, "chart_directive": None, "data": result}


async def run_lineage_coverage():
    result = await governance_lineage_coverage()
    answer = f"目前 Lineage 覆蓋率為 {result['coverage_pct']}%({result['covered']}/{result['total_subjects']})。"
    islands = result["islands"]
    if islands:
        names = "、".join(i["name"] for i in islands[:5])
        answer += f" 完全沒有 lineage 記錄的孤島有:{names}。"
    return {
        "answer_text": answer,
        "chart_directive": {"type": "highlight_subjects", "subject_ids": [i["id"] for i in islands]} if islands else None,
        "data": result,
    }


async def run_subject_growth():
    result = await governance_subject_growth()
    flagged = result["flagged_domains"]
    if not flagged:
        answer = f"近 {result['window_days']} 天全公司新增了 {result['new_subjects_total']} 個 data subject,沒有 Domain 出現異常暴增。"
        return {"answer_text": answer, "chart_directive": None, "data": result}
    names = "、".join(f"{d['domain']}(+{d['new_count']})" for d in flagged)
    answer = f"近 {result['window_days']} 天有異常成長的 Domain:{names}——建議確認是否為分類問題。"
    return {
        "answer_text": answer,
        "chart_directive": {"type": "highlight_domains", "domains": [d["domain"] for d in flagged]},
        "data": result,
    }


# --- Tool-calling loop support (stream_agent_reply / /agent/chat only).
# /agent/query keeps using _dispatch_llm_intent above, unchanged.


async def _tool_risk_priority(n: int = 5):
    # TOOL_DEFS uses "n" for consistency with every other tool's param
    # naming, but run_risk_priority's own kwarg is "limit" (see
    # _dispatch_llm_intent's equivalent translation above) -- this adapter
    # exists purely to bridge that naming mismatch.
    return await run_risk_priority(limit=n)


TOOL_HANDLERS = {
    "top_n_by_maturity": run_top_n_by_maturity,
    "top_n_by_delta": run_top_n_by_delta,
    "stagnant_domains": run_stagnant_domains,
    "domain_ranking": run_domain_ranking,
    "subject_detail": run_subject_detail,
    "trend_over_time": run_trend_over_time,
    "risk_priority": _tool_risk_priority,
    "ownership_coverage": run_ownership_coverage,
    "stewardship": run_stewardship,
    "lineage_coverage": run_lineage_coverage,
    "subject_growth": run_subject_growth,
}

# Exact-match cache of question -> [{"tool": name, "args": {...}}, ...] plan.
# Deliberately never caches answer data (see module docstring additions
# below) -- a cache hit only skips the tool-selection reasoning, each tool
# is still re-executed live. In-memory and process-global on purpose: it
# resets on every redeploy, which conveniently invalidates it whenever
# TOOL_DEFS/prompts change too.
_plan_cache: dict = {}


async def _run_tool(name: str, args: dict):
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return None
    try:
        return await handler(**args)
    except TypeError:
        return None


async def _dispatch_llm_intent(intent: str, params: dict):
    """Maps an LLM-classified intent to its whitelisted query function. The
    model only ever supplies an intent name (constrained to a fixed enum,
    see ollama_client.RESPONSE_SCHEMA) and typed params -- it never writes
    a query itself. Returns None for "unknown" (or anything unrecognized)
    so the caller can fall back to the keyword classifier."""
    if intent == "top_n_by_maturity":
        return await run_top_n_by_maturity(
            n=params.get("n") or 3,
            group_by=params.get("group_by") or "domain",
            descending=params.get("descending", True),
        )
    if intent == "top_n_by_delta":
        return await run_top_n_by_delta(
            n=params.get("n") or 3,
            period=params.get("period") or "week",
            group_by=params.get("group_by") or "domain",
            descending=params.get("descending", True),
        )
    if intent == "stagnant_domains":
        return await run_stagnant_domains(months=params.get("months") or 2)
    if intent == "domain_ranking":
        return await run_domain_ranking()
    if intent == "subject_detail" and params.get("name_hint"):
        return await run_subject_detail(params["name_hint"])
    if intent == "trend_over_time":
        return await run_trend_over_time(domain=params.get("domain"))
    if intent == "risk_priority":
        return await run_risk_priority(limit=params.get("n") or 5)
    if intent == "ownership_coverage":
        return await run_ownership_coverage()
    if intent == "stewardship":
        return await run_stewardship()
    if intent == "lineage_coverage":
        return await run_lineage_coverage()
    if intent == "subject_growth":
        return await run_subject_growth()
    return None


async def classify_and_run(question: str):
    q = question.strip()

    llm_result = await classify_intent(q)
    if llm_result and llm_result.get("intent") not in (None, "unknown"):
        dispatched = await _dispatch_llm_intent(llm_result["intent"], llm_result.get("params") or {})
        if dispatched is not None:
            return dispatched

    return await _classify_and_run_keywords(q)


async def _classify_and_run_keywords(q: str):
    """Keyword-rule fallback, used when Ollama is unreachable or returns
    "unknown". Only covers the original four intents (top_n_by_maturity,
    domain_ranking, subject_detail, trend_over_time) -- everything added
    since (top_n_by_delta, stagnant_domains, and the five governance
    intents: risk_priority, ownership_coverage, stewardship,
    lineage_coverage, subject_growth) needs real language understanding
    that keyword matching can't do reliably, so those are LLM-only. When
    Ollama is unreachable, a question that would have hit one of those
    just falls through to the generic "here's what I can answer" reply
    below instead."""
    domain = _extract_domain(q)

    is_worst = any(k in q for k in ["最差", "最低", "worst", "bottom", "最少"])
    is_top_n = any(k in q for k in ["最高", "top", "前", "最好", "排名", "ranking"]) or is_worst
    is_trend = any(k in q for k in ["趨勢", "trend", "歷史", "over time", "過去"])
    is_department_scope = any(k in q for k in ["部門", "domain", "department"])
    is_subject_scope = any(k in q for k in ["subject", "資料集", "dataset", "data subject"])

    if is_trend:
        return await run_trend_over_time(domain=domain)

    if is_top_n and is_subject_scope and not is_department_scope:
        n = _extract_n(q)
        return await run_top_n_by_maturity(n=n, group_by="subject", descending=not is_worst)

    if is_top_n:
        # default scope is domain-level — matches the example question from
        # the requirements discussion ("maturity 最高的三個部門")
        n = _extract_n(q)
        return await run_top_n_by_maturity(n=n, group_by="domain", descending=not is_worst)

    if domain:
        return await run_domain_ranking()

    words = re.findall(r"[A-Za-z_]{3,}", q)
    if words:
        return await run_subject_detail(words[-1])

    return {
        "answer_text": (
            "目前是關鍵字規則版的備援回覆(Ollama 可能連不上,或問題超出可回答範圍),"
            "可以試著問:「maturity 最高的三個 Domain?」、「哪個 Domain 排名最後?」、"
            "或「全公司過去的 maturity 趨勢?」"
        ),
        "chart_directive": None,
        "data": None,
    }


def sse_event(event_type: str, **data) -> str:
    return f"data: {json.dumps({'type': event_type, **data}, ensure_ascii=False)}\n\n"


def _build_reply_prompt(question: str, result: dict) -> str:
    grounding = json.dumps(result.get("data"), ensure_ascii=False, default=str)
    return f"""你是 IDG Data Quality Dashboard 的助理。使用者的問題是:「{question}」

系統已經查詢好以下真實資料(JSON,是唯一可信的資料來源):
{grounding}

系統原本產生的簡短答案是:「{result.get('answer_text', '')}」

請用自然、友善的繁體中文,把這個答案重新組織成一到兩句完整的回覆給使用者。規則:
1. 只能使用上面提供的 JSON 資料,絕對不可以捏造任何數字、名稱或未提及的內容。
2. 不要覆述「系統原本產生的簡短答案」這句話本身,直接給出你重新組織後的回覆。
3. 不要使用 Markdown 或項目符號,純文字即可。
"""


def _build_multi_reply_prompt(question: str, tool_results: list) -> str:
    """Like _build_reply_prompt, generalized for a turn that made 1+ tool
    calls -- e.g. "who improved most, and who's their data owner" needs
    top_n_by_delta then subject_detail, so there's no single canonical
    `data`/`answer_text` to ground on, only a sequence of them."""
    grounding = json.dumps(
        [{"tool": r["tool"], "data": r["result"].get("data")} for r in tool_results],
        ensure_ascii=False, default=str,
    )
    canned = "\n".join(r["result"].get("answer_text", "") for r in tool_results)
    return f"""你是 IDG Data Quality Dashboard 的助理。使用者的問題是:「{question}」

系統已經查詢好以下真實資料(JSON,是唯一可信的資料來源):
{grounding}

系統針對這些查詢原本產生的簡短答案:
{canned}

請用自然、友善的繁體中文,把這些答案整合成一段完整的回覆給使用者。規則:
1. 只能使用上面提供的 JSON 資料,絕對不可以捏造任何數字、名稱或未提及的內容。
2. 如果有多筆查詢結果,請把它們組織成連貫的一段話,不要逐條照唸。
3. 不要使用 Markdown 或項目符號,純文字即可。
"""


def _build_fallback_prompt(question: str) -> str:
    """Used when the whitelisted lookup found no data (out-of-scope
    question, greeting, etc.) -- there's nothing to ground a data-grounded
    reply on, but the model can still hold the conversation instead of the
    user seeing a static canned string with no LLM involved at all."""
    return f"""你是 IDG Data Quality Dashboard 的助理,只回答跟本系統的資料治理、maturity level、domain/data subject 相關的問題。

使用者問了:「{question}」

系統判斷這個問題目前不屬於任何已支援的查詢類型(不是查排名、進步幅度、停滯偵測、特定 data subject、歷史趨勢,也不是查風險優先排序、ownership 覆蓋率、stewardship 回應力、lineage 覆蓋率或 data subject 成長異常)。請用自然、友善的繁體中文簡短回覆,說明你能協助的範圍,並舉 1-2 個範例問題(例如「maturity 最高的三個 Domain?」、「本週進步最多的 Domain?」、「風險最高的資料集是哪些?」、「哪個 team 逾期最多?」)。一兩句話就好,不要用 Markdown 或項目符號;如果使用者的問題是打招呼,就自然回應打招呼再帶出範例。
"""


def _extract_numbers(value, _depth: int = 0) -> set:
    """Recursively pulls every number out of a string or a JSON-like
    structure (dict/list/scalar), each rounded a few ways so reasonable
    LLM rounding ("2.4" for a stored 2.43) still counts as a match. A list
    also contributes its own length -- "found 3 results" is a legitimate
    derived count, not a number that has to literally appear in the data.
    Used by _reply_is_grounded() as the mechanical half of the
    anti-hallucination check; _depth just guards against pathological
    recursion, real payloads here are a handful of levels deep at most."""
    numbers = set()
    if _depth > 8:
        return numbers
    if isinstance(value, bool):
        return numbers  # bool is a subclass of int -- explicitly excluded, True/False aren't "numbers" here
    if isinstance(value, (int, float)):
        f = float(value)
        numbers.add(round(f))
        numbers.add(round(f, 1))
        numbers.add(round(f, 2))
    elif isinstance(value, str):
        for m in re.findall(r"-?\d+\.?\d*", value):
            try:
                numbers.add(round(float(m), 2))
            except ValueError:
                pass
    elif isinstance(value, dict):
        for v in value.values():
            numbers |= _extract_numbers(v, _depth + 1)
    elif isinstance(value, (list, tuple)):
        numbers.add(len(value))
        for v in value:
            numbers |= _extract_numbers(v, _depth + 1)
    return numbers


def _reply_is_grounded(reply: str, data) -> bool:
    """Mechanical safety net on top of _build_reply_prompt's "don't
    fabricate" instruction -- extracts every number the LLM's phrased
    reply states and confirms each one traces back (within a small
    tolerance, for rounding) to the grounding data actually handed to it,
    rather than just trusting the model followed instructions. Non-numeric
    claims (names, categories) aren't checked here -- there's no cheap way
    to fact-check free text the way there is for numbers, and the
    grounding JSON being the model's only source of information already
    constrains names reasonably well.

    Known limitation: a fabricated number that happens to coincide with a
    stray digit fragment elsewhere in the data (e.g. part of a serialized
    date string) would pass. This is a heuristic safety net, not a proof --
    it catches the common case (invented statistics) cheaply, it doesn't
    replace the prompt instruction, it backstops it."""
    reply_numbers = _extract_numbers(reply)
    if not reply_numbers:
        return True
    allowed = _extract_numbers(data)
    return all(any(abs(n - a) < 0.06 for a in allowed) for n in reply_numbers)


MAX_TOOL_ROUNDS = 4


async def stream_agent_reply(question: str) -> AsyncIterator[str]:
    """Async generator of SSE strings for the /agent/chat endpoint:
    step -> token* -> final.

    Unlike classify_and_run() (single-shot intent classification, still
    used unchanged by /agent/query), this runs a bounded tool-calling loop
    against the on-prem model so a question that needs *chaining* two or
    more whitelisted lookups (e.g. "who improved most this week, and who's
    their data owner") can actually be answered, rather than requiring
    every such combination to be hardcoded as its own intent. An in-memory
    exact-match cache (_plan_cache) remembers, per literal question string,
    which tools were called last time -- a cache hit skips only the
    tool-selection reasoning; each tool is still re-executed live so the
    data itself is never stale.

    Every tool result is a call into the same whitelisted run_* functions
    intents.py has always used (no arbitrary query is ever LLM-written),
    and the final natural-language phrasing pass is grounded and checked
    exactly as before (_reply_is_grounded) -- any failure (unreachable
    model, ungrounded reply) falls back to the deterministic answer_text(s)
    already computed, so the *persisted* reply is always correct even
    though tokens stream live before that check completes."""
    q = question.strip()
    cached_plan = _plan_cache.get(q)

    tool_results: list = []  # [{"tool", "args", "result"}], successful calls only, in call order
    seen_calls: dict = {}  # (tool, sorted-args-tuple) -> result, for in-request de-dup

    async def execute_call(name: str, args: dict):
        key = (name, tuple(sorted((args or {}).items())))
        if key in seen_calls:
            return seen_calls[key]
        result = await _run_tool(name, args or {})
        seen_calls[key] = result
        if result is not None:
            tool_results.append({"tool": name, "args": args or {}, "result": result})
        return result

    is_legacy_fallback = False

    if cached_plan:
        yield sse_event("step", text="正在查詢資料...")
        for step in cached_plan:
            await execute_call(step["tool"], step.get("args") or {})
    else:
        yield sse_event("step", text="正在查詢資料...")
        messages = [
            {"role": "system", "content": TOOL_CALLING_SYSTEM_PROMPT},
            {"role": "user", "content": q},
        ]
        ollama_unreachable = False
        for round_num in range(MAX_TOOL_ROUNDS):
            message = await call_with_tools(messages)
            if message is None:
                ollama_unreachable = round_num == 0 and not tool_results
                break

            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                break  # model decided it has enough (or nothing to look up)

            messages.append({"role": "assistant", "content": message.get("content") or "", "tool_calls": tool_calls})
            for tc in tool_calls:
                fn = tc.get("function") or {}
                name = fn.get("name")
                raw_args = fn.get("arguments")
                if isinstance(raw_args, str):
                    try:
                        args = json.loads(raw_args)
                    except json.JSONDecodeError:
                        args = {}
                else:
                    args = raw_args or {}
                yield sse_event("step", text=f"正在查詢資料({name})...")
                result = await execute_call(name, args)
                messages.append({
                    "role": "tool",
                    "name": name,
                    "content": json.dumps(result, ensure_ascii=False, default=str) if result is not None else "null",
                })
        else:
            # Cap hit without the model stopping on its own -- proceed to
            # the phrasing turn below with whatever's been gathered so far,
            # rather than leaving the loop hanging.
            yield sse_event("step", text="已達查詢上限,改用目前查到的資訊回答。")

        if ollama_unreachable:
            # Tool-selection model itself is unreachable and nothing was
            # looked up yet -- fall back to the single-shot classifier path
            # (classify_intent + keyword rules), same resilience contract
            # /agent/query has always had.
            is_legacy_fallback = True
            legacy_result = await classify_and_run(q)
            tool_results.append({"tool": "_legacy", "args": {}, "result": legacy_result})

    chart_directive = None
    for r in tool_results:
        directive = r["result"].get("chart_directive")
        if directive is not None:
            chart_directive = directive

    data = [r["result"].get("data") for r in tool_results] if tool_results else None
    fallback_reply = "\n".join(r["result"].get("answer_text", "") for r in tool_results).strip()

    if tool_results:
        prompt = _build_multi_reply_prompt(q, tool_results)
    else:
        prompt = _build_fallback_prompt(q)

    yield sse_event("step", text="正在整理回覆...")
    reply = ""
    try:
        async for piece in stream_chat_completion([{"role": "user", "content": prompt}]):
            reply += piece
            yield sse_event("token", text=piece)
    except Exception as e:
        yield sse_event("step", text=f"語言模型無法連線({e}),改用系統原始回覆。")
        reply = ""

    reply = reply.strip()
    if reply and not _reply_is_grounded(reply, data):
        yield sse_event("step", text="偵測到回覆內容可能與資料不符,改用系統原始回覆。")
        reply = ""

    final_reply = reply or fallback_reply
    yield sse_event("final", reply=final_reply, chart_directive=chart_directive, data=data)

    if tool_results and not is_legacy_fallback:
        _plan_cache[q] = [{"tool": r["tool"], "args": r["args"]} for r in tool_results]
