from fastapi import APIRouter

from app.scoring import dimension_meta, max_score

router = APIRouter()


@router.get("/config/dimensions")
async def config_dimensions():
    return {"dimensions": dimension_meta(), "max_score": max_score()}
