import pytest

from app import create_app
from app.services.report_contract import empty_management_report

HSTS = "max-age=63072000; includeSubDomains; preload"
EXISTING_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'",
}


def assert_baseline_headers(response):
    for name, value in EXISTING_HEADERS.items():
        assert response.headers[name] == value
    policy = response.headers["Permissions-Policy"]
    for feature in ("camera", "microphone", "geolocation", "payment", "usb"):
        assert f"{feature}=()" in policy


def test_api_response_over_http_has_headers_without_hsts():
    response = create_app().test_client().get("/api/health/")
    assert response.status_code == 200
    assert_baseline_headers(response)
    assert "Strict-Transport-Security" not in response.headers


@pytest.mark.parametrize("proto", ["https", "HTTPS", "https, http"])
def test_api_response_behind_https_proxy_has_hsts(proto):
    response = create_app().test_client().get(
        "/api/health/", headers={"X-Forwarded-Proto": proto}
    )
    assert_baseline_headers(response)
    assert response.headers["Strict-Transport-Security"] == HSTS


def test_direct_https_request_has_hsts():
    response = create_app().test_client().get("/api/health/", base_url="https://localhost")
    assert response.headers["Strict-Transport-Security"] == HSTS


def test_http_forwarded_proto_does_not_add_hsts():
    response = create_app().test_client().get(
        "/api/health/", headers={"X-Forwarded-Proto": "http"}
    )
    assert "Strict-Transport-Security" not in response.headers


def test_denied_requests_still_carry_security_headers():
    response = create_app().test_client().get(
        "/api/reports/management?selected_date=2026-08-11",
        headers={"X-Forwarded-Proto": "https"},
    )
    assert response.status_code == 401
    assert_baseline_headers(response)
    assert response.headers["Strict-Transport-Security"] == HSTS


@pytest.mark.parametrize(
    ("suffix", "content_type", "extension"),
    [("/csv", "text/csv", "csv"), ("/pdf", "application/pdf", "pdf")],
)
def test_report_downloads_keep_type_and_disposition(monkeypatch, suffix, content_type, extension):
    monkeypatch.setattr(
        "app.middleware.auth_middleware.decode_user_token",
        lambda token: {"user": {"id": 1, "role": "manager"}},
    )
    report = empty_management_report()
    report["metadata"].update({
        "selected_date": "2026-08-11", "start_date": "2026-08-12",
        "end_date": "2026-08-18", "generated_at": "2026-08-11T12:00:00Z",
        "restaurant_name": "Synthetic Bistro", "restaurant_city": "Testville",
    })
    monkeypatch.setattr(
        "app.controllers.report_controller.generate_management_report",
        lambda **params: report,
    )

    response = create_app().test_client().get(
        f"/api/reports/management{suffix}?selected_date=2026-08-11&days_ahead=7",
        headers={"Authorization": "Bearer synthetic", "X-Forwarded-Proto": "https"},
    )

    assert response.status_code == 200
    assert response.mimetype == content_type
    if extension == "csv":
        assert response.mimetype_params["charset"] == "utf-8"
    assert response.headers["Content-Disposition"] == (
        f'attachment; filename="management-report-2026-08-11-7-days.{extension}"'
    )
    assert response.headers["Cache-Control"] == "no-store"
    assert_baseline_headers(response)
    assert response.headers["Strict-Transport-Security"] == HSTS
