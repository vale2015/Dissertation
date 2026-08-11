from flask import Flask,g
from app.middleware.authorization_middleware import require_permission
from app.services.permission_service import MANAGE_STAFF_ACCOUNTS
def app_for(role=None):
    app=Flask(__name__)
    @app.get("/test")
    @require_permission(MANAGE_STAFF_ACCOUNTS)
    def test():return {"ok":True}
    @app.before_request
    def user():
        if role:g.current_user={"role":role}
    return app
def test_manager_allowed_supervisor_forbidden_and_missing_is_unauthenticated():
    assert app_for("manager").test_client().get("/test").status_code==200
    response=app_for("supervisor").test_client().get("/test");assert response.status_code==403 and response.get_json()["error"]["code"]=="FORBIDDEN"
    assert app_for().test_client().get("/test").status_code==401
