"use client";

import { Suspense } from "react";
import Link from "next/link";
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
    peakDemandDay, weeklyData, forecastData, latestRecord, financialSummary,
    getStaffFromCovers,
  } = useDashboardData();
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || "there";
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

  function changeDate(event) {
    const date = event.target.value;
    router.push(date ? `/dashboard?date=${encodeURIComponent(date)}` : "/dashboard");
  }

  return <>
    <section className="rfs-dashboard-heading">
      <div><h1>Good morning, {firstName}! <span aria-hidden="true">👋</span></h1><p>Here’s what’s happening at your restaurant{selectedDate ? ` on ${formatDateDDMMYYYY(selectedDate)}` : " today"}.</p></div>
      <div className="rfs-dashboard-date"><label htmlFor="dashboard-date">View a day</label><input id="dashboard-date" type="date" value={selectedDate || ""} onChange={changeDate} />{selectedDate && <button type="button" onClick={() => router.push("/dashboard")}>Show overview</button>}</div>
    </section>

    {loading && <p className="dashboard-panel rfs-dashboard-state" role="status">Loading restaurant data…</p>}
    {!loading && error && <section className="dashboard-panel rfs-dashboard-state" role="alert"><h2>Dashboard unavailable</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></section>}
    {!loading && !error && selectedDate && !selected && <section className="dashboard-panel rfs-dashboard-state"><h2>No data for this day</h2><p>There is no recorded demand or saved forecast for {formatDateDDMMYYYY(selectedDate)}.</p><button type="button" onClick={() => router.push("/dashboard")}>Show overview</button></section>}

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

      <section className="rfs-dashboard-context" aria-label="Operational context">
        <div className="dashboard-panel"><h2>Latest operational snapshot</h2>{latestRecord.date ? <p>{formatDateDDMMYYYY(latestRecord.date)} · {latestRecord.total_covers ?? "Unavailable"} recorded covers</p> : <p>No recorded operational snapshot is available.</p>}</div>
        <div className="dashboard-panel"><h2>Financial context</h2><p>Past 30-day modelled food revenue: {financialSummary.estimated_food_revenue == null ? "Unavailable" : currency(financialSummary.estimated_food_revenue)}</p><p>Active future staffing forecast labour: {financialSummary.total_labour_cost == null ? "Unavailable" : currency(financialSummary.total_labour_cost)}</p><small>Different periods; these figures should not be subtracted to claim a margin.</small></div>
      </section>

      <nav className="rfs-dashboard-actions" aria-label="Quick actions">
        <Link href="/dashboard/bookings"><strong>Manage bookings</strong><span>Review covers and reservations</span></Link>
        <Link href="/dashboard/reservation-forecast"><strong>View forecasts</strong><span>Explore predicted demand</span></Link>
        <Link href="/dashboard/staff-forecast"><strong>Staff planning</strong><span>Review recommended levels</span></Link>
        <Link href="/dashboard/reports"><strong>View reports</strong><span>Read saved management reports</span></Link>
      </nav>
    </>}
  </>;
}

export default function DashboardContent({ user }) {
  return <Suspense fallback={<p className="dashboard-panel rfs-dashboard-state">Loading restaurant data…</p>}><DashboardContentInner user={user} /></Suspense>;
}
