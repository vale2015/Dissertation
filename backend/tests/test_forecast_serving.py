"""Forecast serving should stay bounded and avoid repeated artifact loading."""

from datetime import date, timedelta
import hashlib
import io

from flask import Flask

from app.api.demand_route import demand_bp
from app.controllers import demand_controller
from app.ml.pipelines import predict_pipeline


class FakeResult:
    def __init__(self, rows=(), columns=(), scalar=None):
        self.rows = rows
        self.columns = columns
        self.value = scalar

    def scalar(self):
        return self.value

    def fetchall(self):
        return self.rows

    def keys(self):
        return self.columns


class FakeSession:
    columns = (
        "date", "same_day_covers", "walk_in_covers", "advance_covers",
        "total_covers", "avg_duration_covers_summary",
    )

    def __init__(self, base_date):
        self.base_date = base_date
        self.queries = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, statement, params=None):
        query = str(statement)
        self.queries.append((query, params))
        if "SELECT MAX(date)" in query:
            return FakeResult(scalar=self.base_date)
        rows = [
            (self.base_date - timedelta(days=offset), 5, 5, 10, 20, 60)
            for offset in range(39, -1, -1)
        ]
        return FakeResult(rows=rows, columns=self.columns)


class FakeModel:
    def predict(self, _features):
        return [25]


def test_forecast_reads_only_the_90_day_window_and_keeps_seven_day_output(monkeypatch):
    database = FakeSession(date(2026, 10, 30))
    monkeypatch.setattr(predict_pipeline, "SessionLocal", lambda: database)
    monkeypatch.setattr(
        predict_pipeline, "_load_model_artifact",
        lambda *_args: (FakeModel(), ["day_of_week"], "a" * 64),
    )

    result = predict_pipeline.prediction_demand(days_ahead=7)

    assert len(result["forecast"]) == 7
    assert result["selected_date"] == "2026-10-30"
    assert result["model_version"] == "a" * 64
    assert "WHERE date >= :window_start_date AND date <= :base_date" in database.queries[1][0]
    assert database.queries[1][1] == {
        "window_start_date": date(2026, 8, 2), "base_date": date(2026, 10, 30)
    }


def test_selected_historical_date_uses_one_bounded_history_query(monkeypatch):
    database = FakeSession(date(2026, 10, 20))
    monkeypatch.setattr(predict_pipeline, "SessionLocal", lambda: database)
    monkeypatch.setattr(
        predict_pipeline, "_load_model_artifact",
        lambda *_args: (FakeModel(), ["day_of_week"], "a" * 64),
    )

    result = predict_pipeline.prediction_demand(days_ahead=10, selected_date="2026-10-20")

    assert len(result["forecast"]) == 10
    assert len(database.queries) == 1
    assert database.queries[0][1]["base_date"] == date(2026, 10, 20)


def test_bundled_artifact_is_deserialized_once_per_warm_process(monkeypatch):
    path = "trusted-model.pkl"
    monkeypatch.setattr("builtins.open", lambda *_args, **_kwargs: io.BytesIO(b"trusted-model"))
    loaded = []
    marker = object()
    monkeypatch.setattr(
        predict_pipeline.joblib, "load",
        lambda _data: loaded.append(True) or {"model": marker, "feature_columns": ["day_of_week"]},
    )
    predict_pipeline._load_model_artifact.cache_clear()
    try:
        first = predict_pipeline._load_model_artifact(path, 1, len(b"trusted-model"))
        second = predict_pipeline._load_model_artifact(path, 1, len(b"trusted-model"))
        assert first is second
        assert len(loaded) == 1
        assert first[2] == hashlib.sha256(b"trusted-model").hexdigest()

        predict_pipeline._load_model_artifact(path, 2, len(b"trusted-model"))
        assert len(loaded) == 2
    finally:
        predict_pipeline._load_model_artifact.cache_clear()


def test_web_training_route_is_removed():
    app = Flask(__name__)
    app.register_blueprint(demand_bp, url_prefix="/api/demand")
    client = app.test_client()
    assert client.get("/api/demand/train").status_code == 404
    assert client.post("/api/demand/train").status_code == 404


def test_forecast_rejects_invalid_date_before_prediction(monkeypatch):
    called = []
    monkeypatch.setattr(
        demand_controller, "prediction_demand",
        lambda **kwargs: called.append(kwargs) or {"forecast": []},
    )
    app = Flask(__name__)
    app.add_url_rule("/forecast", view_func=demand_controller.demand_forecast)
    client = app.test_client()

    response = client.get("/forecast?days=7&date=2026-02-30")
    assert response.status_code == 400
    assert not called

    response = client.get("/forecast?days=10&date=2026-10-20")
    assert response.status_code == 200
    assert called == [{"days_ahead": 10, "selected_date": "2026-10-20"}]


def test_forecast_failure_does_not_expose_internal_error(monkeypatch):
    def fail_prediction(**_kwargs):
        raise RuntimeError("private database connection detail")

    monkeypatch.setattr(demand_controller, "prediction_demand", fail_prediction)
    app = Flask(__name__)
    app.add_url_rule("/forecast", view_func=demand_controller.demand_forecast)

    response = app.test_client().get("/forecast?days=7")

    assert response.status_code == 500
    assert response.get_json() == {"error": "Forecast is temporarily unavailable."}
    assert b"private database connection detail" not in response.data
