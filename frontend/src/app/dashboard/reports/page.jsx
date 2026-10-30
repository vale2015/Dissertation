"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { formatDate } from "@/lib/report-formatters";
import ReportSummary from "@/components/reports/report-summary";
import ReportFinancials from "@/components/reports/report-financials";
import ReportBookingMix from "@/components/reports/report-booking-mix";
import ReportDailyTable from "@/components/reports/report-daily-table";
import ReportInsights from "@/components/reports/report-insights";
import ReportWarnings from "@/components/reports/report-warnings";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextCursor = null, signal) => {
    setLoading(true); setError("");
    try {
      const query = nextCursor ? `?${new URLSearchParams({ cursor: nextCursor })}` : "";
      const response = await fetch(`${API_BASE}/reports/history${query}`, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body?.reports)) throw new Error(body?.error?.message || "Saved reports could not be loaded.");
      setReports((current) => nextCursor ? [...current, ...body.reports] : body.reports);
      setCursor(body.next_cursor || null);
    } catch (caught) {
      if (caught.name !== "AbortError") setError(caught.message || "Saved reports could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(null, controller.signal);
    return () => controller.abort();
  }, [load]);

  async function viewReport(id) {
    setDetailLoading(true); setError("");
    try {
      const response = await fetch(`${API_BASE}/reports/history/${id}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body?.metadata || !body?.summary) throw new Error(body?.error?.message || "Saved report could not be opened.");
      setSelected(body);
    } catch (caught) { setError(caught.message || "Saved report could not be opened."); }
    finally { setDetailLoading(false); }
  }

  return <>
    <section className="dashboard-hero"><h1 className="dashboard-title">Reports</h1><p className="dashboard-text">View saved management reports here. Ask RFS AI to generate, save, find, or download a report.</p></section>
    {error && <div className="report-state report-error" role="alert"><p>{error}</p><button type="button" onClick={() => load()}>Retry list</button></div>}
    {loading && <p className="report-state" role="status">Loading saved reports…</p>}
    {!loading && !error && reports.length === 0 && <p className="report-state">No saved reports yet. Ask RFS AI to generate and save one.</p>}
    {reports.length > 0 && <section className="report-section" aria-label="Saved reports"><h2>Saved reports</h2><div className="report-table-scroll"><table className="report-table"><thead><tr><th scope="col">Date</th><th scope="col">Period</th><th scope="col">Saved by</th><th scope="col">Action</th></tr></thead><tbody>{reports.map((item) => <tr key={item.id}><td>{formatDate(item.selected_date)}</td><td>{item.days_ahead} days</td><td>{item.creator_name}</td><td><button type="button" onClick={() => viewReport(item.id)}>View report #{item.id}</button></td></tr>)}</tbody></table></div>{cursor && !loading && <button className="report-history-more" type="button" onClick={() => load(cursor)}>Load more</button>}</section>}
    {detailLoading && <p className="report-state" role="status">Opening saved report…</p>}
    {selected && !detailLoading && <section className="management-report" aria-label="Selected saved report"><div className="report-period"><strong>Selected date:</strong> {formatDate(selected.metadata.selected_date)} · <strong>Forecast period:</strong> {formatDate(selected.metadata.start_date)} to {formatDate(selected.metadata.end_date)}</div><ReportSummary report={selected} /><ReportFinancials report={selected} /><ReportBookingMix reference={selected.booking_mix_reference} /><ReportDailyTable report={selected} /><ReportInsights items={selected.operational_insights} /><ReportWarnings warnings={selected.warnings} /></section>}
  </>;
}
