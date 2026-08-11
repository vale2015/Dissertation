from flask import Blueprint,request
from app.controllers.auth_controller import login_user, logout_user, get_current_user, get_profile, patch_profile,account_token_controller
from app.services.account_token_service import PURPOSE_ACTIVATION,PURPOSE_RESET
from app.middleware.auth_middleware import require_authenticated_request

auth_bp = Blueprint("auth", __name__)

# Authenticate the user and start a login session.
@auth_bp.post("/login")
def login():
    return login_user()


@auth_bp.post("/logout")
def logout():
    return logout_user()

# Return the details of the currently logged-in user.
@auth_bp.get("/me")
def me():
    return get_current_user()

@auth_bp.route("/profile",methods=["GET","PATCH"])
def profile():
    failure=require_authenticated_request()
    if failure:return failure
    return get_profile() if request.method=="GET" else patch_profile()

@auth_bp.post("/invitations/validate")
def validate_invitation():return account_token_controller(PURPOSE_ACTIVATION)
@auth_bp.post("/activate")
def activate():return account_token_controller(PURPOSE_ACTIVATION,True)
@auth_bp.post("/password-reset/validate")
def validate_reset():return account_token_controller(PURPOSE_RESET)
@auth_bp.post("/password-reset")
def password_reset():return account_token_controller(PURPOSE_RESET,True)
