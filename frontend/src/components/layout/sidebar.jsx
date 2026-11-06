"use client";

import Link from "next/link";
import { forwardRef, Suspense, useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import DatePicker from "react-datepicker";
import ManagerChat from "@/components/chatbot/ManagerChat";
import NavIcon from "@/components/layout/NavIcon";
import { API_BASE } from "@/lib/api";
import useSession from "@/hooks/useSession";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import "react-datepicker/dist/react-datepicker.css";


/**
 * Normalises a date value into YYYY-MM-DD.
 * This keeps URL dates and fetched dates consistent.
 */
function normalizeDate(value) {
  if (!value) return "";

  const text = String(value).trim();

  const directMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (directMatch) {
    return text;
  }

  const parsedDate = new Date(text);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/**
 * Converts a Date object into YYYY-MM-DD.
 */
function formatDateToYMD(date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/**
 * Converts YYYY-MM-DD into a Date object for react-datepicker.
 */
function parseDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

const DashboardDateTrigger = forwardRef(function DashboardDateTrigger({ value, onClick, onKeyDown, onBlur, onFocus, id }, ref) {
  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.(event);
    } else {
      onKeyDown?.(event);
    }
  }

  return <button id={id} ref={ref} type="button" className="rfs-dashboard-date-trigger" aria-label={`View a day, currently ${value}`} onClick={onClick} onKeyDown={handleKeyDown} onBlur={onBlur} onFocus={onFocus}>
    <span>{value}</span>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M7 3v4M17 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  </button>;
});


/**
 * Loading state displayed while URL search parameters are resolved.
 */
function SidebarFallback() {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <p className="sidebar-calendar-note">
          Loading navigation...
        </p>
      </div>
    </aside>
  );
}


/**
 * Contains the interactive Sidebar logic that depends on
 * useSearchParams().
 */
function SidebarContent({ today }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSession();

  // Stores the selected date for single-day pages.
  const [selectedDate, setSelectedDate] = useState("");

  // Stores the latest date returned from the backend.
  const [latestAvailableDate, setLatestAvailableDate] = useState("");

  // The main dashboard displays a monthly summary.
  const isDashboardPage = pathname === "/dashboard";
  const isLocalEventsPage = pathname === "/dashboard/local-events";
  const isAccountPage = ["/dashboard/staff", "/dashboard/profile", "/dashboard/settings", "/dashboard/staffing-rules"].includes(pathname);
  const isReportHistoryPage = pathname.startsWith("/dashboard/reports/history");
  const isDateIndependentPage = isDashboardPage || isLocalEventsPage || isAccountPage || isReportHistoryPage || pathname === "/dashboard/forecast-accuracy";

  /**
   * Synchronise selectedDate with the URL query string.
   */
  useEffect(() => {
    const urlDate = searchParams.get("date") || "";
    setSelectedDate(urlDate);
  }, [searchParams]);

  useEffect(() => {
    const urlDate = searchParams.get("date");
    if (isDashboardPage && urlDate && !parseDateString(urlDate)) {
      router.replace("/dashboard");
    }
  }, [isDashboardPage, router, searchParams]);

  /**
   * Load the latest historical date from the Flask backend.
   */
  useEffect(() => {
    if (!user || !hasPermission(user, PERMISSIONS.VIEW_DASHBOARD) || isAccountPage) {
      return;
    }
    const loadLatestDate = async () => {
      try {
        const response = await fetch(`${API_BASE}/dashboard/`);

        if (!response.ok) {
          throw new Error(
            `Failed to load dashboard data: ${response.status}`
          );
        }

        const json = await response.json();

        const latestDate = normalizeDate(
          json?.latest_record?.date
        );

        setLatestAvailableDate(latestDate);

        const urlDate = searchParams.get("date") || "";

        /**
         * Add the latest available date only to pages that use
         * a single selected day.
         */
        if (!isDateIndependentPage && !urlDate && latestDate) {
          const parameters = new URLSearchParams(
            searchParams.toString()
          );

          parameters.set("date", latestDate);

          router.replace(
            `${pathname}?${parameters.toString()}`
          );
        }
      } catch (error) {
        console.error(
          "Failed to load latest available date:",
          error
        );
      }
    };

    loadLatestDate();
  }, [
    isDateIndependentPage,
    isAccountPage,
    pathname,
    router,
    searchParams,
    user,
  ]);

  /**
   * Update the selected date in the current URL.
   */
  const handleDateChange = (date) => {
    const newDate = formatDateToYMD(date);

    setSelectedDate(newDate);

    const parameters = new URLSearchParams(
      searchParams.toString()
    );

    if (newDate) {
      parameters.set("date", newDate);
    } else {
      parameters.delete("date");
    }

    const queryString = parameters.toString();

    router.push(
      queryString
        ? `${pathname}?${queryString}`
        : pathname
    );
  };

  /**
   * Preserve the selected date when navigating between
   * single-day pages.
   */
  const withDate = (href) => {
    if (["/dashboard","/dashboard/local-events","/dashboard/forecast-accuracy","/dashboard/staff","/dashboard/profile","/dashboard/settings","/dashboard/staffing-rules","/dashboard/reports/history"].includes(href)) {
      return href;
    }

    const activeDate =
      selectedDate ||
      searchParams.get("date") ||
      latestAvailableDate;

    // A dashboard-selected future day is a forecast target, not a valid
    // historical base for generating a new reservation forecast.
    if (href === "/dashboard/reservation-forecast") {
      const historicalDate = latestAvailableDate && parseDateString(activeDate) && activeDate <= latestAvailableDate
        ? activeDate
        : latestAvailableDate;
      return historicalDate ? `${href}?date=${historicalDate}` : href;
    }

    if (!activeDate) {
      return href;
    }

    return `${href}?date=${activeDate}`;
  };

  /**
   * Sidebar navigation items.
   */
  const menuItems = useMemo(
    () => [
      {
        label: "Dashboard",
        icon: "dashboard",
        href: "/dashboard",
        permission: PERMISSIONS.VIEW_DASHBOARD,
      },
      {
        label: "Bookings",
        icon: "bookings",
        href: "/dashboard/bookings",
        permission: PERMISSIONS.MANAGE_BOOKINGS,
      },
      {
        label: "Reservation Forecast",
        icon: "forecast",
        href: "/dashboard/reservation-forecast",
        permission: PERMISSIONS.VIEW_FORECASTS,
      },
      {
        label: "Staffing Forecast",
        icon: "staffForecast",
        href: "/dashboard/staff-forecast",
        permission: PERMISSIONS.VIEW_FORECASTS,
      },
      { label: "Staff Management", icon: "staff", href: "/dashboard/staff", permission: PERMISSIONS.MANAGE_STAFF_ACCOUNTS },
      {
        label: "Reports",
        icon: "reports",
        href: "/dashboard/reports",
        permission: PERMISSIONS.VIEW_REPORTS,
      },
      {
        label: "Settings",
        icon: "settings",
        href: "/dashboard/settings",
        permission: PERMISSIONS.VIEW_OWN_PROFILE,
      },
    ],
    []
  );

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-top">
          <Link href="/dashboard" className="sidebar-brand" aria-label="RFS home">
            <svg className="sidebar-brand-hat" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="M11 30V18a8 8 0 0 1 5-14 8 8 0 0 1 15 1 8 8 0 0 1 6 14v11M11 30h26v8H11z" /></svg>
            <strong>RFS</strong><span>Restaurant<br />Forecasting<br />System</span>
          </Link>
          <nav className="sidebar-nav">
            {menuItems.filter(item => hasPermission(user, item.permission)).map((item) => {
              const isActive = pathname === item.href || (item.href === "/dashboard/reports" && isReportHistoryPage) || (item.href === "/dashboard/settings" && ["/dashboard/profile", "/dashboard/staffing-rules"].includes(pathname));

              return (
                <Link
                  key={item.href}
                  href={withDate(item.href)}
                  className={`sidebar-link ${
                    isActive ? "active" : ""
                  }`}
                >
                  <NavIcon name={item.icon} /><span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className={`sidebar-calendar ${isDashboardPage ? "rfs-sidebar-dashboard-calendar" : ""}`}>
            {isDashboardPage ? (
              <>
                <label className="sidebar-calendar-label" htmlFor="dashboard-sidebar-date">View a day</label>
                <DatePicker
                  id="dashboard-sidebar-date"
                  selected={parseDateString(searchParams.get("date")) || parseDateString(today)}
                  onChange={handleDateChange}
                  dateFormat="EEE, d MMM yyyy"
                  customInput={<DashboardDateTrigger />}
                  calendarClassName="custom-datepicker rfs-dashboard-calendar"
                  popperClassName="rfs-dashboard-calendar-popper"
                  popperPlacement="bottom-start"
                  portalId="rfs-sidebar-calendar-portal"
                  showPopperArrow={false}
                />
                {searchParams.get("date") && <button className="rfs-dashboard-overview-link" type="button" onClick={() => router.push("/dashboard")}>Show overview</button>}
              </>
            ) : isAccountPage || isReportHistoryPage ? (
              <><label className="sidebar-calendar-label">{isReportHistoryPage ? "Report archive" : "Account"}</label><div className="sidebar-range-box"><span className="sidebar-range-value">No forecast date required</span></div></>
            ) : isLocalEventsPage ? (
              <>
                <label className="sidebar-calendar-label">Event search</label>
                <div className="sidebar-range-box"><span className="sidebar-range-value">Choose dates on the page</span></div>
                <p className="sidebar-calendar-note">Search nearby events independently of forecasts</p>
              </>
            ) : (
              <>
                <label className="sidebar-calendar-label">{pathname === "/dashboard/reservation-forecast" ? "Historical base day" : "Select day"}</label>
                <DatePicker
                  selected={parseDateString(selectedDate || latestAvailableDate)}
                  onChange={handleDateChange}
                  maxDate={pathname === "/dashboard/reservation-forecast" ? parseDateString(latestAvailableDate) || undefined : undefined}
                  dateFormat="dd/MM/yyyy"
                  className="sidebar-date-input"
                  calendarClassName="custom-datepicker"
                  portalId="rfs-sidebar-calendar-portal"
                  dayClassName={() => "custom-datepicker-day"}
                />
                <p className="sidebar-calendar-note">{pathname === "/dashboard/reservation-forecast" ? "Forecasts begin after this historical day" : "Defaulting to the latest available date in your dataset"}</p>
              </>
            )}
          </div>
        </div>
        <ManagerChat />
      </aside>
    </>
  );
}


/**
 * Exported Sidebar component.
 *
 * The Suspense boundary prevents Next.js prerendering errors
 * caused by useSearchParams().
 */
export default function Sidebar({ today }) {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <SidebarContent today={today} />
    </Suspense>
  );
}
