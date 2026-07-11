import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool


# Locate the backend .env file for local development.
BACKEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)
ENV_PATH = os.path.join(BACKEND_DIR, ".env")

# Load local environment variables.
# On Vercel, variables are provided by the project configuration.
load_dotenv(ENV_PATH)


# Prefer the URL provided by the Vercel-Supabase integration.
# Fall back to DATABASE_URL when running locally.
DATABASE_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "Database connection URL is missing. "
        "Expected POSTGRES_URL or DATABASE_URL."
    )


# Convert the Supabase URL into an explicit SQLAlchemy psycopg2 URL.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql+psycopg2://",
        1,
    )
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+psycopg2://",
        1,
    )


# NullPool is appropriate for serverless deployments because each
# invocation opens and closes its own database connection.
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    connect_args={"sslmode": "require"},
    future=True,
    echo=False,
)


# Create reusable database sessions.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)