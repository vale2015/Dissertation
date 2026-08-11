"use client";

import { useEffect, useRef } from "react";

import {
  formatEventCount,
  formatEventDate,
  formatEventDistance,
  formatEventTime,
  getImpactClassName,
} from "@/utils/EventFormat";


const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");


export default function EventDetailsModal({
  dayContext,
  isOpen,
  onClose,
  triggerRef,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const modal = modalRef.current;
    const triggerElement = triggerRef?.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal?.querySelector(FOCUSABLE_SELECTOR)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !modal) return;
      const focusable = [...modal.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!modal.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || !dayContext) return null;
  const events = Array.isArray(dayContext.events) ? dayContext.events : [];

  return (
    <div
      className="events-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className="events-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        tabIndex={-1}
      >
        <header className="events-modal-header">
          <div>
            <p>{formatEventDate(dayContext.date)}</p>
            <h2 id="event-modal-title">Nearby events</h2>
            <p>
              {formatEventCount(dayContext.event_count)} · {dayContext.impact_level}{" "}
              potential impact
            </p>
          </div>
          <button
            type="button"
            className="events-modal-close"
            onClick={onClose}
            aria-label="Close event details"
          >
            ×
          </button>
        </header>

        <p className="events-modal-insight">{dayContext.insight}</p>
        <div className="events-list">
          {events.map((event) => (
            <article className="event-card" key={event.id}>
              <header className="event-card-header">
                <div>
                  <h3>{event.name}</h3>
                  <p>{event.category} · {event.genre} · {event.provider || "Event provider"}</p>
                </div>
                <span className={`event-impact-badge ${getImpactClassName(event.impact_level)}`}>
                  {event.impact_level} potential impact
                </span>
              </header>
              <dl className="event-card-details">
                <div><dt>Time</dt><dd>{formatEventTime(event.local_time)}</dd></div>
                <div><dt>Venue</dt><dd>{event.venue?.name || "Venue unavailable"}</dd></div>
                <div><dt>City</dt><dd>{event.venue?.city || "—"}</dd></div>
                <div><dt>Distance</dt><dd>{formatEventDistance(event.distance_km)}</dd></div>
              </dl>
              {event.url ? (
                <a href={event.url} target="_blank" rel="noreferrer">
                  View event on {event.provider || "provider"}
                </a>
              ) : null}
            </article>
          ))}
        </div>
        <p className="events-attribution">Event information provided by Ticketmaster, Bandsintown and TheSportsDB.</p>
      </section>
    </div>
  );
}
