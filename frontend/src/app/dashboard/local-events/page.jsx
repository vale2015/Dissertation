"use client";

import { useCallback, useRef, useState } from "react";

import EventDetailsModal from "@/components/events/EventDetailsModal";
import NearbyEventsPanel from "@/components/events/NearbyEventsPanel";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import useLocalEvents from "@/hooks/useLocalEvents";
import { formatEventCount, formatEventDate } from "@/utils/EventFormat";


function formatMonthInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}


function monthRange(monthValue) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${monthValue}-01`,
    end: `${monthValue}-${String(lastDay).padStart(2, "0")}`,
  };
}


function currentMonth() {
  return formatMonthInput(new Date());
}


export default function LocalEventsPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [searchRange, setSearchRange] = useState(() => monthRange(currentMonth()));
  const [selectedDay, setSelectedDay] = useState(null);
  const triggerRef = useRef(null);

  const { eventContext, loading, refreshing, error, refreshEvents } =
    useLocalEvents(searchRange.start, searchRange.end);

  const monthError = monthRange(selectedMonth) ? null : "Choose a valid month.";

  const eventDays = (eventContext?.days || []).filter(
    (day) => Number(day?.event_count) > 0
  );

  const handleSearch = (event) => {
    event.preventDefault();
    const nextRange = monthRange(selectedMonth);
    if (nextRange) setSearchRange(nextRange);
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
                  Find Ticketmaster events for a full calendar month within 10 km of the restaurant.
                </p>
                <form className="events-search-form" onSubmit={handleSearch}>
                  <label>
                    Month
                    <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
                  </label>
                  <button type="submit" className="events-refresh-button" disabled={Boolean(monthError) || loading}>
                    Search events
                  </button>
                </form>
                {monthError ? <p className="events-error" role="alert">{monthError}</p> : null}
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
