"""Manager-only, database-backed draft and once-only staff-chat actions.

The chat model never handles this state. Passwords enter only at confirmation,
are hashed by staff_service, and are never put in draft JSON or audit metadata.
"""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db.dbcon import SessionLocal
from app.services.permission_service import ROLE_MANAGER, ROLE_STAFF, STATUS_ACTIVE, normalize_role
from app.services.staff_service import (
    DuplicateStaff,
    StaffConflict,
    StaffNotFound,
    SAFE_SELECT,
    _validate_operational_role,
    get_staff_by_id,
    register_staff_in_transaction,
    update_staff_in_transaction,
    _lock_manager_membership,
)
from app.services.staff_validation_service import (
    EMAIL_RE,
    StaffValidationError,
    validate_invitation,
    validate_password,
    validate_update,
)

REGISTER_FIELDS = frozenset({"full_name", "email", "application_role", "staff_role_id"})
EDIT_FIELDS = frozenset({"full_name", "application_role", "staff_role_id"})
ACTION_FIELDS = "id,actor_user_id,kind,state,target_user_id,draft,before_snapshot,after_snapshot,expected_updated_at,revision,result_user_id,result_snapshot,expires_at"


class StaffChatForbidden(PermissionError):
    pass


def _authorize_actor(db, actor_id):
    # Use the same lock ordering as account demotion/deactivation. A valid token
    # cannot race an actor's loss of manager authority during a confirmed write.
    _lock_manager_membership(db)
    actor = db.execute(text("SELECT role,status FROM public.users WHERE id=:id FOR SHARE"), {"id": actor_id}).mappings().first()
    if not actor or actor["role"] != ROLE_MANAGER or actor["status"] != STATUS_ACTIVE:
        raise StaffChatForbidden("An active manager account is required.")


def _expire_actions(db, actor_id):
    db.execute(text("""UPDATE public.staff_chat_actions
        SET state='expired',draft='{}'::jsonb,before_snapshot=NULL,
            after_snapshot=NULL,expected_updated_at=NULL
        WHERE actor_user_id=:actor AND state IN ('draft','review') AND expires_at<=now()"""), {"actor": actor_id})


def _object(value):
    if not isinstance(value, dict):
        raise StaffValidationError({"body": "Send a JSON object."})
    return value


def _action_id(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise StaffValidationError({"action_id": "Invalid action identifier."}) from error


def _json(value):
    return json.loads(value) if isinstance(value, str) else (value or {})


def _public_action(row):
    return {
        "id": str(row["id"]),
        "kind": row["kind"],
        "state": row["state"],
        "draft": _json(row["draft"]),
        "revision": row["revision"],
        "target_user_id": row["target_user_id"],
        "before": _json(row["before_snapshot"]) if row["before_snapshot"] else None,
        "after": _json(row["after_snapshot"]) if row["after_snapshot"] else None,
        "result": _json(row["result_snapshot"]) if row["state"] == "completed" and row["result_snapshot"] else None,
        "expires_at": row["expires_at"].isoformat(),
    }


def _snapshot(row):
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "role": row["role"],
        "application_role": row["role"],
        "staff_role_id": row["staff_role_id"],
        "staff_role_name": row["staff_role_name"],
        "status": row["status"],
    }


def _get_action(db, action_id, actor_id, lock=True):
    suffix = " FOR UPDATE" if lock else ""
    row = db.execute(
        text(f"SELECT {ACTION_FIELDS} FROM public.staff_chat_actions WHERE id=:id AND actor_user_id=:actor{suffix}"),
        {"id": _action_id(action_id), "actor": actor_id},
    ).mappings().first()
    if not row:
        raise StaffNotFound("Staff-chat action not found.")
    return row


def _require_active(db, row):
    if row["expires_at"] <= datetime.now(timezone.utc):
        _expire_actions(db, row["actor_user_id"])
        db.commit()
        raise StaffConflict("This staff action expired. Start again.")
    if row["state"] not in ("draft", "review"):
        raise StaffConflict("This staff action is no longer active.")


def lookup_staff(query):
    if not isinstance(query, str) or not 2 <= len(query.strip()) <= 80:
        raise StaffValidationError({"query": "Search by 2 to 80 characters of name or email."})
    clean = query.strip()
    escaped = clean.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    with SessionLocal() as db:
        rows = db.execute(text(SAFE_SELECT + " WHERE lower(u.email)=:exact OR u.full_name ILIKE :pattern ESCAPE '\\' ORDER BY CASE WHEN lower(u.email)=:exact THEN 0 ELSE 1 END,u.full_name,u.id LIMIT 11"), {"exact": clean.lower(), "pattern": f"%{escaped}%"}).mappings().all()
    return {"matches": [_snapshot(row) for row in rows[:10]], "more": len(rows) > 10}


def current_action(actor_id):
    with SessionLocal() as db:
        _expire_actions(db, actor_id)
        db.commit()
        row = db.execute(text(f"SELECT {ACTION_FIELDS} FROM public.staff_chat_actions WHERE actor_user_id=:actor AND state IN ('draft','review') AND expires_at>now() ORDER BY created_at DESC LIMIT 1"), {"actor": actor_id}).mappings().first()
        return {"action": _public_action(row) if row else None}


def create_action(actor_id, values):
    values = _object(values)
    if set(values) - {"kind", "target_user_id"}:
        raise StaffValidationError({"body": "Unsupported action fields."})
    kind = values.get("kind")
    if kind not in ("register", "edit"):
        raise StaffValidationError({"kind": "Choose register or edit."})
    target = values.get("target_user_id")
    if kind == "register" and target is not None:
        raise StaffValidationError({"target_user_id": "Registration has no existing account."})
    if kind == "edit" and (type(target) is not int or target < 1):
        raise StaffValidationError({"target_user_id": "Choose an exact staff account first."})
    action_id = uuid.uuid4()
    with SessionLocal() as db:
        try:
            _authorize_actor(db, actor_id)
            _expire_actions(db, actor_id)
            active = db.execute(text("SELECT id FROM public.staff_chat_actions WHERE actor_user_id=:actor AND state IN ('draft','review') FOR UPDATE"), {"actor": actor_id}).first()
            if active:
                raise StaffConflict("Finish or cancel your current staff action first.")
            if target is not None and not db.execute(text("SELECT 1 FROM public.users WHERE id=:id"), {"id": target}).first():
                raise StaffNotFound("Staff account not found.")
            db.execute(text("INSERT INTO public.staff_chat_actions(id,actor_user_id,kind,state,target_user_id) VALUES(:id,:actor,:kind,'draft',:target)"), {"id": action_id, "actor": actor_id, "kind": kind, "target": target})
            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise StaffConflict("Finish or cancel your current staff action first.") from error
        except Exception:
            db.rollback()
            raise
    return {"action": get_action(action_id, actor_id)["action"]}


def get_action(action_id, actor_id):
    with SessionLocal() as db:
        _expire_actions(db, actor_id)
        db.commit()
        return {"action": _public_action(_get_action(db, action_id, actor_id, lock=False))}


def _validate_patch(kind, values):
    values = _object(values)
    allowed = REGISTER_FIELDS if kind == "register" else EDIT_FIELDS
    if not values or set(values) - allowed:
        raise StaffValidationError({"body": "Only editable, non-secret staff fields are allowed."})
    result = {}
    fields = {}
    for key, value in values.items():
        if key == "full_name":
            if not isinstance(value, str) or not 2 <= len(value.strip()) <= 120:
                fields[key] = "Must be between 2 and 120 characters."
            else:
                result[key] = value.strip()
        elif key == "email":
            if not isinstance(value, str) or not EMAIL_RE.fullmatch(value.strip()):
                fields[key] = "Enter a valid email address."
            else:
                result[key] = value.strip().lower()
        elif key == "application_role":
            try:
                result[key] = normalize_role(value)
            except ValueError as error:
                fields[key] = str(error)
        elif key == "staff_role_id":
            if value in (None, ""):
                result[key] = None
            elif type(value) is int and value > 0:
                result[key] = value
            else:
                fields[key] = "Choose a valid operational role."
    if fields:
        raise StaffValidationError(fields)
    return result


def patch_action(action_id, actor_id, values):
    with SessionLocal() as db:
        _authorize_actor(db, actor_id)
        row = _get_action(db, action_id, actor_id)
        _require_active(db, row)
        patch = _validate_patch(row["kind"], values)
        draft = {**_json(row["draft"]), **patch}
        db.execute(text("UPDATE public.staff_chat_actions SET draft=CAST(:draft AS jsonb),state='draft',before_snapshot=NULL,after_snapshot=NULL,expected_updated_at=NULL,revision=revision+1 WHERE id=:id"), {"draft": json.dumps(draft), "id": row["id"]})
        db.commit()
    return get_action(action_id, actor_id)


def review_action(action_id, actor_id):
    with SessionLocal() as db:
        _authorize_actor(db, actor_id)
        row = _get_action(db, action_id, actor_id)
        _require_active(db, row)
        draft = _json(row["draft"])
        if row["kind"] == "register":
            values = validate_invitation(draft)
            _validate_operational_role(db, values["staff_role_id"])
            before = None
            after = {"full_name": values["full_name"], "email": values["email"], "role": values["application_role"], "staff_role_id": values["staff_role_id"], "status": STATUS_ACTIVE}
            expected = None
        else:
            values = validate_update(draft)
            member = db.execute(text(SAFE_SELECT + " WHERE u.id=:id"), {"id": row["target_user_id"]}).mappings().first()
            if not member:
                raise StaffNotFound("Staff account not found.")
            _validate_operational_role(db, values.get("staff_role_id"))
            before = _snapshot(member)
            after = {**before, **values}
            if after["role"] == ROLE_STAFF and after["staff_role_id"] is None:
                raise StaffConflict("An operational role is required for staff accounts.")
            expected = member["updated_at"]
        after["application_role"] = after["role"]
        role_id = after.get("staff_role_id")
        if role_id is not None:
            operational_role = db.execute(text("SELECT role_name FROM public.staff_roles WHERE id=:id"), {"id": role_id}).mappings().first()
            if not operational_role:
                raise StaffConflict("The selected operational role does not exist.")
            after["staff_role_name"] = operational_role["role_name"]
        else:
            after["staff_role_name"] = None
        db.execute(text("UPDATE public.staff_chat_actions SET state='review',before_snapshot=CAST(:before AS jsonb),after_snapshot=CAST(:after AS jsonb),expected_updated_at=:expected,revision=revision+1 WHERE id=:id"), {"before": json.dumps(before) if before else None, "after": json.dumps(after), "expected": expected, "id": row["id"]})
        db.commit()
        return {"action": get_action(action_id, actor_id)["action"], "after": after}


def confirm_action(action_id, actor_id, values):
    values = _object(values)
    if set(values) - {"confirm", "revision", "password", "password_confirmation"}:
        raise StaffValidationError({"body": "Unsupported confirmation fields."})
    if values.get("confirm") is not True or type(values.get("revision")) is not int:
        raise StaffValidationError({"confirm": "Review and explicitly confirm this exact action."})
    with SessionLocal() as db:
        row = None
        try:
            _authorize_actor(db, actor_id)
            row = _get_action(db, action_id, actor_id)
            if row["state"] == "completed":
                if values["revision"] != row["revision"]:
                    raise StaffConflict("This confirmation does not match the completed action.")
                return {"staff": _json(row["result_snapshot"]), "replayed": True}
            _require_active(db, row)
            if row["state"] != "review" or values["revision"] != row["revision"]:
                raise StaffConflict("This review is stale. Review the action again.")
            draft = _json(row["draft"])
            if row["kind"] == "register":
                password = validate_password(values)
                validated = {**validate_invitation(draft), "password": password}
                result_id = register_staff_in_transaction(db, validated, actor_id, row["id"])
            else:
                if "password" in values or "password_confirmation" in values:
                    raise StaffValidationError({"body": "Editing cannot change a password."})
                result_id = update_staff_in_transaction(db, row["target_user_id"], validate_update(draft), actor_id, row["expected_updated_at"], row["id"])
            # Read the committed operation's exact outcome in this transaction.
            # The receipt is reused even if a later action changes this account.
            result = _snapshot(get_staff_by_id(result_id, db=db))
            db.execute(text("UPDATE public.staff_chat_actions SET state='completed',result_user_id=:result,result_snapshot=CAST(:snapshot AS jsonb),completed_at=now(),draft='{}'::jsonb,before_snapshot=NULL,after_snapshot=NULL,expected_updated_at=NULL WHERE id=:id"), {"result": result_id, "snapshot": json.dumps(result), "id": row["id"]})
            db.commit()
        except IntegrityError as error:
            db.rollback()
            if row and row["kind"] == "register":
                raise DuplicateStaff("An account already uses this email address.") from error
            raise StaffConflict("The staff action could not be completed.") from error
        except Exception:
            db.rollback()
            raise
    return {"staff": result, "replayed": False}


def cancel_action(action_id, actor_id):
    with SessionLocal() as db:
        _authorize_actor(db, actor_id)
        row = _get_action(db, action_id, actor_id)
        if row["state"] == "completed":
            raise StaffConflict("A completed change cannot be cancelled.")
        if row["state"] in ("draft", "review"):
            db.execute(text("UPDATE public.staff_chat_actions SET state='cancelled',draft='{}'::jsonb,before_snapshot=NULL,after_snapshot=NULL,expected_updated_at=NULL WHERE id=:id"), {"id": row["id"]})
            db.commit()
    return {"cancelled": True}
