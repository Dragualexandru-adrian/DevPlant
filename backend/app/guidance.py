"""AI summary of a medicine's leaflet: how to take it, time between doses, main side effects.

The LLM (Groq) only ever sees text extracted from the official ANM leaflet and is
told to answer from that text alone, returning null for anything not stated.
Results are cached per leaflet URL, so each leaflet is summarised once.
"""

import json

import httpx
from sqlmodel import Session, select

from app import config
from app.leaflet import load_leaflet_sections
from app.models import DrugCatalog, DrugGuidance

DISCLAIMER = (
    "Rezumat generat automat din prospectul oficial ANM. Nu înlocuiește sfatul "
    "medicului sau farmacistului; urmați întotdeauna prescripția medicului."
)

SUMMARY_FIELDS = {
    "mod_utilizare": None,
    "doza_uzuala": None,
    "interval_doze_ore": None,
    "interval_doze_text": None,
    "doza_maxima_zilnica": None,
    "efecte_adverse_principale": [],
    "efecte_adverse_grave": [],
}

SYSTEM_PROMPT = """Ești un asistent farmaceutic. Primești fragmente din prospectul oficial al unui medicament (ANM, România).
Răspunzi DOAR pe baza textului primit. Nu folosi cunoștințe proprii, nu ghici, nu inventa doze.
Dacă o informație nu apare în text, pune null (sau listă goală).
Când prospectul dă doze diferite pe categorii, descrie doza pentru adulți; menționează copiii doar dacă textul se referă numai la ei.
Scrie în limba română, foarte concis (pentru un pacient vârstnic).

Returnează exclusiv un obiect JSON cu cheile:
- "mod_utilizare": string, 1-2 propoziții: cum se ia (ex. înghițit cu apă, înainte/după masă).
- "doza_uzuala": string, doza obișnuită per administrare (ex. "1-2 comprimate").
- "interval_doze_ore": număr, intervalul MINIM în ore dintre două doze, dacă textul îl precizează (ex. 4, 8, 24). null dacă nu.
- "interval_doze_text": string, cum formulează prospectul intervalul/frecvența (ex. "la 4-6 ore", "o dată pe zi").
- "doza_maxima_zilnica": string sau null.
- "efecte_adverse_principale": listă de max. 6 stringuri scurte: reacțiile adverse din secțiunea 4, începând cu cele mai frecvente, cu frecvența în paranteză (ex. "greață (frecvent)", "mâncărimi (rar)"). Include-le chiar dacă prospectul le declară toate rare. Listă goală doar dacă textul nu menționează niciuna.
- "efecte_adverse_grave": listă de max. 4 stringuri scurte, reacțiile pentru care pacientul trebuie să oprească tratamentul sau să meargă imediat la medic."""


class GuidanceError(Exception):
    """The AI summary could not be produced."""


def _build_user_prompt(entry: DrugCatalog, sections: dict[str, str]) -> str:
    titles = {
        "dosage": "SECȚIUNEA 3 — CUM SĂ LUAȚI MEDICAMENTUL",
        "side_effects": "SECȚIUNEA 4 — REACȚII ADVERSE POSIBILE",
        "full_text": "TEXTUL PROSPECTULUI",
    }
    parts = [f"Medicament: {entry.name}"]
    if entry.dci:
        parts.append(f"Substanță activă: {entry.dci}")
    if entry.concentration:
        parts.append(f"Concentrație: {entry.concentration}")
    if entry.form:
        parts.append(f"Formă farmaceutică: {entry.form}")
    for key, body in sections.items():
        parts.append(f"\n=== {titles.get(key, key)} ===\n{body}")
    return "\n".join(parts)


def _clean_summary(raw: dict) -> dict:
    """Keep only expected keys with sane types; the model is not trusted to follow the schema exactly."""
    out = dict(SUMMARY_FIELDS)
    for key in ("mod_utilizare", "doza_uzuala", "interval_doze_text", "doza_maxima_zilnica"):
        value = raw.get(key)
        out[key] = value.strip() if isinstance(value, str) and value.strip() else None
    interval = raw.get("interval_doze_ore")
    if isinstance(interval, (int, float)) and not isinstance(interval, bool) and 0 < interval <= 24 * 7:
        out["interval_doze_ore"] = interval
    for key, cap in (("efecte_adverse_principale", 6), ("efecte_adverse_grave", 4)):
        items = raw.get(key)
        if isinstance(items, list):
            out[key] = [s.strip() for s in items if isinstance(s, str) and s.strip()][:cap]
    return out


def summarize(entry: DrugCatalog, sections: dict[str, str]) -> dict:
    if not config.GROQ_API_KEY:
        raise GuidanceError("GROQ_API_KEY lipsește din backend/.env.")

    body = {
        "model": config.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(entry, sections)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
    }
    if config.GROQ_MODEL.startswith("openai/gpt-oss"):
        body["reasoning_effort"] = "low"  # extraction task; keeps latency down

    try:
        resp = httpx.post(
            config.GROQ_CHAT_URL,
            headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
            json=body,
            timeout=60.0,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return _clean_summary(json.loads(content))
    except httpx.HTTPStatusError as exc:
        raise GuidanceError(f"Groq a răspuns cu {exc.response.status_code}: {exc.response.text[:300]}") from exc
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as exc:
        raise GuidanceError(f"Răspuns invalid de la modelul AI: {exc}") from exc


def get_guidance(session: Session, entry: DrugCatalog) -> dict:
    """Summary for a catalog entry, from cache or freshly generated. Raises LeafletError / GuidanceError."""
    if not entry.leaflet_url:
        raise GuidanceError("Medicamentul nu are link către prospect în catalog.")

    cached = session.exec(select(DrugGuidance).where(DrugGuidance.leaflet_url == entry.leaflet_url)).first()
    if cached:
        summary, model = json.loads(cached.summary_json), cached.model
    else:
        sections = load_leaflet_sections(entry.leaflet_url)
        summary, model = summarize(entry, sections), config.GROQ_MODEL
        session.add(DrugGuidance(leaflet_url=entry.leaflet_url, summary_json=json.dumps(summary, ensure_ascii=False), model=model))
        session.commit()

    return {
        **summary,
        "sursa_prospect": entry.leaflet_url,
        "sursa_rcp": entry.spc_url,
        "model": model,
        "disclaimer": DISCLAIMER,
    }
