"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import SummaryCard from "@/components/dashboard/summaryCard";
import BookingsTrend from "@/components/charts/BookingsTrend";
import StaffingOverviewChart from "@/components/charts/StaffingOverviewChart";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";

// Flask backend API base URL.
const API_BASE = "http://127.0.0.1:5000/api";

// Converts different date formats into YYYY-MM-DD.
function normalizeDate(value) {
  if (!value) return "";

  const text = String(value).trim();

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return text;
  }

  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
// Formats a JavaScript Date object as YYYY-MM-DD.
function formatAsIsoLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString, daysToAdd) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + daysToAdd);
  return formatAsIsoLocal(date);
}

function getShortWeekdayFromDate(dateString) {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

function getFullWeekdayFromDate(dateString) {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-GB", { weekday: "long" });
}
// Checks if the selected date is a closed trading day.
function isClosedDayFromDate(dateString) {
  return getFullWeekdayFromDate(dateString).toLowerCase() === "monday";
}
// Estimates recommended staff based on total covers and trading day.
function getStaffRecommendation(covers, dateString) {
  if (isClosedDayFromDate(dateString)) {
    return {
      predicted_total_covers: 0,
      recommended_staff: 0,
      demand_level: "Closed",
    };
  }

  const totalCovers = Number(covers || 0);

  let staff = 3;
  let demandLevel = "Low";

  if (totalCovers > 20) {
    staff = 4;
    demandLevel = "Moderate";
  }

  if (totalCovers > 30) {
    staff = 6;
    demandLevel = "High";
  }

  if (totalCovers > 40) {
    staff = 8;
    demandLevel = "Very High";
  }

  return {
    predicted_total_covers: totalCovers,
    recommended_staff: staff,
    demand_level: demandLevel,
  };
}
// Creates an empty row when the selected date has no stored data.
function buildPlaceholderRow(dateString) {
  const recommendation = getStaffRecommendation(0, dateString);

  return {
    date: dateString,
    day_of_week: getFullWeekdayFromDate(dateString),
    total_covers: 0,
    predicted_total_covers: 0,
    same_day_covers: 0,
    walk_in_covers: 0,
    advance_covers: 0,
    avg_duration_covers_summary: 0,
    avg_duration_min: 0,
    recommended_staff: recommendation.recommended_staff,
    demand_level: recommendation.demand_level,
    isPlaceholder: true,
  };
}
// Bookings overview page showing historical demand and staffing insights.
function BookingsContent() {
  const searchParams = useSearchParams();
  const selectedDate = normalizeDate(searchParams.get("date"));

  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);
// Load historical demand data from the backend when the page opens.
  useEffect(() => {
    const loadBookingsData = async () => {
      try {
        setLoading(true);

        const response = await fetch(`${API_BASE}/demand/`);
        const json = await response.json();

        const rows = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : [];
        // Normalise dates and sort records chronologically.
        const normalizedRows = rows
          .map((item) => ({
            ...item,
            date: normalizeDate(item.date),
          }))
          .filter((item) => item.date)
          .sort((a, b) => a.date.localeCompare(b.date));

        setHistoricalData(normalizedRows);
      } catch (error) {
        console.error("Failed to load bookings data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBookingsData();
  }, []);
// Add calculated staffing and demand-level values to each historical row.
  const allRows = useMemo(() => {
    return historicalData.map((item) => {
      const totalCovers = Number(
        item.total_covers ?? item.predicted_total_covers ?? 0
      );

      const recommendation = getStaffRecommendation(totalCovers, item.date);

      return {
        ...item,
        date: item.date,
        day_of_week: getFullWeekdayFromDate(item.date),
        total_covers: totalCovers,
        predicted_total_covers: totalCovers,
        recommended_staff: recommendation.recommended_staff,
        demand_level: recommendation.demand_level,
      };
    });
  }, [historicalData]);
// Find the selected date record or use the latest available record.
  const selectedDayData = useMemo(() => {
    if (!allRows.length) return null;

    if (!selectedDate) {
      return allRows[allRows.length - 1] || null;
    }

    const matchedRow = allRows.find((item) => item.date === selectedDate);

    if (matchedRow) {
      return matchedRow;
    }

    return buildPlaceholderRow(selectedDate);
  }, [allRows, selectedDate]);
// Build a 7-day view starting from the selected date.
  const visibleRows = useMemo(() => {
    if (!selectedDayData?.date) return [];

    return Array.from({ length: 7 }, (_, index) => {
      const currentDate = addDays(selectedDayData.date, index);

      const existingRow = allRows.find((item) => item.date === currentDate);

      if (existingRow) {
        return existingRow;
      }

      return buildPlaceholderRow(currentDate);
    });
  }, [allRows, selectedDayData]);

  const selectedDateDisplay = selectedDayData?.date
    ? formatDateDDMMYYYY(selectedDayData.date)
    : "-";

  const totalCovers = Number(selectedDayData?.total_covers || 0);
  const sameDayCovers = Number(selectedDayData?.same_day_covers || 0);
  const walkInCovers = Number(selectedDayData?.walk_in_covers || 0);
  const advanceCovers = Number(selectedDayData?.advance_covers || 0);
  const averageDuration = Number(
    selectedDayData?.avg_duration_covers_summary ||
      selectedDayData?.avg_duration_min ||
      0
  );
  const estimatedStaff = Number(selectedDayData?.recommended_staff || 0);
// Identify the largest booking source for the selected day.
  const mainBookingType = useMemo(() => {
    const sources = [
      { label: "Same-day", value: sameDayCovers },
      { label: "Walk-in", value: walkInCovers },
      { label: "Advance", value: advanceCovers },
    ];

    sources.sort((a, b) => b.value - a.value);
    return sources[0]?.label || "-";
  }, [sameDayCovers, walkInCovers, advanceCovers]);
// Prepare covers data for the reservations trend chart.
  const bookingsTrendData = useMemo(() => {
    return visibleRows.map((item, index) => ({
      label: getShortWeekdayFromDate(item.date) || `Day ${index + 1}`,
      value: Number(item.total_covers ?? item.predicted_total_covers ?? 0),
      date: item.date,
    }));
  }, [visibleRows]);

  const staffingOverviewData = useMemo(() => {
    return visibleRows.map((item, index) => ({
      label: getShortWeekdayFromDate(item.date) || `Day ${index + 1}`,
      value: Number(item.recommended_staff || 0),
      date: item.date,
    }));
  }, [visibleRows]);
{/* Page header and description. */}
  return (
    <div className="dashboard-app">
      <Topbar />

      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">
              <section className="dashboard-hero">
                <h1 className="dashboard-title">Bookings Overview</h1>
                <p className="dashboard-text">
                  Overview of reservations and staffing insights for the selected day
                </p>
              </section>
                {/* Show loading text while booking data is being fetched. */}
              {loading ? (
                <p className="dashboard-text">Loading bookings overview...</p>
              ) : (
                <>
                  <section className="dashboard-summary-grid">
                    <SummaryCard
                      title="Selected Date"
                      value={selectedDateDisplay}
                      description="Historical record selected from the calendar"
                    />

                    <SummaryCard
                      title="Total Covers"
                      value={totalCovers}
                      description="Total reservation for tomorrow"
                    />

                    <SummaryCard
                      title="Main Booking Type"
                      value={mainBookingType}
                      description="Main booking source for the selected day"
                    />

                    <SummaryCard
                      title="Estimated Staff Needed"
                      value={estimatedStaff}
                      description="Recommended staff level based on reservation number"
                    />
                  </section>

                  <section className="dashboard-panel dashboard-insights-panel">
                    <h2 className="dashboard-panel-title">
                      Selected Historical Day Insights
                    </h2>

                    <div className="historical-insights-grid">
                      <div className="historical-insight-item">
                        <p className="historical-insight-label">Same-Day Covers</p>
                        <p className="historical-insight-value">{sameDayCovers}</p>
                      </div>

                      <div className="historical-insight-item">
                        <p className="historical-insight-label">Walk-In Covers</p>
                        <p className="historical-insight-value">{walkInCovers}</p>
                      </div>

                      <div className="historical-insight-item">
                        <p className="historical-insight-label">Advance Covers</p>
                        <p className="historical-insight-value">{advanceCovers}</p>
                      </div>

                      <div className="historical-insight-item">
                        <p className="historical-insight-label">Average Duration</p>
                        <p className="historical-insight-value">
                          {averageDuration} min
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="dashboard-bottom-grid">
                    <section className="dashboard-panel">
                      <BookingsTrend data={bookingsTrendData} />
                    </section>

                    <section className="dashboard-panel">
                      <StaffingOverviewChart data={staffingOverviewData} />
                    </section>
                  </section>

                  {!visibleRows.length && (
                    <p className="dashboard-text" style={{ marginTop: "16px" }}>
                      The selected date is not available in the dataset.
                    </p>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<p className="dashboard-text">Loading bookings overview...</p>}>
      <BookingsContent />
    </Suspense>
  );
}