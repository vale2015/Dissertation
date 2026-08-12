"""Transactional staff-account management."""
import json,os,secrets
from datetime import timedelta
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash
from app.db.dbcon import SessionLocal
from app.services.account_token_service import create_account_token,PURPOSE_ACTIVATION,PURPOSE_RESET
from app.services.permission_service import ROLE_MANAGER,ROLE_STAFF,STATUS_ACTIVE,STATUS_INVITED,STATUS_SUSPENDED,STATUS_INACTIVE
class StaffNotFound(LookupError):pass
class StaffConflict(RuntimeError):pass
class DuplicateStaff(StaffConflict):pass
SAFE_SELECT="""SELECT u.id,u.full_name,u.email,u.role,u.status,u.staff_role_id,sr.role_name AS staff_role_name,sr.department,
u.invited_at,u.activated_at,u.last_login_at,u.created_at,u.updated_at FROM public.users u LEFT JOIN public.staff_roles sr ON sr.id=u.staff_role_id"""
def _audit(db,actor,target,action,metadata=None):
    db.execute(text("INSERT INTO public.staff_account_audit(actor_user_id,target_user_id,action,metadata) VALUES(:actor,:target,:action,CAST(:metadata AS jsonb))"),{"actor":actor,"target":target,"action":action,"metadata":json.dumps(metadata or {})})
def list_staff(search=None,status=None,role=None,staff_role_id=None):
    clauses=[];params={}
    if search:clauses.append("(u.full_name ILIKE :search OR u.email ILIKE :search)");params["search"]=f"%{str(search).strip()}%"
    if status:clauses.append("u.status=:status");params["status"]=status
    if role:clauses.append("u.role=:role");params["role"]=role
    if staff_role_id:clauses.append("u.staff_role_id=:staff_role_id");params["staff_role_id"]=staff_role_id
    query=SAFE_SELECT+(" WHERE "+" AND ".join(clauses) if clauses else "")+" ORDER BY CASE u.status WHEN 'active' THEN 1 WHEN 'invited' THEN 2 WHEN 'suspended' THEN 3 ELSE 4 END,u.full_name,u.id"
    with SessionLocal() as db:return [dict(row) for row in db.execute(text(query),params).mappings().all()]
def get_staff_by_id(user_id,db=None):
    if db:return db.execute(text(SAFE_SELECT+" WHERE u.id=:id"),{"id":user_id}).mappings().first()
    with SessionLocal() as session:
        row=session.execute(text(SAFE_SELECT+" WHERE u.id=:id"),{"id":user_id}).mappings().first()
        if not row:raise StaffNotFound("Staff account not found.")
        return dict(row)
def get_staff_by_email(email):
    with SessionLocal() as db:
        row=db.execute(text(SAFE_SELECT+" WHERE lower(u.email)=:email"),{"email":str(email).strip().lower()}).mappings().first()
        return dict(row) if row else None
def list_operational_roles():
    with SessionLocal() as db:return [dict(row) for row in db.execute(text("SELECT id,role_name,department,hourly_rate,standard_shift_hours FROM public.staff_roles ORDER BY department,role_name")).mappings().all()]
def _validate_operational_role(db,role_id):
    if role_id is None:return
    if not db.execute(text("SELECT 1 FROM public.staff_roles WHERE id=:id"),{"id":role_id}).first():raise StaffConflict("The selected operational role does not exist.")
def _active_manager_count(db):return int(db.execute(text("SELECT count(*) FROM public.users WHERE role='manager' AND status='active'")).scalar() or 0)
def invite_staff(values,actor_id,reissue_user_id=None):
    frontend=os.getenv("FRONTEND_URL","http://localhost:3000").rstrip("/")
    with SessionLocal() as db:
      try:
        if reissue_user_id:
            user=db.execute(text("SELECT id,status FROM public.users WHERE id=:id FOR UPDATE"),{"id":reissue_user_id}).mappings().first()
            if not user:raise StaffNotFound("Staff account not found.")
            if user["status"]!=STATUS_INVITED:raise StaffConflict("Only invited accounts can receive another invitation.")
            user_id=user["id"];action="invitation_reissued"
        else:
            _validate_operational_role(db,values["staff_role_id"])
            unusable=generate_password_hash(secrets.token_urlsafe(48))
            row=db.execute(text("""INSERT INTO public.users(full_name,email,password_hash,role,status,staff_role_id,invited_by,invited_at,session_version,updated_at)
              VALUES(:name,:email,:password,:role,'invited',:staff_role,:actor,now(),1,now()) RETURNING id"""),{"name":values["full_name"],"email":values["email"],"password":unusable,"role":values["application_role"],"staff_role":values["staff_role_id"],"actor":actor_id}).first()
            user_id=row[0];action="staff_invited"
        raw,expires=create_account_token(db,user_id,PURPOSE_ACTIVATION,actor_id,timedelta(hours=24));_audit(db,actor_id,user_id,action);db.commit()
        return {"staff":get_staff_by_id(user_id),"activation_link":f"{frontend}/activate-account?token={raw}","expires_at":expires}
      except IntegrityError as error:db.rollback();raise DuplicateStaff("An account already uses this email address.") from error
      except Exception:db.rollback();raise
def register_staff(values,actor_id):
    with SessionLocal() as db:
      try:
        _validate_operational_role(db,values["staff_role_id"])
        row=db.execute(text("""INSERT INTO public.users(full_name,email,password_hash,role,status,staff_role_id,invited_by,invited_at,activated_at,session_version,updated_at)
          VALUES(:name,:email,:password,:role,'active',:staff_role,:actor,now(),now(),1,now()) RETURNING id"""),{"name":values["full_name"],"email":values["email"],"password":generate_password_hash(values["password"]),"role":values["application_role"],"staff_role":values["staff_role_id"],"actor":actor_id}).first()
        user_id=row[0];_audit(db,actor_id,user_id,"staff_registered");db.commit()
        return {"staff":get_staff_by_id(user_id)}
      except IntegrityError as error:db.rollback();raise DuplicateStaff("An account already uses this email address.") from error
      except Exception:db.rollback();raise
def update_staff(user_id,values,actor_id):
    with SessionLocal() as db:
      try:
        current=db.execute(text("SELECT id,role,status FROM public.users WHERE id=:id FOR UPDATE"),{"id":user_id}).mappings().first()
        if not current:raise StaffNotFound("Staff account not found.")
        _validate_operational_role(db,values.get("staff_role_id"))
        resulting_role=values.get("role",current["role"])
        resulting_staff_role=values.get("staff_role_id") if "staff_role_id" in values else db.execute(text("SELECT staff_role_id FROM public.users WHERE id=:id"),{"id":user_id}).scalar()
        if resulting_role==ROLE_STAFF and resulting_staff_role is None:raise StaffConflict("An operational role is required for staff accounts.")
        if values.get("role") and current["role"]==ROLE_MANAGER and values["role"]!=ROLE_MANAGER and current["status"]==STATUS_ACTIVE and _active_manager_count(db)<=1:raise StaffConflict("The last active manager cannot be demoted.")
        assignments=[];params={"id":user_id}
        for field in ("full_name","role","staff_role_id"):
            if field in values:assignments.append(f"{field}=:{field}");params[field]=values[field]
        db.execute(text(f"UPDATE public.users SET {','.join(assignments)},updated_at=now() WHERE id=:id"),params);_audit(db,actor_id,user_id,"staff_updated",{"fields":sorted(values)});db.commit();return get_staff_by_id(user_id)
      except Exception:db.rollback();raise
def change_staff_status(user_id,status,actor_id):
    allowed={(STATUS_ACTIVE,STATUS_SUSPENDED),(STATUS_ACTIVE,STATUS_INACTIVE),(STATUS_SUSPENDED,STATUS_ACTIVE),(STATUS_SUSPENDED,STATUS_INACTIVE),(STATUS_INACTIVE,STATUS_ACTIVE)}
    with SessionLocal() as db:
      try:
        user=db.execute(text("SELECT id,role,status FROM public.users WHERE id=:id FOR UPDATE"),{"id":user_id}).mappings().first()
        if not user:raise StaffNotFound("Staff account not found.")
        if user_id==actor_id and status in (STATUS_SUSPENDED,STATUS_INACTIVE):raise StaffConflict("You cannot suspend or deactivate your own account.")
        if (user["status"],status) not in allowed:raise StaffConflict("This account status transition is not allowed.")
        if user["role"]==ROLE_MANAGER and user["status"]==STATUS_ACTIVE and status!=STATUS_ACTIVE and _active_manager_count(db)<=1:raise StaffConflict("The last active manager cannot be suspended or deactivated.")
        db.execute(text("UPDATE public.users SET status=:status,session_version=session_version+1,updated_at=now() WHERE id=:id"),{"status":status,"id":user_id});_audit(db,actor_id,user_id,"staff_status_changed",{"from":user["status"],"to":status});db.commit();return get_staff_by_id(user_id)
      except Exception:db.rollback();raise
def create_password_reset(user_id,actor_id):
    frontend=os.getenv("FRONTEND_URL","http://localhost:3000").rstrip("/")
    with SessionLocal() as db:
      try:
        user=db.execute(text("SELECT id,status FROM public.users WHERE id=:id FOR UPDATE"),{"id":user_id}).mappings().first()
        if not user:raise StaffNotFound("Staff account not found.")
        if user["status"]!=STATUS_ACTIVE:raise StaffConflict("Only active accounts can receive a password-reset link.")
        raw,expires=create_account_token(db,user_id,PURPOSE_RESET,actor_id,timedelta(hours=1));_audit(db,actor_id,user_id,"password_reset_issued");db.commit()
        return {"reset_link":f"{frontend}/reset-password?token={raw}","expires_at":expires}
      except Exception:db.rollback();raise
