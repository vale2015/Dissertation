import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool


# Locate backend/.env for local development.
BACKEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)
ENV_PATH = os.path.join(BACKEND_DIR, ".env")

# Load local variables without overriding variables supplied by Vercel.
load_dotenv(ENV_PATH, override=True)

def create_database_url():
    """
    Build the SQLAlchemy URL from separate POSTGRES_* variables.

    This avoids manually combining usernames, passwords, hosts and ports
    into one connection string.
    """

    postgres_user = os.getenv("POSTGRES_USER")
    postgres_password = os.getenv("POSTGRES_PASSWORD")
    postgres_host = os.getenv("POSTGRES_HOST")
    postgres_port = os.getenv("POSTGRES_PORT", "6543")
    postgres_database = (
        os.getenv("POSTGRES_DATABASE")
        or os.getenv("POSTGRES_DB")
        or "postgres"
    )

    # Prefer separate connection components when available.
    if (
        postgres_user
        and postgres_password
        and postgres_host
        and postgres_database
    ):
        try:
            port = int(postgres_port)
        except (TypeError, ValueError) as error:
            raise RuntimeError(
                "POSTGRES_PORT must be a valid number."
            ) from error

        return URL.create(
            drivername="postgresql+psycopg2",
            username=postgres_user,
            password=postgres_password,
            host=postgres_host,
            port=port,
            database=postgres_database,
        )

    # Fall back to a complete URL provided by Vercel or another environment.
    raw_database_url = (
        os.getenv("POSTGRES_URL")
        or os.getenv("DATABASE_URL")
    )

    if not raw_database_url:
        raise RuntimeError(
            "Database configuration is missing. Configure the POSTGRES_* "
            "variables, POSTGRES_URL or DATABASE_URL."
        )

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

    database_url = make_url(raw_database_url)

    # Remove Vercel/Supabase metadata unsupported by psycopg2.
    query_parameters = dict(database_url.query)
    query_parameters.pop("supa", None)

    return database_url.set(query=query_parameters)


database_url = create_database_url()


# Use a fresh client connection through Supabase's transaction pooler.
engine = create_engine(
    database_url,
    poolclass=NullPool,
    connect_args={
        "sslmode": "require",
    },
    future=True,
    echo=False,
)


# Reusable SQLAlchemy session factory.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)