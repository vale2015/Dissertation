from flask import Flask
from flask_cors import CORS

from app.api.demand_route import demand_bp
from app.api.health_route import health_bp
from app.api.dashboard_route import dashboard_bp
from app.api.auth_route import auth_bp
from app.api.booking_route import booking_bp
from app.api.staff_cost_route import staff_cost_bp
from app.api.staffing_rules_route import staffing_rules_bp


def create_app():
    # Create the main Flask application instance.
    app = Flask(__name__)

    # Enable CORS only for the frontend running on localhost:3000.
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    # Add security headers to every response.
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response

    # Register the health-check routes under /api/health.
    app.register_blueprint(health_bp, url_prefix="/api/health")

    # Register the demand routes under /api/demand.
    app.register_blueprint(demand_bp, url_prefix="/api/demand")

    # Register the dashboard routes under /api/dashboard.
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    # Register the authentication routes under /api/auth.
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    # Register the booking routes under /api/booking.
    app.register_blueprint(booking_bp, url_prefix="/api/booking")

    # Register the staff cost routes under /api/staff-cost.
    app.register_blueprint(staff_cost_bp, url_prefix="/api/staff-cost")

    # Register the staffing rules routes under /api/staffing-rules.
    app.register_blueprint(staffing_rules_bp, url_prefix="/api/staffing-rules")

    # Return the fully configured Flask app.
    return app