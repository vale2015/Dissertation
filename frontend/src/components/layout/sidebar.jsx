"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DatePicker from "react-datepicker";
import LogoutForm from "@/components/auth/logoutForm";
import "react-datepicker/dist/react-datepicker.css";

const API_BASE = "http://127.0.0.1:5000/api";

/**
 * Normalizes a date value into YYYY-MM-DD.
 * This helps keep URL dates and fetched dates consistent.
 */
function normalizeDate(value) {
  if (!value) return "";

  const text = String(value).trim();

  const directMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (directMatch) return text;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Converts a Date object into YYYY-MM-DD.
 * Used when the user selects a day from the date picker.
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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Stores the active selected date for single-day pages.
   */
  const [selectedDate, setSelectedDate] = useState("");

  /**
   * Stores the latest date returned from the backend.
   * Used as fallback if no date exists in the URL.
   */
  const [latestAvailableDate, setLatestAvailableDate] = useState("");

  /**
   * Controls logout modal visibility.
   */
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /**
   * Dashboard is now a monthly summary page.
   * We use this flag to change the sidebar behaviour only for /dashboard.
   */
  const isDashboardPage = pathname === "/dashboard";

  /**
   * Sync local selectedDate state with the URL query string.
   */
  useEffect(() => {
    const urlDate = searchParams.get("date") || "";
    setSelectedDate(urlDate);
  }, [searchParams]);

  /**
   * Load the latest available historical date from the backend.
   * This helps us default the date picker for single-day pages.
   */
  useEffect(() => {
    const loadLatestDate = async () => {
      try {
        const response = await fetch(`${API_BASE}/dashboard/`);
        const json = await response.json();

        const latestDate = normalizeDate(json?.latest_record?.date);
        setLatestAvailableDate(latestDate);

        const urlDate = searchParams.get("date") || "";

        /**
         * Only force a default date into the URL for single-day pages.
         * For the monthly dashboard, we do not need ?date=...
         */
        if (!isDashboardPage && !urlDate && latestDate) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("date", latestDate);
          router.replace(`${pathname}?${params.toString()}`);
        }
      } catch (error) {
        console.error("Failed to load latest available date:", error);
      }
    };

    loadLatestDate();
  }, [isDashboardPage, pathname, router, searchParams]);

  /**
   * Opens the logout confirmation modal.
   */
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  /**
   * Clears stored authentication data and redirects to login/root page.
   */
  const handleConfirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setShowLogoutModal(false);
    router.push("/");
  };

  /**
   * Closes the logout confirmation modal.
   */
  const handleCancelLogout = () => {
    setShowLogoutModal(false);
  };

  /**
   * Handles single-day picker changes for pages that use ?date=...
   */
  const handleDateChange = (date) => {
    const newDate = formatDateToYMD(date);
    setSelectedDate(newDate);

    const params = new URLSearchParams(searchParams.toString());

    if (newDate) {
      params.set("date", newDate);
    } else {
      params.delete("date");
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  /**
   * Preserves the selected date across single-day pages.
   * For the Dashboard page, we do not append a date query because the page
   * now represents the last 30 days summary.
   */
  const withDate = (href) => {
    // Dashboard should stay clean without ?date=...
    if (href === "/dashboard") {
      return href;
    }

    const activeDate =
      selectedDate || searchParams.get("date") || latestAvailableDate;

    if (!activeDate) return href;

    return `${href}?date=${activeDate}`;
  };

  /**
   * Sidebar menu items.
   */
  const menuItems = useMemo(
    () => [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Bookings Overview", href: "/dashboard/bookings" },
      { label: "Add New Booking", href: "/dashboard/createBooking" },
      { label: "Reservation Forecast", href: "/dashboard/reservation-forecast" },
      { label: "Staff Forecast", href: "/dashboard/staff-forecast" },
      { label: "Staffing Rules", href: "/dashboard/staffing-rules" },
      { label: "Reports", href: "/dashboard/reports" },
    ],
    []
  );

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-calendar">
            {isDashboardPage ? (
              /**
               * Dashboard-specific sidebar block:
               * show a fixed monthly range summary instead of a date picker.
               */
              <>
                <label className="sidebar-calendar-label">Date range</label>

                <div className="sidebar-range-box">
                  <span className="sidebar-range-value">Last 30 days</span>
                </div>

                <p className="sidebar-calendar-note">
                  Summary based on the most recent month of available data
                </p>
              </>
            ) : (
              /**
               * Default sidebar block for single-day pages:
               * keep the date picker behaviour.
               */
              <>
                <label className="sidebar-calendar-label">Select day</label>

                <DatePicker
                  selected={parseDateString(selectedDate || latestAvailableDate)}
                  onChange={handleDateChange}
                  dateFormat="dd/MM/yyyy"
                  className="sidebar-date-input"
                  calendarClassName="custom-datepicker"
                  dayClassName={() => "custom-datepicker-day"}
                />

                <p className="sidebar-calendar-note">
                  Defaulting to latest available date in your dataset
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
                  className={`sidebar-link ${isActive ? "active" : ""}`}
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