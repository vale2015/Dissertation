from datetime import datetime, timedelta, timezone

from flask import Flask

from app.controllers import auth_controller
from app.services import auth_rate_limit_service as limits
from app.services import auth_service


class _Result:
    def __init__(self, row):
        self.row = row

    def mappings(self):
        return self

    def one(self):
        return self.row


class _Database:
    def __init__(self, row):
        self.row = row
        self.updates = []

    def execute(self, statement, params):
        sql = str(statement)
        if "INSERT INTO public.auth_rate_limits" in sql:
            return _Result(self.row)
        self.updates.append(params)
        return None


def _app():
    app = Flask(__name__)
    app.add_url_rule("/login", view_func=auth_controller.login_user, methods=["POST"])
    app.add_url_rule(
        "/reset", view_func=lambda: auth_controller.account_token_controller("password_reset"), methods=["POST"]
    )
    return app


def test_hmac_keys_are_scoped_and_do_not_store_email(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-signing-secret")
    first = limits._key_hash("login_email", "someone@example.com")
    second = limits._key_hash("login_ip", "someone@example.com")
    assert len(first) == 64
    assert first != second
    assert "someone@example.com" not in first


def test_exponential_block_is_capped():
    assert limits._block_seconds(limits.LOGIN_EMAIL, 1) == 30
    assert limits._block_seconds(limits.LOGIN_EMAIL, 2) == 60
    assert limits._block_seconds(limits.LOGIN_EMAIL, 10) == 900


def test_sixth_email_attempt_starts_temporary_block(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-signing-secret")
    now = datetime.now(timezone.utc)
    db = _Database({"attempt_count": 6, "blocked_until": None})
    retry_after = limits._reserve(db, limits.LOGIN_EMAIL, "someone@example.com", now)
    assert retry_after == 30
    assert db.updates[0]["blocked_until"] == now + timedelta(seconds=30)


def test_existing_block_does_not_extend_it(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-signing-secret")
    now = datetime.now(timezone.utc)
    db = _Database({"attempt_count": 6, "blocked_until": now + timedelta(seconds=17)})
    assert limits._reserve(db, limits.LOGIN_EMAIL, "someone@example.com", now) == 17
    assert db.updates == []


def test_login_returns_retry_after_without_checking_password(monkeypatch):
    monkeypatch.setattr(auth_controller, "reserve_login_attempt", lambda email, ip: 30)
    monkeypatch.setattr(
        auth_controller,
        "authenticate_user",
        lambda email, password: (_ for _ in ()).throw(AssertionError("password checked")),
    )
    response = _app().test_client().post(
        "/login", json={"email": "someone@example.com", "password": "wrong"}
    )
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "30"
    assert response.get_json()["error"] == "Too many attempts. Please try again later."


def test_login_failure_is_generic_for_unknown_account(monkeypatch):
    monkeypatch.setattr(auth_controller, "reserve_login_attempt", lambda email, ip: 0)
    monkeypatch.setattr(auth_controller, "authenticate_user", lambda email, password: None)
    response = _app().test_client().post(
        "/login", json={"email": "unknown@example.com", "password": "wrong"}
    )
    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_unknown_account_still_checks_a_password_hash(monkeypatch):
    class _Session:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def execute(self, *_args, **_kwargs):
            return self

        def mappings(self):
            return self

        def first(self):
            return None

    checked_hashes = []
    monkeypatch.setattr(auth_service, "SessionLocal", _Session)
    monkeypatch.setattr(
        auth_service,
        "check_password_hash",
        lambda password_hash, password: checked_hashes.append(password_hash) or False,
    )
    assert auth_service.authenticate_user("unknown@example.com", "wrong") is None
    assert checked_hashes == [auth_service.DUMMY_PASSWORD_HASH]


def test_login_rejects_non_object_json_before_rate_limit(monkeypatch):
    monkeypatch.setattr(
        auth_controller,
        "reserve_login_attempt",
        lambda email, ip: (_ for _ in ()).throw(AssertionError("rate limit checked")),
    )
    response = _app().test_client().post("/login", json=["not", "an", "object"])
    assert response.status_code == 400


def test_successful_login_clears_email_counter(monkeypatch):
    cleared = []
    monkeypatch.setattr(auth_controller, "reserve_login_attempt", lambda email, ip: 0)
    monkeypatch.setattr(auth_controller, "authenticate_user", lambda email, password: {"token": "jwt", "user": {"id": 1}})
    monkeypatch.setattr(auth_controller, "clear_login_email", cleared.append)
    response = _app().test_client().post(
        "/login", json={"email": "Someone@Example.com", "password": "correct"}
    )
    assert response.status_code == 200
    assert cleared == ["Someone@Example.com"]


def test_account_token_endpoint_is_throttled_before_token_lookup(monkeypatch):
    monkeypatch.setattr(auth_controller, "reserve_account_token_attempt", lambda ip: 60)
    monkeypatch.setattr(
        auth_controller,
        "validate_account_token",
        lambda token, purpose: (_ for _ in ()).throw(AssertionError("token checked")),
    )
    response = _app().test_client().post("/reset", json={"token": "anything"})
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"
    assert response.get_json()["error"]["code"] == "AUTH_THROTTLED"


def test_account_token_endpoint_handles_non_object_json(monkeypatch):
    monkeypatch.setattr(auth_controller, "reserve_account_token_attempt", lambda ip: 0)
    monkeypatch.setattr(
        auth_controller,
        "validate_account_token",
        lambda token, purpose: (_ for _ in ()).throw(auth_controller.InvalidAccountToken("Invalid token"))
        if token is None
        else (_ for _ in ()).throw(AssertionError("unexpected token")),
    )
    response = _app().test_client().post("/reset", json=["not", "an", "object"])
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "INVALID_ACCOUNT_LINK"
