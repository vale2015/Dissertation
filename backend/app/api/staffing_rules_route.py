from flask import Blueprint
from app.controllers.staffing_rules_controller import get_all_staffing_rules

staffing_rules_bp = Blueprint("staffing_rules", __name__)

@staffing_rules_bp.get("/")
def fetch_staffing_rules():
    return get_all_staffing_rules()