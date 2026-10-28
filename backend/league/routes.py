from fastapi import APIRouter, HTTPException

from .models import Fixture, FixtureSummary, League, MatchDetail, StandingsRow
from .service import compute_standings, get_catalog

router = APIRouter(prefix="/api", tags=["Fictional league"])


# GET the validated fictional league identity and roster catalog.
@router.get("/league", response_model=League)
def league() -> League:
    return get_catalog().league


# GET fixture summaries with optional replay-backed events; metadata events imply no 3D reconstruction.
@router.get("/fixtures", response_model=tuple[FixtureSummary, ...])
def fixtures() -> tuple[FixtureSummary, ...]:
    return tuple(
        FixtureSummary(
            **m.model_dump(include=set(Fixture.model_fields)),
            analyzedEvent=next((e for e in m.events if e.replay), None),
        )
        for m in get_catalog().matches
    )


# GET deterministic standings computed from finished results, excluding upcoming fixtures.
@router.get("/standings", response_model=tuple[StandingsRow, ...])
def standings() -> tuple[StandingsRow, ...]:
    return compute_standings(get_catalog())


# GET one validated fixture and its recorded event ledger, or return 404.
@router.get("/matches/{match_id}", response_model=MatchDetail)
def match_detail(match_id: str) -> MatchDetail:
    match = next((m for m in get_catalog().matches if m.id == match_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Unknown match")
    return match
