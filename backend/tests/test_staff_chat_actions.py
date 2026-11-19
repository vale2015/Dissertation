import uuid
from datetime import datetime, timedelta, timezone

import pytest
from flask import Flask, g

from app.api.staff_route import staff_bp
from app.controllers import staff_chat_controller
from app.services import staff_chat_service
from app.services import staff_service
from app.services.staff_service import StaffConflict
from app.services.staff_validation_service import StaffValidationError


@pytest.fixture(autouse=True)
def no_live_budget_storage(monkeypatch):
    monkeypatch.setattr(staff_chat_controller, "reserve_staff_chat_attempt", lambda _actor: 0)


def test_staff_chat_lookup_is_manager_only(monkeypatch):
    app = Flask(__name__)
    app.register_blueprint(staff_bp, url_prefix="/staff")

    @app.before_request
    def actor():
        g.current_user = {"id": 7, "role": app.config["ROLE"]}

    monkeypatch.setattr(staff_chat_controller, "lookup_staff", lambda query: {"matches": [{"id": 9, "email": "a@example.com"}], "more": False})
    app.config["ROLE"] = "supervisor"
    assert app.test_client().get("/staff/chat-lookup?query=Ann").status_code == 403
    app.config["ROLE"] = "manager"
    response = app.test_client().get("/staff/chat-lookup?query=Ann")
    assert response.status_code == 200
    assert response.get_json()["matches"][0]["id"] == 9


def test_staff_chat_create_rejects_oversized_or_non_json_body(monkeypatch):
    app = Flask(__name__)
    app.register_blueprint(staff_bp, url_prefix="/staff")

    @app.before_request
    def actor():
        g.current_user = {"id": 7, "role": "manager"}

    monkeypatch.setattr(staff_chat_controller, "create_action", lambda *_: {"action": {"id": "unused"}})
    client = app.test_client()
    assert client.post("/staff/chat-actions", data="hello", content_type="text/plain").status_code == 400
    assert client.post("/staff/chat-actions", data='{"kind":"register","padding":"' + "x" * 2050 + '"}', content_type="application/json").status_code == 400


def test_draft_rejects_password_and_uneditable_email():
    with pytest.raises(StaffValidationError):
        staff_chat_service._validate_patch("register", {"password": "secret password"})
    with pytest.raises(StaffValidationError):
        staff_chat_service._validate_patch("edit", {"email": "changed@example.com"})
    assert staff_chat_service._validate_patch("register", {"email": " Ann@Example.com "}) == {"email": "ann@example.com"}


def test_confirmation_requires_separate_explicit_decision():
    action_id = uuid.uuid4()
    for body in ({"confirm": False, "revision": 1}, {"confirm": True, "revision": "1"}):
        with pytest.raises(StaffValidationError):
            staff_chat_service.confirm_action(action_id, 7, body)


class _Result:
    def __init__(self, row=None):
        self.row = row

    def mappings(self):
        return self

    def first(self):
        return self.row


class _Session:
    def __init__(self, row):
        self.row = row
        self.created = 0
        self.audit = 0
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, statement, params=None):
        sql = str(statement)
        if "SELECT id,actor_user_id,kind,state" in sql:
            return _Result(self.row)
        if "pg_advisory_xact_lock" in sql:
            return _Result()
        if "SELECT role,status FROM public.users" in sql:
            return _Result({"role": "manager", "status": "active"})
        if "SELECT 1 FROM public.staff_roles" in sql:
            return _Result((1,))
        if "INSERT INTO public.users" in sql:
            self.created += 1
            return _Result((55,))
        if "INSERT INTO public.staff_account_audit" in sql:
            self.audit += 1
            return _Result()
        if "UPDATE public.staff_chat_actions SET state='completed'" in sql:
            self.row["state"] = "completed"
            self.row["result_user_id"] = params["result"]
            import json
            self.row["result_snapshot"] = json.loads(params["snapshot"])
            return _Result()
        raise AssertionError(f"Unexpected SQL: {sql}")

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass


def test_confirmed_registration_is_once_only_and_draft_has_no_password(monkeypatch):
    action_id = uuid.uuid4()
    row = {
        "id": action_id,
        "actor_user_id": 7,
        "kind": "register",
        "state": "review",
        "target_user_id": None,
        "draft": {"full_name": "Ann Cook", "email": "ann@example.com", "application_role": "staff", "staff_role_id": 2},
        "before_snapshot": None,
        "after_snapshot": None,
        "expected_updated_at": None,
        "revision": 3,
        "result_user_id": None,
        "result_snapshot": None,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    db = _Session(row)
    monkeypatch.setattr(staff_chat_service, "SessionLocal", lambda: db)
    member = {"id": 55, "full_name": "Ann Cook", "email": "ann@example.com", "role": "staff", "staff_role_id": 2, "staff_role_name": "Waiter", "status": "active"}
    monkeypatch.setattr(staff_chat_service, "get_staff_by_id", lambda user_id, db=None: member)
    body = {"confirm": True, "revision": 3, "password": "a secure password", "password_confirmation": "a secure password"}
    first = staff_chat_service.confirm_action(action_id, 7, body)
    second = staff_chat_service.confirm_action(action_id, 7, body)
    assert first == {"staff": {**member, "application_role": "staff"}, "replayed": False}
    assert second["replayed"] is True
    assert db.created == 1 and db.audit == 1 and db.commits == 1
    assert "password" not in row["draft"]
    with pytest.raises(StaffConflict):
        staff_chat_service.confirm_action(action_id, 7, {"confirm": True, "revision": 2})


def test_stale_edit_is_rejected_before_mutation():
    class _EditSession:
        def __init__(self):
            self.queries = []

        def execute(self, statement, _params=None):
            sql = str(statement)
            self.queries.append(sql)
            if "pg_advisory_xact_lock" in sql:
                return _Result()
            if "SELECT id,role,status,staff_role_id,updated_at" in sql:
                return _Result({"id": 9, "role": "staff", "status": "active", "staff_role_id": 2, "updated_at": datetime(2026, 11, 12, 12, 0, tzinfo=timezone.utc)})
            raise AssertionError("A stale edit must not perform a write.")

    db = _EditSession()
    with pytest.raises(StaffConflict, match="changed since review"):
        staff_service.update_staff_in_transaction(db, 9, {"full_name": "Changed Name"}, 7, expected_updated_at=datetime(2026, 11, 12, 11, 0, tzinfo=timezone.utc))
    assert len(db.queries) == 2
