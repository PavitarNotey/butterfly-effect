from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from league.routes import router as league_router
from league.service import get_catalog
from tactics.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_catalog()
    yield


app = FastAPI(title="Butterfly Effect API", lifespan=lifespan)
app.include_router(router)
app.include_router(league_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
)


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    project: Literal["butterfly-effect"] = "butterfly-effect"


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()
