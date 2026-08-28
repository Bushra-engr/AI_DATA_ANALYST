from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from sqlalchemy.orm import declarative_base
from pathlib import Path
import os

# Load .env reliably from backend or root directory
env_path_backend = Path(__file__).resolve().parents[2] / ".env"
env_path_root = Path(__file__).resolve().parents[3] / ".env"

if env_path_backend.exists():
    load_dotenv(dotenv_path=env_path_backend)
elif env_path_root.exists():
    load_dotenv(dotenv_path=env_path_root)
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    url=DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20,
)


Base = declarative_base()

SessionLocal = sessionmaker(
    autoflush=False,
    autocommit = False,
    bind = engine
)


