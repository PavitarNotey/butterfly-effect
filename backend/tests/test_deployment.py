import json
import subprocess
import sys
from pathlib import Path

from deployment import BACKEND, SCENARIOS, package


def test_artifact_is_allowlisted_and_canonical_data_is_unchanged(tmp_path):
    artifact = tmp_path / "api"
    package(artifact)
    files = {
        p.relative_to(artifact).as_posix() for p in artifact.rglob("*") if p.is_file()
    }
    expected = {"main.py", "config.py", "league/catalog.json"}
    expected |= {f"scenarios/{name}" for name in SCENARIOS}
    for module in ("ai", "league", "tactics"):
        expected |= {f"{module}/{p.name}" for p in (BACKEND / module).glob("*.py")}
    assert files == expected
    for name in SCENARIOS:
        assert (artifact / "scenarios" / name).read_bytes() == (
            BACKEND.parent / "frontend/src/replay" / name
        ).read_bytes()


def test_packaged_app_uses_bundled_scenarios_without_frontend(tmp_path, monkeypatch):
    artifact = tmp_path / "api"
    package(artifact)
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("AI_PAID_GENERATION_ENABLED", "false")
    monkeypatch.setenv("PYTHONPATH", "")
    # A new process prevents already-imported repository modules masking bad paths.
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
from pathlib import Path
from fastapi.testclient import TestClient
from main import app
from tactics.service import REGISTRY
assert all(p.parent == Path.cwd() / 'scenarios' for p in REGISTRY.values())
with TestClient(app) as client:
    assert client.get('/health').json()['status'] == 'ok'
    assert len(client.get('/api/fixtures').json()) == 5
    assert len(client.get('/api/standings').json()) == 10
    for scenario in REGISTRY:
        response = client.get(f'/api/scenarios/{scenario}/evidence')
        assert response.status_code == 200
        assert response.json()['scenarioId'] == scenario
    assert client.get('/api/ai/status').json()['provider'] == 'mock'
print('true')
""",
        ],
        cwd=artifact,
        text=True,
        capture_output=True,
        timeout=30,
        check=True,
    )
    assert json.loads(result.stdout) is True


def test_repository_still_uses_existing_canonical_sources():
    from tactics.service import REGISTRY

    assert all(
        path.parent == Path(__file__).resolve().parents[2] / "frontend/src/replay"
        for path in REGISTRY.values()
    )
