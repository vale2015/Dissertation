from types import SimpleNamespace
from unittest.mock import MagicMock, call

import pytest

from app.services import booking_service


def transaction_connection(monkeypatch):
    connection = MagicMock()
    transaction = MagicMock()
    transaction.__enter__.return_value = connection
    monkeypatch.setattr(booking_service.engine, "begin", MagicMock(return_value=transaction))
    return connection, transaction


def test_create_booking_and_demand_rebuild_share_one_transaction(monkeypatch):
    connection, transaction = transaction_connection(monkeypatch)
    data = {
        "booking_date": "2026-10-22",
        "booking_time": "18:30",
        "party_size": 4,
        "booking_type": "advance",
    }
    inserted_booking = {"id": 17, **data}

    insert = MagicMock(return_value=inserted_booking)
    rebuild = MagicMock()
    monkeypatch.setattr(booking_service, "_insert_booking", insert)
    monkeypatch.setattr(
        booking_service,
        "_rebuild_demand_features_for_date",
        rebuild,
    )

    result = booking_service.create_booking_and_sync_features(data)

    assert result == inserted_booking
    insert.assert_called_once_with(connection, data)
    rebuild.assert_called_once_with(connection, "2026-10-22")
    connection.commit.assert_not_called()
    transaction.__exit__.assert_called_once_with(None, None, None)


def test_create_rolls_back_when_demand_rebuild_fails(monkeypatch):
    connection, transaction = transaction_connection(monkeypatch)
    error = RuntimeError("demand rebuild failed")
    monkeypatch.setattr(
        booking_service,
        "_insert_booking",
        MagicMock(return_value={"id": 17}),
    )
    monkeypatch.setattr(
        booking_service,
        "_rebuild_demand_features_for_date",
        MagicMock(side_effect=error),
    )

    with pytest.raises(RuntimeError, match="demand rebuild failed"):
        booking_service.create_booking_and_sync_features(
            {
                "booking_date": "2026-10-22",
                "booking_time": "18:30",
                "party_size": 4,
                "booking_type": "advance",
            }
        )

    connection.commit.assert_not_called()
    transaction.__exit__.assert_called_once()
    assert transaction.__exit__.call_args.args[0] is RuntimeError


def test_update_locks_booking_and_rebuilds_both_dates_in_one_transaction(
    monkeypatch,
):
    connection, _ = transaction_connection(monkeypatch)
    existing = {
        "id": 17,
        "booking_date": "2026-10-22",
        "booking_time": "18:30",
        "party_size": 4,
        "booking_type": "advance",
        "customer_name": "Alex",
        "notes": "Window",
    }
    updated_row = SimpleNamespace(
        _mapping={**existing, "booking_date": "2026-10-23"}
    )
    connection.execute.return_value.fetchone.return_value = updated_row

    fetch = MagicMock(return_value=existing)
    rebuild = MagicMock()
    monkeypatch.setattr(booking_service, "_fetch_booking_by_id", fetch)
    monkeypatch.setattr(
        booking_service,
        "_rebuild_demand_features_for_date",
        rebuild,
    )

    result = booking_service.update_booking_and_sync_features(
        17,
        {"booking_date": "2026-10-23"},
    )

    assert result["booking_date"] == "2026-10-23"
    fetch.assert_called_once_with(connection, 17, for_update=True)
    assert rebuild.call_args_list == [
        call(connection, "2026-10-22"),
        call(connection, "2026-10-23"),
    ]
    connection.commit.assert_not_called()


def test_delete_uses_returned_date_for_atomic_demand_rebuild(monkeypatch):
    connection, _ = transaction_connection(monkeypatch)
    connection.execute.return_value.fetchone.return_value = SimpleNamespace(
        booking_date="2026-10-22"
    )
    rebuild = MagicMock()
    monkeypatch.setattr(
        booking_service,
        "_rebuild_demand_features_for_date",
        rebuild,
    )

    result = booking_service.delete_booking_and_sync_features(17)

    assert result is True
    rebuild.assert_called_once_with(connection, "2026-10-22")
    connection.commit.assert_not_called()


def test_delete_missing_booking_does_not_rebuild_demand(monkeypatch):
    connection, _ = transaction_connection(monkeypatch)
    connection.execute.return_value.fetchone.return_value = None
    rebuild = MagicMock()
    monkeypatch.setattr(
        booking_service,
        "_rebuild_demand_features_for_date",
        rebuild,
    )

    result = booking_service.delete_booking_and_sync_features(999)

    assert result is False
    rebuild.assert_not_called()

