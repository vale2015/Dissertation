"use client";

import { Suspense } from "react";
import SummaryCard from "@/components/dashboard/summaryCard";
import BookingsTrend from "@/components/charts/BookingsTrend";
import StaffingOverviewChart from "@/components/charts/StaffingOverviewChart";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";
import useDashboardData from "@/hooks/useDashboardData";


// Formats numeric values as GBP currency.
function formatCurrency(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}


// Contains the dashboard logic that depends on useDashboardData().
function DashboardContentInner({ user }) {
  const {
    loading,
    selectedDate,
    selectedMode,
    selectedHistoricalRecord,
    selectedForecastRecord,
    selectedHistoricalType,
    selectedForecastType,
    predictedCoversNext7Days,
    staffNeededTomorrow,
    peakDemandDay,
    totalRecords,
    weeklyData,
    latestRecord,
    summary,
    financialSummary,
    getStaffFromCovers,
  } = useDashboardData();

  // Prepare staffing chart data for a selected historical date.
  const historicalStaffData = selectedHistoricalRecord
    ? [
        {
          label: formatDateDDMMYYYY(selectedDate),
          value: getStaffFromCovers(
            selectedHistoricalRecord.total_covers || 0
          ),
        },
      ]
    : [];

  // Prepare staffing chart data for a selected forecast date.
  const forecastStaffData = selectedForecastRecord
    ? [
        {
          label: formatDateDDMMYYYY(selectedDate),
          value: getStaffFromCovers(
            selectedForecastRecord.predicted_total_covers || 0
          ),
        },
      ]
    : [];

  // Prepare weekly staffing chart data.
  const weeklyStaffingData = weeklyData.map((item) => ({
    label: item.label,
    value: Number(
      item.staff ||
        getStaffFromCovers(item.value || 0)
    ),
  }));

  return (
    <>
      <section className="dashboard-hero">
        <h1 className="dashboard-title">
          Dashboard
        </h1>

        <p className="dashboard-text">
          Welcome
          {user?.full_name
            ? `, ${user.full_name}`
            : ""}
        </p>

        {selectedDate && (
          <p className="dashboard-text">
            Selected date:{" "}
            {formatDateDDMMYYYY(selectedDate)}
          </p>
        )}
      </section>

      {loading ? (
        <p className="dashboard-text">
          Loading dashboard data...
        </p>
      ) : selectedDate ? (
        selectedMode === "historical" ? (
          <>
            <section className="dashboard-summary-grid">
              <SummaryCard
                title="Selected Date"
                value={formatDateDDMMYYYY(
                  selectedDate
                )}
                description="Historical record selected from the calendar."
              />

              <SummaryCard
                title="Total Covers"
                value={
                  selectedHistoricalRecord
                    ?.total_covers ?? 0
                }
                description="Recorded total covers for the selected day."
              />

              <SummaryCard
                title="Main Booking Type"
                value={selectedHistoricalType}
                description="Largest booking source for the selected historical day."
              />

              <SummaryCard
                title="Estimated Staff Needed"
                value={getStaffFromCovers(
                  selectedHistoricalRecord
                    ?.total_covers || 0
                )}
                description="Recommended staff level based on recorded demand."
              />
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel-title">
                Monthly Operational Insights For the{" "}
                {formatDateDDMMYYYY(selectedDate)}
              </h2>

              <div className="reports-grid">
                <div className="report-item">
                  <p className="report-label">
                    Same Day Covers
                  </p>

                  <h3 className="report-value">
                    {selectedHistoricalRecord
                      ?.same_day_covers ?? 0}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Walk-in Covers
                  </p>

                  <h3 className="report-value">
                    {selectedHistoricalRecord
                      ?.walk_in_covers ?? 0}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Advance Covers
                  </p>

                  <h3 className="report-value">
                    {selectedHistoricalRecord
                      ?.advance_covers ?? 0}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Average Duration
                  </p>

                  <h3 className="report-value">
                    {Math.round(
                      Number(
                        selectedHistoricalRecord
                          ?.avg_duration_covers_summary ||
                          0
                      )
                    )}{" "}
                    min
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Total Labour Cost
                  </p>

                  <h3 className="report-value">
                    {formatCurrency(
                      financialSummary.total_labour_cost
                    )}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Labour Cost Per Cover
                  </p>

                  <h3 className="report-value">
                    £
                    {selectedHistoricalRecord
                      ?.total_covers
                      ? (
                          Number(
                            financialSummary.total_labour_cost ||
                              0
                          ) /
                          Number(
                            selectedHistoricalRecord.total_covers ||
                              1
                          )
                        ).toFixed(2)
                      : "0.00"}
                  </h3>
                </div>
              </div>
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel-title">
                Food Revenue vs Labour Cost
                Comparison
              </h2>

              <div className="reports-grid">
                <div className="report-item">
                  <p className="report-label">
                    Estimated Food Revenue
                  </p>

                  <h3 className="report-value">
                    {formatCurrency(
                      financialSummary.estimated_food_revenue
                    )}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Total Labour Cost
                  </p>

                  <h3 className="report-value">
                    {formatCurrency(
                      financialSummary.total_labour_cost
                    )}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Revenue vs Labour Ratio
                  </p>

                  <h3 className="report-value">
                    {Number(
                      financialSummary.revenue_vs_labour_ratio ||
                        0
                    ).toFixed(2)}
                    x
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Gross Margin After Labour
                  </p>

                  <h3 className="report-value">
                    {formatCurrency(
                      financialSummary.gross_margin_after_labour
                    )}
                  </h3>
                </div>
              </div>
            </section>

            <section className="dashboard-bottom-grid">
              <section className="dashboard-panel">
                <BookingsTrend
                  data={weeklyData}
                />
              </section>

              <section className="dashboard-panel">
                <StaffingOverviewChart
                  data={historicalStaffData}
                />
              </section>
            </section>
          </>
        ) : selectedMode === "forecast" ? (
          <>
            <section className="dashboard-summary-grid">
              <SummaryCard
                title="Selected Date"
                value={formatDateDDMMYYYY(
                  selectedDate
                )}
                description="Forecast day selected from the calendar."
              />

              <SummaryCard
                title="Predicted Covers"
                value={
                  selectedForecastRecord
                    ?.predicted_total_covers ?? 0
                }
                description="Random Forest prediction for the selected day."
              />

              <SummaryCard
                title="Main Booking Type"
                value={selectedForecastType}
                description="Largest input booking source used for the forecast."
              />

              <SummaryCard
                title="Estimated Staff Needed"
                value={getStaffFromCovers(
                  selectedForecastRecord
                    ?.predicted_total_covers || 0
                )}
                description="Recommended staff level based on forecast demand."
              />
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel-title">
                Monthly Operational Insights For the{" "}
                {formatDateDDMMYYYY(selectedDate)}
              </h2>

              <div className="reports-grid">
                <div className="report-item">
                  <p className="report-label">
                    Forecast Day
                  </p>

                  <h3 className="report-value">
                    {selectedForecastRecord
                      ?.day_of_week || "-"}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Predicted Total Covers
                  </p>

                  <h3 className="report-value">
                    {selectedForecastRecord
                      ?.predicted_total_covers ?? 0}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Same-day Covers Input
                  </p>

                  <h3 className="report-value">
                    {selectedForecastRecord
                      ?.input_features
                      ?.same_day_covers ?? 0}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Walk-in Covers Input
                  </p>

                  <h3 className="report-value">
                    {selectedForecastRecord
                      ?.input_features
                      ?.walk_in_covers ?? 0}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Advance Covers Input
                  </p>

                  <h3 className="report-value">
                    {selectedForecastRecord
                      ?.input_features
                      ?.advance_covers ?? 0}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Average Duration Input
                  </p>

                  <h3 className="report-value">
                    {Math.round(
                      Number(
                        selectedForecastRecord
                          ?.input_features
                          ?.avg_duration_covers_summary ||
                          0
                      )
                    )}{" "}
                    min
                  </h3>
                </div>
              </div>
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel-title">
                Food Revenue vs Labour Cost
                Comparison
              </h2>

              <div className="reports-grid">
                <div className="report-item">
                  <p className="report-label">
                    Estimated Food Revenue
                  </p>

                  <h3 className="report-value">
                    {formatCurrency(
                      financialSummary.estimated_food_revenue
                    )}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Total Labour Cost
                  </p>

                  <h3 className="report-value">
                    {formatCurrency(
                      financialSummary.total_labour_cost
                    )}
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Revenue vs Labour Ratio
                  </p>

                  <h3 className="report-value">
                    {Number(
                      financialSummary.revenue_vs_labour_ratio ||
                        0
                    ).toFixed(2)}
                    x
                  </h3>
                </div>

                <div className="report-item">
                  <p className="report-label">
                    Gross Margin After Labour
                  </p>

                  <h3 className="report-value">
                    {formatCurrency(
                      financialSummary.gross_margin_after_labour
                    )}
                  </h3>
                </div>
              </div>
            </section>

            <section className="dashboard-bottom-grid">
              <section className="dashboard-panel">
                <BookingsTrend
                  data={weeklyData}
                />
              </section>

              <section className="dashboard-panel">
                <StaffingOverviewChart
                  data={forecastStaffData}
                />
              </section>
            </section>
          </>
        ) : (
          <section className="dashboard-panel">
            <h2 className="dashboard-panel-title">
              No data for selected date
            </h2>

            <p className="dashboard-text">
              There is no historical or forecast
              record stored for{" "}
              {formatDateDDMMYYYY(selectedDate)}.
            </p>
          </section>
        )
      ) : (
        <>
          <section className="dashboard-summary-grid">
            <SummaryCard
              title="Predicted Covers"
              value={predictedCoversNext7Days}
              description="Expected covers for the next 7 forecast days."
            />

            <SummaryCard
              title="Staff Needed Tomorrow"
              value={staffNeededTomorrow}
              description="Estimated staffing level based on forecast demand."
            />

            <SummaryCard
              title="Peak Demand Day"
              value={peakDemandDay}
              description="Highest expected demand from the Random Forest forecast."
            />

            <SummaryCard
              title="Total Records"
              value={totalRecords}
              description="Operational demand records stored in the database."
            />
          </section>

          <section className="dashboard-panel">
            <h2 className="dashboard-panel-title">
              Latest Operational Snapshot
            </h2>

            <div className="reports-grid">
              <div className="report-item">
                <p className="report-label">
                  Latest Date
                </p>

                <h3 className="report-value">
                  {latestRecord.date
                    ? formatDateDDMMYYYY(
                        latestRecord.date
                      )
                    : "-"}
                </h3>
              </div>

              <div className="report-item">
                <p className="report-label">
                  Latest Total Covers
                </p>

                <h3 className="report-value">
                  {latestRecord.total_covers ?? "-"}
                </h3>
              </div>

              <div className="report-item">
                <p className="report-label">
                  Average Total Covers
                </p>

                <h3 className="report-value">
                  {Math.round(
                    Number(
                      summary.avg_total_covers || 0
                    )
                  )}
                </h3>
              </div>

              <div className="report-item">
                <p className="report-label">
                  Average Duration
                </p>

                <h3 className="report-value">
                  {Math.round(
                    Number(
                      summary.avg_duration_covers_summary ||
                        0
                    )
                  )}{" "}
                  min
                </h3>
              </div>
            </div>
          </section>

          <section className="dashboard-panel">
            <h2 className="dashboard-panel-title">
              Food Revenue vs Labour Cost
              Comparison
            </h2>

            <div className="reports-grid">
              <div className="report-item">
                <p className="report-label">
                  Estimated Food Revenue
                </p>

                <h3 className="report-value">
                  {formatCurrency(
                    financialSummary.estimated_food_revenue
                  )}
                </h3>
              </div>

              <div className="report-item">
                <p className="report-label">
                  Total Labour Cost
                </p>

                <h3 className="report-value">
                  {formatCurrency(
                    financialSummary.total_labour_cost
                  )}
                </h3>
              </div>

              <div className="report-item">
                <p className="report-label">
                  Revenue vs Labour Cost Ratio
                </p>

                <h3 className="report-value">
                  {Number(
                    financialSummary.revenue_vs_labour_ratio ||
                      0
                  ).toFixed(2)}
                  x
                </h3>
              </div>

              <div className="report-item">
                <p className="report-label">
                  Gross Margin After Labour
                </p>

                <h3 className="report-value">
                  {formatCurrency(
                    financialSummary.gross_margin_after_labour
                  )}
                </h3>
              </div>
            </div>
          </section>

          <section className="dashboard-bottom-grid">
            <section className="dashboard-panel">
              <BookingsTrend data={weeklyData} />
            </section>

            <section className="dashboard-panel">
              <StaffingOverviewChart
                data={weeklyStaffingData}
              />
            </section>
          </section>
        </>
      )}
    </>
  );
}


// Export the component through a parent Suspense boundary.
export default function DashboardContent({ user }) {
  return (
    <Suspense
      fallback={
        <p className="dashboard-text">
          Loading dashboard data...
        </p>
      }
    >
      <DashboardContentInner user={user} />
    </Suspense>
  );
}