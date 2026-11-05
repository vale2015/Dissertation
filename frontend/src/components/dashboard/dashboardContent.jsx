"use client";

import { forwardRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import SummaryCard from "@/components/dashboard/summaryCard";
import BookingsTrend from "@/components/charts/BookingsTrend";
import StaffingOverviewChart from "@/components/charts/StaffingOverviewChart";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";
import useDashboardData from "@/hooks/useDashboardData";
import "react-datepicker/dist/react-datepicker.css";

const currency = (value) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value))
  : "Unavailable";

function parseCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function formatCalendarDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const DashboardDateTrigger = forwardRef(function DashboardDateTrigger({ value, onClick, onKeyDown, onBlur, onFocus, id }, ref) {
  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.(event);
    } else {
      onKeyDown?.(event);
    }
  }

  return <button id={id} ref={ref} type="button" className="rfs-dashboard-date-trigger" aria-label={`View a day, currently ${value}`} onClick={onClick} onKeyDown={handleKeyDown} onBlur={onBlur} onFocus={onFocus}>
    <span>{value}</span>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M7 3v4M17 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  </button>;
});

function DashboardContentInner({ user, today }) {
  const router = useRouter();
  const {
    loading, error, selectedDate, selectedMode, selectedHistoricalRecord,
    selectedForecastRecord, predictedCoversNext7Days, staffNeededTomorrow,
    peakDemandDay, weeklyData, forecastData, financialSummary,
    getStaffFromCovers,
  } = useDashboardData();
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || "there";
  const calendarDate = parseCalendarDate(selectedDate) || parseCalendarDate(today);
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

  function chooseDate(date) {
    if (!date) return;
    const dateString = formatCalendarDate(date);
    if (dateString !== selectedDate) router.push(`/dashboard?date=${encodeURIComponent(dateString)}`);
  }

  function showOverview() {
    router.push("/dashboard");
  }

  return <>
    <section className="rfs-dashboard-heading">
      <div><h1>Good morning, {firstName}! <span aria-hidden="true">👋</span></h1><p>{selectedDate ? `Here’s your restaurant data for ${formatDateDDMMYYYY(selectedDate)}.` : "Here’s your restaurant overview."}</p></div>
    </section>

    <section className="rfs-dashboard-date-bar" aria-label="Dashboard date selection">
      <div className="rfs-dashboard-date-context">
        <span className="rfs-dashboard-date-eyebrow">Dashboard view</span>
        <strong>{selectedDate ? "Selected day" : "Overview"}</strong>
      </div>
      <div className="rfs-dashboard-date-picker">
        <label htmlFor="dashboard-date">View a day</label>
        <div className="rfs-dashboard-date-field">
          <DatePicker id="dashboard-date" selected={calendarDate} onChange={chooseDate} dateFormat="EEE, d MMM yyyy" customInput={<DashboardDateTrigger />} calendarClassName="custom-datepicker rfs-dashboard-calendar" popperPlacement="bottom-start" showPopperArrow={false} />
        </div>
      </div>
      <p className="rfs-dashboard-date-note">{selectedDate ? "Showing data for this date." : "Overview combines recent bookings and the next forecast days."}</p>
      {selectedDate && <button className="rfs-dashboard-overview-link" type="button" onClick={showOverview}>Show overview</button>}
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

export default function DashboardContent({ user, today }) {
  return <Suspense fallback={<p className="dashboard-panel rfs-dashboard-state">Loading restaurant data…</p>}><DashboardContentInner user={user} today={today} /></Suspense>;
}
