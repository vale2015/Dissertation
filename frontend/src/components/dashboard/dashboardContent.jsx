"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import SummaryCard from "@/components/dashboard/summaryCard";
import BookingsTrend from "@/components/charts/BookingsTrend";
import StaffingOverviewChart from "@/components/charts/StaffingOverviewChart";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";
import useDashboardData from "@/hooks/useDashboardData";

const currency = (value) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value))
  : "Unavailable";

function DashboardContentInner({ user }) {
  const router = useRouter();
  const {
    loading, error, selectedDate, selectedMode, selectedHistoricalRecord,
    selectedForecastRecord, predictedCoversNext7Days, staffNeededTomorrow,
    peakDemandDay, weeklyData, forecastData, financialSummary,
    getStaffFromCovers,
  } = useDashboardData();
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || "there";
  const [draftSelection, setDraftSelection] = useState(null);
  const draftDate = draftSelection?.baseDate === selectedDate ? draftSelection.value : (selectedDate || "");
  const history = weeklyData.slice(-7);
  const forecast = forecastData.slice(0, 7).map((row) => ({
    date: row.date, label: row.day_of_week || row.date,
    value: Number(row.predicted_total_covers || 0),
  }));
  const staffing = forecast.map((row, index) => ({ ...row, value: forecastData[index]?.closed ? 0 : getStaffFromCovers(row.value) }));
  const cumulativeForecast = forecast.reduce((days, row) => [
    ...days,
    { ...row, value: (days.at(-1)?.value || 0) + row.value },
  ], []);
  const selected = selectedMode === "historical" ? selectedHistoricalRecord : selectedForecastRecord;
  const selectedCovers = selectedMode === "historical" ? selected?.total_covers : selected?.predicted_total_covers;

  function applyDate(event) {
    event.preventDefault();
    if (draftDate && draftDate !== selectedDate) {
      router.push(`/dashboard?date=${encodeURIComponent(draftDate)}`);
    } else if (!draftDate && selectedDate) {
      router.push("/dashboard");
    }
  }

  return <>
    <section className="rfs-dashboard-heading">
      <div><h1>Good morning, {firstName}! <span aria-hidden="true">👋</span></h1><p>Here’s what’s happening at your restaurant{selectedDate ? ` on ${formatDateDDMMYYYY(selectedDate)}` : " today"}.</p></div>
      <form className="rfs-dashboard-date" onSubmit={applyDate}><label htmlFor="dashboard-date">View a day</label><div className="rfs-dashboard-date-controls"><input id="dashboard-date" type="date" value={draftDate} onChange={(event) => setDraftSelection({ baseDate: selectedDate, value: event.target.value })} /><button type="submit" disabled={!draftDate || draftDate === selectedDate}>Apply</button></div>{selectedDate && <button type="button" onClick={() => router.push("/dashboard")}>Show overview</button>}</form>
    </section>

    {loading && <p className="dashboard-panel rfs-dashboard-state" role="status">Loading restaurant data…</p>}
    {!loading && error && <section className="dashboard-panel rfs-dashboard-state" role="alert"><h2>Dashboard unavailable</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></section>}
    {!loading && !error && selectedDate && !selected && <section className="dashboard-panel rfs-dashboard-state"><h2>No data for this day</h2><p>There is no recorded demand or current forecast for {formatDateDDMMYYYY(selectedDate)}.</p><button type="button" onClick={() => router.push("/dashboard")}>Show overview</button></section>}

    {!loading && !error && (!selectedDate || selected) && <>
      <section className="dashboard-summary-grid rfs-kpi-grid" aria-label="Restaurant summary">
        {selectedDate ? <>
          <SummaryCard title={selectedMode === "historical" ? "Recorded covers" : "Predicted covers"} value={selectedCovers ?? "Unavailable"} description={`${selectedMode === "historical" ? "Observed demand" : "Forecast demand"} for ${formatDateDDMMYYYY(selectedDate)}.`} />
          <SummaryCard title="Recommended staff" value={selectedCovers == null ? "Unavailable" : (selectedForecastRecord?.closed ? 0 : getStaffFromCovers(selectedCovers))} description="Rule-based recommendation, not a scheduled headcount." />
          <SummaryCard title="Data type" value={selectedMode === "historical" ? "Recorded" : "Forecast"} description="Historical results and future predictions are kept separate." />
        </> : <>
          <SummaryCard title="Expected covers" value={forecastData.length ? predictedCoversNext7Days : "Unavailable"} description="Predicted total across the next available 7 forecast days." />
          <SummaryCard title="Recommended staff" value={staffNeededTomorrow} description="Rule-based staffing recommendation for the next forecast day." />
          <SummaryCard title="Estimated food revenue" value={financialSummary.estimated_food_revenue == null ? "Unavailable" : currency(financialSummary.estimated_food_revenue)} description="Past 30-day covers × average spend; not actual sales." />
          <SummaryCard title="Peak forecast day" value={forecastData.length ? peakDemandDay : "Unavailable"} description="Highest predicted covers in the current forecast." />
        </>}
      </section>

      <section className="rfs-dashboard-charts" aria-label="Demand and staffing charts">
        <div className="dashboard-panel"><BookingsTrend data={history} title="Bookings trend" description="Recorded daily covers over the most recent available days; not the number of reservations." /></div>
        <div className="dashboard-panel"><BookingsTrend data={forecast} title="Reservation forecast" description="Predicted daily covers. Forecasts are estimates, not completed bookings." variant="columns" seriesLabel="Predicted covers" /></div>
        <div className="dashboard-panel"><StaffingOverviewChart data={staffing} title="Staffing overview" description="Recommended staff by forecast day. No roster or scheduled-staff data is available." /></div>
        <div className="dashboard-panel"><BookingsTrend data={cumulativeForecast} title="Cumulative demand" description="Running total of predicted covers across the available forecast days." variant="line" seriesLabel="Cumulative covers" /></div>
      </section>

    </>}
  </>;
}

export default function DashboardContent({ user }) {
  return <Suspense fallback={<p className="dashboard-panel rfs-dashboard-state">Loading restaurant data…</p>}><DashboardContentInner user={user} /></Suspense>;
}
