"""Staff-chat state, authorization, failure recovery and privacy boundaries."""
import copy
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from flask import Flask, g
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.staff_route import staff_bp
from app.controllers import staff_chat_controller as controller
from app.services import staff_chat_service as service
from app.services import auth_rate_limit_service as limits
from app.services.staff_service import DuplicateStaff, StaffConflict, StaffNotFound
from app.services.staff_validation_service import StaffValidationError


def action_row(**changes):
    row = dict(id=uuid.uuid4(), actor_user_id=7, kind="register", state="review",
               target_user_id=None, draft={"full_name": "Ann Cook", "email": "ann@example.com",
               "application_role": "staff", "staff_role_id": 2}, before_snapshot=None,
               after_snapshot={"full_name": "Ann Cook", "email": "ann@example.com", "role": "staff",
                               "application_role": "staff", "staff_role_id": 2, "staff_role_name": "Waiter", "status": "active"},
               expected_updated_at=None, revision=3, result_user_id=None, result_snapshot=None,
               expires_at=datetime.now(timezone.utc) + timedelta(minutes=5))
    return {**row, **changes}


class Result:
    def __init__(self, row=None, rows=None): self.row, self.rows = row, rows or []
    def mappings(self): return self
    def first(self): return self.row
    def all(self): return self.rows
    def scalar(self): return self.row


class MemoryTransaction:
    """A transactional fake: rollback reverses account and audit writes together."""
    def __init__(self, row=None):
        self.row = row
        self.actor = {"role": "manager", "status": "active"}
        self.users = {9: {"id": 9, "full_name": "Ann Cook", "email": "ann@example.com", "role": "staff",
                         "status": "active", "staff_role_id": 2, "staff_role_name": "Waiter",
                         "updated_at": datetime(2026, 11, 19, tzinfo=timezone.utc)}}
        self.audits = []
        self.statements = []
        self.fail_completion = False
        self.duplicate = False
        self.commits = 0
        self.rollbacks = 0
    def __enter__(self):
        self.checkpoint = copy.deepcopy((self.row, self.users, self.audits))
        return self
    def __exit__(self, *_): return False
    def commit(self):
        self.commits += 1
        self.checkpoint = copy.deepcopy((self.row, self.users, self.audits))
    def rollback(self):
        self.rollbacks += 1
        self.row, self.users, self.audits = copy.deepcopy(self.checkpoint)
    def execute(self, query, params=None):
        sql, p = str(query), params or {}
        self.statements.append((sql, p))
        if "pg_advisory_xact_lock" in sql: return Result()
        if "SELECT role,status FROM public.users" in sql: return Result(self.actor)
        if "SET state='expired'" in sql:
            if self.row and self.row["actor_user_id"] == p["actor"] and self.row["state"] in ("draft", "review") and self.row["expires_at"] <= datetime.now(timezone.utc):
                self.row.update(state="expired", draft={}, before_snapshot=None, after_snapshot=None, expected_updated_at=None)
            return Result()
        if "FROM public.staff_chat_actions WHERE id=:id" in sql:
            return Result(self.row if self.row and self.row["id"] == p["id"] and self.row["actor_user_id"] == p["actor"] else None)
        if "FROM public.staff_chat_actions WHERE actor_user_id" in sql:
            return Result(self.row if self.row and self.row["actor_user_id"] == p["actor"] and self.row["state"] in ("draft", "review") else None)
        if "SELECT id FROM public.staff_chat_actions" in sql:
            return Result((self.row["id"],) if self.row and self.row["state"] in ("draft", "review") else None)
        if "SELECT 1 FROM public.users" in sql: return Result((1,) if p["id"] in self.users else None)
        if "INSERT INTO public.staff_chat_actions" in sql:
            self.row = action_row(id=p["id"], actor_user_id=p["actor"], kind=p["kind"], state="draft",
                                  target_user_id=p["target"], draft={}, before_snapshot=None, after_snapshot=None, revision=0)
            return Result()
        if "SET draft=CAST(:draft" in sql:
            self.row.update(draft=json.loads(p["draft"]), state="draft", before_snapshot=None, after_snapshot=None, expected_updated_at=None, revision=self.row["revision"] + 1)
            return Result()
        if "SET state='review'" in sql:
            self.row.update(state="review", before_snapshot=json.loads(p["before"]) if p["before"] else None,
                            after_snapshot=json.loads(p["after"]), expected_updated_at=p["expected"], revision=self.row["revision"] + 1)
            return Result()
        if "SET state='completed'" in sql:
            if self.fail_completion: raise SQLAlchemyError("synthetic database failure")
            self.row.update(state="completed", draft={}, before_snapshot=None, after_snapshot=None,
                            expected_updated_at=None, result_user_id=p["result"], result_snapshot=json.loads(p["snapshot"]))
            return Result()
        if "SET state='cancelled'" in sql:
            self.row.update(state="cancelled", draft={}, before_snapshot=None, after_snapshot=None, expected_updated_at=None)
            return Result()
        if "SELECT 1 FROM public.staff_roles" in sql: return Result((1,) if p["id"] == 2 else None)
        if "SELECT role_name FROM public.staff_roles" in sql: return Result({"role_name": "Waiter"} if p["id"] == 2 else None)
        if "SELECT id,role,status,staff_role_id,updated_at" in sql: return Result(self.users.get(p["id"]))
        if "SELECT count(*) FROM public.users" in sql: return Result(sum(u["role"] == "manager" and u["status"] == "active" for u in self.users.values()))
        if "LEFT JOIN public.staff_roles" in sql: return Result(self.users.get(p["id"]))
        if "INSERT INTO public.users" in sql:
            if self.duplicate: raise IntegrityError("insert", {}, Exception("unique conflict"))
            self.users[55] = {"id": 55, "full_name": p["name"], "email": p["email"], "role": p["role"],
                              "status": "active", "staff_role_id": p["staff_role"], "staff_role_name": "Waiter"}
            return Result((55,))
        if "INSERT INTO public.staff_account_audit" in sql:
            self.audits.append(p)
            return Result()
        if "UPDATE public.users SET" in sql:
            self.users[p["id"]].update({k: v for k, v in p.items() if k != "id"})
            return Result()
        raise AssertionError(f"Unexpected query: {sql}")


@pytest.fixture
def db(monkeypatch):
    instance = MemoryTransaction(action_row())
    monkeypatch.setattr(service, "SessionLocal", lambda: instance)
    return instance


@pytest.fixture
def client(monkeypatch):
    app = Flask(__name__)
    app.config["ROLE"] = "manager"
    app.register_blueprint(staff_bp, url_prefix="/staff")
    @app.before_request
    def actor():
        if app.config["ROLE"]: g.current_user = {"id": 7, "role": app.config["ROLE"]}
    monkeypatch.setattr(controller, "reserve_staff_chat_attempt", lambda _: 0)
    return app.test_client()


def confirmation(row):
    return {"confirm": True, "revision": row["revision"], "password": "strong initial password", "password_confirmation": "strong initial password"}


def test_replay_returns_original_receipt_and_does_not_repeat_write(db):
    payload = confirmation(db.row)
    first = service.confirm_action(db.row["id"], 7, payload)
    db.users[55]["full_name"] = "Changed by a later action"
    replay = service.confirm_action(db.row["id"], 7, {"confirm": True, "revision": 3})
    assert first["staff"] == replay["staff"] and replay["replayed"]
    assert replay["staff"]["full_name"] == "Ann Cook"
    recovered = service.get_action(db.row["id"], 7)
    assert recovered["action"]["result"] == first["staff"]
    assert len(db.audits) == 1
    assert db.row["draft"] == {} and db.row["before_snapshot"] is None and db.row["after_snapshot"] is None
    assert "strong initial password" not in json.dumps(db.audits) + json.dumps(db.row, default=str)


def test_operation_and_receipt_rollback_together(db):
    db.fail_completion = True
    with pytest.raises(SQLAlchemyError): service.confirm_action(db.row["id"], 7, confirmation(db.row))
    assert 55 not in db.users and not db.audits and db.row["state"] == "review"
    assert db.rollbacks == 1


def test_duplicate_email_has_no_success_receipt(db):
    db.duplicate = True
    with pytest.raises(DuplicateStaff): service.confirm_action(db.row["id"], 7, confirmation(db.row))
    assert db.row["state"] == "review" and not db.audits


@pytest.mark.parametrize("actor", [{"role": "staff", "status": "active"}, {"role": "manager", "status": "inactive"}, None])
def test_actor_authority_rechecked_before_confirmation(db, actor):
    db.actor = actor
    with pytest.raises(service.StaffChatForbidden): service.confirm_action(db.row["id"], 7, confirmation(db.row))
    assert not db.audits and 55 not in db.users


def test_foreign_actor_cannot_get_or_confirm_action(db):
    with pytest.raises(StaffNotFound): service.get_action(db.row["id"], 8)
    with pytest.raises(StaffNotFound): service.confirm_action(db.row["id"], 8, confirmation(db.row))
    assert not db.audits


def test_expired_action_erases_draft_and_cannot_confirm(db):
    db.row["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    with pytest.raises(StaffConflict, match="expired"): service.confirm_action(db.row["id"], 7, confirmation(db.row))
    assert db.row["state"] == "expired" and db.row["draft"] == {} and db.row["after_snapshot"] is None
    assert not db.audits


def test_cancel_erases_pii_and_rejects_later_confirm(db):
    action_id = db.row["id"]
    assert service.cancel_action(action_id, 7) == {"cancelled": True}
    assert db.row["draft"] == {} and db.row["before_snapshot"] is None and db.row["after_snapshot"] is None
    with pytest.raises(StaffConflict): service.confirm_action(action_id, 7, confirmation(db.row))
    assert not db.audits


def test_patch_invalidates_review_and_old_confirmation(db):
    old = confirmation(db.row)
    service.patch_action(db.row["id"], 7, {"full_name": "Ann Other"})
    assert db.row["state"] == "draft" and db.row["after_snapshot"] is None
    with pytest.raises(StaffConflict, match="stale"): service.confirm_action(db.row["id"], 7, old)
    assert not db.audits


def test_review_is_recoverable_and_uses_normalized_values(db):
    reviewed = service.review_action(db.row["id"], 7)
    restored = service.current_action(7)
    assert reviewed["after"] == restored["action"]["after"]
    assert restored["action"]["after"]["application_role"] == "staff"
    assert restored["action"]["after"]["staff_role_name"] == "Waiter"


def test_edit_review_snapshots_before_after_and_stale_edit_fails(db):
    db.row = action_row(kind="edit", target_user_id=9, state="draft", draft={"application_role": "supervisor", "staff_role_id": None})
    result = service.review_action(db.row["id"], 7)
    assert result["action"]["before"]["role"] == "staff"
    assert result["action"]["after"]["application_role"] == "supervisor"
    assert result["action"]["after"]["staff_role_name"] is None
    db.users[9]["updated_at"] += timedelta(seconds=1)
    with pytest.raises(StaffConflict, match="changed since review"):
        service.confirm_action(db.row["id"], 7, {"confirm": True, "revision": db.row["revision"]})
    assert not db.audits


def test_edit_preserves_last_manager_protection(db):
    db.users[9].update(role="manager", staff_role_id=None)
    db.row = action_row(kind="edit", target_user_id=9, state="draft", draft={"application_role": "supervisor"})
    service.review_action(db.row["id"], 7)
    with pytest.raises(StaffConflict, match="last active manager"):
        service.confirm_action(db.row["id"], 7, {"confirm": True, "revision": db.row["revision"]})
    assert not db.audits


def test_second_action_requires_explicit_cancel(db):
    with pytest.raises(StaffConflict, match="Finish or cancel"): service.create_action(7, {"kind": "register"})
    service.cancel_action(db.row["id"], 7)
    created = service.create_action(7, {"kind": "edit", "target_user_id": 9})
    assert created["action"]["target_user_id"] == 9


@pytest.mark.parametrize("role,expected", [(None, 401), ("staff", 403), ("supervisor", 403)])
def test_all_chat_endpoints_deny_restricted_roles(client, role, expected):
    client.application.config["ROLE"] = role
    action_id = uuid.uuid4()
    for method, path in [("GET", "/chat-lookup?query=Ann"), ("GET", "/chat-actions/current"),
                         ("POST", "/chat-actions"), ("GET", f"/chat-actions/{action_id}"),
                         ("PATCH", f"/chat-actions/{action_id}"), ("POST", f"/chat-actions/{action_id}/review"),
                         ("POST", f"/chat-actions/{action_id}/confirm"), ("DELETE", f"/chat-actions/{action_id}"),
                         ("POST", "/chat-model-budget")]:
        assert client.open("/staff" + path, method=method, json={}).status_code == expected


def test_controller_errors_do_not_log_request_or_sql_parameters(client, monkeypatch, caplog):
    def fail(*_): raise SQLAlchemyError("private@example.com secret-password SQL parameters")
    monkeypatch.setattr(controller, "create_action", fail)
    response = client.post("/staff/chat-actions", json={"kind": "register"})
    assert response.status_code == 503
    assert "private@example.com" not in caplog.text and "secret-password" not in caplog.text
    assert "Staff-chat request failed (database)" in caplog.text


def test_actions_throttled_with_retry_after(client, monkeypatch):
    monkeypatch.setattr(controller, "reserve_staff_chat_attempt", lambda _: 30)
    response = client.get("/staff/chat-actions/current")
    assert response.status_code == 429 and response.headers["Retry-After"] == "30"


def test_review_and_cancel_reject_bodies(client, monkeypatch):
    monkeypatch.setattr(controller, "review_action", lambda *_: pytest.fail("Unexpected review"))
    monkeypatch.setattr(controller, "cancel_action", lambda *_: pytest.fail("Unexpected cancel"))
    action_id = uuid.uuid4()
    assert client.post(f"/staff/chat-actions/{action_id}/review", json={"confirm": True}).status_code == 400
    assert client.delete(f"/staff/chat-actions/{action_id}", json={"confirm": True}).status_code == 400


def test_model_budget_rejects_payloads_and_returns_allowance(client, monkeypatch):
    calls = []
    monkeypatch.setattr(controller, "reserve_chat_model_attempt", lambda actor: calls.append(actor) or 0)
    assert client.post("/staff/chat-model-budget", json={"message": "private text"}).status_code == 400
    assert client.post("/staff/chat-model-budget", data="hello", content_type="text/plain").status_code == 400
    response = client.post("/staff/chat-model-budget", json={})
    assert response.status_code == 200 and response.get_json()["allowed"] is True
    assert calls == [7] and response.headers["Cache-Control"] == "no-store"


def test_model_budget_throttle_or_storage_failure_never_grants_allowance(client, monkeypatch, caplog):
    monkeypatch.setattr(controller, "reserve_chat_model_attempt", lambda _: 3600)
    response = client.post("/staff/chat-model-budget", json={})
    assert response.status_code == 429 and response.headers["Retry-After"] == "3600"
    def fail(_): raise SQLAlchemyError("private input and secret-token")
    monkeypatch.setattr(controller, "reserve_chat_model_attempt", fail)
    response = client.post("/staff/chat-model-budget", json={})
    assert response.status_code == 503 and "allowed" not in response.get_json()
    assert "secret-token" not in caplog.text


def test_model_reservation_enforces_all_three_caps(monkeypatch):
    class Transaction:
        def __enter__(self): return self
        def __exit__(self, *_): return False
    class Sessions:
        def begin(self): return Transaction()
    monkeypatch.setattr(limits, "SessionLocal", Sessions())
    monkeypatch.setattr(limits, "_maybe_prune", lambda *_: None)
    calls = []
    monkeypatch.setattr(limits, "_reserve", lambda db, policy, key, now: calls.append((policy.scope, policy.allowed_attempts, key)) or 0)
    assert limits.reserve_chat_model_attempt(7) == 0
    assert calls == [("chat_model_actor_minute", 5, "7"), ("chat_model_actor_day", 50, "7"), ("chat_model_global_day", 200, "all_managers")]
    calls.clear()
    monkeypatch.setattr(limits, "_reserve", lambda db, policy, key, now: calls.append(policy.scope) or 60)
    assert limits.reserve_chat_model_attempt(7) == 60 and calls == ["chat_model_actor_minute"]
