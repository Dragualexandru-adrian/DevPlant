from app.schemas import MedicationCreate, ScheduleCreate, UserCreate


def test_user_create_defaults_to_patient_role():
    user = UserCreate(name="A B", email="a@b.com", password="x")
    assert user.role == "patient"


def test_medication_create_defaults():
    med = MedicationCreate(name="Aspirin")
    assert med.pills_per_dose == 1
    assert med.stock == 0
    assert med.marker_id is None


def test_schedule_create_defaults_window_minutes():
    sched = ScheduleCreate(medication_id=1, time="08:00", days_of_week="mon,tue")
    assert sched.window_minutes == 3
