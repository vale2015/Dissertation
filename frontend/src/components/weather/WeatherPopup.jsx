import WeatherIcon from "@/components/weather/WeatherIcon";
import {
  formatForecastDate,
  formatForecastDay,
  formatLastUpdated,
  formatPercentage,
  formatPrecipitation,
  formatTemperature,
  formatTime,
  formatWindSpeed,
} from "@/utils/WeatherFormat";


function Detail({ label, value }) {
  return (
    <div className="weather-detail">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}


export default function WeatherPopup({
  popupId,
  weather,
  error,
  refreshing,
  onClose,
  onRefresh,
  closeButtonRef,
}) {
  const timezone = weather?.location?.timezone;
  const city = weather?.location?.city || "Restaurant weather";
  const current = weather?.current;
  const today = weather?.today;
  const forecast = Array.isArray(weather?.daily_forecast)
    ? weather.daily_forecast
    : [];

  return (
    <section
      id={popupId}
      className="weather-popup"
      role="dialog"
      aria-modal="false"
      aria-labelledby="weather-popup-title"
    >
      <header className="weather-popup-header">
        <div>
          <p className="weather-popup-location">{city}</p>
          <h2 id="weather-popup-title">
            {current?.condition || "Weather information"}
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          className="weather-icon-button weather-popup-close"
          type="button"
          aria-label="Close weather information"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      {weather ? (
        <>
          <section className="weather-current" aria-label="Current weather">
            <WeatherIcon
              icon={current?.icon}
              size={72}
              label={current?.condition || "Current weather"}
            />
            <div>
              <p className="weather-current-temperature">
                {formatTemperature(current?.temperature)}
              </p>
              <p>{current?.condition || "Unknown conditions"}</p>
              <p className="weather-secondary">
                Feels like {formatTemperature(current?.apparent_temperature)}
              </p>
            </div>
          </section>

          <section className="weather-popup-section" aria-labelledby="weather-today-title">
            <h3 id="weather-today-title">Today</h3>
            <dl className="weather-details-grid">
              <Detail label="Minimum" value={formatTemperature(today?.temperature_min)} />
              <Detail label="Maximum" value={formatTemperature(today?.temperature_max)} />
              <Detail label="Humidity" value={formatPercentage(current?.humidity)} />
              <Detail label="Rain probability" value={formatPercentage(today?.precipitation_probability)} />
              <Detail label="Precipitation" value={formatPrecipitation(current?.precipitation)} />
              <Detail label="Wind" value={formatWindSpeed(current?.wind_speed)} />
              <Detail label="Sunrise" value={formatTime(today?.sunrise, timezone)} />
              <Detail label="Sunset" value={formatTime(today?.sunset, timezone)} />
            </dl>
          </section>

          <section className="weather-popup-section" aria-labelledby="weather-forecast-title">
            <h3 id="weather-forecast-title">Seven-day forecast</h3>
            <div className="weather-forecast-list">
              {forecast.map((day, index) => (
                <article className="weather-forecast-row" key={`${day.date}-${index}`}>
                  <div className="weather-forecast-date">
                    <strong>{formatForecastDay(day.date)}</strong>
                    <span>{formatForecastDate(day.date)}</span>
                  </div>
                  <WeatherIcon
                    icon={day.icon}
                    size={32}
                    label={day.condition || "Forecast conditions"}
                  />
                  <span className="weather-forecast-condition">
                    {day.condition || "Unknown conditions"}
                  </span>
                  <span>{formatTemperature(day.temperature_max)}</span>
                  <span className="weather-secondary">
                    {formatTemperature(day.temperature_min)}
                  </span>
                  <span>{formatPercentage(day.precipitation_probability)}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="weather-empty-state">
          Weather information is currently unavailable. Use refresh to try again.
        </p>
      )}

      {weather?.stale && (
        <p className="weather-warning" role="status">
          Weather information may be out of date.
        </p>
      )}
      {error && (
        <p className="weather-error" role="alert">
          {error}
        </p>
      )}

      <footer className="weather-popup-footer">
        <div>
          <p className="weather-last-updated">
            Last updated: {formatLastUpdated(weather?.fetched_at, timezone)}
          </p>
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
          >
            Weather data provided by Open-Meteo
          </a>
        </div>
        <button
          className="weather-refresh-button"
          type="button"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </footer>
    </section>
  );
}
