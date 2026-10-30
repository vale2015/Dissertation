"use client";

import DataChart from "./DataChart";

export default function StaffingOverviewChart({ data = [], title = "Staffing overview", description = "Recommended staff by day." }) {
  const chartData = Array.isArray(data) ? data.map((item, index) => ({
    date: item?.date || "",
    label: item?.label || item?.date || `Day ${index + 1}`,
    value: item?.value ?? item?.recommended_staff ?? item?.staff_needed ?? item?.staff,
  })) : [];

  return <DataChart data={chartData} title={title} description={description} variant="columns" unit="staff" seriesLabel="Recommended staff" tone="navy" />;
}
