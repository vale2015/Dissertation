"use client";

export default function SummaryCard({
  title,
  value,
  description,
  className = "",
}) {
  return (
    <div className={`summary-card ${className}`.trim()}>
      <p className="summary-card-label">{title}</p>
      <h3 className="summary-card-value">{value}</h3>
      <p className="summary-card-description">{description}</p>
    </div>
  );
}