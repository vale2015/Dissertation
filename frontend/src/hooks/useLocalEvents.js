"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE } from "@/lib/api";


const CACHE_PREFIX = "rfs_local_events_v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SAFE_ERROR_MESSAGE = "Local-event information is temporarily unavailable.";


function cacheKey(startDate, endDate) {
  return `${CACHE_PREFIX}:${startDate}:${endDate}`;
}


function isEventContext(value) {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && Array.isArray(value.days)
  );
}


function readCachedContext(startDate, endDate) {
  try {
    const key = cacheKey(startDate, endDate);
    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) return null;
    const cached = JSON.parse(rawValue);
    const valid = cached
      && Number.isFinite(cached.cachedAt)
      && Date.now() - cached.cachedAt < CACHE_TTL_MS
      && isEventContext(cached.data);
    if (!valid) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return cached.data;
  } catch {
    try {
      window.sessionStorage.removeItem(cacheKey(startDate, endDate));
    } catch {
      // Event requests remain usable when browser storage is unavailable.
    }
    return null;
  }
}


function storeCachedContext(startDate, endDate, data) {
  try {
    window.sessionStorage.setItem(
      cacheKey(startDate, endDate),
      JSON.stringify({ cachedAt: Date.now(), data })
    );
  } catch {
    // The hook still returns live data when browser storage is unavailable.
  }
}


export default function useLocalEvents(startDate, endDate) {
  const [eventContext, setEventContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef({ controller: null, sequence: 0 });

  const requestEvents = useCallback(async ({ refresh = false } = {}) => {
    if (!startDate || !endDate) return;

    const cached = refresh ? null : readCachedContext(startDate, endDate);
    if (cached) {
      setEventContext(cached);
      setError(null);
      setLoading(false);
      return;
    }

    requestRef.current.controller?.abort();
    const controller = new AbortController();
    const sequence = requestRef.current.sequence + 1;
    requestRef.current = { controller, sequence };

    setError(null);
    if (refresh) setRefreshing(true);
    else setLoading(true);

    const parameters = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    try {
      const response = await fetch(`${API_BASE}/events?${parameters}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !isEventContext(payload.data)) {
        throw new Error("Invalid local-event response");
      }
      if (requestRef.current.sequence !== sequence || controller.signal.aborted) return;
      storeCachedContext(startDate, endDate, payload.data);
      setEventContext(payload.data);
    } catch (requestError) {
      if (
        requestError?.name !== "AbortError"
        && requestRef.current.sequence === sequence
        && !controller.signal.aborted
      ) {
        setError(SAFE_ERROR_MESSAGE);
      }
    } finally {
      if (requestRef.current.sequence === sequence && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!startDate || !endDate) {
      requestRef.current.controller?.abort();
      requestRef.current.sequence += 1;
      setEventContext(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return undefined;
    }

    requestEvents();
    return () => requestRef.current.controller?.abort();
  }, [startDate, endDate, requestEvents]);

  const eventsByDate = useMemo(() => {
    return Object.fromEntries(
      (eventContext?.days || [])
        .filter((day) => day && typeof day.date === "string")
        .map((day) => [day.date, day])
    );
  }, [eventContext]);

  const refreshEvents = useCallback(
    () => requestEvents({ refresh: true }),
    [requestEvents]
  );

  return {
    eventContext,
    eventsByDate,
    loading,
    refreshing,
    error,
    refreshEvents,
  };
}
