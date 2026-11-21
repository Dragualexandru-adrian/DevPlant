import mongomock
import pytest
from fastapi.testclient import TestClient

from app.db import get_db, init_db
from app.main import app


@pytest.fixture
def db():
    """Fresh in-memory MongoDB per test (mongomock), same indexes as production."""
    database = mongomock.MongoClient(tz_aware=True)["medguard_test"]
    init_db(database)
    return database


@pytest.fixture(name="client")
def client_fixture(db):
    app.dependency_overrides[get_db] = lambda: db
    # Not used as a context manager: this intentionally skips the app's
    # startup event (init_db on the real database + the missed-dose background
    # task), keeping each test isolated and fast.
    client = TestClient(app)
    yield client
    client.close()
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    def _create(email: str = "patient@example.com", password: str = "secret123", role: str = "patient", name: str = "Test Patient"):
        client.post("/auth/register", json={"name": name, "email": email, "password": password, "role": role})
        resp = client.post("/auth/login", data={"username": email, "password": password})
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _create
