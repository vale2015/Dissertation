import csv, io
from app.services.report_csv_service import COLUMNS, generate_report_csv, safe_cell
from app.services.report_pdf_service import generate_report_pdf
from app.services.report_contract import empty_management_report


def sample():
    report=empty_management_report();report["metadata"].update({"selected_date":"2026-08-11","start_date":"2026-08-12","end_date":"2026-08-12","generated_at":"2026-08-11T12:00:00Z","restaurant_name":"Rosmarino","restaurant_city":"London"})
    report["daily_breakdown"]=[{"date":"2026-08-12","day_of_week":"Wednesday","status":"Open","holiday_name":"=unsafe","predicted_covers":20,"staffing":{"total_staff_assignments":1,"roles":[{"role":"Chef","required_staff":1}]},"estimated_labour_cost":96.0,"estimated_revenue":600.0,"weather":{"available":False},"events":{"available":False},"warnings":[]}]
    return report


def test_csv_bom_crlf_columns_and_injection():
    content=generate_report_csv(sample());assert content.startswith(b"\xef\xbb\xbf") and b"\r\n" in content
    rows=list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
    assert list(rows[0])==COLUMNS and rows[0]["holiday"]=="'=unsafe" and safe_cell("+1")=="'+1"


def test_pdf_has_magic_bytes_and_content():
    content=generate_report_pdf(sample());assert content.startswith(b"%PDF-") and len(content)>1000
