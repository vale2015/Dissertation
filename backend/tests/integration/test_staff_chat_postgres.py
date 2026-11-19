"""Real PostgreSQL 17 checks, using only an explicitly disposable database.

Run with --confcutdir=tests/integration so the ordinary parent conftest cannot
load the application's local configuration. The test engine never reads .env
or DATABASE_URL. Without RFS_CHAT_TEST_DATABASE_URL these tests skip; the CI
job sets RFS_CHAT_REQUIRE_INTEGRATION=1 so a missing URL is a failure there.
No database is dropped, truncated or repaired: migration setup requires an
empty public schema, and each test inserts separately named fixture records.
"""
import importlib
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier, Lock, current_thread, local
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError, DBAPIError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool


def disposable_database_url(raw):
    """Reject production hosts, other databases and connection overrides."""
    try:
        url = make_url(raw)
    except (ArgumentError, TypeError, ValueError):
        raise ValueError("Invalid dedicated staff-chat test database URL.") from None
    if (url.drivername not in ("postgresql", "postgresql+psycopg2")
            or url.host not in ("127.0.0.1", "::1")
            or url.database != "rfs_chat_test"
            or not url.username or not url.port or url.query):
        raise ValueError("Staff-chat integration requires a literal loopback host, explicit port, rfs_chat_test database and no URL query options.")
    return url.set(drivername="postgresql+psycopg2")


@pytest.mark.parametrize("raw", [
    "postgresql://postgres:ci@db.example.com:5432/rfs_chat_test",
    "postgresql://postgres:ci@127.0.0.1:5432/postgres",
    "postgresql://postgres:ci@127.0.0.1:5432/rfs_chat_test?host=db.example.com",
    "postgresql://postgres:ci@127.0.0.1:5432/rfs_chat_test?sslmode=require",
    "postgresql://postgres:ci@localhost:5432/rfs_chat_test",
    "postgresql://postgres:ci@127.0.0.1/rfs_chat_test",
    "sqlite:///rfs_chat_test",
    "not a connection URL",
])
def test_integration_url_rejects_non_disposable_targets(raw):
    with pytest.raises(ValueError):
        disposable_database_url(raw)


def test_integration_url_accepts_explicit_loopback_database():
    url = disposable_database_url("postgresql://postgres:ci@127.0.0.1:5432/rfs_chat_test")
    assert url.host == "127.0.0.1" and url.database == "rfs_chat_test"


@pytest.fixture(scope="session")
def postgres_engine():
    raw = os.environ.get("RFS_CHAT_TEST_DATABASE_URL")
    if not raw:
        if os.environ.get("RFS_CHAT_REQUIRE_INTEGRATION") == "1":
            pytest.fail("RFS_CHAT_TEST_DATABASE_URL is required for the real PostgreSQL CI job.")
        pytest.skip("Dedicated disposable staff-chat PostgreSQL URL is not configured.")
    try:
        url = disposable_database_url(raw)
    except ValueError as error:
        pytest.fail(str(error))
    engine = create_engine(
        url, poolclass=NullPool, future=True, echo=False,
        connect_args={
            "sslmode": "disable",  # Allowed only after the loopback/database guard.
            "connect_timeout": 5,
            "options": "-c lock_timeout=8000 -c statement_timeout=20000 -c idle_in_transaction_session_timeout=30000",
        },
    )
    with engine.connect() as connection:
        assert connection.execute(text("SELECT current_database()")).scalar_one() == "rfs_chat_test"
        version = int(connection.execute(text("SHOW server_version_num")).scalar_one())
        assert 170000 <= version < 180000, "Integration coverage requires PostgreSQL 17."
        table_count = connection.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")).scalar_one()
        assert table_count == 0, "Refusing to migrate a nonempty test database; use a fresh disposable service."
    # Each file retains its own BEGIN/COMMIT, exactly as the migration runner.
    raw_connection = engine.raw_connection()
    try:
        raw_connection.driver_connection.autocommit = True
        with raw_connection.cursor() as cursor:
            cursor.execute("""
                CREATE ROLE anon NOLOGIN;
                CREATE ROLE authenticated NOLOGIN;
                CREATE ROLE service_role NOLOGIN;
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
            """)
            root = Path(__file__).resolve().parents[3]
            for migration in sorted((root / "supabase" / "migrations").glob("*.sql")):
                cursor.execute(migration.read_text(encoding="utf-8"))
            cursor.execute((root / "supabase" / "verify_access.sql").read_text(encoding="utf-8"))
            cursor.execute((root / "supabase" / "verify_staff_chat_actions.sql").read_text(encoding="utf-8"))
    finally:
        raw_connection.close()
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def real_service(postgres_engine, monkeypatch):
    # Service imports may construct the normal application engine. Keep even
    # that construction local and explicitly prevent dotenv loading here.
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *_args, **_kwargs: False)
    for key in tuple(os.environ):
        if key.startswith("POSTGRES_"):
            monkeypatch.delenv(key)
    monkeypatch.setenv("DATABASE_URL", postgres_engine.url.render_as_string(hide_password=False))
    service = importlib.import_module("app.services.staff_chat_service")
    staff = importlib.import_module("app.services.staff_service")
    db_module = importlib.import_module("app.db.dbcon")
    sessions = sessionmaker(bind=postgres_engine, autoflush=False, expire_on_commit=False, future=True)
    monkeypatch.setattr(service, "SessionLocal", sessions)
    monkeypatch.setattr(staff, "SessionLocal", sessions)
    monkeypatch.setattr(db_module, "SessionLocal", sessions)
    monkeypatch.setattr(db_module, "engine", postgres_engine)
    suffix = uuid4().hex
    with postgres_engine.begin() as db:
        role_id = db.execute(text("""INSERT INTO public.staff_roles(role_name,department,hourly_rate,standard_shift_hours)
            VALUES ('QA Waiter','QA Floor',12,8) RETURNING id""")).scalar_one()
        def insert_user(name, role):
            return db.execute(text("""INSERT INTO public.users(full_name,email,password_hash,role,status,staff_role_id)
                VALUES (:name,:email,'not-a-login',:role,'active',:staff_role) RETURNING id"""),
                {"name": name, "email": f"{name.lower().replace(' ', '-')}-{suffix}@example.invalid", "role": role,
                 "staff_role": role_id if role == "staff" else None}).scalar_one()
        actor = insert_user("QA Manager", "manager")
        other_actor = insert_user("QA Other Manager", "manager")
        target = insert_user("QA Target", "staff")
    return SimpleNamespace(service=service, engine=postgres_engine, actor=actor, other_actor=other_actor,
                           role_id=role_id, target=target, email=f"qa-register-{suffix}@example.invalid")


def reviewed_registration(case):
    service = case.service
    action = service.create_action(case.actor, {"kind": "register"})["action"]
    service.patch_action(action["id"], case.actor, {"full_name": "QA Registered", "email": case.email,
                         "application_role": "staff", "staff_role_id": case.role_id})
    return service.review_action(action["id"], case.actor)["action"]


def reviewed_edit(case):
    action = case.service.create_action(case.actor, {"kind": "edit", "target_user_id": case.target})["action"]
    case.service.patch_action(action["id"], case.actor, {"full_name": "QA Changed"})
    return case.service.review_action(action["id"], case.actor)["action"]


def confirmation(action, registration=False):
    body = {"confirm": True, "revision": action["revision"]}
    if registration:
        body.update(password="CI-only initial password", password_confirmation="CI-only initial password")
    return body


def simultaneous_confirmations(case, action, body):
    """Release two distinct PostgreSQL sessions at the same first lock query."""
    barrier, seen, pids, pid_lock = Barrier(2), local(), [], Lock()
    def synchronize(connection, _cursor, statement, _parameters, _context, _executemany):
        if ("pg_advisory_xact_lock" in statement and current_thread().name.startswith("staff-chat-confirm")
                and not getattr(seen, "ready", False)):
            seen.ready = True
            pid = connection.exec_driver_sql("SELECT pg_backend_pid()").scalar_one()
            with pid_lock:
                pids.append(pid)
            barrier.wait(timeout=10)
    event.listen(case.engine, "before_cursor_execute", synchronize)
    try:
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="staff-chat-confirm") as executor:
            futures = [executor.submit(case.service.confirm_action, action["id"], case.actor, dict(body)) for _ in range(2)]
            results = [future.result(timeout=35) for future in futures]
    finally:
        event.remove(case.engine, "before_cursor_execute", synchronize)
    assert len(set(pids)) == 2, "Both concurrent confirmations must use distinct real PostgreSQL sessions."
    return results


def audit_rows(case, action):
    with case.engine.connect() as db:
        return db.execute(text("SELECT action,metadata FROM public.staff_account_audit WHERE metadata->>'chat_action_id'=:id"),
                          {"id": action["id"]}).mappings().all()


def test_concurrent_registration_is_one_user_one_audit_and_stable_receipt(real_service):
    case = real_service
    action = reviewed_registration(case)
    results = simultaneous_confirmations(case, action, confirmation(action, registration=True))
    assert sorted(result["replayed"] for result in results) == [False, True]
    assert results[0]["staff"] == results[1]["staff"]
    with case.engine.connect() as db:
        assert db.execute(text("SELECT count(*) FROM public.users WHERE email=:email"), {"email": case.email}).scalar_one() == 1
        stored = db.execute(text("SELECT state,draft,result_snapshot FROM public.staff_chat_actions WHERE id=:id"),
                            {"id": action["id"]}).mappings().one()
    assert stored["state"] == "completed" and stored["draft"] == {}
    assert stored["result_snapshot"] == results[0]["staff"]
    assert [row["action"] for row in audit_rows(case, action)] == ["staff_registered"]
    # A later independent update cannot rewrite the original once-only receipt.
    with case.engine.begin() as db:
        db.execute(text("UPDATE public.users SET full_name='Later independent change' WHERE email=:email"), {"email": case.email})
    receipt = case.service.confirm_action(action["id"], case.actor, confirmation(action))
    assert receipt == {"staff": results[0]["staff"], "replayed": True}
    assert case.service.get_action(action["id"], case.actor)["action"]["result"] == results[0]["staff"]


def test_concurrent_edit_is_one_change_one_audit_and_stable_receipt(real_service):
    case = real_service
    action = reviewed_edit(case)
    results = simultaneous_confirmations(case, action, confirmation(action))
    assert sorted(result["replayed"] for result in results) == [False, True]
    assert results[0]["staff"] == results[1]["staff"]
    assert results[0]["staff"]["full_name"] == "QA Changed"
    assert [row["action"] for row in audit_rows(case, action)] == ["staff_updated"]
    with case.engine.connect() as db:
        assert db.execute(text("SELECT full_name FROM public.users WHERE id=:id"), {"id": case.target}).scalar_one() == "QA Changed"


def test_real_stale_edit_has_no_write_or_audit(real_service):
    case = real_service
    action = reviewed_edit(case)
    with case.engine.begin() as db:
        db.execute(text("UPDATE public.users SET full_name='External change',updated_at=updated_at+interval '1 second' WHERE id=:id"), {"id": case.target})
    with pytest.raises(case.service.StaffConflict, match="changed since review"):
        case.service.confirm_action(action["id"], case.actor, confirmation(action))
    assert audit_rows(case, action) == []
    with case.engine.connect() as db:
        assert db.execute(text("SELECT full_name FROM public.users WHERE id=:id"), {"id": case.target}).scalar_one() == "External change"
        assert db.execute(text("SELECT state FROM public.staff_chat_actions WHERE id=:id"), {"id": action["id"]}).scalar_one() == "review"


def test_postgres_failure_rolls_back_user_audit_and_receipt_together(real_service):
    case = real_service
    action = reviewed_registration(case)
    def fail_before_receipt(connection, _cursor, statement, _parameters, _context, _executemany):
        if "UPDATE public.staff_chat_actions SET state='completed'" in statement:
            connection.exec_driver_sql("SELECT 1/0")  # A real PostgreSQL transaction error.
    event.listen(case.engine, "before_cursor_execute", fail_before_receipt)
    try:
        with pytest.raises(DBAPIError):
            case.service.confirm_action(action["id"], case.actor, confirmation(action, registration=True))
    finally:
        event.remove(case.engine, "before_cursor_execute", fail_before_receipt)
    assert audit_rows(case, action) == []
    with case.engine.connect() as db:
        assert db.execute(text("SELECT count(*) FROM public.users WHERE email=:email"), {"email": case.email}).scalar_one() == 0
        stored = db.execute(text("SELECT state,result_snapshot FROM public.staff_chat_actions WHERE id=:id"), {"id": action["id"]}).mappings().one()
    assert stored["state"] == "review" and stored["result_snapshot"] is None
    assert case.service.confirm_action(action["id"], case.actor, confirmation(action, registration=True))["replayed"] is False
    assert len(audit_rows(case, action)) == 1


@pytest.mark.parametrize("change", ["role", "status"])
def test_real_actor_loss_of_authority_denies_before_write(real_service, change):
    case = real_service
    action = reviewed_registration(case)
    with case.engine.begin() as db:
        statement = "UPDATE public.users SET role='supervisor' WHERE id=:id" if change == "role" else "UPDATE public.users SET status='inactive' WHERE id=:id"
        db.execute(text(statement), {"id": case.actor})
    with pytest.raises(case.service.StaffChatForbidden):
        case.service.confirm_action(action["id"], case.actor, confirmation(action, registration=True))
    assert audit_rows(case, action) == []
    with case.engine.connect() as db:
        assert db.execute(text("SELECT count(*) FROM public.users WHERE email=:email"), {"email": case.email}).scalar_one() == 0


def test_real_other_manager_cannot_confirm_foreign_action(real_service):
    case = real_service
    action = reviewed_registration(case)
    with pytest.raises(case.service.StaffNotFound):
        case.service.confirm_action(action["id"], case.other_actor, confirmation(action, registration=True))
    assert audit_rows(case, action) == []
