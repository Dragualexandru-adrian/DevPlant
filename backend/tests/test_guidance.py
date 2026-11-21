import json

import httpx
import pytest
from sqlmodel import Session, select

from app import config, guidance
from app.guidance import GuidanceError, _clean_summary, get_guidance, summarize
from app.leaflet import LeafletError
from app.models import DrugCatalog, DrugGuidance

MODEL_REPLY = {
    "mod_utilizare": "Se înghite cu apă.",
    "doza_uzuala": "1-2 comprimate",
    "interval_doze_ore": 4,
    "interval_doze_text": "la 4-6 ore",
    "doza_maxima_zilnica": "8 comprimate",
    "efecte_adverse_principale": ["mâncărimi (rar)"],
    "efecte_adverse_grave": ["reacții alergice grave"],
}


@pytest.fixture
def entry(engine):
    with Session(engine) as session:
        e = DrugCatalog(name="PARACETAMOL 500 mg", dci="PARACETAMOLUM", leaflet_url="http://anm/PRO_1.pdf", spc_url="http://anm/RCP_1.pdf")
        session.add(e)
        session.commit()
        session.refresh(e)
        return e


@pytest.fixture
def fake_groq(monkeypatch):
    """Records Groq requests and answers with MODEL_REPLY."""
    calls = []
    reply = {"choices": [{"message": {"content": json.dumps(MODEL_REPLY)}}]}

    def fake_post(url, **kwargs):
        calls.append({"url": url, **kwargs})
        return httpx.Response(200, json=reply, request=httpx.Request("POST", url))

    monkeypatch.setattr(config, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(config, "GROQ_MODEL", "openai/gpt-oss-120b")
    monkeypatch.setattr(guidance.httpx, "post", fake_post)
    monkeypatch.setattr(guidance, "load_leaflet_sections", lambda url: {"dosage": "3. Cum să luați ... la 4-6 ore"})
    return calls


def test_summarize_sends_leaflet_text_and_parses_json(fake_groq, entry):
    result = summarize(entry, {"dosage": "3. Cum să luați: 1-2 comprimate la 4-6 ore"})
    assert result == MODEL_REPLY

    request = fake_groq[0]
    assert request["headers"]["Authorization"] == "Bearer test-key"
    assert request["json"]["response_format"] == {"type": "json_object"}
    assert request["json"]["reasoning_effort"] == "low"
    user_msg = request["json"]["messages"][1]["content"]
    assert "PARACETAMOL 500 mg" in user_msg and "1-2 comprimate la 4-6 ore" in user_msg


def test_summarize_requires_api_key(monkeypatch, entry):
    monkeypatch.setattr(config, "GROQ_API_KEY", "")
    with pytest.raises(GuidanceError, match="GROQ_API_KEY"):
        summarize(entry, {})


def test_summarize_wraps_groq_errors(monkeypatch, entry):
    monkeypatch.setattr(config, "GROQ_API_KEY", "k")
    monkeypatch.setattr(
        guidance.httpx, "post", lambda url, **k: httpx.Response(401, text="bad key", request=httpx.Request("POST", url))
    )
    with pytest.raises(GuidanceError, match="401"):
        summarize(entry, {})


def test_summarize_rejects_non_json_reply(monkeypatch, entry):
    monkeypatch.setattr(config, "GROQ_API_KEY", "k")
    monkeypatch.setattr(
        guidance.httpx,
        "post",
        lambda url, **k: httpx.Response(200, json={"choices": [{"message": {"content": "nu e json"}}]}, request=httpx.Request("POST", url)),
    )
    with pytest.raises(GuidanceError, match="invalid"):
        summarize(entry, {})


def test_clean_summary_drops_bad_types_and_unknown_keys():
    cleaned = _clean_summary({
        "mod_utilizare": "  ",
        "interval_doze_ore": "8",  # string, not number
        "efecte_adverse_principale": ["a", 3, "", "b", "c", "d", "e", "f", "g"],
        "efecte_adverse_grave": "nu e lista",
        "extra": "ignored",
    })
    assert cleaned["mod_utilizare"] is None
    assert cleaned["interval_doze_ore"] is None
    assert cleaned["efecte_adverse_principale"] == ["a", "b", "c", "d", "e", "f"]
    assert cleaned["efecte_adverse_grave"] == []
    assert "extra" not in cleaned
    assert _clean_summary({"interval_doze_ore": True})["interval_doze_ore"] is None
    assert _clean_summary({"interval_doze_ore": 0})["interval_doze_ore"] is None


def test_get_guidance_caches_per_leaflet(engine, entry, fake_groq):
    with Session(engine) as session:
        first = get_guidance(session, entry)
        second = get_guidance(session, entry)
        cached = session.exec(select(DrugGuidance)).all()

    assert len(fake_groq) == 1  # second call served from cache
    assert first == second
    assert first["interval_doze_ore"] == 4
    assert first["sursa_prospect"] == "http://anm/PRO_1.pdf"
    assert first["sursa_rcp"] == "http://anm/RCP_1.pdf"
    assert "medicului" in first["disclaimer"]
    assert len(cached) == 1 and json.loads(cached[0].summary_json)["doza_uzuala"] == "1-2 comprimate"


def test_get_guidance_without_leaflet_link(engine):
    with Session(engine) as session:
        with pytest.raises(GuidanceError, match="link"):
            get_guidance(session, DrugCatalog(name="X"))


def test_guidance_endpoint(client, entry, fake_groq):
    resp = client.get(f"/catalog/{entry.id}/guidance")
    assert resp.status_code == 200
    assert resp.json()["mod_utilizare"] == "Se înghite cu apă."


def test_guidance_endpoint_reports_leaflet_failure(client, entry, monkeypatch):
    def fail(url):
        raise LeafletError("Prospectul este scanat (imagine), fără text extractibil.")

    monkeypatch.setattr(guidance, "load_leaflet_sections", fail)
    resp = client.get(f"/catalog/{entry.id}/guidance")
    assert resp.status_code == 502
    assert "scanat" in resp.json()["detail"]


def test_guidance_endpoint_404(client):
    assert client.get("/catalog/12345/guidance").status_code == 404
