import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db import get_session
from app.main import app


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="client")
def client_fixture(engine):
    def get_session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_session_override
    # Not used as a context manager: this intentionally skips the app's
    # startup event (init_db on the real engine + the missed-dose background
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
