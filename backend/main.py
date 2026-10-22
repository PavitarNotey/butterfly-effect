from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tactics.routes import router

app = FastAPI(title="Butterfly Effect API")
app.include_router(router)
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
