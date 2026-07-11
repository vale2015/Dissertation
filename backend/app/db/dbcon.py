import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool


# Locate the backend .env file for local development.
BACKEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)
ENV_PATH = os.path.join(BACKEND_DIR, ".env")

# Load local environment variables.
# Vercel provides its variables through the project configuration.
load_dotenv(ENV_PATH)


# Use the Vercel-Supabase integration URL in production.
# Fall back to DATABASE_URL during local development.
raw_database_url = (
    os.getenv("POSTGRES_URL")
    or os.getenv("DATABASE_URL")
)

if not raw_database_url:
    raise RuntimeError(
        "Database connection URL is missing. "
        "Expected POSTGRES_URL or DATABASE_URL."
    )


# Explicitly select the psycopg2 SQLAlchemy driver.
if raw_database_url.startswith("postgres://"):
    raw_database_url = raw_database_url.replace(
        "postgres://",
        "postgresql+psycopg2://",
        1,
    )
elif raw_database_url.startswith("postgresql://"):
    raw_database_url = raw_database_url.replace(
        "postgresql://",
        "postgresql+psycopg2://",
        1,
    )


# Parse the URL and remove integration metadata that psycopg2
# does not recognize as a database connection option.
database_url = make_url(raw_database_url)

query_parameters = dict(database_url.query)
query_parameters.pop("supa", None)
query_parameters["sslmode"] = "require"

database_url = database_url.set(query=query_parameters)


# Use a new database connection for each serverless invocation.
engine = create_engine(
    database_url,
    poolclass=NullPool,
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