from datetime import timedelta, date
import os
import joblib
import pandas as pd
import holidays
from sqlalchemy import text

from app.db.dbcon import SessionLocal

# Number of recent historical days used to build forecasting features.
HISTORICAL_WINDOW_DAYS = 90
HOLIDAY_COUNTRY = "GB"
HOLIDAY_SUBDIV = None

# Fixed Christmas closure period used to mark the restaurant as closed.
CHRISTMAS_CLOSED_START = date(2025, 12, 21)
CHRISTMAS_CLOSED_END = date(2025, 12, 29)

# Checks whether the restaurant is closed on the selected date.
def is_closed_date(check_date):
    is_monday_closed = check_date.weekday() == 0
    is_christmas_shutdown = CHRISTMAS_CLOSED_START <= check_date <= CHRISTMAS_CLOSED_END
    return is_monday_closed or is_christmas_shutdown

# Returns the reason why the restaurant is closed.
def get_closure_reason(check_date):
    if CHRISTMAS_CLOSED_START <= check_date <= CHRISTMAS_CLOSED_END:
        return "Christmas Closure"
    if check_date.weekday() == 0:
        return "Monday"
    return None

# Builds the UK holiday calendar used for forecast date features.
def build_holiday_calendar(years):
    if HOLIDAY_SUBDIV:
        return holidays.country_holidays(
            HOLIDAY_COUNTRY,
            years=years,
            subdiv=HOLIDAY_SUBDIV,
        )
    return holidays.country_holidays(
        HOLIDAY_COUNTRY,
        years=years,
    )

# Creates holiday and festive-period features for a forecast date.
def get_calendar_features(check_date, holiday_calendar):
    holiday_name = holiday_calendar.get(check_date)
    is_bank_holiday = int(holiday_name is not None)

    holiday_name_lower = holiday_name.lower() if holiday_name else ""

    is_christmas_related = int(
        "christmas" in holiday_name_lower or "boxing" in holiday_name_lower
    )
    is_new_year_related = int("new year" in holiday_name_lower)
    is_easter_related = int(
        "easter" in holiday_name_lower or "good friday" in holiday_name_lower
    )

    festive_anchor = False
    for offset in range(-3, 4):
        nearby_date = check_date + timedelta(days=offset)
        nearby_name = holiday_calendar.get(nearby_date)

        if nearby_name:
            nearby_name_lower = nearby_name.lower()
            if (
                "christmas" in nearby_name_lower
                or "boxing" in nearby_name_lower
                or "new year" in nearby_name_lower
                or "easter" in nearby_name_lower
                or "good friday" in nearby_name_lower
            ):
                festive_anchor = True
                break

    is_festive_period = int(festive_anchor)

    is_special_day = int(
        is_bank_holiday
        or is_festive_period
        or is_christmas_related
        or is_new_year_related
        or is_easter_related
    )

    return {
        "holiday_name": holiday_name,
        "is_bank_holiday": is_bank_holiday,
        "is_christmas_related": is_christmas_related,
        "is_new_year_related": is_new_year_related,
        "is_easter_related": is_easter_related,
        "is_festive_period": is_festive_period,
        "is_special_day": is_special_day,
    }

# Generates future demand predictions using the trained Random Forest model.
def prediction_demand(days_ahead=7, selected_date=None):
    try:
        model_path = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "artifacts",
                "demand_model.pkl",
            )
        )
        # Stop forecasting if the model has not been trained yet.
        if not os.path.exists(model_path):
            return {"message": "Model file not found. Train the model first."}
        # Load the trained model and the feature columns used during training.
        saved_artifact = joblib.load(model_path)
        model = saved_artifact["model"]
        feature_columns = saved_artifact["feature_columns"]

        with SessionLocal() as db:
            result = db.execute(
                text(
                    """
                    SELECT
                        date,
                        same_day_covers,
                        walk_in_covers,
                        advance_covers,
                        total_covers,
                        avg_duration_covers_summary
                    FROM public.restaurant_demand_features
                    ORDER BY date ASC
                    """
                )
            )
            rows = result.fetchall()
            columns = result.keys()

        df = pd.DataFrame(rows, columns=columns)

        if df.empty:
            return {"message": "No data found in restaurant_demand_features"}

        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

        numeric_columns = [
            "same_day_covers",
            "walk_in_covers",
            "advance_covers",
            "total_covers",
            "avg_duration_covers_summary",
        ]

        for column in numeric_columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")

        df = df.dropna(
            subset=[
                "date",
                "same_day_covers",
                "walk_in_covers",
                "advance_covers",
                "total_covers",
                "avg_duration_covers_summary",
            ]
        ).reset_index(drop=True)

        if df.empty:
            return {"message": "No valid historical data found after cleaning."}

        df["date_only"] = df["date"].dt.date
        available_dates = sorted(df["date_only"].tolist())

        if selected_date:
            selected_date_obj = pd.to_datetime(selected_date).date()

            if selected_date_obj not in available_dates:
                return {
                    "model": "random_forest",
                    "forecast_days": days_ahead,
                    "based_on_recent_rows": int(len(df)),
                    "selected_date": str(selected_date_obj),
                    "forecast": [],
                    "message": "Selected date is not available in the historical dataset.",
                }

            base_date = selected_date_obj
        else:
            base_date = max(available_dates)

        window_start_date = base_date - timedelta(days=HISTORICAL_WINDOW_DAYS - 1)

        history_df = (
            df[
                (df["date_only"] >= window_start_date)
                & (df["date_only"] <= base_date)
            ]
            .sort_values("date")
            .copy()
            .reset_index(drop=True)
        )

        if len(history_df) < 30:
            return {
                "model": "random_forest",
                "forecast_days": days_ahead,
                "based_on_recent_rows": int(len(history_df)),
                "selected_date": str(base_date),
                "forecast": [],
                "message": "At least 30 historical records are required within the last 90 days before the selected date to generate the forecast.",
            }

        holiday_years = sorted(
            set(history_df["date"].dt.year.tolist())
            | set((base_date + timedelta(days=i + 1)).year for i in range(days_ahead))
        )
        holiday_calendar = build_holiday_calendar(holiday_years)

        forecast = []

        for i in range(days_ahead):
            future_date = base_date + timedelta(days=i + 1)

            closed = is_closed_date(future_date)
            closure_reason = get_closure_reason(future_date)

            total_covers_series = history_df["total_covers"].tolist()

            if len(total_covers_series) < 30:
                return {
                    "model": "random_forest",
                    "forecast_days": days_ahead,
                    "based_on_recent_rows": int(len(history_df)),
                    "selected_date": str(base_date),
                    "forecast": forecast,
                    "message": "Not enough rolling history to continue forecasting.",
                }

            recent_7 = history_df.tail(7)
            recent_30 = history_df.tail(30)

            same_day_avg_7 = float(recent_7["same_day_covers"].mean())
            walk_in_avg_7 = float(recent_7["walk_in_covers"].mean())
            advance_avg_7 = float(recent_7["advance_covers"].mean())
            duration_avg_7 = float(recent_7["avg_duration_covers_summary"].mean())

            same_day_avg_30 = float(recent_30["same_day_covers"].mean())
            walk_in_avg_30 = float(recent_30["walk_in_covers"].mean())
            advance_avg_30 = float(recent_30["advance_covers"].mean())
            duration_avg_30 = float(recent_30["avg_duration_covers_summary"].mean())

            total_covers_lag_1 = float(total_covers_series[-1])
            total_covers_lag_7 = float(total_covers_series[-7])
            total_covers_lag_14 = float(total_covers_series[-14])
            total_covers_avg_7 = float(sum(total_covers_series[-7:]) / 7)
            total_covers_avg_30 = float(sum(total_covers_series[-30:]) / 30)

            week_of_year = int(pd.Timestamp(future_date).isocalendar().week)
            is_weekend = int(future_date.weekday() in [4, 5, 6])

            calendar_features = get_calendar_features(future_date, holiday_calendar)

            row_data = {
                "same_day_avg_7": round(same_day_avg_7, 2),
                "walk_in_avg_7": round(walk_in_avg_7, 2),
                "advance_avg_7": round(advance_avg_7, 2),
                "duration_avg_7": round(duration_avg_7, 2),
                "same_day_avg_30": round(same_day_avg_30, 2),
                "walk_in_avg_30": round(walk_in_avg_30, 2),
                "advance_avg_30": round(advance_avg_30, 2),
                "duration_avg_30": round(duration_avg_30, 2),
                "total_covers_lag_1": round(total_covers_lag_1, 2),
                "total_covers_lag_7": round(total_covers_lag_7, 2),
                "total_covers_lag_14": round(total_covers_lag_14, 2),
                "total_covers_avg_7": round(total_covers_avg_7, 2),
                "total_covers_avg_30": round(total_covers_avg_30, 2),
                "day_of_week": future_date.weekday(),
                "month": future_date.month,
                "day_of_month": future_date.day,
                "week_of_year": week_of_year,
                "is_weekend": is_weekend,
                "is_bank_holiday": calendar_features["is_bank_holiday"],
                "is_christmas_related": calendar_features["is_christmas_related"],
                "is_new_year_related": calendar_features["is_new_year_related"],
                "is_easter_related": calendar_features["is_easter_related"],
                "is_festive_period": calendar_features["is_festive_period"],
                "is_special_day": calendar_features["is_special_day"],
            }

            input_data = pd.DataFrame([row_data])[feature_columns]

            if closed:
                predicted_total_covers = 0
                simulated_total_covers = round(total_covers_avg_7, 2)
            else:
                predicted_total_covers = max(0, round(float(model.predict(input_data)[0])))
                simulated_total_covers = predicted_total_covers

            forecast.append(
                {
                    "date": str(future_date),
                    "day_of_week": future_date.strftime("%A"),
                    "holiday_name": calendar_features["holiday_name"],
                    "closed": closed,
                    "closure_reason": closure_reason,
                    "input_features": row_data,
                    "predicted_total_covers": predicted_total_covers,
                }
            )

            new_row = {
                "date": pd.Timestamp(future_date),
                "date_only": future_date,
                "same_day_covers": same_day_avg_7,
                "walk_in_covers": walk_in_avg_7,
                "advance_covers": advance_avg_7,
                "total_covers": simulated_total_covers,
                "avg_duration_covers_summary": duration_avg_7,
            }

            history_df = pd.concat(
                [history_df, pd.DataFrame([new_row])],
                ignore_index=True,
            )

            rolling_window_start = future_date - timedelta(days=HISTORICAL_WINDOW_DAYS - 1)
            history_df = (
                history_df[history_df["date_only"] >= rolling_window_start]
                .sort_values("date")
                .reset_index(drop=True)
            )

        return {
            "model": "random_forest",
            "forecast_days": days_ahead,
            "based_on_recent_rows": int(len(history_df)),
            "historical_window_used": HISTORICAL_WINDOW_DAYS,
            "selected_date": str(base_date),
            "holiday_country": HOLIDAY_COUNTRY,
            "holiday_subdiv": HOLIDAY_SUBDIV,
            "forecast": forecast,
        }

    except Exception as e:
        return {
            "message": "Forecast failed",
            "error": str(e),
        }