"use client";

import { useId, useMemo } from "react";

const WIDTH = 640;
const HEIGHT = 260;
const PLOT = { left: 44, right: 18, top: 18, bottom: 40 };

function shortLabel(item) {
  const match = String(item.date || "").match(/^\d{4}-(\d{2})-(\d{2})/);
  return match ? `${match[2]}/${match[1]}` : String(item.label);
}

function niceCeiling(value) {
  if (value <= 0) return 4;
  const roughStep = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= roughStep);
  return Math.max(4, step * 4);
}

export default function DataChart({ data = [], title, description, variant = "area", unit = "covers", seriesLabel = "Covers", tone = "red" }) {
  const id = useId().replace(/:/g, "");
  const values = useMemo(() => (Array.isArray(data) ? data : [])
    .map((item) => ({ ...item, value: item?.value == null || item.value === "" ? NaN : Number(item.value) }))
    .filter((item) => item.value >= 0 && Number.isFinite(item.value) && item.label), [data]);
  const ceiling = niceCeiling(Math.max(0, ...values.map((item) => item.value)));
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const isColumns = variant === "columns";
  const x = (index) => isColumns
    ? PLOT.left + plotWidth * (index + 0.5) / values.length
    : PLOT.left + plotWidth * (values.length === 1 ? 0.5 : index / (values.length - 1));
  const y = (value) => PLOT.top + plotHeight * (1 - value / ceiling);
  const points = values.map((item, index) => ({ ...item, x: x(index), y: y(item.value) }));
  const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const baseline = y(0);
  const area = points.length ? `${line} L ${points.at(-1).x} ${baseline} L ${points[0].x} ${baseline} Z` : "";
  const barWidth = Math.min(38, plotWidth / Math.max(values.length, 1) * 0.54);
  const labelStep = values.length > 20 ? 5 : values.length > 12 ? 3 : values.length > 8 ? 2 : 1;
  const first = values[0];
  const last = values.at(-1);

  return <div className={`rfs-data-chart rfs-data-chart--${tone}`}>
    <div className="dashboard-chart-header">
      <div><h3 className="dashboard-panel-title">{title}</h3><p className="dashboard-chart-subtitle">{description}</p></div>
      {values.length > 0 && <span className="rfs-chart-count">{values.length} days</span>}
    </div>
    {values.length ? <>
      <div className="rfs-chart-legend"><span className="rfs-chart-key" aria-hidden="true" />{seriesLabel}<span className="rfs-chart-period">{shortLabel(first)} – {shortLabel(last)}</span></div>
      <div className="rfs-chart-scroll">
        <svg className="rfs-chart-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
          <title id={`${id}-title`}>{title}</title>
          <desc id={`${id}-desc`}>{description} {values.map((item) => `${shortLabel(item)}: ${item.value} ${unit}`).join(", ")}</desc>
          <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.2" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.015" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map((tick) => {
            const tickValue = ceiling * tick / 4;
            const tickY = y(tickValue);
            return <g key={tick}><line className="rfs-chart-grid" x1={PLOT.left} x2={WIDTH - PLOT.right} y1={tickY} y2={tickY} /><text className="rfs-chart-axis" x={PLOT.left - 10} y={tickY + 4} textAnchor="end">{Number.isInteger(tickValue) ? tickValue : tickValue.toFixed(1)}</text></g>;
          })}
          {isColumns ? points.map((point, index) => <rect key={`${point.date}-${index}`} className="rfs-chart-bar" x={point.x - barWidth / 2} y={point.y} width={barWidth} height={Math.max(0, baseline - point.y)} rx="5"><title>{`${shortLabel(point)}: ${point.value} ${unit}`}</title></rect>) : <>
            {variant === "area" && <path d={area} fill={`url(#${id}-fill)`} />}
            <path className="rfs-chart-line" d={line} fill="none" />
            {points.map((point, index) => <circle key={`${point.date}-${index}`} className="rfs-chart-point" cx={point.x} cy={point.y} r="4"><title>{`${shortLabel(point)}: ${point.value} ${unit}`}</title></circle>)}
          </>}
          {points.map((point, index) => (index % labelStep === 0 || index === points.length - 1) && <text key={`${point.date}-${index}`} className="rfs-chart-axis rfs-chart-axis--x" x={point.x} y={HEIGHT - 12} textAnchor="middle">{shortLabel(point)}</text>)}
        </svg>
      </div>
      <details className="rfs-chart-details"><summary>View chart data</summary><div className="rfs-chart-table-wrap"><table><caption>{title}</caption><thead><tr><th scope="col">Day</th><th scope="col">{seriesLabel}</th></tr></thead><tbody>{values.map((item, index) => <tr key={`${item.date}-${index}`}><th scope="row">{item.date || item.label}</th><td>{item.value}</td></tr>)}</tbody></table></div></details>
    </> : <p className="dashboard-empty-state">No chart data available.</p>}
  </div>;
}
