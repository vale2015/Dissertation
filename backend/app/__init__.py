import os

from flask import Flask, request
from flask_cors import CORS

from app.api.auth_route import auth_bp
from app.api.booking_route import booking_bp
from app.api.dashboard_route import dashboard_bp
from app.api.demand_route import demand_bp
from app.api.events_route import events_bp
from app.api.health_route import health_bp
from app.api.staff_cost_route import staff_cost_bp
from app.api.staffing_rules_route import staffing_rules_bp
from app.api.weather_route import weather_bp
from app.api.report_route import reports_bp
from app.middleware.auth_middleware import require_authenticated_request


# Blueprints containing private restaurant data.
PROTECTED_BLUEPRINTS = {
    demand_bp.name,
    dashboard_bp.name,
    booking_bp.name,
    staff_cost_bp.name,
    staffing_rules_bp.name,
    weather_bp.name,
    events_bp.name,
    reports_bp.name,
}


def create_app():
    # Create the main Flask application.
    app = Flask(__name__)

    frontend_url = os.environ.get(
        "FRONTEND_URL",
        "http://localhost:3000",
    )

    # Remove duplicate origins when FRONTEND_URL is localhost.
    allowed_origins = list(
        dict.fromkeys([
            "http://localhost:3000",
            frontend_url,
        ])
    )

    # Allow requests only from the local and deployed Next.js frontend.
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": allowed_origins,
            }
        },
        methods=[
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],
        allow_headers=[
            "Content-Type",
            "Authorization",
        ],
    )

    # Authenticate requests for protected blueprints.
    @app.before_request
    def protect_private_api_routes():
        if request.blueprint in PROTECTED_BLUEPRINTS:
            return require_authenticated_request()

        return None

    # Add security headers to every response.
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers[
            "Referrer-Policy"
        ] = "strict-origin-when-cross-origin"
        response.headers[
            "Content-Security-Policy"
        ] = "default-src 'self'"

        return response

    # Public health-check routes.
    app.register_blueprint(
        health_bp,
        url_prefix="/api/health",
    )

    # Public authentication routes.
    app.register_blueprint(
        auth_bp,
        url_prefix="/api/auth",
    )

    # Protected demand routes.
    app.register_blueprint(
        demand_bp,
        url_prefix="/api/demand",
    )

    # Protected dashboard routes.
    app.register_blueprint(
        dashboard_bp,
        url_prefix="/api/dashboard",
    )

    # Protected booking routes.
    app.register_blueprint(
        booking_bp,
        url_prefix="/api/booking",
    )

    # Protected staff-cost routes.
    app.register_blueprint(
        staff_cost_bp,
        url_prefix="/api/staff-cost",
    )

    # Protected staffing-rules routes.
    app.register_blueprint(
        staffing_rules_bp,
        url_prefix="/api/staffing-rules",
    )

    # Protected restaurant weather routes.
    app.register_blueprint(
        weather_bp,
        url_prefix="/api/weather",
    )

    # Protected nearby-event routes.
    app.register_blueprint(
        events_bp,
        url_prefix="/api/events",
    )

    app.register_blueprint(reports_bp, url_prefix="/api/reports")

    return app
