from flask import Blueprint
from app.controllers.auth_controller import login_user, logout_user, get_current_user

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