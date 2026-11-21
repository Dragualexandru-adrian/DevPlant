def test_report_event_by_marker_id_requires_no_auth(client, auth_headers):
    headers = auth_headers()
    med = client.post("/meds", json={"name": "Aspirin", "marker_id": "ARUCO1"}, headers=headers).json()

    resp = client.post("/events", json={"marker_id": "ARUCO1", "event_type": "accessed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["event_type"] == "accessed"
    assert body["medication_id"] == med["id"]


def test_report_event_unknown_marker_404(client):
    resp = client.post("/events", json={"marker_id": "GHOST", "event_type": "accessed"})
    assert resp.status_code == 404


def test_list_events_requires_auth(client):
    resp = client.get("/events")
    assert resp.status_code == 401


def test_list_events_scoped_to_owner(client, auth_headers):
    headers_a = auth_headers(email="a@b.com")
    headers_b = auth_headers(email="b@b.com")
    client.post("/meds", json={"name": "Aspirin", "marker_id": "A1"}, headers=headers_a).json()
    client.post("/events", json={"marker_id": "A1", "event_type": "accessed"})

    resp_a = client.get("/events", headers=headers_a)
    resp_b = client.get("/events", headers=headers_b)
    assert len(resp_a.json()) == 1
    assert resp_b.json() == []


def test_confirm_dose_decrements_stock(client, auth_headers):
    headers = auth_headers()
    med = client.post(
        "/meds", json={"name": "Aspirin", "stock": 10, "pills_per_dose": 2}, headers=headers
    ).json()

    resp = client.post("/events/confirm", json={"medication_id": med["id"]}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["event_type"] == "dose_confirmed"

    med_after = client.get(f"/meds/{med['id']}", headers=headers).json()
    assert med_after["stock"] == 8


def test_confirm_dose_stock_floors_at_zero(client, auth_headers):
    headers = auth_headers()
    med = client.post(
        "/meds", json={"name": "Aspirin", "stock": 1, "pills_per_dose": 5}, headers=headers
    ).json()

    client.post("/events/confirm", json={"medication_id": med["id"]}, headers=headers)

    med_after = client.get(f"/meds/{med['id']}", headers=headers).json()
    assert med_after["stock"] == 0


def test_confirm_dose_requires_auth(client, auth_headers):
    headers = auth_headers()
    med = client.post("/meds", json={"name": "Aspirin"}, headers=headers).json()

    resp = client.post("/events/confirm", json={"medication_id": med["id"]})
    assert resp.status_code == 401


def test_list_events_filtered_by_medication(client, auth_headers):
    headers = auth_headers()
    med1 = client.post("/meds", json={"name": "Aspirin", "marker_id": "A1"}, headers=headers).json()
    med2 = client.post("/meds", json={"name": "Ibuprofen", "marker_id": "A2"}, headers=headers).json()
    client.post("/events", json={"marker_id": "A1", "event_type": "accessed"})
    client.post("/events", json={"marker_id": "A2", "event_type": "accessed"})

    resp = client.get(f"/events?medication_id={med1['id']}", headers=headers)
    body = resp.json()
    assert len(body) == 1
    assert body[0]["medication_id"] == med1["id"]


def test_confirm_dose_not_owned_404(client, auth_headers):
    headers_a = auth_headers(email="a@b.com")
    headers_b = auth_headers(email="b@b.com")
    med = client.post("/meds", json={"name": "Aspirin"}, headers=headers_a).json()

    resp = client.post("/events/confirm", json={"medication_id": med["id"]}, headers=headers_b)
    assert resp.status_code == 404
