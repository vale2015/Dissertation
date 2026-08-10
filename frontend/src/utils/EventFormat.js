const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const IMPACT_CLASSES = {
  none: "event-impact-none",
  low: "event-impact-low",
  medium: "event-impact-medium",
  high: "event-impact-high",
  unavailable: "event-impact-unavailable",
};


function parseLocalDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}


export function formatEventDate(value) {
  const date = parseLocalDate(value);
  return date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date)
    : "—";
}


export function formatEventDay(value) {
  const date = parseLocalDate(value);
  return date
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        timeZone: "UTC",
      }).format(date)
    : "—";
}


export function formatEventTime(value) {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
    return "Time unavailable";
  }
  return value.slice(0, 5);
}


export function formatEventDistance(value) {
  const distance = Number(value);
  return Number.isFinite(distance) && distance >= 0
    ? `${distance.toFixed(1)} km`
    : "—";
}


export function formatEventCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) return "—";
  if (count === 0) return "No events";
  return count === 1 ? "1 event" : `${count} events`;
}


export function getImpactClassName(value) {
  const key = String(value || "unavailable").trim().toLowerCase();
  return IMPACT_CLASSES[key] || IMPACT_CLASSES.unavailable;
}
