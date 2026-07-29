from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agent, config, domains, maturity, subjects, teams

app = FastAPI(title="IDG Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(subjects.router, prefix="/api")
app.include_router(maturity.router, prefix="/api")
app.include_router(domains.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(teams.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
