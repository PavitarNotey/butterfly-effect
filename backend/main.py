from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai.routes import router as ai_router
from config import ServerSettings
from league.routes import router as league_router
from league.service import get_catalog
from tactics.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_catalog()
    yield
    if hasattr(app.state, "intelligence"):
        await app.state.intelligence.close()
        del app.state.intelligence


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    project: Literal["butterfly-effect"] = "butterfly-effect"


def health() -> HealthResponse:
    return HealthResponse()


def create_app() -> FastAPI:
    application = FastAPI(title="Butterfly Effect API", lifespan=lifespan)
    application.include_router(router)
    application.include_router(league_router)
    application.include_router(ai_router)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=ServerSettings().allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    application.get("/health", response_model=HealthResponse)(health)
    return application


app = create_app()
