"use client";

import WeatherWidget from "@/components/weather/WeatherWidget";

export default function Topbar({ user }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-brand">RFS - Restaurant Forecasting System</h1>
        <p className="topbar-subtitle">Decision Support System</p>
      </div>

      <div className="topbar-right">
        <WeatherWidget />

        <div className="topbar-user-icon">👤</div>

        <div className="topbar-user">
          <span className="topbar-user-name">
            {user?.full_name || "Test Manager"}
          </span>
        </div>
      </div>
    </header>
  );
}
