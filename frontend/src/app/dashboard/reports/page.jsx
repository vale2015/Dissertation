"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

const API_BASE = "http://127.0.0.1:5000/api";

export default function ReportsPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReportsData = async () => {
      try {
        const [dashboardRes, forecastRes] = await Promise.all([
          fetch(`${API_BASE}/dashboard/`),
          fetch(`${API_BASE}/demand/forecast`),
        ]);

        const dashboardJson = await dashboardRes.json();
        const forecastJson = await forecastRes.json();

        setDashboardData(dashboardJson);
        setForecastData(
          Array.isArray(forecastJson?.forecast) ? forecastJson.forecast : []
        );
      } catch (error) {
        console.error("Failed to load reports data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadReportsData();
  }, []);

  const summary = dashboardData?.summary || {};

  const weeklyForecast = useMemo(() => {
    return forecastData.reduce(
      (sum, item) => sum + Number(item.predicted_total_covers || 0),
      0
    );
  }, [forecastData]);

  const averageBookingDuration = Math.round(
    Number(summary.avg_duration_covers_summary || 0)
  );

  const mostActiveBookingType = useMemo(() => {
    const advance = Number(summary.avg_advance_covers || 0);
    const walkIn = Number(summary.avg_walk_in_covers || 0);
    const sameDay = Number(summary.avg_same_day_covers || 0);

    const max = Math.max(advance, walkIn, sameDay);

    if (max === advance) return "Advance";
    if (max === walkIn) return "Walk-in";
    return "Same-day";
  }, [summary]);

  const estimatedWeeklyStaffNeed = useMemo(() => {
    return forecastData.reduce((sum, item) => {
      const covers = Number(item.predicted_total_covers || 0);

      if (covers <= 20) return sum + 3;
      if (covers <= 30) return sum + 4;
      if (covers <= 40) return sum + 6;
      return sum + 8;
    }, 0);
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
                <h1 className="dashboard-title">Weekly Report</h1>
                <p className="dashboard-text">
                  Summary insights generated from database records and Random
                  Forest forecasts.
                </p>
              </section>

              {loading ? (
                <p className="dashboard-text">Loading report data...</p>
              ) : (
                <section className="dashboard-panel">
                  <h2 className="dashboard-panel-title">Weekly Summary Report</h2>

                  <div className="reports-grid">
                    <div className="report-item">
                      <p className="report-label">Weekly Covers Forecast</p>
                      <h3 className="report-value">{weeklyForecast}</h3>
                    </div>

                    <div className="report-item">
                      <p className="report-label">Average Booking Duration</p>
                      <h3 className="report-value">
                        {averageBookingDuration} min
                      </h3>
                    </div>

                    <div className="report-item">
                      <p className="report-label">Most Active Booking Type</p>
                      <h3 className="report-value">{mostActiveBookingType}</h3>
                    </div>

                    <div className="report-item">
                      <p className="report-label">Estimated Weekly Staff Need</p>
                      <h3 className="report-value">
                        {estimatedWeeklyStaffNeed}
                      </h3>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}