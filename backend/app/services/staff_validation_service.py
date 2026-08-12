"""Validation shared by staff controllers and account services."""
import re
from app.services.permission_service import normalize_role,normalize_status,ROLE_STAFF
EMAIL_RE=re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
class StaffValidationError(ValueError):
    def __init__(self,fields): super().__init__("Invalid staff account fields.");self.fields=fields
def validate_invitation(data):
    data=data or {};fields={};name=str(data.get("full_name") or "").strip();email=str(data.get("email") or "").strip().lower()
    try: role=normalize_role(data.get("application_role"))
    except ValueError as error: fields["application_role"]=str(error);role=None
    staff_role_id=data.get("staff_role_id")
    if len(name)<2 or len(name)>120:fields["full_name"]="Must be between 2 and 120 characters."
    if not EMAIL_RE.fullmatch(email):fields["email"]="Enter a valid email address."
    if role==ROLE_STAFF and not staff_role_id:fields["staff_role_id"]="An operational role is required for staff."
    try: staff_role_id=int(staff_role_id) if staff_role_id not in (None,"") else None
    except (TypeError,ValueError):fields["staff_role_id"]="Must be a valid role identifier."
    if fields:raise StaffValidationError(fields)
    return {"full_name":name,"email":email,"application_role":role,"staff_role_id":staff_role_id}
def validate_registration(data):
    result=validate_invitation(data)
    result["password"]=validate_password(data)
    return result
def validate_update(data):
    data=data or {};result={};fields={}
    if "full_name" in data:
        result["full_name"]=str(data["full_name"] or "").strip()
        if len(result["full_name"])<2 or len(result["full_name"])>120:fields["full_name"]="Must be between 2 and 120 characters."
    if "application_role" in data:
        try:result["role"]=normalize_role(data["application_role"])
        except ValueError as error:fields["application_role"]=str(error)
    if "staff_role_id" in data:
        try:result["staff_role_id"]=int(data["staff_role_id"]) if data["staff_role_id"] not in (None,"") else None
        except (TypeError,ValueError):fields["staff_role_id"]="Must be a valid role identifier."
    if not result:fields["body"]="No editable fields were supplied."
    if fields:raise StaffValidationError(fields)
    return result
def validate_status(data):
    try:return normalize_status((data or {}).get("status"))
    except ValueError as error:raise StaffValidationError({"status":str(error)}) from error
def validate_password(data):
    data=data or {};password=data.get("password");confirmation=data.get("password_confirmation");fields={}
    if not isinstance(password,str) or len(password)<12 or len(password)>128 or not password.strip():fields["password"]="Use 12 to 128 non-blank characters."
    if password!=confirmation:fields["password_confirmation"]="Passwords must match."
    if fields:raise StaffValidationError(fields)
    return password
