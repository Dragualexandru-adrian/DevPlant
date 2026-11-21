"""ANM drug catalog: CSV import + fuzzy search.

Matching is deterministic (rapidfuzz), not AI: the OCR text or typed query is
matched against catalog names/DCI here, and only the chosen entry's leaflet is
sent to the LLM later. keras-ocr only emits lowercase [a-z0-9], so both sides
are normalised (upper-case, no diacritics, alphanumerics only) before scoring.
"""

import csv
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from rapidfuzz import fuzz, process
from pymongo.database import Database

from app import db as store

from app.models import DrugCatalog

# CSV header -> DrugCatalog field. Pack-level columns (Ambalaj, Cod CIM,
# Nr. autorizare, Link ambalaj) are dropped: they only differ per box size.
CSV_COLUMNS = {
    "Denumire comerciala": "name",
    "DCI": "dci",
    "Forma farmaceutica": "form",
    "Cod ATC": "atc_code",
    "Concentratie": "concentration",
    "Firma detinatoare": "holder",
    "Link prospect": "leaflet_url",
    "Link RCP": "spc_url",
}
DEDUP_FIELDS = ("name", "concentration", "form", "leaflet_url")

# Scores are 0-100. Below these a result is unrelated noise, not a match.
MIN_OCR_SCORE = 70
MIN_SEARCH_SCORE = 60


def normalize(text: str | None) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^A-Za-z0-9]+", " ", text)
    return " ".join(text.upper().split())


def read_csv_rows(path: Path) -> list[dict]:
    """Read the ANM CSV (';'-separated, UTF-8) into deduplicated DrugCatalog dicts."""
    seen: set[tuple] = set()
    rows: list[dict] = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        missing = set(CSV_COLUMNS) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV is missing columns: {sorted(missing)}")
        for raw in reader:
            row = {field: (raw.get(col) or "").strip() or None for col, field in CSV_COLUMNS.items()}
            if not row["name"]:
                continue
            key = tuple(row[k] for k in DEDUP_FIELDS)
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
    return rows


def import_csv(db: Database, path: Path) -> int:
    """Replace the whole catalog with the CSV contents. Returns rows stored."""
    rows = read_csv_rows(path)
    coll = db[store.coll(DrugCatalog)]
    coll.delete_many({})
    if rows:
        coll.insert_many([{"_id": i, **{k: v for k, v in row.items() if v is not None}} for i, row in enumerate(rows, 1)])
    store.set_counter(db, store.coll(DrugCatalog), len(rows))
    _index_cache.clear()
    return len(rows)


@dataclass
class _Index:
    ids: list[int]
    names: list[str]  # normalised trade names
    dcis: list[str]  # normalised active substances


# Keyed by (database identity, row count, max id): a re-import (even from the CLI
# script while the server runs) or a different test DB rebuilds it.
_index_cache: dict[tuple, _Index] = {}


def _get_index(db: Database) -> _Index:
    coll = db[store.coll(DrugCatalog)]
    count = coll.count_documents({})
    last = coll.find_one({}, {"_id": 1}, sort=[("_id", -1)])
    key = (id(db), count, last["_id"] if last else None)
    index = _index_cache.get(key)
    if index is None:
        rows = list(coll.find({}, {"name": 1, "dci": 1}).sort("_id", 1))
        index = _Index(
            ids=[r["_id"] for r in rows],
            names=[normalize(r.get("name")) for r in rows],
            dcis=[normalize(r.get("dci")) for r in rows],
        )
        _index_cache.clear()
        _index_cache[key] = index
    return index


def _fetch(db: Database, scored: list[tuple[int, float]], limit: int) -> list[tuple[DrugCatalog, float]]:
    """Turn (index position, score) pairs into catalog rows, best first."""
    index = _get_index(db)
    scored = sorted(scored, key=lambda s: (-s[1], len(index.names[s[0]])))[:limit]
    ids = [index.ids[pos] for pos, _ in scored]
    by_id = {e.id: e for e in store.find(db, DrugCatalog, {"_id": {"$in": ids}})}
    return [(by_id[index.ids[pos]], round(score, 1)) for pos, score in scored if index.ids[pos] in by_id]


def search(db: Database, query: str, limit: int = 10) -> list[tuple[DrugCatalog, float]]:
    """Fuzzy search by trade name or active substance (typed query)."""
    q = normalize(query)
    index = _get_index(db)
    if not q or not index.ids:
        return []

    scores: dict[int, float] = {}
    for choices, weight in ((index.names, 1.0), (index.dcis, 0.9)):
        for _, score, pos in process.extract(q, choices, scorer=fuzz.WRatio, limit=limit * 20):
            scores[pos] = max(scores.get(pos, 0.0), score * weight)
    # A name that starts with what was typed is what the user means ("parac" -> PARACETAMOL ...).
    for pos, name in enumerate(index.names):
        if name.startswith(q):
            scores[pos] = max(scores.get(pos, 0.0), 100.0)

    return _fetch(db, [(pos, s) for pos, s in scores.items() if s >= MIN_SEARCH_SCORE], limit)


def match_ocr_lines(db: Database, lines: list[str], limit: int = 5) -> list[tuple[DrugCatalog, float]]:
    """Best catalog entries for the text read off a medicine box.

    A box carries many lines (company, "comprimate", lot no.); each catalog name is
    scored against every line and keeps its best score, so noise lines don't
    drag down the line that actually holds the name.
    """
    index = _get_index(db)
    lines_norm = [normalize(line) for line in lines]
    lines_norm = [q for q in lines_norm if q]
    # Adjacent lines joined too: "PARACETAMOL" / "500 mg" are often split.
    joined = [f"{a} {b}" for a, b in zip(lines_norm, lines_norm[1:])]
    # Lines like "500 MG" or "20" partially match hundreds of names equally; a
    # query needs real letters to be worth scoring.
    queries = [q for q in lines_norm + joined if sum(c.isalpha() for c in q) >= 4]
    if not queries or not index.ids:
        return []

    matrix = process.cdist(queries, index.names, scorer=fuzz.WRatio, workers=-1)
    best = matrix.max(axis=0)
    # Partial matching scores "FARINGO" the same against FARINGOSEPT and FARINGO HOT DRINK;
    # a trade name whose first word was read exactly on the box is the better match.
    # Only the first line counts: callers send the most prominent text first (the phone
    # orders by letter size), and later lines hold generic words (PARACETAMOL, SOLUTIE...).
    words = {w for w in lines_norm[0].split() if sum(c.isalpha() for c in w) >= 4} if lines_norm else set()
    scored = []
    for pos, score in enumerate(best):
        name = index.names[pos]
        if name and name.split(" ", 1)[0] in words:
            score = 100.0
        if score >= MIN_OCR_SCORE:
            scored.append((pos, float(score)))
    return _fetch(db, scored, limit)
