"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";
import { API_BASE } from "@/lib/api";


// Normalise different date formats into YYYY-MM-DD.
function normalizeDate(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split("-");
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");
    return `${year}-${month}-${day}`;
  }

  const parsedDate = new Date(text);

  if (!Number.isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = String(
      parsedDate.getMonth() + 1
    ).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(
      2,
      "0"
    );

    return `${year}-${month}-${day}`;
  }

  return "";
}


// Return the weekday name for a date.
function getDayName(dateValue) {
  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleDateString("en-GB", {
    weekday: "long",
  });
}


// Format a value as UK currency.
function formatCurrency(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}


// Determine demand level from forecasted covers.
function getDemandLevel(covers, closed) {
  if (closed) return "Closed";
  if (covers <= 20) return "Low";
  if (covers <= 30) return "Moderate";
  return "High";
}


// Create a department-level staffing summary.
function getDepartmentBreakdown(costRows, closed) {
  if (closed) {
    return {
      foh: "—",
      kitchen: "—",
      bar: "—",
      total: "Closed",
    };
  }

  let foh = 0;
  let kitchen = 0;
  let bar = 0;
  let supervisor = 0;

  costRows.forEach((item) => {
    const department = String(
      item.department || ""
    ).toLowerCase();

    const requiredStaff = Number(
      item.required_staff || 0
    );

    if (department === "floor") {
      foh += requiredStaff;
    }

    if (department === "kitchen") {
      kitchen += requiredStaff;
    }

    if (department === "bar") {
      bar += requiredStaff;
    }

    if (department === "management") {
      supervisor += requiredStaff;
    }
  });

  return {
    foh,
    kitchen,
    bar,
    total: foh + kitchen + bar + supervisor,
  };
}


// Group staff-cost rows by forecast date.
function groupResultsByDate(results) {
  return results.reduce((groupedResults, item) => {
    const dateKey = normalizeDate(item.forecast_date);

    if (!groupedResults[dateKey]) {
      groupedResults[dateKey] = [];
    }

    groupedResults[dateKey].push(item);

    return groupedResults;
  }, {});
}


// Combine forecast totals with department staffing data.
function mapForecastRows(dailyTotals, costResults) {
  const resultsByDate = groupResultsByDate(
    costResults
  );

  return dailyTotals.map((item) => {
    const normalizedDate = normalizeDate(
      item.forecast_date
    );

    const relatedRoleRows =
      resultsByDate[normalizedDate] || [];

    const closed = item.closed === true;

    const numericCovers = closed
      ? 0
      : Number(item.predicted_covers || 0);

    const staff = getDepartmentBreakdown(
      relatedRoleRows,
      closed
    );

    const labourCost = Number(
      item.total_estimated_cost || 0
    );

    return {
      date: item.forecast_date,
      normalizedDate,
      day: getDayName(item.forecast_date),
      closed,
      closure_reason: item.closure_reason || null,
      covers: closed ? "Closed" : numericCovers,
      numericCovers,
      foh: staff.foh,
      kitchen: staff.kitchen,
      bar: staff.bar,
      total: staff.total,
      demand: getDemandLevel(
        numericCovers,
        closed
      ),
      labourCost,
      labourCostDisplay:
        formatCurrency(labourCost),
      roleBreakdown: relatedRoleRows,
    };
  });
}


// Contains the page logic that depends on useSearchParams().
function StaffForecastContent() {
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date");

  const [forecastDays, setForecastDays] =
    useState(7);

  const [viewMode, setViewMode] =
    useState("cost");

  const [forecastRows, setForecastRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [clickedRowDate, setClickedRowDate] =
    useState("");

  const [error, setError] = useState("");

  // Load the staffing forecast from the Flask backend.
  useEffect(() => {
    let isMounted = true;

    async function loadForecast() {
      try {
        setLoading(true);
        setError("");

        const queryDate = selectedDate || "";

        const requestUrl =
          `${API_BASE}/staff-cost/forecast` +
          `?days_ahead=${forecastDays}` +
          `&selected_date=${queryDate}`;

        const response = await fetch(requestUrl, {
          method: "GET",
          cache: "no-store",
        });

        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json?.error ||
              json?.message ||
              "Failed to load staff cost forecast."
          );
        }

        const dailyTotals = Array.isArray(
          json?.daily_totals
        )
          ? json.daily_totals
          : [];

        const costResults = Array.isArray(
          json?.results
        )
          ? json.results
          : [];

        const mappedRows = mapForecastRows(
          dailyTotals,
          costResults
        );

        if (!isMounted) {
          return;
        }

        setForecastRows(mappedRows);
        setClickedRowDate("");
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        console.error(
          "Failed to load staff cost forecast:",
          requestError
        );

        setError(
          requestError.message ||
            "Failed to load staff forecast."
        );

        setForecastRows([]);
        setClickedRowDate("");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadForecast();

    return () => {
      isMounted = false;
    };
  }, [forecastDays, selectedDate]);

  const openDays = useMemo(() => {
    return forecastRows.filter(
      (row) => !row.closed
    );
  }, [forecastRows]);

  const closedDays = useMemo(() => {
    return forecastRows.filter(
      (row) => row.closed
    );
  }, [forecastRows]);

  const averageDailyStaff = useMemo(() => {
    if (!openDays.length) {
      return 0;
    }

    const totalStaff = openDays.reduce(
      (sum, row) => {
        return sum + Number(row.total || 0);
      },
      0
    );

    return (
      totalStaff / openDays.length
    ).toFixed(1);
  }, [openDays]);

  const totalPredictedCovers = useMemo(() => {
    return openDays.reduce((sum, row) => {
      return (
        sum + Number(row.numericCovers || 0)
      );
    }, 0);
  }, [openDays]);

  const totalForecastLabourCost =
    useMemo(() => {
      return openDays.reduce((sum, row) => {
        return (
          sum + Number(row.labourCost || 0)
        );
      }, 0);
    }, [openDays]);

  const averageDailyLabourCost =
    useMemo(() => {
      if (!openDays.length) {
        return 0;
      }

      return (
        totalForecastLabourCost /
        openDays.length
      );
    }, [
      openDays,
      totalForecastLabourCost,
    ]);

  const peakDayRow = useMemo(() => {
    if (!openDays.length) {
      return null;
    }

    return [...openDays].sort(
      (firstRow, secondRow) => {
        return (
          secondRow.numericCovers -
          firstRow.numericCovers
        );
      }
    )[0];
  }, [openDays]);

  const peakStaff = useMemo(() => {
    if (!openDays.length) {
      return "-";
    }

    const maxStaffRow = [...openDays].sort(
      (firstRow, secondRow) => {
        return (
          Number(secondRow.total || 0) -
          Number(firstRow.total || 0)
        );
      }
    )[0];

    return maxStaffRow?.total ?? "-";
  }, [openDays]);

  const mostExpensiveDayRow = useMemo(() => {
    if (!openDays.length) {
      return null;
    }

    return [...openDays].sort(
      (firstRow, secondRow) => {
        return (
          Number(secondRow.labourCost || 0) -
          Number(firstRow.labourCost || 0)
        );
      }
    )[0];
  }, [openDays]);

  const selectedRow = useMemo(() => {
    if (!forecastRows.length) {
      return null;
    }

    if (clickedRowDate) {
      const clickedMatch = forecastRows.find(
        (row) =>
          row.normalizedDate === clickedRowDate
      );

      if (clickedMatch) {
        return clickedMatch;
      }
    }

    const normalizedSelectedDate =
      normalizeDate(selectedDate);

    if (normalizedSelectedDate) {
      const urlMatch = forecastRows.find(
        (row) =>
          row.normalizedDate ===
          normalizedSelectedDate
      );

      if (urlMatch) {
        return urlMatch;
      }
    }

    return forecastRows[0];
  }, [
    forecastRows,
    clickedRowDate,
    selectedDate,
  ]);

  return (
    <div className="dashboard-app">
      <Topbar />

      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">
              <section className="dashboard-hero">
                <h1 className="dashboard-title">
                  Staff Forecast
                </h1>

                <p className="dashboard-text">
                  {forecastDays}-day staffing
                  recommendations and cost forecast by
                  department
                </p>

                <div className="forecast-toggle">
                  <button
                    type="button"
                    className={
                      forecastDays === 7
                        ? "forecast-toggle-btn active"
                        : "forecast-toggle-btn"
                    }
                    onClick={() =>
                      setForecastDays(7)
                    }
                  >
                    7 Days
                  </button>

                  <button
                    type="button"
                    className={
                      forecastDays === 10
                        ? "forecast-toggle-btn active"
                        : "forecast-toggle-btn"
                    }
                    onClick={() =>
                      setForecastDays(10)
                    }
                  >
                    10 Days
                  </button>
                </div>

                <div className="forecast-toggle forecast-view-toggle">
                  <button
                    type="button"
                    className={
                      viewMode === "staffing"
                        ? "forecast-toggle-btn active"
                        : "forecast-toggle-btn"
                    }
                    onClick={() =>
                      setViewMode("staffing")
                    }
                  >
                    Staffing View
                  </button>

                  <button
                    type="button"
                    className={
                      viewMode === "cost"
                        ? "forecast-toggle-btn active"
                        : "forecast-toggle-btn"
                    }
                    onClick={() =>
                      setViewMode("cost")
                    }
                  >
                    Staffing + Cost View
                  </button>
                </div>
              </section>

              {loading ? (
                <p className="dashboard-text">
                  Loading staff forecast...
                </p>
              ) : error ? (
                <p className="login-error">
                  {error}
                </p>
              ) : (
                <div className="staff-forecast-layout">
                  <section className="dashboard-panel staff-forecast-table-panel">
                    <h2 className="dashboard-panel-title">
                      Forecast Details (
                      {forecastDays} Days)
                    </h2>

                    <div className="booking-table-wrapper">
                      <table className="booking-table staff-forecast-table">
                        <thead>
                          <tr>
                            <th rowSpan={2}>
                              Date
                            </th>
                            <th rowSpan={2}>
                              Day
                            </th>
                            <th rowSpan={2}>
                              Covers
                            </th>

                            <th
                              colSpan={4}
                              className="department-staffing-heading"
                            >
                              Department
                            </th>

                            {viewMode ===
                              "cost" && (
                              <th rowSpan={2}>
                                Estimated Staff Cost
                              </th>
                            )}
                          </tr>

                          <tr>
                            <th className="staff-col">
                              FOH
                            </th>
                            <th className="staff-col">
                              Kitchen
                            </th>
                            <th className="staff-col">
                              Bar
                            </th>
                            <th className="staff-col">
                              Total
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {forecastRows.length >
                          0 ? (
                            forecastRows.map(
                              (row, index) => {
                                const isSelected =
                                  selectedRow?.normalizedDate ===
                                  row.normalizedDate;

                                const isHighCost =
                                  !row.closed &&
                                  row.labourCost >=
                                    averageDailyLabourCost;

                                return (
                                  <tr
                                    key={`${row.normalizedDate}-${forecastDays}-${index}`}
                                    onClick={() =>
                                      setClickedRowDate(
                                        row.normalizedDate
                                      )
                                    }
                                    className={`
                                      ${
                                        isSelected
                                          ? "selected-forecast-row"
                                          : ""
                                      }
                                      ${
                                        isHighCost
                                          ? "high-cost-row"
                                          : ""
                                      }
                                    `}
                                  >
                                    <td>
                                      {formatDateDDMMYYYY(
                                        row.date
                                      )}
                                    </td>

                                    <td>
                                      {row.day}
                                    </td>

                                    <td>
                                      {row.covers}
                                    </td>

                                    <td>
                                      {row.foh}
                                    </td>

                                    <td>
                                      {row.kitchen}
                                    </td>

                                    <td>
                                      {row.bar}
                                    </td>

                                    <td>
                                      {row.total}
                                    </td>

                                    {viewMode ===
                                      "cost" && (
                                      <td className="labour-cost-cell">
                                        {row.closed
                                          ? "£0.00"
                                          : row.labourCostDisplay}
                                      </td>
                                    )}
                                  </tr>
                                );
                              }
                            )
                          ) : (
                            <tr>
                              <td
                                colSpan={
                                  viewMode ===
                                  "cost"
                                    ? 8
                                    : 7
                                }
                                className="empty-state-cell"
                              >
                                No staff forecast
                                data available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <aside className="dashboard-panel staff-summary-panel">
                    <h2 className="dashboard-panel-title">
                      Period Summary
                    </h2>

                    <div className="staff-summary-scroll">
                      <div className="summary-mini-card">
                        <h3>
                          Average Daily Staff
                        </h3>
                        <p>
                          {averageDailyStaff}
                        </p>
                        <span>
                          Across all forecasted open
                          days in the next{" "}
                          {forecastDays} days
                        </span>
                      </div>

                      <div className="summary-mini-card">
                        <h3>
                          Total Predicted Covers
                        </h3>
                        <p>
                          {totalPredictedCovers}
                        </p>
                        <span>
                          Across all open days in
                          the next {forecastDays}{" "}
                          days
                        </span>
                      </div>

                      {viewMode === "cost" && (
                        <>
                          <div className="summary-mini-card">
                            <h3>
                              Total Forecast
                              Staffing Cost
                            </h3>
                            <p>
                              {formatCurrency(
                                totalForecastLabourCost
                              )}
                            </p>
                            <span>
                              Total staffing cost
                              in the next{" "}
                              {forecastDays} days
                            </span>
                          </div>

                          <div className="summary-mini-card">
                            <h3>
                              Average Daily
                              Staffing Cost
                            </h3>
                            <p>
                              {formatCurrency(
                                averageDailyLabourCost
                              )}
                            </p>
                            <span>
                              Average daily
                              staffing cost
                            </span>
                          </div>
                        </>
                      )}

                      <div className="staff-divider" />

                      <h3 className="staff-side-heading">
                        Selected Day
                      </h3>

                      {selectedRow ? (
                        <>
                          <p>
                            {formatDateDDMMYYYY(
                              selectedRow.date
                            )}{" "}
                            — {selectedRow.day}
                          </p>

                          <div className="staff-side-grid">
                            <span>Covers</span>
                            <strong>
                              {
                                selectedRow.covers
                              }
                            </strong>

                            <span>FOH</span>
                            <strong>
                              {selectedRow.foh}
                            </strong>

                            <span>Kitchen</span>
                            <strong>
                              {
                                selectedRow.kitchen
                              }
                            </strong>

                            <span>Bar</span>
                            <strong>
                              {selectedRow.bar}
                            </strong>

                            <span>
                              Total Staff
                            </span>
                            <strong>
                              {
                                selectedRow.total
                              }
                            </strong>

                            {viewMode ===
                              "cost" && (
                              <>
                                <span>
                                  Estimated Labour
                                  Cost
                                </span>
                                <strong>
                                  {selectedRow.closed
                                    ? "£0.00"
                                    : selectedRow.labourCostDisplay}
                                </strong>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <p>
                          No forecast row selected.
                        </p>
                      )}

                      <div className="staff-divider" />

                      <h3 className="staff-side-heading">
                        Weekly Breakdown
                      </h3>

                      <div className="staff-side-grid">
                        <span>Peak Day</span>
                        <strong>
                          {peakDayRow?.day || "-"}
                        </strong>

                        <span>Peak Staff</span>
                        <strong>
                          {peakStaff}
                        </strong>

                        {viewMode === "cost" && (
                          <>
                            <span>
                              Most Expensive Day
                            </span>
                            <strong>
                              {mostExpensiveDayRow
                                ?.day || "-"}
                            </strong>
                          </>
                        )}

                        <span>Open Days</span>
                        <strong>
                          {openDays.length} of{" "}
                          {forecastRows.length}
                        </strong>

                        <span>Closed Days</span>
                        <strong>
                          {closedDays.length
                            ? closedDays
                                .map(
                                  (row) => row.day
                                )
                                .join(", ")
                            : "-"}
                        </strong>
                      </div>
                    </div>
                  </aside>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}


// Export the page through a parent Suspense boundary.
export default function StaffForecastPage() {
  return (
    <Suspense
      fallback={
        <p className="dashboard-text">
          Loading staff forecast...
        </p>
      }
    >
      <StaffForecastContent />
    </Suspense>
  );
}