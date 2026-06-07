"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import SummaryCard from "@/components/dashboard/summaryCard";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";
// Flask backend API base URL.
const API_BASE = "http://127.0.0.1:5000/api";
// Checks if the forecast day is a closed trading day.
function isClosedDay(day) {
  return String(day || "").trim().toLowerCase() === "monday";
}
// Reservation forecast page showing predicted covers for 7 or 10 days.
export default function ReservationForecastPage() {
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date");
// Store forecast length, forecast results, and loading state.
  const [forecastDays, setForecastDays] = useState(7);
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(false);
// Load forecast data whenever the selected date or forecast length changes.
  useEffect(() => {
    let ignore = false;

    const loadForecast = async () => {
      setLoading(true);
      setForecastData([]);

      try { // Build the forecast API URL using the selected date if available.
        const requestUrl = selectedDate
          ? `${API_BASE}/demand/forecast?days=${forecastDays}&date=${selectedDate}`
          : `${API_BASE}/demand/forecast?days=${forecastDays}`;

        console.log("Fetching forecast:", requestUrl);
// Request forecast data from the Flask backend.
        const response = await fetch(requestUrl, {
          method: "GET",
          cache: "no-store",
        });

        const json = await response.json();

        if (ignore) return;

        const rawRows = Array.isArray(json?.forecast) ? json.forecast : [];

        const adjustedRows = rawRows.map((item) => {
          const closed = item.closed === true || isClosedDay(item.day_of_week);

          return {
            ...item,
            closed,
            predicted_total_covers: closed
              ? 0
              : Number(item.predicted_total_covers || 0),
          };
        });

        setForecastData(adjustedRows);
      } catch (error) {
        console.error("Failed to load forecast data:", error);
        if (!ignore) {
          setForecastData([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadForecast();

    return () => {
      ignore = true;
    };
  }, [forecastDays, selectedDate]);

  const totalForecastedCovers = useMemo(() => {
    return forecastData.reduce(
      (sum, item) => sum + Number(item.predicted_total_covers || 0),
      0
    );
  }, [forecastData]);

  const peakDay = useMemo(() => {
    const openDays = forecastData.filter((item) => !item.closed);

    if (!openDays.length) return "-";

    const maxItem = [...openDays].sort(
      (a, b) =>
        Number(b.predicted_total_covers || 0) -
        Number(a.predicted_total_covers || 0)
    )[0];

    return maxItem?.day_of_week || "-";
  }, [forecastData]);

  const lowestDay = useMemo(() => {
    const openDays = forecastData.filter((item) => !item.closed);

    if (!openDays.length) return "-";

    const minItem = [...openDays].sort(
      (a, b) =>
        Number(a.predicted_total_covers || 0) -
        Number(b.predicted_total_covers || 0)
    )[0];

    return minItem?.day_of_week || "-";
  }, [forecastData]);

  const averagePerDay = useMemo(() => {
    const openDays = forecastData.filter((item) => !item.closed);

    if (!openDays.length) return 0;

    const total = openDays.reduce(
      (sum, item) => sum + Number(item.predicted_total_covers || 0),
      0
    );

    return Math.round(total / openDays.length);
  }, [forecastData]);

  return (
    <div className="dashboard-app">
      <Topbar />

      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">
              <section className="dashboard-hero">
                <h1 className="dashboard-title">Reservation Forecast</h1>
                <p className="dashboard-text">
                  Forecast expected covers for the next {forecastDays} days
                  {selectedDate ? ` from ${formatDateDDMMYYYY(selectedDate)}` : ""}
                </p>

                <div className="forecast-toggle">
                  <button
                    type="button"
                    className={
                      forecastDays === 7
                        ? "forecast-toggle-btn active"
                        : "forecast-toggle-btn"
                    }
                    onClick={() => setForecastDays(7)}
                    disabled={loading && forecastDays === 7}
                  >
                    7 Days
                  </button>

                  <button
                    type="button"
                    className={
                      forecastDays === 10
                        ? "forecast-toggle-btn active"
                        : "forecast-toggle-btn"
                    }
                    onClick={() => setForecastDays(10)}
                    disabled={loading && forecastDays === 10}
                  >
                    10 Days
                  </button>
                </div>
              </section>

              {loading ? (
                <p className="dashboard-text">Loading forecast data...</p>
              ) : (
                <>
                  <section className="dashboard-summary-grid">
                    <SummaryCard
                      title="Forecasted Covers"
                      value={totalForecastedCovers}
                      description={`Predicted total covers in the next ${forecastDays} days, excluding Monday`}
                    />
                    <SummaryCard
                      title="Peak Day"
                      value={peakDay}
                      description="Highest expected reservations day"
                    />
                    <SummaryCard
                      title="Lowest Day"
                      value={lowestDay}
                      description="Lowest expected reservation day"
                    />
                    <SummaryCard
                      title="Average Per Day"
                      value={averagePerDay}
                      description="Average forecasted covers across business days"
                    />
                  </section>

                  <section className="dashboard-panel">
                    <h2 className="dashboard-panel-title">
                      Forecast Details ({forecastDays} Days)
                    </h2>

                    <div className="booking-table-wrapper">
                      <table className="booking-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Day</th>
                            <th>Status</th>
                            <th>Predicted Covers</th>
                            <th>Same-day Average(7d)</th>
                            <th>Walk-in Average(7d)</th>
                            <th>Advance Average (7d)</th>
                          </tr>
                        </thead>

                        <tbody>
                          {forecastData.length > 0 ? (
                            forecastData.map((item, index) => (
                              <tr key={`${item.date}-${forecastDays}-${index}`}>
                                <td>{formatDateDDMMYYYY(item.date)}</td>
                                <td>{item.day_of_week}</td>
                                <td>
                                  {item.closed
                                    ? item.closure_reason || "Closed"
                                    : "Open"}
                                </td>
                                <td>{item.predicted_total_covers}</td>
                                <td>
                                  {item.closed
                                    ? "-"
                                    : item.input_features?.same_day_avg_7 ?? "-"}
                                </td>
                                <td>
                                  {item.closed
                                    ? "-"
                                    : item.input_features?.walk_in_avg_7 ?? "-"}
                                </td>
                                <td>
                                  {item.closed
                                    ? "-"
                                    : item.input_features?.advance_avg_7 ?? "-"}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="7" className="empty-state-cell">
                                No forecast data available for the selected date.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}