"""
Client for the on-prem Ollama instance used to classify a free-text question
into one of the whitelisted intents declared in intents.py.

The model never writes a database query itself -- it only picks an intent
name (constrained to a fixed enum via Ollama's structured-output `format`)
and fills a handful of typed params. `classify_and_run` in intents.py maps
that intent name to a hardcoded, parameterized Mongo query. If Ollama is
unreachable, times out, or returns something that doesn't parse, this
returns None and the caller falls back to the keyword-based classifier.
"""

import json
import os
from typing import Optional

import httpx

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:latest")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "15"))

INTENT_NAMES = [
    "top_n_by_maturity",
    "top_n_by_delta",
    "stagnant_domains",
    "domain_ranking",
    "subject_detail",
    "trend_over_time",
    "risk_priority",
    "ownership_coverage",
    "stewardship",
    "lineage_coverage",
    "subject_growth",
    "unknown",
]

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {"type": "string", "enum": INTENT_NAMES},
        "params": {
            "type": "object",
            "properties": {
                "n": {"type": "integer"},
                "period": {"type": "string", "enum": ["week", "month", "year"]},
                "months": {"type": "integer"},
                "group_by": {"type": "string", "enum": ["domain", "subject"]},
                "descending": {"type": "boolean"},
                "domain": {"type": ["string", "null"]},
                "name_hint": {"type": ["string", "null"]},
            },
        },
    },
    "required": ["intent", "params"],
}

SYSTEM_PROMPT = """你是 IDG Data Quality Dashboard 的問題分類器。將使用者的問題對應到下列其中一個 intent 並填入參數,只能輸出符合 schema 的 JSON,不要有任何額外文字或說明。

可用的 intent:
- top_n_by_maturity: 依「目前 maturity level(絕對值)」排名前/後 N 個 domain 或 data subject。適用於「maturity 最高/最低的三個 domain」這類問題。
  params: n(整數,預設 3), group_by("domain" 或 "subject", 預設 "domain"), descending(true=由高到低/最好, false=由低到高/最差)
- top_n_by_delta: 依「這週/這個月/這一年的進步幅度(變化量,不是絕對值)」排名前/後 N 個 domain 或 data subject。適用於「本週進步最多」「這個月退步最多」這類問題。
  params: n(整數,預設 3), period("week"/"month"/"year", 預設 "week"), group_by("domain" 或 "subject", 預設 "domain"), descending(true=進步最多, false=退步最多)
- stagnant_domains: 找出連續 N 個月都沒有進步(maturity level 沒有提升)的 domain。適用於「連續兩個月沒有進步/沒在做 data governance 的 domain」這類問題。
  params: months(整數,預設 2)
- domain_ranking: 列出所有 domain 依目前 maturity 排名。
  params: {}
- subject_detail: 查詢某一個特定 data subject 的詳細資訊。
  params: name_hint(該 data subject 的名稱或名稱片段)
- trend_over_time: 查詢某個 domain(或全公司)過去的 maturity 歷史趨勢。
  params: domain(字串或 null,null 表示全公司)
- risk_priority: 查詢「風險優先排序」——依「近期使用量 × 距離滿分的差距」排出最該優先處理的 data subject。適用於「風險最高的是哪些」「該優先處理誰」這類問題。
  params: n(整數,預設 5,要看幾筆)
- ownership_coverage: 查詢 Data Owner/Steward/IT Owner 的指派覆蓋率,整體或依 domain。適用於「ownership 覆蓋率多少」「哪個 domain 缺 owner 缺最多」這類問題。
  params: {}
- stewardship: 查詢各 Owner Team 處理 incident 的回應力(逾期件數、平均解決時間、誰回應最快)。適用於「哪個 team 逾期最多」「誰回應最快」這類問題。
  params: {}
- lineage_coverage: 查詢 lineage(資料血緣)覆蓋率,以及完全沒有 lineage 記錄的「孤島」資料集。適用於「哪些資料集沒有 lineage」「lineage 覆蓋率多少」這類問題。
  params: {}
- subject_growth: 查詢近期新增 data subject 是否有異常暴增的 domain(可能代表分類錯誤)。適用於「最近新增很多資料的 domain」「有沒有異常成長」這類問題。
  params: {}
- unknown: 問題不屬於以上任何一種,或者需要目前系統還沒有的統計。
  params: {}
"""


async def classify_intent(question: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": question},
                    ],
                    "format": RESPONSE_SCHEMA,
                    "stream": False,
                    "options": {"temperature": 0},
                },
            )
            resp.raise_for_status()
            content = resp.json()["message"]["content"]
            parsed = json.loads(content)
            if "intent" not in parsed:
                return None
            return parsed
    except Exception:
        return None


# --- Tool-calling for /agent/chat's multi-step loop (intents.stream_agent_reply) ---
#
# Same underlying capabilities as RESPONSE_SCHEMA/SYSTEM_PROMPT above (used
# by classify_intent for /agent/query's single-shot lookup), reshaped into
# Ollama's native tool-calling format so the model can call more than one
# in a single turn -- e.g. "who improved most, and who owns it" needs
# top_n_by_delta then a subject-detail-style lookup, a combination nobody
# hardcoded as its own intent. /agent/query keeps using classify_intent
# unchanged; this is additive, not a replacement.

TOOL_DEFS = [
    {
        "type": "function",
        "function": {
            "name": "top_n_by_maturity",
            "description": "依「目前 maturity level(絕對值)」排名前/後 N 個 domain 或 data subject。適用於「maturity 最高/最低的三個 domain」這類問題。",
            "parameters": {
                "type": "object",
                "properties": {
                    "n": {"type": "integer", "description": "要看幾筆,預設 3"},
                    "group_by": {"type": "string", "enum": ["domain", "subject"], "description": "預設 domain"},
                    "descending": {"type": "boolean", "description": "true=由高到低/最好, false=由低到高/最差"},
                },
                "required": ["n", "group_by", "descending"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "top_n_by_delta",
            "description": "依「這週/這個月/這一年的進步幅度(變化量,不是絕對值)」排名前/後 N 個 domain 或 data subject。適用於「本週進步最多」「這個月退步最多」這類問題。",
            "parameters": {
                "type": "object",
                "properties": {
                    "n": {"type": "integer", "description": "要看幾筆,預設 3"},
                    "period": {"type": "string", "enum": ["week", "month", "year"], "description": "預設 week"},
                    "group_by": {"type": "string", "enum": ["domain", "subject"], "description": "預設 domain"},
                    "descending": {"type": "boolean", "description": "true=進步最多, false=退步最多"},
                },
                "required": ["n", "period", "group_by", "descending"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "stagnant_domains",
            "description": "找出連續 N 個月都沒有進步(maturity level 沒有提升)的 domain。適用於「連續兩個月沒有進步/沒在做 data governance 的 domain」這類問題。",
            "parameters": {
                "type": "object",
                "properties": {"months": {"type": "integer", "description": "預設 2"}},
                "required": ["months"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "domain_ranking",
            "description": "列出所有 domain 依目前 maturity 排名。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "subject_detail",
            "description": "查詢某一個特定 data subject 的詳細資訊(名稱、domain、目前 maturity level、owners)。",
            "parameters": {
                "type": "object",
                "properties": {"name_hint": {"type": "string", "description": "該 data subject 的名稱或名稱片段"}},
                "required": ["name_hint"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trend_over_time",
            "description": "查詢某個 domain(或全公司)過去的 maturity 歷史趨勢。",
            "parameters": {
                "type": "object",
                "properties": {"domain": {"type": ["string", "null"], "description": "null 表示全公司"}},
                "required": ["domain"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "risk_priority",
            "description": "查詢「風險優先排序」——依「近期使用量 × 距離滿分的差距」排出最該優先處理的 data subject。適用於「風險最高的是哪些」「該優先處理誰」這類問題。",
            "parameters": {
                "type": "object",
                "properties": {"n": {"type": "integer", "description": "要看幾筆,預設 5"}},
                "required": ["n"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ownership_coverage",
            "description": "查詢 Data Owner/Steward/IT Owner 的指派覆蓋率,整體或依 domain。適用於「ownership 覆蓋率多少」「哪個 domain 缺 owner 缺最多」這類問題。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "stewardship",
            "description": "查詢各 Owner Team 處理 incident 的回應力(逾期件數、平均解決時間、誰回應最快)。適用於「哪個 team 逾期最多」「誰回應最快」這類問題。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lineage_coverage",
            "description": "查詢 lineage(資料血緣)覆蓋率,以及完全沒有 lineage 記錄的「孤島」資料集。適用於「哪些資料集沒有 lineage」「lineage 覆蓋率多少」這類問題。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "subject_growth",
            "description": "查詢近期新增 data subject 是否有異常暴增的 domain(可能代表分類錯誤)。適用於「最近新增很多資料的 domain」「有沒有異常成長」這類問題。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

TOOL_CALLING_SYSTEM_PROMPT = """你是 IDG Data Quality Dashboard 的助理。你可以呼叫下面提供的工具來查詢真實資料,一次可以呼叫一個或多個工具,也可以先看某個工具的結果、再決定要不要呼叫下一個。

規則:
1. 只能呼叫提供的工具,絕對不能自己編造數字或名稱。
2. 如果一個問題需要組合多個資訊才能回答(例如「進步最多的是誰、又是誰負責的」),可以連續呼叫多個工具。
3. 當你已經有足夠的資訊時,直接用自然、友善的繁體中文回答,不要再呼叫工具,不要用 Markdown 或項目符號。
4. 如果問題跟資料治理、maturity level、domain/data subject 完全無關(例如打招呼、閒聊),不要呼叫任何工具,直接簡短說明你能協助的範圍並舉 1-2 個範例問題。
"""


async def call_with_tools(messages: list) -> Optional[dict]:
    """One non-streaming tool-selection round: returns the raw `message`
    dict (either {"tool_calls": [...]} or plain {"content": "..."}), or
    None on any failure -- same unreachable-Ollama contract as
    classify_intent. Always temperature 0 (structured decision, not free
    text) and non-streaming (tool-call arguments are structured JSON, not
    meaningfully streamable token-by-token; only the final phrasing turn
    in llm_client.py streams)."""
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "tools": TOOL_DEFS,
                    "stream": False,
                    "options": {"temperature": 0},
                },
            )
            resp.raise_for_status()
            return resp.json().get("message")
    except Exception:
        return None
