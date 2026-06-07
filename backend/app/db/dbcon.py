import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV_PATH = os.path.join(BACKEND_DIR, ".env")

# Load environment variables, including the database connection string.
load_dotenv(ENV_PATH)

# Read the Supabase/PostgreSQL database URL from the .env file.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(f"DATABASE_URL is missing. Expected it in: {ENV_PATH}")

# Create the SQLAlchemy engine used to connect to the PostgreSQL database.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"},
    future=True,
    echo=False
)

# Create a reusable database session factory for queries and transactions.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)