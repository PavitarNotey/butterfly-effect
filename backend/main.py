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
    """Validate the league before serving and close app-owned AI tasks on shutdown.

    No model generation or paid connectivity probe occurs during startup.
    """
    get_catalog()
    yield
    if hasattr(app.state, "intelligence"):
        await app.state.intelligence.close()
        del app.state.intelligence


# Stable liveness payload; it does not imply Foundry or external-service connectivity.
class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    project: Literal["butterfly-effect"] = "butterfly-effect"


# Liveness endpoint: return a static response without probing a model or external API.
def health() -> HealthResponse:
    return HealthResponse()


def create_app() -> FastAPI:
    """Assemble read-only football routes, explicit AI actions and exact-origin CORS.

    Returns a FastAPI application; credentials remain in backend settings.
    """
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
