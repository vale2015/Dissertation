"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import EventDetailsModal from "@/components/events/EventDetailsModal";
import NearbyEventsPanel from "@/components/events/NearbyEventsPanel";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import useLocalEvents from "@/hooks/useLocalEvents";
import { formatEventCount, formatEventDate } from "@/utils/EventFormat";


const SEARCH_DAYS = 10;


function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function defaultDates() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + SEARCH_DAYS - 1);
  return { start: formatDateInput(start), end: formatDateInput(end) };
}


export default function LocalEventsPage() {
  const [draftRange, setDraftRange] = useState(defaultDates);
  const [searchRange, setSearchRange] = useState(defaultDates);
  const [selectedDay, setSelectedDay] = useState(null);
  const triggerRef = useRef(null);

  const { eventContext, loading, refreshing, error, refreshEvents } =
    useLocalEvents(searchRange.start, searchRange.end);

  const rangeError = useMemo(() => {
    if (!draftRange.start || !draftRange.end) return "Choose both dates.";
    const start = new Date(`${draftRange.start}T00:00:00`);
    const end = new Date(`${draftRange.end}T00:00:00`);
    const days = Math.round((end - start) / 86400000) + 1;
    if (days < 1) return "The end date must be on or after the start date.";
    if (days > SEARCH_DAYS) return "Choose a period of no more than 10 days.";
    return null;
  }, [draftRange.end, draftRange.start]);

  const eventDays = (eventContext?.days || []).filter(
    (day) => Number(day?.event_count) > 0
  );

  const handleSearch = (event) => {
    event.preventDefault();
    if (!rangeError) setSearchRange(draftRange);
  };

  const openDay = useCallback((day, trigger) => {
    triggerRef.current = trigger;
    setSelectedDay(day);
  }, []);

  return (
    <div className="dashboard-app">
      <Topbar />
      <div className="dashboard-shell">
        <Sidebar />
        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">
              <section className="dashboard-hero">
                <h1 className="dashboard-title">Local Events</h1>
                <p className="dashboard-text">
                  Find Ticketmaster events within 10 km of the restaurant.
                </p>
                <form className="events-search-form" onSubmit={handleSearch}>
                  <label>
                    Start date
                    <input type="date" value={draftRange.start} onChange={(event) => setDraftRange((current) => ({ ...current, start: event.target.value }))} />
                  </label>
                  <label>
                    End date
                    <input type="date" value={draftRange.end} onChange={(event) => setDraftRange((current) => ({ ...current, end: event.target.value }))} />
                  </label>
                  <button type="submit" className="events-refresh-button" disabled={Boolean(rangeError) || loading}>
                    Search events
                  </button>
                </form>
                {rangeError ? <p className="events-error" role="alert">{rangeError}</p> : null}
              </section>

              <NearbyEventsPanel
                eventContext={eventContext}
                loading={loading}
                error={error}
                onRefresh={refreshEvents}
                refreshing={refreshing}
              />

              <section className="dashboard-panel events-results" aria-labelledby="events-results-title">
                <h2 id="events-results-title" className="dashboard-panel-title">Available events</h2>
                {loading && !eventContext ? <p>Loading available events…</p> : null}
                {!loading && !error && eventContext && eventDays.length === 0 ? (
                  <p>No Ticketmaster events were found for the selected dates.</p>
                ) : null}
                <div className="events-day-grid">
                  {eventDays.map((day) => (
                    <article className="events-day-card" key={day.date}>
                      <p className="events-day-date">{formatEventDate(day.date)}</p>
                      <h3>{formatEventCount(day.event_count)}</h3>
                      <p>{day.insight}</p>
                      <button type="button" className="events-day-button" onClick={(event) => openDay(day, event.currentTarget)}>
                        View event details
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      <EventDetailsModal
        dayContext={selectedDay}
        isOpen={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        triggerRef={triggerRef}
      />
    </div>
  );
}
