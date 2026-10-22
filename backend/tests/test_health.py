import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok', 'project': 'butterfly-effect'}


@pytest.mark.parametrize('origin', ['http://localhost:5173', 'http://127.0.0.1:5173'])
def test_local_frontend_cors(origin):
    response = client.get('/health', headers={'Origin': origin})
    assert response.headers['access-control-allow-origin'] == origin


def test_unknown_origin_is_not_allowed():
    response = client.get('/health', headers={'Origin': 'https://example.com'})
    assert 'access-control-allow-origin' not in response.headers
