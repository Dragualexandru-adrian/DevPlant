def test_create_schedule_for_owned_medication(client, auth_headers):
    headers = auth_headers()
    med = client.post("/meds", json={"name": "Aspirin"}, headers=headers).json()

    resp = client.post(
        "/schedules",
        json={"medication_id": med["id"], "time": "08:00", "days_of_week": "mon,tue"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["window_minutes"] == 3


def test_create_schedule_for_unowned_medication_404(client, auth_headers):
    headers_a = auth_headers(email="a@b.com")
    headers_b = auth_headers(email="b@b.com")
    med = client.post("/meds", json={"name": "Aspirin"}, headers=headers_a).json()

    resp = client.post(
        "/schedules",
        json={"medication_id": med["id"], "time": "08:00", "days_of_week": "mon"},
        headers=headers_b,
    )
    assert resp.status_code == 404


def test_list_schedules_filtered_by_medication(client, auth_headers):
    headers = auth_headers()
    med1 = client.post("/meds", json={"name": "Aspirin"}, headers=headers).json()
    med2 = client.post("/meds", json={"name": "Ibuprofen"}, headers=headers).json()
    client.post(
        "/schedules",
        json={"medication_id": med1["id"], "time": "08:00", "days_of_week": "mon"},
        headers=headers,
    )
    client.post(
        "/schedules",
        json={"medication_id": med2["id"], "time": "09:00", "days_of_week": "tue"},
        headers=headers,
    )

    resp = client.get(f"/schedules?medication_id={med1['id']}", headers=headers)
    body = resp.json()
    assert len(body) == 1
    assert body[0]["medication_id"] == med1["id"]


def test_list_schedules_requires_auth(client):
    resp = client.get("/schedules")
    assert resp.status_code == 401


def test_delete_schedule(client, auth_headers):
    headers = auth_headers()
    med = client.post("/meds", json={"name": "Aspirin"}, headers=headers).json()
    sched = client.post(
        "/schedules",
        json={"medication_id": med["id"], "time": "08:00", "days_of_week": "mon"},
        headers=headers,
    ).json()

    resp = client.delete(f"/schedules/{sched['id']}", headers=headers)
    assert resp.status_code == 200

    resp = client.get(f"/schedules?medication_id={med['id']}", headers=headers)
    assert resp.json() == []


def test_delete_schedule_missing_404(client, auth_headers):
    headers = auth_headers()
    resp = client.delete("/schedules/999", headers=headers)
    assert resp.status_code == 404


def test_delete_schedule_not_owned_404(client, auth_headers):
    headers_a = auth_headers(email="a@b.com")
    headers_b = auth_headers(email="b@b.com")
    med = client.post("/meds", json={"name": "Aspirin"}, headers=headers_a).json()
    sched = client.post(
        "/schedules",
        json={"medication_id": med["id"], "time": "08:00", "days_of_week": "mon"},
        headers=headers_a,
    ).json()

    resp = client.delete(f"/schedules/{sched['id']}", headers=headers_b)
    assert resp.status_code == 404
