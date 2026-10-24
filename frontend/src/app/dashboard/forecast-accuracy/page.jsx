"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import useSession from "@/hooks/useSession";
import { API_BASE } from "@/lib/api";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

function dateLabel(value) {
  return value ? value.split("-").reverse().join("/") : "—";
}

function metric(value, suffix = "") {
  return value == null ? "Not enough data" : `${value}${suffix}`;
}

export default function ForecastAccuracyPage() {
  const { user } = useSession();
  const canRecord = hasPermission(user, PERMISSIONS.MANAGE_BOOKINGS);
  const [windowDays, setWindowDays] = useState(90);
  const [dataset, setDataset] = useState("real");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [covers, setCovers] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/staff-cost/accuracy?days=${windowDays}&dataset=${dataset}`, {
        cache: "no-store",
        signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to load forecast accuracy.");
      setReport(body);
      return true;
    } catch (caught) {
      if (caught.name !== "AbortError") {
        setReport(null);
        setError(caught.message);
      }
      return false;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [windowDays, dataset]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selected = report?.days.find((day) => day.service_date === selectedDate);
  const correcting = selected?.actual_covers != null;
  const recent = useMemo(() => (report?.days || [])
    .filter((day) => day.actual_covers != null).slice(0, 14).reverse(), [report]);
  const largestError = Math.max(1, ...recent.map((day) => Math.abs(day.error_covers)));

  function chooseDate(value) {
    setSelectedDate(value);
    setCovers("");
    setReason("");
    setNotice("");
  }

  async function saveActual(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const url = correcting
      ? `${API_BASE}/staff-cost/actuals/${selectedDate}`
      : `${API_BASE}/staff-cost/actuals`;
    const body = correcting
      ? { actual_covers: Number(covers), reason }
      : { service_date: selectedDate, actual_covers: Number(covers) };
    try {
      const response = await fetch(url, {
        method: correcting ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Actual covers could not be saved.");
      const refreshed = await load();
      if (refreshed) {
        setCovers("");
        setReason("");
        setNotice(correcting ? "Correction saved with its reason." : "Actual covers recorded.");
      }
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-app">
      <Topbar />
      <div className="dashboard-shell">
        <Sidebar />
        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">
              <section className="dashboard-hero">
                <h1 className="dashboard-title">Forecast accuracy</h1>
                <p className="dashboard-text">
                  {dataset === "demo"
                    ? "Explore an illustrative forecast-versus-served comparison. All values on this tab are invented for testing."
                    : "Compare the first forecast saved before each open service with the covers actually served. Booking totals are shown for context, not counted as actuals."}
                </p>
                <label className="accuracy-window">
                  Data <select value={dataset} onChange={(event) => {
                    chooseDate("");
                    setDataset(event.target.value);
                  }}>
                    <option value="real">Real records</option>
                    <option value="demo">Demo sample</option>
                  </select>
                </label>
                <label className="accuracy-window">
                  Show the last <select value={windowDays} onChange={(event) => {
                    chooseDate("");
                    setWindowDays(Number(event.target.value));
                  }}>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                  </select>
                </label>
              </section>

              {error && <p className="report-state report-error" role="alert">{error}</p>}
              {notice && <p className="report-state" role="status">{notice}</p>}
              {loading && <p className="report-state" role="status">Loading forecast accuracy…</p>}

              {report && !loading && <>
                {report.dataset === "demo" && <p className="report-state" role="status">
                  Demo sample: forecasts and served-cover figures on this tab are invented for testing.
                  They are excluded from real accuracy figures. Changes you make here update the demo sample only.
                </p>}
                <section className="report-card-grid accuracy-summary" aria-label="Accuracy summary">
                  <article className="report-metric"><span>Days with actuals</span><strong>{report.summary.evaluated_days} of {report.eligible_days}</strong></article>
                  <article className="report-metric"><span>Mean absolute error</span><strong>{metric(report.summary.mean_absolute_error, " covers")}</strong></article>
                  <article className="report-metric"><span>Mean absolute percentage error</span><strong>{metric(report.summary.mean_absolute_percentage_error, "%")}</strong></article>
                  <article className="report-metric"><span>Mean bias</span><strong>{metric(report.summary.mean_bias, " covers")}</strong></article>
                </section>
                <p className="accuracy-note">
                  Positive bias means the forecast was too high. Days with zero actual covers count toward absolute
                  error but not percentage error ({report.summary.zero_actual_days_excluded_from_mape} excluded).
                  Future and closed days are excluded. Real records also exclude predictions saved after service began.
                </p>

                {canRecord && report.days.length > 0 && <section className="report-section accuracy-entry">
                  <h2>Record completed-service covers</h2>
                  <p>Enter the number actually served. Corrections require a reason and retain the previous value.</p>
                  <form onSubmit={saveActual}>
                    <label>Service date
                      <select required value={selectedDate} onChange={(event) => chooseDate(event.target.value)}>
                        <option value="">Select a completed service</option>
                        {report.days.map((day) => <option key={day.service_date} value={day.service_date}>
                          {dateLabel(day.service_date)} · forecast {day.predicted_covers} · {day.actual_covers == null ? "awaiting actual" : `actual ${day.actual_covers}`}
                        </option>)}
                      </select>
                    </label>
                    <label>Actual covers
                      <input type="number" min="0" max="100000" step="1" required value={covers} onChange={(event) => setCovers(event.target.value)} />
                    </label>
                    {correcting && <label>Reason for correction
                      <input type="text" minLength="5" maxLength="500" required value={reason} onChange={(event) => setReason(event.target.value)} />
                    </label>}
                    <button type="submit" disabled={saving || !selectedDate || covers === ""}>
                      {saving ? "Saving…" : correcting ? "Save correction" : "Record actual"}
                    </button>
                  </form>
                </section>}

                {report.days.length === 0 ? <p className="report-state">
                  {dataset === "demo"
                    ? "No demo sample is available yet."
                    : "No eligible completed services yet. Generate a forecast before a future service; once that day has passed, it will appear here. Select Demo sample to explore an illustrative comparison now."}
                </p> : <>
                  {recent.length > 0 && <section className="report-section">
                    <h2>Recent daily error</h2>
                    <div className="accuracy-trend" role="list" aria-label="Absolute forecast error by service date">
                      {recent.map((day) => <div className="accuracy-trend-item" role="listitem" key={day.service_date}
                        aria-label={`${dateLabel(day.service_date)}: forecast ${day.predicted_covers}, actual ${day.actual_covers}, error ${day.error_covers}`}>
                        <span className="accuracy-trend-bar" style={{ height: `${Math.max(8, Math.abs(day.error_covers) / largestError * 100)}%` }} />
                        <small>{dateLabel(day.service_date)}</small>
                      </div>)}
                    </div>
                  </section>}
                  <section className="report-section report-table-scroll">
                    <h2>Daily comparisons</h2>
                    <table className="report-table"><thead><tr>
                      <th scope="col">Service date</th><th scope="col">Original run</th><th scope="col">Lead</th>
                      <th scope="col">Forecast</th><th scope="col">Booked</th><th scope="col">Served actual</th><th scope="col">Error</th>
                    </tr></thead><tbody>{report.days.map((day) => <tr key={day.service_date}>
                      <td>{dateLabel(day.service_date)} · {day.weekday}</td><td>#{day.run_id}</td>
                      <td>{day.lead_days} days</td><td>{day.predicted_covers}</td>
                      <td>{day.booked_covers ?? "—"}</td><td>{day.actual_covers ?? "Awaiting entry"}</td>
                      <td>{day.error_covers ?? "—"}</td>
                    </tr>)}</tbody></table>
                  </section>
                  <div className="accuracy-segments">
                    <section className="report-section report-table-scroll"><h2>By weekday</h2>
                      <table className="report-table"><thead><tr><th>Day</th><th>Samples</th><th>MAE</th><th>MAPE</th></tr></thead>
                        <tbody>{report.by_weekday.map((group) => <tr key={group.weekday}><td>{group.weekday}</td>
                          <td>{group.evaluated_days}</td><td>{metric(group.mean_absolute_error)}</td>
                          <td>{metric(group.mean_absolute_percentage_error, "%")}</td></tr>)}</tbody></table>
                    </section>
                    <section className="report-section report-table-scroll"><h2>By forecast lead</h2>
                      <table className="report-table"><thead><tr><th>Days ahead</th><th>Samples</th><th>MAE</th><th>MAPE</th></tr></thead>
                        <tbody>{report.by_lead_days.map((group) => <tr key={group.lead_days}><td>{group.lead_days}</td>
                          <td>{group.evaluated_days}</td><td>{metric(group.mean_absolute_error)}</td>
                          <td>{metric(group.mean_absolute_percentage_error, "%")}</td></tr>)}</tbody></table>
                    </section>
                  </div>
                </>}
              </>}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
