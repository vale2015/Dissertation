import { formatEventCount, getImpactClassName } from "@/utils/EventFormat";


export default function EventImpactBadge({ dayContext, onClick, loading = false }) {
  if (loading && !dayContext) {
    return <span className="event-impact-badge event-impact-none">Loading…</span>;
  }
  if (!dayContext || dayContext.supported === false) {
    return (
      <span className="event-impact-badge event-impact-unavailable">Unavailable</span>
    );
  }

  const count = Number(dayContext.event_count || 0);
  const impact = dayContext.impact_level || "None";
  const className = `event-impact-badge ${getImpactClassName(impact)}`;
  if (count <= 0) return <span className={className}>No events</span>;

  const label = `${formatEventCount(count)} · ${impact}`;
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={`${dayContext.date}: ${label} potential local-event impact. Open details.`}
    >
      {label}
    </button>
  );
}
