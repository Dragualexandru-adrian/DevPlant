from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default="patient")  # "patient" or "caregiver"
    expo_push_token: Optional[str] = None


class Medication(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id")
    name: str
    concentration: Optional[str] = None
    pills_per_dose: int = 1
    stock: int = 0
    marker_id: Optional[str] = Field(default=None, unique=True, index=True)


class Schedule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    medication_id: int = Field(foreign_key="medication.id")
    time: str  # "HH:MM", 24h
    days_of_week: str  # csv, e.g. "mon,tue,wed,thu,fri,sat,sun"
    window_minutes: int = 3
    end_date: Optional[str] = None  # "YYYY-MM-DD"; None = no end date


class Event(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    medication_id: int = Field(foreign_key="medication.id")
    event_type: str  # "accessed" | "dose_confirmed" | "missed_alert"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DrugCatalog(SQLModel, table=True):
    """One authorised medicine from the ANM list (CSV), deduplicated across pack sizes."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)  # "Denumire comerciala"
    dci: Optional[str] = None  # active substance (INN)
    form: Optional[str] = None  # "Forma farmaceutica"
    atc_code: Optional[str] = None
    concentration: Optional[str] = None
    holder: Optional[str] = None  # "Firma detinatoare" (marketing authorisation holder)
    leaflet_url: Optional[str] = Field(default=None, index=True)  # "Link prospect"
    spc_url: Optional[str] = None  # "Link RCP"


class DrugGuidance(SQLModel, table=True):
    """Cached AI summary of a patient leaflet, keyed by leaflet URL (shared by many catalog rows)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    leaflet_url: str = Field(unique=True, index=True)
    summary_json: str
    model: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
