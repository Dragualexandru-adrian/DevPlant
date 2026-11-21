"""One-off copy of the old SQLite database (medguard.db) into MongoDB (MONGODB_URI in .env).

Keeps the integer ids, so tokens, marker_ids and the frontend keep working, and
moves the id counters past the highest copied id. Documents that already exist in
Mongo with the same id are overwritten.

Usage (from backend/, venv active):
    python -m scripts.migrate_sqlite_to_mongo            # reads ./medguard.db
    python -m scripts.migrate_sqlite_to_mongo path/to/medguard.db
"""

import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from app import db as store
from app.db import get_db, init_db

TABLES = ["user", "medication", "schedule", "event", "drugcatalog", "drugguidance"]
DATETIME_FIELDS = {"timestamp", "created_at"}


def _convert(row: sqlite3.Row) -> dict:
    doc = {}
    for key in row.keys():
        value = row[key]
        if value is None:
            continue  # absent field == None for the models (and the sparse marker_id index)
        if key in DATETIME_FIELDS and isinstance(value, str):
            value = datetime.fromisoformat(value)
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)  # SQLite stored UTC without offset
        doc["_id" if key == "id" else key] = value
    return doc


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "medguard.db")
    if not path.is_file():
        sys.exit(f"Nu găsesc {path}")

    src = sqlite3.connect(path)
    src.row_factory = sqlite3.Row
    existing = {r[0] for r in src.execute("select name from sqlite_master where type='table'")}

    db = get_db()
    init_db(db)
    for table in TABLES:
        if table not in existing:
            continue
        docs = [_convert(r) for r in src.execute(f'select * from "{table}"')]
        if docs:
            db[table].delete_many({"_id": {"$in": [d["_id"] for d in docs]}})
            db[table].insert_many(docs)
            current = (db.counters.find_one({"_id": table}) or {}).get("seq", 0)
            store.set_counter(db, table, max(current, max(d["_id"] for d in docs)))
        print(f"{table}: {len(docs)} documente")


if __name__ == "__main__":
    main()
