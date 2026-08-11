from datetime import timezone
from sqlalchemy import text
from werkzeug.security import generate_password_hash
from app.db.dbcon import SessionLocal
from app.services.account_token_service import find_valid_token,PURPOSE_ACTIVATION,PURPOSE_RESET
from app.services.permission_service import STATUS_INVITED,STATUS_ACTIVE
from app.services.staff_validation_service import validate_password
class InvalidAccountToken(ValueError):pass
def _masked(email):
    local,domain=email.split("@",1);return f"{local[:1]}***@{domain}"
def validate_account_token(raw,purpose):
    if not isinstance(raw,str) or not raw:raise InvalidAccountToken("This link is invalid or has expired.")
    with SessionLocal() as db:row=find_valid_token(db,raw,purpose)
    required=STATUS_INVITED if purpose==PURPOSE_ACTIVATION else STATUS_ACTIVE
    if not row or row["status"]!=required:raise InvalidAccountToken("This link is invalid or has expired.")
    return {"valid":True,"full_name":row["full_name"],"masked_email":_masked(row["email"]),"expires_at":row["expires_at"]}
def complete_account_token(raw,purpose,data):
    password=validate_password(data)
    with SessionLocal() as db:
      try:
        row=find_valid_token(db,raw,purpose,for_update=True);required=STATUS_INVITED if purpose==PURPOSE_ACTIVATION else STATUS_ACTIVE
        if not row or row["status"]!=required:raise InvalidAccountToken("This link is invalid or has expired.")
        if purpose==PURPOSE_ACTIVATION:
            db.execute(text("UPDATE public.users SET password_hash=:password,status='active',activated_at=now(),session_version=session_version+1,updated_at=now() WHERE id=:id"),{"password":generate_password_hash(password),"id":row["user_id"]});action="account_activated"
        else:
            db.execute(text("UPDATE public.users SET password_hash=:password,session_version=session_version+1,updated_at=now() WHERE id=:id"),{"password":generate_password_hash(password),"id":row["user_id"]});action="password_reset_completed"
        db.execute(text("UPDATE public.user_account_tokens SET used_at=now() WHERE id=:id AND used_at IS NULL"),{"id":row["id"]})
        db.execute(text("INSERT INTO public.staff_account_audit(actor_user_id,target_user_id,action,metadata) VALUES(NULL,:id,:action,'{}'::jsonb)"),{"id":row["user_id"],"action":action});db.commit();return {"message":"Account activated successfully." if purpose==PURPOSE_ACTIVATION else "Password reset successfully."}
      except Exception:db.rollback();raise
