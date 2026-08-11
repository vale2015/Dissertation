"use client";

import WeatherWidget from "@/components/weather/WeatherWidget";
import useSession from "@/hooks/useSession";
import {hasPermission,PERMISSIONS} from "@/lib/permissions";

export default function Topbar({ user }) {
  const session = useSession();
  const currentUser = user || session.user;
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-brand">RFS - Restaurant Forecasting System</h1>
        <p className="topbar-subtitle">Decision Support System</p>
      </div>

      <div className="topbar-right">
        {hasPermission(currentUser,PERMISSIONS.VIEW_FORECASTS) && <WeatherWidget />}

        <div className="topbar-user-icon">👤</div>

        <div className="topbar-user">
          <span className="topbar-user-name">
            {currentUser?.full_name || "Loading user…"}
          </span>
          {currentUser?.role && <span className="topbar-user-role">{currentUser.role}</span>}
        </div>
      </div>
    </header>
  );
}
