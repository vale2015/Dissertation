import os
import joblib
import pandas as pd
import holidays
from sqlalchemy import text
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, TimeSeriesSplit

from app.db.dbcon import SessionLocal

# Number of historical days used by the prediction pipeline.
HISTORICAL_WINDOW_DAYS = 90
HOLIDAY_COUNTRY = "GB"
HOLIDAY_SUBDIV = None  # Set a UK subdivision later if needed

# Builds the UK holiday calendar used to identify bank holidays and special days.
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

# Creates calendar-based features for a specific date.
def get_calendar_features(check_date, holiday_calendar):

    # Check whether the selected date is a bank holiday.
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
        nearby_date = check_date + pd.Timedelta(days=offset)
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
        "is_bank_holiday": is_bank_holiday,
        "is_christmas_related": is_christmas_related,
        "is_new_year_related": is_new_year_related,
        "is_easter_related": is_easter_related,
        "is_festive_period": is_festive_period,
        "is_special_day": is_special_day,
    }

# Trains the Random Forest demand forecasting model using historical restaurant data.
def train_model():
    try:
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
        # Convert database rows into a pandas DataFrame for data preparation.
        df = pd.DataFrame(rows, columns=columns)

        if df.empty:
            return {"message": "No data found in restaurant_demand_features"}
        # Convert the date column into datetime format and sort records chronologically.
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

        # Rolling features on booking sub-components
        df["same_day_avg_7"] = (
            df["same_day_covers"].shift(1).rolling(window=7, min_periods=1).mean()
        )
        df["walk_in_avg_7"] = (
            df["walk_in_covers"].shift(1).rolling(window=7, min_periods=1).mean()
        )
        df["advance_avg_7"] = (
            df["advance_covers"].shift(1).rolling(window=7, min_periods=1).mean()
        )
        df["duration_avg_7"] = (
            df["avg_duration_covers_summary"].shift(1).rolling(window=7, min_periods=1).mean()
        )

        df["same_day_avg_30"] = (
            df["same_day_covers"].shift(1).rolling(window=30, min_periods=1).mean()
        )
        df["walk_in_avg_30"] = (
            df["walk_in_covers"].shift(1).rolling(window=30, min_periods=1).mean()
        )
        df["advance_avg_30"] = (
            df["advance_covers"].shift(1).rolling(window=30, min_periods=1).mean()
        )
        df["duration_avg_30"] = (
            df["avg_duration_covers_summary"].shift(1).rolling(window=30, min_periods=1).mean()
        )

        # Direct lag features
        df["total_covers_lag_1"] = df["total_covers"].shift(1)
        df["total_covers_lag_7"] = df["total_covers"].shift(7)
        df["total_covers_lag_14"] = df["total_covers"].shift(14)

        # Rolling averages of total covers
        df["total_covers_avg_7"] = (
            df["total_covers"].shift(1).rolling(window=7, min_periods=1).mean()
        )
        df["total_covers_avg_30"] = (
            df["total_covers"].shift(1).rolling(window=30, min_periods=1).mean()
        )

        # Calendar features
        df["day_of_week"] = df["date"].dt.dayofweek
        df["month"] = df["date"].dt.month
        df["day_of_month"] = df["date"].dt.day
        df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)

        # Friday, Saturday, Sunday flagged as restaurant weekend pattern
        df["is_weekend"] = df["day_of_week"].isin([4, 5, 6]).astype(int)

        # Build UK holiday calendar for all years in dataset
        years = sorted(df["date"].dt.year.unique().tolist())
        holiday_calendar = build_holiday_calendar(years)

        holiday_features_df = df["date"].dt.date.apply(
            lambda d: pd.Series(get_calendar_features(d, holiday_calendar))
        )

        df = pd.concat([df, holiday_features_df], axis=1)

        feature_columns = [
            "same_day_avg_7",
            "walk_in_avg_7",
            "advance_avg_7",
            "duration_avg_7",
            "same_day_avg_30",
            "walk_in_avg_30",
            "advance_avg_30",
            "duration_avg_30",
            "total_covers_lag_1",
            "total_covers_lag_7",
            "total_covers_lag_14",
            "total_covers_avg_7",
            "total_covers_avg_30",
            "day_of_week",
            "month",
            "day_of_month",
            "week_of_year",
            "is_weekend",
            "is_bank_holiday",
            "is_christmas_related",
            "is_new_year_related",
            "is_easter_related",
            "is_festive_period",
            "is_special_day",
        ]

        # Drop rows where target or engineered features are missing
        df = df.dropna(subset=feature_columns + ["total_covers"]).reset_index(drop=True)

        if df.empty:
            return {"message": "No valid rows after feature engineering."}

        if len(df) < 10:
            return {"message": "Not enough processed rows for training (minimum 10 required)."}

        X = df[feature_columns]
        y = df["total_covers"]

        # Chronological split
        split_index = int(len(df) * 0.8)
        X_train, X_test = X.iloc[:split_index], X.iloc[split_index:]
        y_train, y_test = y.iloc[:split_index], y.iloc[split_index:]

        if len(X_train) < 10 or len(X_test) < 1:
            return {"message": "Not enough data after train/test split."}

        model = RandomForestRegressor(
            n_estimators=300,
            max_depth=6,
            min_samples_leaf=5,
            min_samples_split=10,
            max_features="sqrt",
            random_state=42,
            n_jobs=-1,
        )

        # Safer time-series cross-validation
        n_splits = min(5, max(2, len(X_train) // 20))
        tscv = TimeSeriesSplit(n_splits=n_splits)
        cv_scores = cross_val_score(model, X_train, y_train, cv=tscv, scoring="r2")

        model.fit(X_train, y_train)
        predictions = model.predict(X_test)

        mae = mean_absolute_error(y_test, predictions)
        rmse = mean_squared_error(y_test, predictions) ** 0.5
        r2 = r2_score(y_test, predictions)

        feature_importances = dict(
            zip(feature_columns, [round(float(v), 4) for v in model.feature_importances_])
        )
        sorted_importances = dict(
            sorted(feature_importances.items(), key=lambda x: x[1], reverse=True)
        )

        artifacts_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "artifacts")
        )
        os.makedirs(artifacts_dir, exist_ok=True)

        model_path = os.path.join(artifacts_dir, "demand_model.pkl")

        joblib.dump(
            {
                "model": model,
                "feature_columns": feature_columns,
                "historical_window_days": HISTORICAL_WINDOW_DAYS,
                "training_rows": int(len(X_train)),
                "testing_rows": int(len(X_test)),
                "holiday_country": HOLIDAY_COUNTRY,
                "holiday_subdiv": HOLIDAY_SUBDIV,
            },
            model_path,
        )

        return {
            "message": "Random Forest model trained successfully",
            "model_path": model_path,
            "data": {
                "rows_loaded_from_database": int(len(rows)),
                "rows_used_for_training_after_feature_engineering": int(len(df)),
                "training_rows": int(len(X_train)),
                "testing_rows": int(len(X_test)),
            },
            "features_used": feature_columns,
            "metrics": {
                "mae": round(float(mae), 2),
                "rmse": round(float(rmse), 2),
                "r2": round(float(r2), 4),
                "mean_actual": round(float(y_test.mean()), 2),
                "mean_predicted": round(float(predictions.mean()), 2),
                "cv_r2_mean": round(float(cv_scores.mean()), 4),
                "cv_r2_std": round(float(cv_scores.std()), 4),
            },
            "feature_importances": sorted_importances,
            "historical_window_used_for_forecasting": HISTORICAL_WINDOW_DAYS,
            "holiday_country": HOLIDAY_COUNTRY,
            "holiday_subdiv": HOLIDAY_SUBDIV,
        }

    except Exception as e:
        return {
            "message": "Model training failed",
            "error": str(e),
        }