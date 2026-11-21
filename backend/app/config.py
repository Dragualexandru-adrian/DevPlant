import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./medguard.db")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5174").split(",")

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-dev-secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))

MISSED_DOSE_CHECK_INTERVAL_SECONDS = int(os.getenv("MISSED_DOSE_CHECK_INTERVAL_SECONDS", "15"))
DEFAULT_WINDOW_MINUTES = int(os.getenv("DEFAULT_WINDOW_MINUTES", "3"))

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
