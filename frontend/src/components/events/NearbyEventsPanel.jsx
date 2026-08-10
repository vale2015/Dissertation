import {
  formatEventCount,
  formatEventDate,
  formatEventDistance,
} from "@/utils/EventFormat";


function SummaryItem({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}


export default function NearbyEventsPanel({
  eventContext,
  loading,
  error,
  onRefresh,
  refreshing,
}) {
  const summary = eventContext?.summary;
  const location = eventContext?.location;

  return (
    <section className="events-summary-panel" aria-labelledby="events-summary-title">
      <div className="events-modal-header">
        <div>
          <p>NEARBY EVENTS</p>
          <h2 id="events-summary-title">Potential Local Event Impact</h2>
        </div>
        <button
          type="button"
          className="events-refresh-button"
          onClick={onRefresh}
          disabled={loading || refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading && !eventContext ? <p>Loading nearby events…</p> : null}
      {error ? <p className="events-error" role="alert">{error}</p> : null}
      {eventContext?.stale ? (
        <p className="events-warning" role="status">{eventContext.warning}</p>
      ) : null}
      {summary?.results_truncated ? (
        <p className="events-warning">
          Only the first available Ticketmaster results are shown.
        </p>
      ) : null}

      {summary ? (
        <>
          <dl className="events-summary-grid">
            <SummaryItem label="Total" value={formatEventCount(summary.total_events)} />
            <SummaryItem label="Days with events" value={summary.days_with_events ?? "—"} />
            <SummaryItem label="High-impact days" value={summary.high_impact_days ?? "—"} />
            <SummaryItem label="Busiest date" value={formatEventDate(summary.busiest_date)} />
            <SummaryItem label="Events on busiest date" value={formatEventCount(summary.busiest_event_count)} />
            <SummaryItem label="Search radius" value={formatEventDistance(location?.radius_km)} />
            <SummaryItem label="City" value={location?.city || "—"} />
          </dl>
          {summary.total_events === 0 ? (
            <p className="events-warning">
              No Ticketmaster events were found for this location and period. Other
              local events may still exist.
            </p>
          ) : null}
        </>
      ) : null}
      <p className="events-attribution">Event information provided by Ticketmaster.</p>
    </section>
  );
}
