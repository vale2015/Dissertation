"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import BookingsTrend from "@/components/charts/BookingsTrend";
import SummaryCard from "@/components/dashboard/summaryCard";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";
import { API_BASE } from "@/lib/api";

function validISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeDay(item) {
  if (!validISODate(item?.date)) throw new Error("Incomplete forecast data");
  const dayName = item.day_of_week || new Date(`${item.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long" });
  const closed = item.closed === true || String(dayName).toLowerCase() === "monday";
  if (!closed && (item.predicted_total_covers === null || item.predicted_total_covers === undefined || (typeof item.predicted_total_covers === "string" && !item.predicted_total_covers.trim()))) {
    throw new Error("Incomplete forecast data");
  }
  const covers = closed ? 0 : Number(item.predicted_total_covers);
  if (!Number.isFinite(covers) || covers < 0) throw new Error("Incomplete forecast data");
  return { ...item, day_of_week: dayName, closed, predicted_total_covers: covers };
}

function ReservationForecastContent() {
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date") || "";
  const invalidDate = Boolean(requestedDate) && !validISODate(requestedDate);
  const [forecastDays, setForecastDays] = useState(7);
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (invalidDate) {
      setResult(null);
      setError("Choose a valid historical date to view a forecast.");
      setStatus("error");
      return;
    }

    const controller = new AbortController();
    const loadForecast = async () => {
      setStatus("loading");
      setError("");
      setResult(null);
      try {
        const params = new URLSearchParams({ days: String(forecastDays) });
        if (requestedDate) params.set("date", requestedDate);
        const response = await fetch(`${API_BASE}/demand/forecast?${params}`, {
          method: "GET", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Forecast service unavailable");
        const json = await response.json();
        if (controller.signal.aborted) return;
        const rows = Array.isArray(json?.forecast) ? json.forecast.map(normalizeDay) : [];
        setResult({ ...json, forecast: rows });
        setStatus(rows.length ? "ready" : "empty");
      } catch {
        if (controller.signal.aborted) return;
        setError("We couldn’t load the forecast. Please try again.");
        setStatus("error");
      }
    };
    loadForecast();
    return () => controller.abort();
  }, [forecastDays, requestedDate, invalidDate, retryKey]);

  const rows = result?.forecast || [];
  const openDays = rows.filter((day) => !day.closed);
  const totalCovers = openDays.reduce((sum, day) => sum + day.predicted_total_covers, 0);
  const peak = openDays.reduce((highest, day) => !highest || day.predicted_total_covers > highest.predicted_total_covers ? day : highest, null);
  const closedDays = rows.length - openDays.length;
  const averageCovers = openDays.length ? Math.round(totalCovers / openDays.length) : 0;
  const basisDate = validISODate(result?.selected_date) ? result.selected_date : validISODate(requestedDate) ? requestedDate : "";
  const chartData = rows.map((day) => ({ date: day.date, label: day.day_of_week, value: day.predicted_total_covers }));

  return <div className="rfs-forecast-page">
    <header className="rfs-forecast-header">
      <div>
        <p className="rfs-forecast-kicker">Planning / Demand outlook</p>
        <h1>Reservation forecast</h1>
        <p>Expected covers by service day—not confirmed bookings.</p>
      </div>
      <Link className="rfs-page-action rfs-page-action-secondary" href="/dashboard/forecast-accuracy">View forecast accuracy</Link>
    </header>

    <div className="rfs-forecast-controls">
      <div>
        <span className="rfs-forecast-control-label">Forecast horizon</span>
        <div className="rfs-forecast-horizon" role="group" aria-label="Forecast horizon">
          {[7, 10].map((days) => <button key={days} type="button" aria-pressed={forecastDays === days} onClick={() => setForecastDays(days)}>{days} days</button>)}
        </div>
      </div>
      <p>Based on historical demand{basisDate ? ` through ${formatDateDDMMYYYY(basisDate)}` : " through the latest available date"}.</p>
    </div>

    {status === "loading" && <section className="dashboard-panel rfs-forecast-state" role="status">Loading reservation forecast…</section>}
    {status === "error" && <section className="dashboard-panel rfs-forecast-state" role="alert"><h2>Forecast unavailable</h2><p>{error}</p>{!invalidDate && <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Try again</button>}</section>}
    {status === "empty" && <section className="dashboard-panel rfs-forecast-state"><h2>No forecast available</h2><p>{result?.message || "There is not enough eligible history for this date. Choose another historical day."}</p></section>}

    {status === "ready" && <>
      <section className="dashboard-summary-grid rfs-forecast-stats" aria-label="Forecast summary">
        <SummaryCard title="Predicted covers" value={totalCovers} description={`Total across ${rows.length} forecast days; closed days count as zero.`} />
        <SummaryCard title="Peak open day" value={peak?.day_of_week || "—"} description={peak ? `${formatDateDDMMYYYY(peak.date)} · ${peak.predicted_total_covers} predicted covers` : "No open days in this forecast."} />
        <SummaryCard title="Average open day" value={openDays.length ? averageCovers : "—"} description="Predicted covers per open service day." />
        <SummaryCard title="Closed days" value={closedDays} description="Shown separately, not treated as low-demand days." />
      </section>

      <section className="dashboard-panel rfs-forecast-chart" aria-label="Daily predicted covers chart">
        <BookingsTrend data={chartData} title="Daily expected covers" description="Predicted covers for each forecast day. Closed days are shown as zero." variant="columns" seriesLabel="Predicted covers" />
      </section>

      <section className="dashboard-panel rfs-forecast-details" aria-labelledby="rfs-forecast-details-title">
        <div className="rfs-forecast-details-heading"><div><h2 id="rfs-forecast-details-title">Day-by-day forecast</h2><p>Use this for planning; these are estimates, not recorded visits.</p></div><span>{formatDateDDMMYYYY(rows[0].date)} – {formatDateDDMMYYYY(rows.at(-1).date)}</span></div>
        <div className="booking-table-wrapper"><table className="booking-table rfs-forecast-table"><caption className="sr-only">Daily reservation forecast for {rows.length} days</caption><thead><tr><th scope="col">Date</th><th scope="col">Day</th><th scope="col">Service</th><th scope="col">Predicted covers</th><th scope="col">Context</th></tr></thead><tbody>
          {rows.map((day) => <tr key={day.date}><th scope="row">{formatDateDDMMYYYY(day.date)}</th><td>{day.day_of_week}</td><td><span className={`rfs-forecast-status ${day.closed ? "is-closed" : "is-open"}`}>{day.closed ? "Closed" : "Open"}</span></td><td className="rfs-forecast-covers">{day.predicted_total_covers}</td><td>{day.closed ? day.closure_reason || "Restaurant closed" : day.holiday_name || "—"}</td></tr>)}
        </tbody></table></div>
      </section>
      <p className="rfs-forecast-basis">{result?.model ? `Model: ${String(result.model).replaceAll("_", " ")}. ` : ""}{result?.model_version ? `Version ${result.model_version}. ` : ""}Forecasts may change as booking and demand data change.</p>
      {result?.message && <p className="rfs-forecast-note" role="status">{result.message}</p>}
    </>}
  </div>;
}

export default function ReservationForecastPage() {
  return <Suspense fallback={<p className="dashboard-text" role="status">Loading reservation forecast…</p>}><ReservationForecastContent /></Suspense>;
}
