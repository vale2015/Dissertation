"use client";

import { useMemo } from "react";

function formatShortDate(value) {
  if (!value) return "";

  const text = String(value).trim();
  const directMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!directMatch) return value;

  const [, year, month, day] = directMatch;
  return `${day}-${month}`;
}

export default function StaffingOverviewChart({ data = [] }) {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data
      .map((item, index) => {
        const safeValue = Number(
          item?.value ??
            item?.recommended_staff ??
            item?.staff_needed ??
            item?.staff ??
            0
        );

        const safeDate = item?.date || "";
        const safeLabel = item?.label || formatShortDate(safeDate) || `Day ${index + 1}`;

        return {
          label: safeLabel,
          value: Number.isFinite(safeValue) ? safeValue : 0,
          date: safeDate,
        };
      })
      .filter((item) => item.value >= 0)
      .slice(0, 30);
  }, [data]);

  const maxValue = Math.max(...chartData.map((item) => item.value), 1);

  const labelStep =
    chartData.length <= 7
      ? 1
      : chartData.length <= 14
      ? 2
      : chartData.length <= 21
      ? 3
      : 5;

  const shouldShowLabel = (index) => {
    return (
      index === 0 ||
      index === chartData.length - 1 ||
      index % labelStep === 0
    );
  };

  return (
    <>
      <div className="dashboard-chart-header">
        <div>
          <h3 className="dashboard-panel-title">Staffing Overview</h3>
          <p className="dashboard-chart-subtitle">
            Estimated staff required by day
          </p>
        </div>
      </div>

      <div className="staffing-overview-chart">
        {chartData.length > 0 ? (
          <div className="staffing-overview-bars staffing-overview-bars-monthly">
            {chartData.map((item, index) => {
              const barHeight =
                item.value === 0 ? "0%" : `${(item.value / maxValue) * 100}%`;

              return (
                <div
                  key={`${item.date || item.label}-${index}`}
                  className="staffing-overview-item"
                >
                  <div className="staffing-overview-value">
                    {shouldShowLabel(index) ? item.value : ""}
                  </div>

                  <div className="staffing-overview-bar-wrap">
                    <div
                      className="staffing-overview-bar"
                      style={{ height: barHeight }}
                    />
                  </div>

                  <div className="staffing-overview-label">
                    {shouldShowLabel(index)
                      ? formatShortDate(item.date) || item.label
                      : ""}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <p className="dashboard-text">No staffing data available.</p>
          </div>
        )}
      </div>
    </>
  );
}