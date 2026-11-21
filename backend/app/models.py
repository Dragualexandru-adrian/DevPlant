from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class User(BaseModel):
    id: Optional[int] = None
    name: str
    email: str
    hashed_password: str
    role: str = "patient"  # "patient" or "caregiver"
    expo_push_token: Optional[str] = None


class Medication(BaseModel):
    id: Optional[int] = None
    owner_id: int
    name: str
    concentration: Optional[str] = None
    pills_per_dose: int = 1
    stock: int = 0
    marker_id: Optional[str] = None


class Schedule(BaseModel):
    id: Optional[int] = None
    medication_id: int
    time: str  # "HH:MM", 24h
    days_of_week: str  # csv, e.g. "mon,tue,wed,thu,fri,sat,sun"
    window_minutes: int = 3
    end_date: Optional[str] = None  # "YYYY-MM-DD"; None = no end date


class Event(BaseModel):
    id: Optional[int] = None
    medication_id: int
    event_type: str  # "accessed" | "dose_confirmed" | "missed_alert"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    occurrence: Optional[str] = None  # missed_alert only: "<schedule_id>@YYYY-MM-DD HH:MM", dedupes across restarts


class DrugCatalog(BaseModel):
    """One authorised medicine from the ANM list (CSV), deduplicated across pack sizes."""

    id: Optional[int] = None
    name: str  # "Denumire comerciala"
    dci: Optional[str] = None  # active substance (INN)
    form: Optional[str] = None  # "Forma farmaceutica"
    atc_code: Optional[str] = None
    concentration: Optional[str] = None
    holder: Optional[str] = None  # "Firma detinatoare" (marketing authorisation holder)
    leaflet_url: Optional[str] = None  # "Link prospect"
    spc_url: Optional[str] = None  # "Link RCP"


class DrugGuidance(BaseModel):
    """Cached AI summary of a patient leaflet, keyed by leaflet URL (shared by many catalog rows)."""

    id: Optional[int] = None
    leaflet_url: str
    summary_json: str
    model: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
