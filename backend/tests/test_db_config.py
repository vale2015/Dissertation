import traceback

import pytest

from app.db.dbcon import create_database_url


@pytest.mark.parametrize("key", ["DATABASE_URL", "POSTGRES_URL"])
def test_invalid_url_does_not_expose_password(monkeypatch, key):
    for component in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_HOST"):
        monkeypatch.delenv(component, raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    monkeypatch.setenv(
        key,
        "postgresql://reader:private-marker@db.example.test:secret-fragment/postgres",
    )

    with pytest.raises(RuntimeError) as error:
        create_database_url()

    assert "private-marker" not in str(error.value)
    assert "secret-fragment" not in str(error.value)
    assert "secret-fragment" not in "".join(traceback.format_exception(error.value))
    assert "configuration is invalid" in str(error.value)
    assert error.value.__cause__ is None


def test_unrecognized_database_url_is_redacted(monkeypatch):
    for component in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_HOST"):
        monkeypatch.delenv(component, raising=False)
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "not-a-url-private-marker")

    with pytest.raises(RuntimeError) as error:
        create_database_url()

    assert "private-marker" not in "".join(traceback.format_exception(error.value))
    assert error.value.__cause__ is None


def test_encoded_password_url_is_accepted(monkeypatch):
    for component in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_HOST"):
        monkeypatch.delenv(component, raising=False)
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://reader:private%40marker@db.example.test:6543/postgres",
    )

    url = create_database_url()

    assert url.password == "private@marker"
    assert url.host == "db.example.test"
    assert url.port == 6543
