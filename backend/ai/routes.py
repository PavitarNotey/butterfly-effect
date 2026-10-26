from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import ValidationError

from league.service import get_catalog

from .config import AISettings
from .evidence import event_stream
from .models import AIStatus, ExplainRequest, Intelligence, Mode, StreamEvent
from .providers import AIError
from .service import IntelligenceService

router = APIRouter(prefix="/api/ai", tags=["Synthetic football intelligence"])


def service(request: Request) -> IntelligenceService:
    if not hasattr(request.app.state, "intelligence"):
        try:
            request.app.state.intelligence = IntelligenceService(AISettings())
        except (ValidationError, ValueError):
            # Never serialize settings validation inputs (may contain a secret).
            raise HTTPException(
                503,
                "Invalid backend AI configuration. Check the documented environment variable names.",
            ) from None
    return request.app.state.intelligence


async def generate(request, scenario_id, mode, event_id=None, recap=False):
    try:
        ai = service(request)
        ai.limit_client(request.client.host if request.client else "local")
        return await ai.get(scenario_id, mode, event_id, recap)
    except KeyError:
        raise HTTPException(404, "Unknown scenario or event") from None
    except AIError as error:
        raise HTTPException(
            error.status,
            str(error),
            headers={"Retry-After": "60"} if error.status == 429 else None,
        ) from None


@router.get("/status", response_model=AIStatus)
def status(request: Request):
    try:
        settings = service(request).settings
    except HTTPException:
        return AIStatus(
            provider="invalid_configuration",
            available=False,
            message="Invalid backend AI configuration.",
        )
    return AIStatus(
        provider=settings.provider,
        available=settings.provider != "disabled",
        message={
            "foundry": "Microsoft Foundry configured. Connectivity is checked on generation, not startup.",
            "mock": "Explicit offline demo fixtures. No live AI generation.",
            "disabled": "Configure Foundry or explicitly select mock mode on the backend.",
        }[settings.provider],
    )


@router.post("/moments/explain", response_model=Intelligence)
async def explain(body: ExplainRequest, request: Request):
    return await generate(request, body.scenario_id, body.mode, body.event_id)


@router.get("/scenarios/{scenario_id}/commentary", response_model=Intelligence)
async def commentary(scenario_id: str, request: Request, mode: Mode = "casual"):
    return await generate(request, scenario_id, mode)


@router.get("/scenarios/{scenario_id}/events", response_model=list[StreamEvent])
def events(
    scenario_id: str,
    after: Annotated[int, Query(ge=-1)] = -1,
    limit: Annotated[int, Query(ge=1, le=16)] = 4,
):
    try:
        return [e for e in event_stream(scenario_id) if e.sequence > after][:limit]
    except KeyError:
        raise HTTPException(404, "Unknown scenario") from None


@router.get("/matches/{match_id}/recap", response_model=Intelligence)
async def recap(match_id: str, request: Request, mode: Mode = "casual"):
    match = next((m for m in get_catalog().matches if m.id == match_id), None)
    if match is None:
        raise HTTPException(404, "Unknown match")
    if match.status != "finished":
        raise HTTPException(
            409, "Recaps are available only for finished synthetic fixtures."
        )
    reference = next(e.replay for e in match.events if e.replay)
    return await generate(request, reference.scenarioId, mode, recap=True)
