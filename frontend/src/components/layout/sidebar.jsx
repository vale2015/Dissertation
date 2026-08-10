"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import DatePicker from "react-datepicker";
import LogoutForm from "@/components/auth/logoutForm";
import { API_BASE } from "@/lib/api";
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
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}


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
function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Stores the selected date for single-day pages.
  const [selectedDate, setSelectedDate] = useState("");

  // Stores the latest date returned from the backend.
  const [latestAvailableDate, setLatestAvailableDate] = useState("");

  // Controls logout modal visibility.
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // The main dashboard displays a monthly summary.
  const isDashboardPage = pathname === "/dashboard";
  const isLocalEventsPage = pathname === "/dashboard/local-events";

  /**
   * Synchronise selectedDate with the URL query string.
   */
  useEffect(() => {
    const urlDate = searchParams.get("date") || "";
    setSelectedDate(urlDate);
  }, [searchParams]);

  /**
   * Load the latest historical date from the Flask backend.
   */
  useEffect(() => {
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
        if (!isDashboardPage && !isLocalEventsPage && !urlDate && latestDate) {
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
    isDashboardPage,
    isLocalEventsPage,
    pathname,
    router,
    searchParams,
  ]);

  /**
   * Open the logout confirmation modal.
   */
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  /**
   * Clear authentication data and return to the login page.
   */
  const handleConfirmLogout = async () => {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      throw new Error(
        data?.error || "Unable to complete logout."
      );
    }

    setShowLogoutModal(false);

    router.replace("/");
    router.refresh();
  } catch (error) {
    console.error("Logout failed:", error);
  }
};

  /**
   * Close the logout confirmation modal.
   */
  const handleCancelLogout = () => {
    setShowLogoutModal(false);
  };

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
    if (href === "/dashboard" || href === "/dashboard/local-events") {
      return href;
    }

    const activeDate =
      selectedDate ||
      searchParams.get("date") ||
      latestAvailableDate;

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
        href: "/dashboard",
      },
      {
        label: "Bookings Overview",
        href: "/dashboard/bookings",
      },
      {
        label: "Add New Booking",
        href: "/dashboard/createBooking",
      },
      {
        label: "Reservation Forecast",
        href: "/dashboard/reservation-forecast",
      },
      {
        label: "Local Events",
        href: "/dashboard/local-events",
      },
      {
        label: "Staff Forecast",
        href: "/dashboard/staff-forecast",
      },
      {
        label: "Staffing Rules",
        href: "/dashboard/staffing-rules",
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
      },
    ],
    []
  );

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-calendar">
            {isDashboardPage ? (
              <>
                <label className="sidebar-calendar-label">
                  Date range
                </label>

                <div className="sidebar-range-box">
                  <span className="sidebar-range-value">
                    Last 30 days
                  </span>
                </div>

                <p className="sidebar-calendar-note">
                  Summary based on the most recent month of
                  available data
                </p>
              </>
            ) : isLocalEventsPage ? (
              <>
                <label className="sidebar-calendar-label">
                  Event search
                </label>
                <div className="sidebar-range-box">
                  <span className="sidebar-range-value">
                    Choose dates on the page
                  </span>
                </div>
                <p className="sidebar-calendar-note">
                  Search nearby events independently of forecasts
                </p>
              </>
            ) : (
              <>
                <label className="sidebar-calendar-label">
                  Select day
                </label>

                <DatePicker
                  selected={parseDateString(
                    selectedDate || latestAvailableDate
                  )}
                  onChange={handleDateChange}
                  dateFormat="dd/MM/yyyy"
                  className="sidebar-date-input"
                  calendarClassName="custom-datepicker"
                  dayClassName={() =>
                    "custom-datepicker-day"
                  }
                />

                <p className="sidebar-calendar-note">
                  Defaulting to the latest available date in
                  your dataset
                </p>
              </>
            )}
          </div>

          <nav className="sidebar-nav">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={withDate(item.href)}
                  className={`sidebar-link ${
                    isActive ? "active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={handleLogoutClick}
            >
              Logout
            </button>
          </nav>
        </div>
      </aside>

      <LogoutForm
        isOpen={showLogoutModal}
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
      />
    </>
  );
}


/**
 * Exported Sidebar component.
 *
 * The Suspense boundary prevents Next.js prerendering errors
 * caused by useSearchParams().
 */
export default function Sidebar() {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <SidebarContent />
    </Suspense>
  );
}
