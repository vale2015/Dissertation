from functools import wraps
from flask import g,jsonify
from app.services.permission_service import has_permission,has_role
def _forbidden():return jsonify({"error":{"code":"FORBIDDEN","message":"You do not have permission to perform this action."}}),403
def require_permission(permission):
    def decorator(function):
        @wraps(function)
        def wrapped(*args,**kwargs):
            if not getattr(g,"current_user",None):return jsonify({"error":{"code":"UNAUTHENTICATED","message":"Authentication required."}}),401
            if not has_permission(g.current_user,permission):return _forbidden()
            return function(*args,**kwargs)
        return wrapped
    return decorator
def require_role(*roles):
    def decorator(function):
        @wraps(function)
        def wrapped(*args,**kwargs):
            if not getattr(g,"current_user",None):return jsonify({"error":{"code":"UNAUTHENTICATED","message":"Authentication required."}}),401
            if not has_role(g.current_user,*roles):return _forbidden()
            return function(*args,**kwargs)
        return wrapped
    return decorator
