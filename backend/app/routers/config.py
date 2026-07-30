from fastapi import APIRouter

from app.scoring import dimension_meta, level_meta, max_level, max_score

router = APIRouter()


@router.get("/config/dimensions")
async def config_dimensions():
    return {"dimensions": dimension_meta(), "max_score": max_score()}


@router.get("/config/levels")
async def config_levels():
    return {"levels": level_meta(), "max_level": max_level()}
