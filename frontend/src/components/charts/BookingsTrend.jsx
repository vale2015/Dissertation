"use client";

import DataChart from "./DataChart";

export default function BookingsTrend({
  data = [],
  title = "Bookings trend",
  description = "Recorded daily covers.",
  variant = "area",
  seriesLabel = "Covers",
}) {
  const chartData = Array.isArray(data) ? data.map((item, index) => ({
    date: item?.date || "",
    label: item?.label || item?.date || `Day ${index + 1}`,
    value: item?.value ?? item?.total_covers ?? item?.predicted_total_covers,
  })) : [];

  return <DataChart data={chartData} title={title} description={description} variant={variant} unit="covers" seriesLabel={seriesLabel} />;
}
