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
from app.agent.ollama_client import classify_intent
from app.db import db
from app.util import compute_deltas, period_delta, serialize

DOMAIN_KEYWORDS = {
    "sales": "Sales", "銷售": "Sales",
    "finance": "Finance", "財務": "Finance", "財政": "Finance",
    "marketing": "Marketing", "行銷": "Marketing",
    "product": "Product", "產品": "Product",
    "risk": "Risk", "風險": "Risk",
    "platform": "Platform", "平台": "Platform",
}

CN_NUMBERS = {"一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "十": 10}


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
            f"{d['domain']}(L{d['avg_maturity_level']:.1f})" for d in docs
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
    answer = "各 Domain maturity 排名:" + "、".join(f"{d['domain']}(L{d['avg_maturity_level']:.1f})" for d in docs)
    return {
        "answer_text": answer,
        "chart_directive": {"type": "show_domain_ranking"},
        "data": serialize(docs),
    }


async def run_subject_detail(name_hint: str):
    subject = await db.data_subjects.find_one({"name": {"$regex": re.escape(name_hint), "$options": "i"}})
    if not subject:
        return {
            "answer_text": f"找不到名稱包含「{name_hint}」的 data subject。",
            "chart_directive": None,
            "data": None,
        }
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
    "unknown". Only covers the original four intents -- top_n_by_delta and
    stagnant_domains need real language understanding (distinguishing
    "highest" from "improved the most") that keyword matching can't do
    reliably, so those are LLM-only."""
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


def _build_fallback_prompt(question: str) -> str:
    """Used when the whitelisted lookup found no data (out-of-scope
    question, greeting, etc.) -- there's nothing to ground a data-grounded
    reply on, but the model can still hold the conversation instead of the
    user seeing a static canned string with no LLM involved at all."""
    return f"""你是 IDG Data Quality Dashboard 的助理,只回答跟本系統的資料治理、maturity level、domain/data subject 相關的問題。

使用者問了:「{question}」

系統判斷這個問題目前不屬於任何已支援的查詢類型(不是查排名、進步幅度、停滯偵測、特定 data subject 或歷史趨勢)。請用自然、友善的繁體中文簡短回覆,說明你能協助的範圍,並舉 1-2 個範例問題(例如「maturity 最高的三個 Domain?」、「本週進步最多的 Domain?」、「連續兩個月沒有進步的 Domain?」)。一兩句話就好,不要用 Markdown 或項目符號;如果使用者的問題是打招呼,就自然回應打招呼再帶出範例。
"""


async def stream_agent_reply(question: str) -> AsyncIterator[str]:
    """Async generator of SSE strings for the /agent/chat endpoint:
    step -> token* -> final. The structured lookup (intent classification
    + whitelisted Mongo query) is exactly classify_and_run(); this adds an
    LLM phrasing pass on top of it -- data-grounded when the lookup found
    something, a "here's what I can help with" prompt when it didn't, so
    the on-prem model is in the loop for every reply, not just in-scope
    ones. Either way, any LLM failure falls back to the deterministic
    answer_text already computed above, so the reply is always correct."""
    yield sse_event("step", text="🔍 正在查詢資料...")
    result = await classify_and_run(question)
    answer_text = result.get("answer_text", "")
    chart_directive = result.get("chart_directive")
    data = result.get("data")

    prompt = _build_reply_prompt(question, result) if data else _build_fallback_prompt(question)

    yield sse_event("step", text="💬 正在整理回覆...")
    reply = ""
    try:
        async for piece in stream_chat_completion([{"role": "user", "content": prompt}]):
            reply += piece
            yield sse_event("token", text=piece)
    except Exception as e:
        yield sse_event("step", text=f"⚠️ 語言模型無法連線({e}),改用系統原始回覆。")
        reply = ""

    final_reply = reply.strip() or answer_text
    yield sse_event("final", reply=final_reply, chart_directive=chart_directive, data=data)
