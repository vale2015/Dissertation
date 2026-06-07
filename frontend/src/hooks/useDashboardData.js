"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  normalizeDate,
  getStaffFromCovers,
  getBookingTypeFromRecord,
  getBookingTypeFromForecastInput,
  buildRecentBookings,
} from "@/utils/DashboardHelpers";

// Base URL used for all Flask backend API requests.
const API_BASE = "http://127.0.0.1:5000/api";
// Custom hook that loads and prepares all dashboard data.
export default function useDashboardData() {
  // Read the selected date from the URL query string.
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date") || "";
  // Store dashboard, forecast, weekly demand, and loading state.
  const [dashboardData, setDashboardData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [allDemandData, setAllDemandData] = useState([]);
  const [loading, setLoading] = useState(true);
  // Convert the selected date into a consistent format for comparison.
  const normalizedSelectedDate = useMemo(() => {
    return normalizeDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {// Load dashboard data whenever the selected date changes.
    const loadDashboardData = async () => {
      setLoading(true);

      try {
        const forecastUrl = normalizedSelectedDate
          ? `${API_BASE}/demand/forecast?selected_date=${encodeURIComponent(
              normalizedSelectedDate
            )}`
          : `${API_BASE}/demand/forecast`;
        
        //Load all dashboard-related API data at the same time.
        const [dashboardRes, forecastRes, weeklyRes, demandRes] =
          await Promise.all([
            fetch(`${API_BASE}/dashboard/`),
            fetch(forecastUrl),
            fetch(`${API_BASE}/demand/weekly`),
            fetch(`${API_BASE}/demand/`),
          ]);

        if (
          !dashboardRes.ok ||
          !forecastRes.ok ||
          !weeklyRes.ok ||
          !demandRes.ok
        ) {
          throw new Error("One or more API requests failed.");
        }

        const dashboardJson = await dashboardRes.json();
        const forecastJson = await forecastRes.json();
        const weeklyJson = await weeklyRes.json();
        const demandJson = await demandRes.json();
        // Prepare weekly data for the dashboard charts.
        const normalizedWeeklyData = Array.isArray(weeklyJson)
          ? weeklyJson.map((item, index) => ({
              label: item.label || `Day ${index + 1}`,
              date: item.date || "",
              value: Number(item.value || 0),
              staff: Number(item.staff || getStaffFromCovers(item.value || 0)),
            }))
          : [];

        setDashboardData(dashboardJson);
        setForecastData(
          Array.isArray(forecastJson?.forecast) ? forecastJson.forecast : []
        );
        setWeeklyData(normalizedWeeklyData);
        setAllDemandData(Array.isArray(demandJson) ? demandJson : []);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        setDashboardData(null);
        setForecastData([]);
        setWeeklyData([]);
        setAllDemandData([]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [normalizedSelectedDate]);

  const summary = dashboardData?.summary || {};
  const latestRecord = dashboardData?.latest_record || {};
  const financialSummary = dashboardData?.financial_summary || {};

  const selectedHistoricalRecord = useMemo(() => {
    if (!normalizedSelectedDate || !allDemandData.length) return null;

    return (
      allDemandData.find(
        (item) => normalizeDate(item.date) === normalizedSelectedDate
      ) || null
    );
  }, [normalizedSelectedDate, allDemandData]);

  const selectedForecastRecord = useMemo(() => {
    if (!normalizedSelectedDate || !forecastData.length) return null;

    return (
      forecastData.find(
        (item) => normalizeDate(item.date) === normalizedSelectedDate
      ) || null
    );
  }, [normalizedSelectedDate, forecastData]);

  const selectedMode = useMemo(() => {
    if (selectedHistoricalRecord) return "historical";
    if (selectedForecastRecord) return "forecast";
    return null;
  }, [selectedHistoricalRecord, selectedForecastRecord]);

  const totalRecords = allDemandData.length;

  const predictedCoversNext7Days = useMemo(() => {
    return forecastData.reduce((sum, item) => {
      return sum + Number(item.predicted_total_covers || 0);
    }, 0);
  }, [forecastData]);
   // Find the forecast day with the highest demand.
  const peakDemandDay = useMemo(() => {
    if (!forecastData.length) return "-";

    const maxItem = [...forecastData].sort(
      (a, b) =>
        Number(b.predicted_total_covers || 0) -
        Number(a.predicted_total_covers || 0)
    )[0];

    return maxItem?.day_of_week || maxItem?.date || "-";
  }, [forecastData]);
  // Estimate staff needed for the next forecast day.
  const staffNeededTomorrow = useMemo(() => {
    if (!forecastData.length) return "-";
    return getStaffFromCovers(forecastData[0]?.predicted_total_covers);
  }, [forecastData]);

  const bookingTypeData = useMemo(() => {
    const sameDay = Number(summary.avg_same_day_covers || 0);
    const walkIn = Number(summary.avg_walk_in_covers || 0);
    const advance = Number(summary.avg_advance_covers || 0);

    const total = sameDay + walkIn + advance;

    if (!total) {
      return [
        { label: "Advance", value: 0 },
        { label: "Walk-ins", value: 0 },
        { label: "Same-day", value: 0 },
      ];
    }

    return [
      { label: "Advance", value: Math.round((advance / total) * 100) },
      { label: "Walk-ins", value: Math.round((walkIn / total) * 100) },
      { label: "Same-day", value: Math.round((sameDay / total) * 100) },
    ];
  }, [summary]);

  const recentBookings = useMemo(() => {
    return buildRecentBookings(allDemandData);
  }, [allDemandData]);

  const selectedHistoricalType = useMemo(() => {
    return getBookingTypeFromRecord(selectedHistoricalRecord);
  }, [selectedHistoricalRecord]);

  const selectedForecastType = useMemo(() => {
    return getBookingTypeFromForecastInput(
      selectedForecastRecord?.input_features
    );
  }, [selectedForecastRecord]);
  // Return all values needed by the dashboard page
  return {
    loading,
    selectedDate,
    normalizedSelectedDate,
    selectedMode,
    selectedHistoricalRecord,
    selectedForecastRecord,
    selectedHistoricalType,
    selectedForecastType,
    predictedCoversNext7Days,
    staffNeededTomorrow,
    peakDemandDay,
    totalRecords,
    weeklyData,
    bookingTypeData,
    recentBookings,
    latestRecord,
    summary,
    financialSummary,
    getStaffFromCovers,
  };
}