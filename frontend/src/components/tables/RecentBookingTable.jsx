"use client";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";

export default function RecentBookingTable({ bookings = [] }) {
  return (
    <div className="booking-table-wrapper">
      <table className="booking-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Covers</th>
            <th>Booking Type</th>
            <th>Avg Duration</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {bookings.length ? (
            bookings.map((booking) => (
              <tr key={booking.id}>
                <td>{formatDateDDMMYYYY(booking.date)}</td>
                <td>{booking.covers}</td>
                <td>{booking.type}</td>
                <td>{booking.duration}</td>
                <td>
                  <span
                    className={`booking-status ${booking.status
                      .toLowerCase()
                      .replace("-", "")}`}
                  >
                    {booking.status}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5">No recent booking data available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}