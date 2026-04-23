"use client";

import { useMemo, useState } from "react";

function formatShortDate(value) {
  if (!value) return "";

  const text = String(value).trim();
  const directMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!directMatch) return value;

  const [, year, month, day] = directMatch;
  return `${day}-${month}`;
}

function formatFullDate(value) {
  if (!value) return "";

  const text = String(value).trim();
  const directMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!directMatch) return value;

  const [, year, month, day] = directMatch;
  return `${day}/${month}/${year}`;
}

export default function BookingsTrend({ data = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data
      .map((item, index) => {
        const safeValue = Number(
          item?.value ??
            item?.total_covers ??
            item?.predicted_total_covers ??
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
      .filter((item) => item.value >= 0);
  }, [data]);

  const maxValue = Math.max(...chartData.map((item) => item.value), 1);
  const minValue = Math.min(...chartData.map((item) => item.value), 0);

  const range = Math.max(maxValue - minValue, 1);
  const paddedMax = maxValue + range * 0.15;
  const paddedMin = Math.max(0, minValue - range * 0.1);

  const leftPadding = 8;
  const rightPadding = 4;
  const topPadding = 10;
  const bottomPadding = 18;

  const usableWidth = 100 - leftPadding - rightPadding;
  const usableHeight = 100 - topPadding - bottomPadding;

  const getX = (index) => {
    if (chartData.length <= 1) {
      return leftPadding + usableWidth / 2;
    }

    return leftPadding + (index / (chartData.length - 1)) * usableWidth;
  };

  const getY = (value) => {
    if (paddedMax === paddedMin) {
      return topPadding + usableHeight / 2;
    }

    return (
      topPadding +
      ((paddedMax - Number(value || 0)) / (paddedMax - paddedMin)) * usableHeight
    );
  };

  const coordinates = chartData.map((item, index) => ({
    x: getX(index),
    y: getY(item.value),
    value: item.value,
    label: item.label,
    date: item.date,
  }));

  const buildSmoothPath = (points) => {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i += 1) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;

      d += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    return d;
  };

  const smoothPath = buildSmoothPath(coordinates);

  const labelStep =
    chartData.length > 20 ? 6 : chartData.length > 12 ? 3 : 1;

  const visibleLabels = chartData.map((item, index) =>
    index % labelStep === 0 || index === chartData.length - 1
      ? formatShortDate(item.date) || item.label
      : ""
  );

  return (
    <>
      <div className="dashboard-chart-header">
        <div>
          <h3 className="dashboard-panel-title">Reservations Trend</h3>
          <p className="dashboard-chart-subtitle">
            Daily covers across the last 30 days · Hover over the line points to view the reservation value for each day.
          </p>
        </div>
      </div>

      <div
        className="simple-line-chart has-tooltip"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${hoveredPoint.x}%`,
              top: `${hoveredPoint.y}%`,
            }}
          >
            <span className="chart-tooltip-date">
              {formatFullDate(hoveredPoint.date) || hoveredPoint.label}
            </span>
            <strong className="chart-tooltip-value">
              {hoveredPoint.value} covers
            </strong>
          </div>
        )}

        {chartData.length > 0 ? (
          <>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="simple-line-chart-svg"
            >
              <path
                d={smoothPath}
                fill="none"
                className="chart-line-path"
                strokeWidth="0.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {coordinates.map((point, index) => (
                <g key={`${point.date || point.label}-${index}`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill="transparent"
                    onMouseEnter={() => setHoveredPoint(point)}
                  />

                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="1.1"
                    className="chart-line-point"
                    onMouseEnter={() => setHoveredPoint(point)}
                  />
                </g>
              ))}
            </svg>

            <div className="simple-chart-labels">
              {visibleLabels.map((label, index) => (
                <span key={`${label || "empty"}-${index}`}>{label}</span>
              ))}
            </div>
          </>
        ) : (
          <div className="dashboard-empty-state">
            <p className="dashboard-text">No reservation trend data available.</p>
          </div>
        )}
      </div>
    </>
  );
}