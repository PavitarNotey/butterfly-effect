from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError

from .engine import at, corridor, interval, movement, space, spatial
from .models import Analysis, EvidenceBundle, Scenario, TacticalMoment, Thresholds
from .service import evidence_bundle, load_scenario

router = APIRouter(prefix="/api/scenarios", tags=["Tactical evidence"])


def scenario_or_404(id):
    try:
        return load_scenario(id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Unknown scenario") from error
    except ValidationError as error:
        raise HTTPException(
            status_code=422, detail=error.errors(include_context=False)
        ) from error


@router.get("/{id}", response_model=Scenario)
def scenario(id: str):
    return scenario_or_404(id)


@router.get("/{id}/evidence", response_model=EvidenceBundle)
def evidence(
    id: str,
    corridor_half_width: Annotated[float, Query(gt=0, le=5, allow_inf_nan=False)] = 0.9,
    contested_margin: Annotated[float, Query(ge=0, le=5, allow_inf_nan=False)] = 0.6,
    coverage_radius: Annotated[float, Query(gt=0, le=20, allow_inf_nan=False)] = 6,
):
    scenario_or_404(id)
    try:
        return evidence_bundle(
            id,
            Thresholds(
                corridorHalfWidth=corridor_half_width,
                contestedMargin=contested_margin,
                coverageRadius=coverage_radius,
            ),
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{id}/moments", response_model=list[TacticalMoment])
def moments(id: str):
    scenario_or_404(id)
    try:
        return evidence_bundle(id).moments
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{id}/analysis", response_model=Analysis)
def analysis(
    id: str,
    t: Annotated[float, Query(ge=0, allow_inf_nan=False)],
    start: Annotated[float, Query(ge=0, allow_inf_nan=False)] = 0,
    end: Annotated[float | None, Query(ge=0, allow_inf_nan=False)] = None,
    receiver_id: str | None = None,
    passer_id: str | None = None,
    pass_start: Annotated[float | None, Query(ge=0, allow_inf_nan=False)] = None,
    pass_end: Annotated[float | None, Query(ge=0, allow_inf_nan=False)] = None,
    corridor_half_width: Annotated[float, Query(gt=0, le=5, allow_inf_nan=False)] = 0.9,
):
    s = scenario_or_404(id)
    end = t if end is None else end
    try:
        interval(s, t, t)
        interval(s, start, end)
        travel = None
        coverage = None
        if any(x is not None for x in [passer_id, pass_start, pass_end]):
            if any(x is None for x in [passer_id, receiver_id, pass_start, pass_end]):
                raise ValueError(
                    "Recorded corridor needs passer_id, receiver_id, pass_start and pass_end"
                )
            travel = corridor(
                s,
                passer_id,
                receiver_id,
                pass_start,
                pass_end,
                Thresholds(corridorHalfWidth=corridor_half_width),
            )
        if receiver_id:
            p = next((p for p in s.players if p.id == receiver_id), None)
            if p is None:
                raise ValueError("Unknown receiver_id")
            coverage = space(s, at(s, p.id, t), p.teamId, t)
        return Analysis(
            scenarioId=id,
            t=t,
            start=start,
            end=end,
            spatial=spatial(s, t),
            movements=[
                movement(s, p.id, start, end)
                for p in sorted(s.players, key=lambda p: p.id)
            ],
            space=coverage,
            corridor=travel,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
