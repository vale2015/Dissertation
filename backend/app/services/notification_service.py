"""Private, recipient-scoped in-app notifications."""

from sqlalchemy import text

from app.db.dbcon import SessionLocal


PAGE_SIZE = 20


def create_report_saved_notification(db, recipient_id, report_id, selected_date):
    """Insert in the same transaction as the saved report."""
    db.execute(text("""
        INSERT INTO public.in_app_notifications
            (recipient_id, event_type, source_id, dedupe_key, title, body)
        VALUES
            (:recipient_id, 'report_saved', :report_id, :dedupe_key,
             'Management report saved', :body)
        ON CONFLICT (dedupe_key) DO NOTHING
    """), {
        "recipient_id": recipient_id,
        "report_id": report_id,
        "dedupe_key": f"report_saved:{report_id}:{recipient_id}",
        "body": f"Report #{report_id} for {selected_date} is ready. Ask RFS AI to view or download it.",
    })


def _prune_expired(db):
    db.execute(text("""
        DELETE FROM public.in_app_notifications WHERE id IN (
            SELECT id FROM public.in_app_notifications
            WHERE expires_at <= now() ORDER BY expires_at LIMIT 100
        )
    """))


def list_notifications(recipient_id):
    with SessionLocal() as db:
        _prune_expired(db)
        rows = db.execute(text("""
            SELECT id, event_type, source_id, title, body, created_at, read_at
            FROM public.in_app_notifications
            WHERE recipient_id = :recipient_id AND expires_at > now()
            ORDER BY created_at DESC, id DESC LIMIT :limit
        """), {"recipient_id": recipient_id, "limit": PAGE_SIZE}).mappings().all()
        unread_count = db.execute(text("""
            SELECT count(*) FROM public.in_app_notifications
            WHERE recipient_id = :recipient_id AND read_at IS NULL AND expires_at > now()
        """), {"recipient_id": recipient_id}).scalar_one()
        db.commit()
    return {
        "notifications": [{
            "id": row["id"], "event_type": row["event_type"],
            "source_id": row["source_id"], "title": row["title"],
            "body": row["body"], "created_at": row["created_at"].isoformat(),
            "read_at": row["read_at"].isoformat() if row["read_at"] else None,
        } for row in rows],
        "unread_count": unread_count,
    }


def mark_notification_read(recipient_id, notification_id):
    with SessionLocal() as db:
        row = db.execute(text("""
            UPDATE public.in_app_notifications
            SET read_at = COALESCE(read_at, now())
            WHERE id = :notification_id AND recipient_id = :recipient_id
              AND expires_at > now()
            RETURNING id, read_at
        """), {"notification_id": notification_id, "recipient_id": recipient_id}).mappings().one_or_none()
        db.commit()
    return {"id": row["id"], "read_at": row["read_at"].isoformat()} if row else None
