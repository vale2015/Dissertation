"""Private, immutable report snapshots with bounded PostgreSQL file storage."""

import base64
import binascii
import json
from datetime import datetime

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import text

from app.db.dbcon import SessionLocal
from app.services.auth_service import get_secret_key
from app.services.notification_service import create_report_saved_notification


PAGE_SIZE = 20
MAX_SNAPSHOT_BYTES = 262144
MAX_FILE_BYTES = 262144
DOWNLOAD_TOKEN_SECONDS = 300
DOWNLOAD_TOKEN_SALT = "report-history-download-v1"


class ReportHistoryError(ValueError):
    pass


def _prune_expired(db):
    # Bounded work on each save/list; expired records are never returned.
    db.execute(text("""
        DELETE FROM public.report_history WHERE id IN (
            SELECT id FROM public.report_history
            WHERE expires_at <= now() ORDER BY expires_at LIMIT 100
        )
    """))


def save_report(report, pdf_file, csv_file, actor_id):
    snapshot = json.dumps(report, separators=(",", ":"), allow_nan=False)
    if len(snapshot.encode("utf-8")) > MAX_SNAPSHOT_BYTES:
        raise ReportHistoryError("This report is too large to save.")
    for content in (pdf_file, csv_file):
        if not isinstance(content, bytes) or not 0 < len(content) <= MAX_FILE_BYTES:
            raise ReportHistoryError("This report file is too large to save.")
    metadata = report["metadata"]
    with SessionLocal() as db:
        _prune_expired(db)
        row = db.execute(text("""
            INSERT INTO public.report_history (
                created_by, selected_date, days_ahead, forecast_start_date,
                forecast_end_date, generated_at, snapshot, pdf_file, csv_file
            ) VALUES (
                :actor_id, :selected_date, :days_ahead, :start_date,
                :end_date, :generated_at, CAST(:snapshot AS jsonb), :pdf_file, :csv_file
            ) RETURNING id, created_at, expires_at
        """), {
            "actor_id": actor_id,
            "selected_date": metadata["selected_date"],
            "days_ahead": metadata["days_ahead"],
            "start_date": metadata["start_date"],
            "end_date": metadata["end_date"],
            "generated_at": metadata["generated_at"],
            "snapshot": snapshot,
            "pdf_file": pdf_file,
            "csv_file": csv_file,
        }).mappings().one()
        create_report_saved_notification(db, actor_id, row["id"], metadata["selected_date"])
        db.commit()
    return {"id": row["id"], "created_at": row["created_at"].isoformat(),
            "expires_at": row["expires_at"].isoformat()}


def _decode_cursor(cursor):
    if not cursor:
        return None
    if len(cursor) > 512:
        raise ReportHistoryError("Invalid page cursor.")
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
        created_at = datetime.fromisoformat(payload["created_at"])
        report_id = payload["id"]
        if created_at.tzinfo is None or not isinstance(report_id, int) or report_id <= 0:
            raise ValueError
        return created_at, report_id
    except (ValueError, TypeError, KeyError, UnicodeDecodeError, binascii.Error):
        raise ReportHistoryError("Invalid page cursor.") from None


def _encode_cursor(row):
    payload = json.dumps({"created_at": row["created_at"].isoformat(), "id": row["id"]})
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def list_reports(cursor=None):
    position = _decode_cursor(cursor)
    query = """
        SELECT h.id, h.created_by, u.full_name AS creator_name,
               h.selected_date, h.days_ahead, h.forecast_start_date,
               h.forecast_end_date, h.generated_at, h.created_at, h.expires_at
        FROM public.report_history h JOIN public.users u ON u.id = h.created_by
        WHERE h.expires_at > now()
    """
    values = {"limit": PAGE_SIZE + 1}
    if position:
        query += " AND (h.created_at, h.id) < (:cursor_at, :cursor_id)"
        values.update({"cursor_at": position[0], "cursor_id": position[1]})
    query += " ORDER BY h.created_at DESC, h.id DESC LIMIT :limit"
    with SessionLocal() as db:
        _prune_expired(db)
        rows = [dict(row) for row in db.execute(text(query), values).mappings().all()]
        db.commit()
    has_more = len(rows) > PAGE_SIZE
    page = rows[:PAGE_SIZE]
    next_cursor = _encode_cursor(page[-1]) if has_more else None
    return {"reports": [_public_row(row) for row in page], "next_cursor": next_cursor}


def _public_row(row):
    return {key: value.isoformat() if hasattr(value, "isoformat") else value
            for key, value in row.items()}


def get_report(report_id):
    with SessionLocal() as db:
        row = db.execute(text("""
            SELECT snapshot FROM public.report_history
            WHERE id = :id AND expires_at > now()
        """), {"id": report_id}).mappings().first()
    return row["snapshot"] if row else None


def get_report_file(report_id, format_name):
    column = {"pdf": "pdf_file", "csv": "csv_file"}.get(format_name)
    if not column:
        raise ReportHistoryError("Unsupported report format.")
    with SessionLocal() as db:
        row = db.execute(text(f"""
            SELECT selected_date, days_ahead, {column} AS content
            FROM public.report_history WHERE id = :id AND expires_at > now()
        """), {"id": report_id}).mappings().first()
    return dict(row) if row else None


def report_exists(report_id):
    with SessionLocal() as db:
        return db.execute(text("""
            SELECT 1 FROM public.report_history
            WHERE id = :id AND expires_at > now()
        """), {"id": report_id}).first() is not None


def create_download_token(report_id, format_name, user_id):
    if format_name not in ("pdf", "csv"):
        raise ReportHistoryError("Unsupported report format.")
    serializer = URLSafeTimedSerializer(get_secret_key(), salt=DOWNLOAD_TOKEN_SALT)
    return serializer.dumps({"report_id": report_id, "format": format_name, "user_id": user_id})


def valid_download_token(token, report_id, format_name, user_id):
    try:
        serializer = URLSafeTimedSerializer(get_secret_key(), salt=DOWNLOAD_TOKEN_SALT)
        data = serializer.loads(token, max_age=DOWNLOAD_TOKEN_SECONDS)
        return data == {"report_id": report_id, "format": format_name, "user_id": user_id}
    except (BadSignature, SignatureExpired):
        return False
