def test_register_creates_user(client):
    resp = client.post("/auth/register", json={"email": "a@b.com", "password": "secret123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "a@b.com"
    assert body["role"] == "patient"
    assert "hashed_password" not in body


def test_register_duplicate_email_rejected(client):
    client.post("/auth/register", json={"email": "a@b.com", "password": "secret123"})
    resp = client.post("/auth/register", json={"email": "a@b.com", "password": "other"})
    assert resp.status_code == 400


def test_login_success_returns_bearer_token(client):
    client.post("/auth/register", json={"email": "a@b.com", "password": "secret123"})
    resp = client.post("/auth/login", data={"username": "a@b.com", "password": "secret123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_wrong_password_rejected(client):
    client.post("/auth/register", json={"email": "a@b.com", "password": "secret123"})
    resp = client.post("/auth/login", data={"username": "a@b.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_email_rejected(client):
    resp = client.post("/auth/login", data={"username": "ghost@b.com", "password": "x"})
    assert resp.status_code == 401


def test_push_token_requires_auth(client):
    resp = client.post("/auth/push-token", json={"expo_push_token": "tok"})
    assert resp.status_code == 401


def test_push_token_sets_value(client, auth_headers):
    headers = auth_headers()
    resp = client.post("/auth/push-token", json={"expo_push_token": "tok123"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
