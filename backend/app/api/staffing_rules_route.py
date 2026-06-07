from flask import Blueprint
from app.controllers.staffing_rules_controller import get_all_staffing_rules_controller


staffing_rules_bp = Blueprint(
    "staffing_rules",
    __name__
)

# Retrieve all staffing rules used to calculate staff requirements.
@staffing_rules_bp.route("/", methods=["GET"])
def get_all_staffing_rules_route():
    return get_all_staffing_rules_controller()