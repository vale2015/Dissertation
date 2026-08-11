"""One-time account token creation; raw values are returned once only."""
import hashlib,secrets
from datetime import datetime,timedelta,timezone
from sqlalchemy import text
PURPOSE_ACTIVATION="account_activation";PURPOSE_RESET="password_reset"
def token_hash(raw):return hashlib.sha256(str(raw).encode("utf-8")).hexdigest()
def create_account_token(db,user_id,purpose,created_by,valid_for):
    db.execute(text("UPDATE public.user_account_tokens SET used_at=now() WHERE user_id=:uid AND purpose=:purpose AND used_at IS NULL"),{"uid":user_id,"purpose":purpose})
    raw=secrets.token_urlsafe(32);expires=datetime.now(timezone.utc)+valid_for
    db.execute(text("INSERT INTO public.user_account_tokens(user_id,purpose,token_hash,expires_at,created_by) VALUES(:uid,:purpose,:hash,:expires,:actor)"),{"uid":user_id,"purpose":purpose,"hash":token_hash(raw),"expires":expires,"actor":created_by})
    return raw,expires
def find_valid_token(db,raw,purpose,for_update=False):
    suffix=" FOR UPDATE" if for_update else ""
    return db.execute(text("""SELECT t.id,t.user_id,t.expires_at,u.full_name,u.email,u.status
      FROM public.user_account_tokens t JOIN public.users u ON u.id=t.user_id
      WHERE t.token_hash=:hash AND t.purpose=:purpose AND t.used_at IS NULL AND t.expires_at>now() LIMIT 1"""+suffix),{"hash":token_hash(raw),"purpose":purpose}).mappings().first()
