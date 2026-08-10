"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE } from "@/lib/api";


const WEATHER_CACHE_KEY = "rfs_weather_cache";
const WEATHER_CACHE_LIFETIME_MS = 30 * 60 * 1000;
const SAFE_ERROR_MESSAGE = "Weather information is temporarily unavailable.";


function isWeatherData(value) {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && value.current
      && typeof value.current === "object"
  );
}


function readCachedWeather() {
  try {
    const rawValue = window.sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!rawValue) return null;

    const cachedValue = JSON.parse(rawValue);
    const validShape = cachedValue
      && typeof cachedValue === "object"
      && Number.isFinite(cachedValue.cachedAt)
      && isWeatherData(cachedValue.data);
    const isCurrent = validShape
      && Date.now() - cachedValue.cachedAt < WEATHER_CACHE_LIFETIME_MS;

    if (!isCurrent) {
      window.sessionStorage.removeItem(WEATHER_CACHE_KEY);
      return null;
    }

    return cachedValue.data;
  } catch {
    try {
      window.sessionStorage.removeItem(WEATHER_CACHE_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }
    return null;
  }
}


function cacheWeather(data) {
  try {
    window.sessionStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        data,
      })
    );
  } catch {
    // Weather remains usable when session storage is unavailable.
  }
}


export default function useWeather() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(false);
  const requestControllerRef = useRef(null);

  const requestWeather = useCallback(async ({ refresh = false } = {}) => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    if (mountedRef.current) {
      setError(null);
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
    }

    try {
      const response = await fetch(`${API_BASE}/weather/`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success !== true || !isWeatherData(payload.data)) {
        throw new Error("Invalid weather response");
      }

      cacheWeather(payload.data);
      if (mountedRef.current && !controller.signal.aborted) {
        setWeather(payload.data);
      }
    } catch (requestError) {
      if (
        requestError?.name !== "AbortError"
        && mountedRef.current
        && !controller.signal.aborted
      ) {
        setError(SAFE_ERROR_MESSAGE);
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const cachedWeather = readCachedWeather();

    if (cachedWeather) {
      setWeather(cachedWeather);
      setLoading(false);
    } else {
      requestWeather();
    }

    return () => {
      mountedRef.current = false;
      requestControllerRef.current?.abort();
    };
  }, [requestWeather]);

  const refreshWeather = useCallback(() => {
    return requestWeather({ refresh: true });
  }, [requestWeather]);

  return {
    weather,
    loading,
    refreshing,
    error,
    refreshWeather,
  };
}
