"use client";
// dashboard main component showing welcome text and feature cards.
export default function DashboardMain({ user }) {
  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <h1 className="dashboard-title">Dashboard</h1>

        <p className="dashboard-text">
          Welcome{user?.full_name ? `, ${user.full_name}` : ""}.
        </p>

        <div className="dashboard-card-grid">
          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Reservations Forecast</h2>
            <p className="dashboard-card-text">
              View predicted covers based on booking data.
            </p>
          </div>

          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Staff Forecast</h2>
            <p className="dashboard-card-text">
              View staffing needs based on expected demand.
            </p>
          </div>

          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Bookings Overview</h2>
            <p className="dashboard-card-text">
              Monitor latest booking and demand information.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}