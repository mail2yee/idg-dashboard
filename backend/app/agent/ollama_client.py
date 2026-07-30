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
