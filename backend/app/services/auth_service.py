import os
from datetime import datetime,timedelta,timezone
import jwt
from sqlalchemy import text
from werkzeug.security import check_password_hash
from app.db.dbcon import SessionLocal
from app.services.permission_service import STATUS_ACTIVE,permissions_for_role
TOKEN_DURATION_HOURS=8;TOKEN_ISSUER="rfs-backend"
USER_QUERY="""SELECT u.id,u.full_name,u.email,u.password_hash,u.role,u.status,u.session_version,u.staff_role_id,u.last_login_at,
sr.role_name AS staff_role,sr.department FROM public.users u LEFT JOIN public.staff_roles sr ON sr.id=u.staff_role_id"""
def get_secret_key():
    key=os.getenv("SECRET_KEY")
    if not key:raise RuntimeError("JWT signing key is not configured")
    return key
def _safe_user(user):
    return {"id":user["id"],"full_name":user["full_name"],"email":user["email"],"role":user["role"],
        "status":user["status"],"staff_role_id":user.get("staff_role_id"),"staff_role":user.get("staff_role"),
        "department":user.get("department"),"permissions":permissions_for_role(user["role"]),"last_login_at":user.get("last_login_at")}
def create_token(user):
    now=datetime.now(timezone.utc);payload={"sub":str(user["id"]),"ver":int(user.get("session_version") or 1),"iat":now,"exp":now+timedelta(hours=TOKEN_DURATION_HOURS),"iss":TOKEN_ISSUER}
    return jwt.encode(payload,get_secret_key(),algorithm="HS256")
def authenticate_user(email,password):
    normalized=str(email).strip().lower()
    with SessionLocal() as db:
        row=db.execute(text(USER_QUERY+" WHERE lower(u.email)=:email LIMIT 1"),{"email":normalized}).mappings().first()
        if not row or row["status"]!=STATUS_ACTIVE or not check_password_hash(row["password_hash"],password):return None
        db.execute(text("UPDATE public.users SET last_login_at=now(),updated_at=now() WHERE id=:id"),{"id":row["id"]});db.commit()
        user=dict(row);user["last_login_at"]=datetime.now(timezone.utc)
    return {"message":"Login successful","token":create_token(user),"user":_safe_user(user)}
def decode_user_token(token):
    payload=jwt.decode(token,get_secret_key(),algorithms=["HS256"],issuer=TOKEN_ISSUER,options={"require":["sub","iat","exp","iss"]})
    try:user_id=int(payload["sub"])
    except (TypeError,ValueError):raise jwt.InvalidTokenError("Invalid user identifier")
    with SessionLocal() as db:row=db.execute(text(USER_QUERY+" WHERE u.id=:id LIMIT 1"),{"id":user_id}).mappings().first()
    if not row or row["status"]!=STATUS_ACTIVE or int(payload.get("ver",1))!=int(row["session_version"] or 1):raise jwt.InvalidTokenError("Session is no longer valid")
    return {"message":"Authenticated user","user":_safe_user(dict(row))}
def update_own_profile(user_id,full_name):
    name=str(full_name or "").strip()
    if len(name)<2 or len(name)>120:raise ValueError("Full name must be between 2 and 120 characters.")
    with SessionLocal() as db:
        row=db.execute(text("UPDATE public.users SET full_name=:name,updated_at=now() WHERE id=:id RETURNING id"),{"name":name,"id":user_id}).first()
        if not row:raise LookupError("Account not found.")
        db.execute(text("INSERT INTO public.staff_account_audit(actor_user_id,target_user_id,action,metadata) VALUES(:id,:id,'profile_updated',:metadata)"),{"id":user_id,"metadata":"{}"});db.commit()
    return name
