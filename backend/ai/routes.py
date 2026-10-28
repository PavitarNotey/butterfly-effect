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
    """Lazily return the app-owned intelligence service without probing the model.

    Configuration errors become safe HTTP errors; settings validation inputs
    may contain secrets and must never be serialized into responses.
    """
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


async def generate(
    request, scenario_id, mode, event_id=None, recap=False, cache_only=False
):
    """Apply client limits and translate service errors into safe HTTP responses.

    cache_only passes through unchanged; Retry-After is supplied for throttling.
    """
    try:
        ai = service(request)
        ai.limit_client(request.client.host if request.client else "local")
        return await ai.get(scenario_id, mode, event_id, recap, cache_only)
    except KeyError:
        raise HTTPException(404, "Unknown scenario or event") from None
    except AIError as error:
        raise HTTPException(
            error.status,
            str(error),
            headers={"Retry-After": "60"} if error.status == 429 else None,
        ) from None


# GET availability from local configuration; do not invoke Foundry merely to render status.
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
    paid_ready = (
        settings.ai_paid_generation_enabled
        and settings.ai_input_usd_per_million > 0
        and settings.ai_output_usd_per_million > 0
    )
    return AIStatus(
        provider=settings.provider,
        available=settings.provider == "mock"
        or (settings.provider == "foundry" and paid_ready),
        message={
            "foundry": "Microsoft Foundry configured; connectivity is checked on generation."
            if paid_ready
            else "New AI generation is paused. Replay and measured evidence remain available.",
            "mock": "Explicit offline demo fixtures. No live AI generation.",
            "disabled": "Configure Foundry or explicitly select mock mode on the backend.",
        }[settings.provider],
    )


# POST the explicit moment request; preserve cache-only intent and audience through the shared service.
@router.post("/moments/explain", response_model=Intelligence)
async def explain(body: ExplainRequest, request: Request):
    return await generate(
        request, body.scenario_id, body.mode, body.event_id, cache_only=body.cache_only
    )


# GET one bounded cue set or saved result; replay sampling remains entirely client-side.
@router.get("/scenarios/{scenario_id}/commentary", response_model=Intelligence)
async def commentary(
    scenario_id: str, request: Request, mode: Mode = "casual", cache_only: bool = False
):
    return await generate(request, scenario_id, mode, cache_only=cache_only)


# GET a stateless, bounded synthetic event page after an exclusive sequence cursor.
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


# GET intelligence only for finished fixtures with a validated reconstructed-passage reference.
@router.get("/matches/{match_id}/recap", response_model=Intelligence)
async def recap(
    match_id: str, request: Request, mode: Mode = "casual", cache_only: bool = False
):
    match = next((m for m in get_catalog().matches if m.id == match_id), None)
    if match is None:
        raise HTTPException(404, "Unknown match")
    if match.status != "finished":
        raise HTTPException(
            409, "Recaps are available only for finished synthetic fixtures."
        )
    reference = next(e.replay for e in match.events if e.replay)
    return await generate(
        request, reference.scenarioId, mode, recap=True, cache_only=cache_only
    )
