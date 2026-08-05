from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agent.intents import classify_and_run, stream_agent_reply

router = APIRouter()


class AgentQuery(BaseModel):
    question: str
    lang: str = "zh"  # "zh" | "en" -- default "zh" keeps old callers (scripts,
    # the existing pytest suite, direct curl) unchanged; the frontend always
    # sends its current locale explicitly once wired up.


@router.post("/agent/query")
async def agent_query(payload: AgentQuery):
    """Non-streaming: whitelisted-query lookup only, deterministic
    answer_text (no LLM phrasing pass). Kept for scripts/tests that want a
    single JSON response; the chat panel UI uses /agent/chat instead."""
    return await classify_and_run(payload.question, lang=payload.lang)


@router.post("/agent/chat")
async def agent_chat(payload: AgentQuery):
    """SSE stream (step/token/final events) that also runs the on-prem LLM
    phrasing pass over the whitelisted query's result -- see
    intents.stream_agent_reply for the grounding/fallback behavior."""
    return StreamingResponse(stream_agent_reply(payload.question, lang=payload.lang), media_type="text/event-stream")
