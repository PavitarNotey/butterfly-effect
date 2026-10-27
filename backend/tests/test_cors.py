import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from config import LOCAL_ORIGINS, ServerSettings
from main import create_app

FRONTEND = "https://butterfly-effect-football.netlify.app"


def test_configuration_retains_localhost_and_normalizes_explicit_origins():
    settings = ServerSettings(
        _env_file=None,
        cors_allowed_origins=f" {FRONTEND}/, http://localhost:5173, {FRONTEND}, ",
    )
    assert settings.allowed_origins == [*LOCAL_ORIGINS, FRONTEND]
    assert ServerSettings(
        _env_file=None, cors_allowed_origins=""
    ).allowed_origins == list(LOCAL_ORIGINS)


@pytest.mark.parametrize(
    "value",
    [
        "*",
        "https://*.netlify.app",
        "null",
        "file:///tmp",
        "https://example.com/path",
        "https://example.com?query=yes",
        "https://example.com/#fragment",
        "https://user:password@example.com",
        "https://example.com:bad",
    ],
)
def test_invalid_origins_fail_closed(value):
    with pytest.raises(ValidationError):
        ServerSettings(_env_file=None, cors_allowed_origins=value)


@pytest.fixture
def deployed_client(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", FRONTEND)
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("AI_PAID_GENERATION_ENABLED", "false")
    with TestClient(create_app()) as client:
        yield client


@pytest.mark.parametrize(
    "path",
    [
        "/health",
        "/api/league",
        "/api/fixtures",
        "/api/standings",
        "/api/scenarios",
        "/api/scenarios/the-invisible-run/evidence",
        "/api/scenarios/the-missed-chance/evidence",
        "/api/scenarios/the-untouched-pass/evidence",
    ],
)
def test_netlify_can_read_all_data_routes(deployed_client, path):
    response = deployed_client.get(path, headers={"Origin": FRONTEND})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == FRONTEND
    assert "Origin" in response.headers["vary"]


@pytest.mark.parametrize("mode", ["casual", "analyst"])
def test_netlify_json_preflight_and_mock_explanation(deployed_client, mode):
    preflight = deployed_client.options(
        "/api/ai/moments/explain",
        headers={
            "Origin": FRONTEND,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == FRONTEND
    assert "POST" in preflight.headers["access-control-allow-methods"]
    response = deployed_client.post(
        "/api/ai/moments/explain",
        headers={"Origin": FRONTEND},
        json={"scenario_id": "the-untouched-pass", "event_id": "dummy", "mode": mode},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == FRONTEND
    assert response.json()["provider"] == "mock"
    assert response.json()["mode"] == mode
    assert deployed_client.app.state.intelligence.diagnostics()["model_attempts"] == 0


@pytest.mark.parametrize("origin", [*LOCAL_ORIGINS, FRONTEND])
def test_local_and_production_origins_coexist(deployed_client, origin):
    assert (
        deployed_client.get("/health", headers={"Origin": origin}).headers[
            "access-control-allow-origin"
        ]
        == origin
    )


@pytest.mark.parametrize(
    "origin",
    [
        "https://untrusted.netlify.app",
        f"{FRONTEND}.evil.example",
        f"{FRONTEND}:8443",
        FRONTEND.replace("https:", "http:"),
    ],
)
def test_other_origins_and_disallowed_preflights_stay_blocked(deployed_client, origin):
    assert (
        "access-control-allow-origin"
        not in deployed_client.get("/api/fixtures", headers={"Origin": origin}).headers
    )
    response = deployed_client.options(
        "/api/ai/moments/explain",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_unneeded_methods_and_headers_are_not_allowed(deployed_client):
    for changes in (
        {"Access-Control-Request-Method": "DELETE"},
        {"Access-Control-Request-Headers": "x-unrestricted-header"},
    ):
        response = deployed_client.options(
            "/health",
            headers={
                "Origin": FRONTEND,
                "Access-Control-Request-Method": "GET",
                **changes,
            },
        )
        assert response.status_code == 400
