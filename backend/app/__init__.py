from flask import Flask
from flask_cors import CORS
from app.api.demand_route import demand_bp
from app.api.dbtest_route import testdb_bp
from app.api.dashboard_route import dashboard_bp
from app.api.auth_route import auth_bp
from app.api.booking_route import booking_bp
from app.api.staff_cost_route import staff_cost_bp
from app.api.staffing_rules_route import staffing_rules_bp


def create_app():
    # Create the main Flask application instance.
    app = Flask(__name__)

    # Enable CORS only for your frontend running on localhost:3000.
    # This means only requests coming from that origin are allowed
    # to access routes under /api/*.
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    # Add security headers to every response.
    # These do not replace validation/sanitisation,
    # but they add an extra security layer.
    @app.after_request
    def add_security_headers(response):
        # Prevent browsers from trying to guess a different content type.
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent the site from being embedded inside iframes.
        # This helps reduce clickjacking attacks.
        response.headers["X-Frame-Options"] = "DENY"

        # Control how much referrer information is sent to other sites.
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Add a basic Content Security Policy.
        # This helps reduce XSS risk by restricting where content can load from.
        response.headers["Content-Security-Policy"] = "default-src 'self'"

        return response

    # Register the database test routes under /api/dbtest.
    app.register_blueprint(testdb_bp, url_prefix="/api/dbtest")

    # Register the demand routes under /api/demand.
    app.register_blueprint(demand_bp, url_prefix="/api/demand")

    # Register the dashboard routes under /api/dashboard.
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    # Register the authentication routes under /api/auth.
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    # Register the booking routes under /api/booking.
    app.register_blueprint(booking_bp, url_prefix="/api/booking")

    #Register the staff cost route under api/staff_cost
    app.register_blueprint(staff_cost_bp, url_prefix="/api/staff-cost")

    #Register the staff rules under api/staff_rules
    app.register_blueprint(staffing_rules_bp, url_prefix="/api/staffing-rules")

    # Return the fully configured Flask app.
    return app