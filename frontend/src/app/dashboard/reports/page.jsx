"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import useManagementReport from "@/hooks/useManagementReport";
import ReportSummary from "@/components/reports/report-summary";
import ReportFinancials from "@/components/reports/report-financials";
import ReportBookingMix from "@/components/reports/report-booking-mix";
import ReportDailyTable from "@/components/reports/report-daily-table";
import ReportInsights from "@/components/reports/report-insights";
import ReportWarnings from "@/components/reports/report-warnings";
import { formatDate } from "@/lib/report-formatters";

function ReportContent() {
  const params = useSearchParams();
  const selectedDate = params.get("date") || "";
  const [daysAhead, setDaysAhead] = useState(7);
  const { report, isLoading, error } = useManagementReport(selectedDate, daysAhead);

  return <>
    <section className="dashboard-hero">
      <h1 className="dashboard-title">Management Reports</h1>
      <p className="dashboard-text">View the operational report here. Ask RFS in the top bar to generate, save, find, or download reports.</p>
    </section>
    <fieldset className="report-view-period">
      <legend>View period</legend>
      {[7, 10].map((days) => <button type="button" className={daysAhead === days ? "is-active" : ""} aria-pressed={daysAhead === days} onClick={() => setDaysAhead(days)} key={days}>{days} days</button>)}
    </fieldset>
    <div aria-live="polite">
      {isLoading && <section className="report-state">Loading management report…</section>}
      {error && !isLoading && <section className="report-state report-error" role="alert"><h2>Report unavailable</h2><p>{error}</p></section>}
    </div>
    {report && !isLoading && <div className="management-report">
      <p className="report-period"><strong>Selected date:</strong> {formatDate(report.metadata.selected_date)} · <strong>Forecast period:</strong> {formatDate(report.metadata.start_date)} to {formatDate(report.metadata.end_date)}</p>
      <ReportSummary report={report} />
      <ReportFinancials report={report} />
      <ReportBookingMix reference={report.booking_mix_reference} />
      <ReportDailyTable report={report} />
      <ReportInsights items={report.operational_insights} />
      <ReportWarnings warnings={report.warnings} />
    </div>}
  </>;
}

export default function ReportsPage() {
  return <Suspense fallback={<p className="report-state">Loading report view…</p>}><ReportContent /></Suspense>;
}
