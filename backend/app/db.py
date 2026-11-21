"""MongoDB access (Atlas in production, mongomock in tests).

Documents keep integer ids (stored as `_id`, exposed as `id`) so the API, the
frontend and the Pi (marker_id -> medication id) work the same as with SQLite.
Ids come from an atomic counter per collection.
"""

from typing import Optional, TypeVar

from pydantic import BaseModel
from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument
from pymongo.database import Database

from app.config import MONGODB_DB, MONGODB_URI

M = TypeVar("M", bound=BaseModel)

_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        if not MONGODB_URI:
            raise RuntimeError("MONGODB_URI lipsește din backend/.env")
        _client = MongoClient(MONGODB_URI, tz_aware=True, serverSelectionTimeoutMS=10000)
    return _client


def get_db() -> Database:
    """FastAPI dependency (overridden with a mongomock database in tests)."""
    return get_client()[MONGODB_DB]


def init_db(db: Optional[Database] = None) -> None:
    db = get_db() if db is None else db
    db.user.create_index("email", unique=True)
    db.medication.create_index("owner_id")
    # sparse: medications without a marker are stored without the field (see _to_doc)
    db.medication.create_index("marker_id", unique=True, sparse=True)
    db.schedule.create_index("medication_id")
    db.event.create_index([("medication_id", ASCENDING), ("timestamp", DESCENDING)])
    db.drugguidance.create_index("leaflet_url", unique=True)


def coll(cls: type[BaseModel]) -> str:
    return cls.__name__.lower()


def next_id(db: Database, name: str) -> int:
    doc = db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return doc["seq"]


def set_counter(db: Database, name: str, value: int) -> None:
    db.counters.update_one({"_id": name}, {"$set": {"seq": value}}, upsert=True)


def _to_doc(model: BaseModel) -> dict:
    # None values are left out, so the sparse unique index on marker_id ignores them.
    doc = model.model_dump(exclude={"id"}, exclude_none=True)
    doc["_id"] = model.id
    return doc


def load(cls: type[M], doc: Optional[dict]) -> Optional[M]:
    if doc is None:
        return None
    doc = dict(doc)
    doc["id"] = doc.pop("_id")
    return cls(**doc)


def insert(db: Database, model: M) -> M:
    model.id = next_id(db, coll(type(model)))
    db[coll(type(model))].insert_one(_to_doc(model))
    return model


def save(db: Database, model: BaseModel) -> None:
    db[coll(type(model))].replace_one({"_id": model.id}, _to_doc(model))


def get(db: Database, cls: type[M], id_: int) -> Optional[M]:
    return load(cls, db[coll(cls)].find_one({"_id": id_}))


def find_one(db: Database, cls: type[M], query: dict) -> Optional[M]:
    return load(cls, db[coll(cls)].find_one(query))


def find(db: Database, cls: type[M], query: Optional[dict] = None, sort: Optional[list] = None) -> list[M]:
    cursor = db[coll(cls)].find(query or {})
    if sort:
        cursor = cursor.sort(sort)
    return [load(cls, d) for d in cursor]


def delete(db: Database, cls: type[BaseModel], id_: int) -> None:
    db[coll(cls)].delete_one({"_id": id_})
