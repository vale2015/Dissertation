const EMPTY_VALUE = "—";


function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}


function toValidDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}


export function formatTemperature(value) {
  const number = toFiniteNumber(value);
  if (number === null) return EMPTY_VALUE;

  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(number)}°C`;
}


export function formatPercentage(value) {
  const number = toFiniteNumber(value);
  if (number === null) return EMPTY_VALUE;

  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(number)}%`;
}


export function formatPrecipitation(value) {
  const number = toFiniteNumber(value);
  if (number === null) return EMPTY_VALUE;

  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(number)} mm`;
}


export function formatWindSpeed(value) {
  const number = toFiniteNumber(value);
  if (number === null) return EMPTY_VALUE;

  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(number)} km/h`;
}


export function formatTime(value, timezone) {
  if (typeof value === "string") {
    const localProviderTime = value.match(/T(\d{2}:\d{2})/);
    const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
    if (localProviderTime && !hasOffset) {
      return localProviderTime[1];
    }
  }

  const date = toValidDate(value);
  if (!date) return EMPTY_VALUE;

  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return EMPTY_VALUE;
  }
}


export function formatForecastDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return EMPTY_VALUE;
  }

  const date = toValidDate(`${value}T12:00:00Z`);
  if (!date) return EMPTY_VALUE;

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}


export function formatForecastDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return EMPTY_VALUE;
  }

  const date = toValidDate(`${value}T12:00:00Z`);
  if (!date) return EMPTY_VALUE;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}


export function formatLastUpdated(value, timezone) {
  const date = toValidDate(value);
  if (!date) return EMPTY_VALUE;

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return EMPTY_VALUE;
  }
}
