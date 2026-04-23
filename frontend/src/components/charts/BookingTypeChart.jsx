"use client";

export default function BookingTypeChart({
  sameDay = 0,
  walkIn = 0,
  advance = 0,
}) {
  const safeSameDay = Number(sameDay || 0);
  const safeWalkIn = Number(walkIn || 0);
  const safeAdvance = Number(advance || 0);

  const total = safeSameDay + safeWalkIn + safeAdvance;

  const items = [
    {
      label: "Same-day",
      value: safeSameDay,
      width: total > 0 ? `${(safeSameDay / total) * 100}%` : "0%",
      modifier: "same-day",
    },
    {
      label: "Walk-in",
      value: safeWalkIn,
      width: total > 0 ? `${(safeWalkIn / total) * 100}%` : "0%",
      modifier: "walk-in",
    },
    {
      label: "Advance",
      value: safeAdvance,
      width: total > 0 ? `${(safeAdvance / total) * 100}%` : "0%",
      modifier: "advance",
    },
  ];

  return (
    <>
      <div className="dashboard-chart-header">
        <div>
          <h3 className="dashboard-panel-title">Booking Type Mix</h3>
          <p className="dashboard-chart-subtitle">
            Overview of booking sources
          </p>
        </div>
      </div>

      <div className="booking-type-chart">
        <div className="booking-type-bars">
          {items.map((item) => (
            <div key={item.label} className="booking-type-row">
              <div className="booking-type-row-top">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>

              <div className="booking-type-track">
                <div
                  className={`booking-type-fill ${item.modifier}`}
                  style={{ width: item.width }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}