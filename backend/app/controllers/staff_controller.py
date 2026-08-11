import logging
from flask import g,jsonify,request
from app.services.permission_service import normalize_role,normalize_status
from app.services.staff_validation_service import validate_invitation,validate_update,validate_status,StaffValidationError
from app.services.staff_service import list_staff,get_staff_by_id,list_operational_roles,invite_staff,update_staff,change_staff_status,create_password_reset,StaffNotFound,StaffConflict,DuplicateStaff
logger=logging.getLogger(__name__)
def _respond(function,success=200):
    try:
        result=function();response=jsonify(result);response.status_code=success;response.headers["Cache-Control"]="no-store";return response
    except StaffValidationError as error:return jsonify({"error":{"code":"INVALID_STAFF_FIELDS","message":"Check the highlighted fields.","fields":error.fields}}),400
    except DuplicateStaff as error:return jsonify({"error":{"code":"DUPLICATE_EMAIL","message":str(error)}}),409
    except StaffConflict as error:return jsonify({"error":{"code":"STAFF_CONFLICT","message":str(error)}}),409
    except StaffNotFound:return jsonify({"error":{"code":"STAFF_NOT_FOUND","message":"Staff account not found."}}),404
    except ValueError as error:return jsonify({"error":{"code":"INVALID_FILTER","message":str(error)}}),400
    except Exception:logger.exception("Staff account request failed.");return jsonify({"error":{"code":"STAFF_REQUEST_FAILED","message":"The staff request could not be completed."}}),500
def list_controller():
    def action():
        status=request.args.get("status");role=request.args.get("role")
        if status:status=normalize_status(status)
        if role:role=normalize_role(role)
        role_id=request.args.get("staff_role_id",type=int)
        return {"staff":list_staff(request.args.get("search"),status,role,role_id)}
    return _respond(action)
def roles_controller():return _respond(lambda:{"roles":list_operational_roles()})
def detail_controller(user_id):return _respond(lambda:{"staff":get_staff_by_id(user_id)})
def invite_controller():return _respond(lambda:invite_staff(validate_invitation(request.get_json(silent=True)),g.current_user["id"]),201)
def reissue_controller(user_id):return _respond(lambda:invite_staff({},g.current_user["id"],user_id),200)
def update_controller(user_id):return _respond(lambda:{"staff":update_staff(user_id,validate_update(request.get_json(silent=True)),g.current_user["id"])})
def status_controller(user_id):return _respond(lambda:{"staff":change_staff_status(user_id,validate_status(request.get_json(silent=True)),g.current_user["id"])})
def reset_controller(user_id):return _respond(lambda:create_password_reset(user_id,g.current_user["id"]))
