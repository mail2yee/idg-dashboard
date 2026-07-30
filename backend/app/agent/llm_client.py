"""
Streaming client for the on-prem LLM's OpenAI-compatible chat endpoint.

Used to phrase the final natural-language reply shown to the user, as
opposed to ollama_client.classify_intent (which only picks an intent name +
params, never free text). This assumes an OpenAI-compatible
`/chat/completions` endpoint -- the shape Ollama (`/v1/chat/completions`),
vLLM, and TGI-style on-prem gateways all speak -- i.e.
POST {LLM_BASE_URL}/chat/completions with {"model", "messages", "stream": true},
returning SSE lines of `data: {"choices":[{"delta":{"content": "..."}}]}`
terminated by `data: [DONE]`. Swapping the on-prem provider (or pointing at
a different served model) only means changing LLM_BASE_URL/LLM_MODEL --
callers just consume `stream_chat_completion()` as an async generator of
text chunks and don't need to change.
"""

import json
import os
from typing import AsyncIterator, List, Dict

import httpx

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
# qwen3:14b over qwen2.5:latest here specifically -- qwen2.5 occasionally
# mixed in simplified characters despite the prompt asking for Traditional
# Chinese, qwen3:14b was consistently clean in testing. It's ~4x slower
# (~20s vs ~5s per reply) but this is only the reply-phrasing pass;
# ollama_client.OLLAMA_MODEL (intent classification) stays on qwen2.5,
# unaffected by this choice.
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen3:14b")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "60"))


async def stream_chat_completion(messages: List[Dict]) -> AsyncIterator[str]:
    """Yields text chunks as they arrive from the LLM. Raises on HTTP or
    connection errors -- callers decide how to degrade (see
    intents.stream_agent_reply, which falls back to the deterministic
    answer_text already computed from the whitelisted query)."""
    url = f"{LLM_BASE_URL}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    payload = {"model": LLM_MODEL, "messages": messages, "stream": True}

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]" or not data:
                    continue
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                piece = (choices[0].get("delta") or {}).get("content")
                if piece:
                    yield piece
