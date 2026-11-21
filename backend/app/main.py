import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.background import missed_dose_loop
from app.config import CORS_ORIGINS
from app.db import init_db
from app.routers import auth, events, meds, schedules

app = FastAPI(title="MedGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(meds.router)
app.include_router(schedules.router)
app.include_router(events.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    asyncio.create_task(missed_dose_loop())


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
