"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import WeatherIcon from "@/components/weather/WeatherIcon";
import WeatherPopup from "@/components/weather/WeatherPopup";
import useWeather from "@/hooks/useWeather";
import { formatTemperature } from "@/utils/WeatherFormat";


const POPUP_ID = "weather-popup";


export default function WeatherWidget() {
  const {
    weather,
    loading,
    refreshing,
    error,
    refreshWeather,
  } = useWeather();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const widgetButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  const closePopup = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => {
      widgetButtonRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        closePopup();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopup();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePopup, isOpen]);

  const current = weather?.current;
  const city = weather?.location?.city;
  const buttonLabel = loading
    ? "Loading restaurant weather"
    : weather
      ? `Open weather information. ${city || "Restaurant"}, ${current?.condition || "unknown conditions"}, ${formatTemperature(current?.temperature)}`
      : "Weather unavailable. Open weather information to retry";

  return (
    <div className="weather-widget" ref={wrapperRef}>
      <button
        ref={widgetButtonRef}
        className={`weather-widget-button${loading ? " is-loading" : ""}`}
        type="button"
        aria-label={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={POPUP_ID}
        onClick={() => setIsOpen((open) => !open)}
      >
        <WeatherIcon
          icon={current?.icon || "unknown"}
          size={28}
          decorative
        />
        <span className="weather-widget-temperature">
          {loading ? "—" : formatTemperature(current?.temperature)}
        </span>
        <span className="weather-widget-city">
          {loading ? "Loading" : city || "Unavailable"}
        </span>
        <span className="sr-only" aria-live="polite">
          {loading ? "Weather loading" : error || "Weather loaded"}
        </span>
      </button>

      {isOpen && (
        <WeatherPopup
          popupId={POPUP_ID}
          weather={weather}
          error={error}
          refreshing={refreshing}
          onClose={closePopup}
          onRefresh={refreshWeather}
          closeButtonRef={closeButtonRef}
        />
      )}
    </div>
  );
}
