"""
Whitelisted-intent query engine for the AI agent panel.

This module is a stand-in for the real internal Gemma API call: instead of
native tool-calling, the (future) LLM will be constrained to emit a fixed
JSON shape like {"intent": "top_n_by_maturity", "params": {...}}, and this
file maps that intent to a whitelisted Mongo query — never an arbitrary
query the model writes itself.

For this prototype pass, `classify_and_run` plays the role of the LLM using
simple keyword rules, but returns the exact same response shape
({answer_text, chart_directive, data}) a real LLM-backed version would.
Swapping in the real model later only touches this file.
"""

import re
from typing import Optional

from app.db import db
from app.util import serialize

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


async def classify_and_run(question: str):
    q = question.strip()
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
            "這是規則式的示範版本(尚未接上內部 Gemma API),"
            "可以試著問:「maturity 最高的三個 Domain?」、「哪個 Domain 排名最後?」、"
            "或「全公司過去的 maturity 趨勢?」"
        ),
        "chart_directive": None,
        "data": None,
    }
