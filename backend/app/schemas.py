from typing import Optional

from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    password: str
    role: str = "patient"


class UserRead(BaseModel):
    id: int
    email: str
    role: str


class PushTokenUpdate(BaseModel):
    expo_push_token: str


class MedicationCreate(BaseModel):
    name: str
    concentration: Optional[str] = None
    pills_per_dose: int = 1
    stock: int = 0
    marker_id: Optional[str] = None


class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    concentration: Optional[str] = None
    pills_per_dose: Optional[int] = None
    stock: Optional[int] = None
    marker_id: Optional[str] = None


class ScheduleCreate(BaseModel):
    medication_id: int
    time: str
    days_of_week: str
    window_minutes: int = 3


class EventIn(BaseModel):
    marker_id: str
    event_type: str  # "accessed"


class DoseConfirm(BaseModel):
    medication_id: int
