def test_create_medication(client, auth_headers):
    headers = auth_headers()
    resp = client.post("/meds", json={"name": "Aspirin", "stock": 10}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Aspirin"
    assert body["stock"] == 10


def test_create_medication_requires_auth(client):
    resp = client.post("/meds", json={"name": "Aspirin"})
    assert resp.status_code == 401


def test_list_medications_scoped_to_owner(client, auth_headers):
    headers_a = auth_headers(email="a@b.com")
    headers_b = auth_headers(email="b@b.com")
    client.post("/meds", json={"name": "Aspirin"}, headers=headers_a)
    client.post("/meds", json={"name": "Ibuprofen"}, headers=headers_b)

    resp = client.get("/meds", headers=headers_a)
    names = [m["name"] for m in resp.json()]
    assert names == ["Aspirin"]


def test_get_medication_not_owned_returns_404(client, auth_headers):
    headers_a = auth_headers(email="a@b.com")
    headers_b = auth_headers(email="b@b.com")
    created = client.post("/meds", json={"name": "Aspirin"}, headers=headers_a).json()

    resp = client.get(f"/meds/{created['id']}", headers=headers_b)
    assert resp.status_code == 404


def test_get_medication_missing_returns_404(client, auth_headers):
    headers = auth_headers()
    resp = client.get("/meds/999", headers=headers)
    assert resp.status_code == 404


def test_update_medication_partial_fields(client, auth_headers):
    headers = auth_headers()
    created = client.post("/meds", json={"name": "Aspirin", "stock": 5}, headers=headers).json()

    resp = client.put(f"/meds/{created['id']}", json={"stock": 20}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["stock"] == 20
    assert body["name"] == "Aspirin"


def test_update_medication_not_owned_returns_404(client, auth_headers):
    headers_a = auth_headers(email="a@b.com")
    headers_b = auth_headers(email="b@b.com")
    created = client.post("/meds", json={"name": "Aspirin"}, headers=headers_a).json()

    resp = client.put(f"/meds/{created['id']}", json={"stock": 1}, headers=headers_b)
    assert resp.status_code == 404


def test_delete_medication_not_owned_404(client, auth_headers):
    headers_a = auth_headers(email="a@b.com")
    headers_b = auth_headers(email="b@b.com")
    created = client.post("/meds", json={"name": "Aspirin"}, headers=headers_a).json()

    resp = client.delete(f"/meds/{created['id']}", headers=headers_b)
    assert resp.status_code == 404


def test_delete_medication(client, auth_headers):
    headers = auth_headers()
    created = client.post("/meds", json={"name": "Aspirin"}, headers=headers).json()

    resp = client.delete(f"/meds/{created['id']}", headers=headers)
    assert resp.status_code == 200

    resp = client.get(f"/meds/{created['id']}", headers=headers)
    assert resp.status_code == 404
