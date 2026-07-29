from fastapi import APIRouter
from pydantic import BaseModel

from app.agent.intents import classify_and_run

router = APIRouter()


class AgentQuery(BaseModel):
    question: str


@router.post("/agent/query")
async def agent_query(payload: AgentQuery):
    return await classify_and_run(payload.question)
