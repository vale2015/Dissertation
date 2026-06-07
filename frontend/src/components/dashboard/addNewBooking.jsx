"use client";

import { generateBookingTimeSlots } from "@/utils/bookingTimeSlot";
// Form component used to create a new restaurant booking.
export default function AddNewBooking({
  formData = {
    booking_date: "",
    booking_time: "",
    party_size: "",
    booking_type: "advance",
    customer_name: "",
    notes: "",
  },
  loading = false,
  successMessage = "",
  errorMessage = "",
  onChange = () => {},
  onSubmit = () => {},
  onCancel = () => {},
}) {// Generate the available booking time options.
  const bookingTimes = generateBookingTimeSlots();
// Check if the selected date is Monday, when the restaurant is closed.
  const isSelectedMonday = formData.booking_date
    ? new Date(`${formData.booking_date}T00:00:00`).getDay() === 1
    : false;

  return (
    <>
      <section className="booking-page-header">
        <h1 className="booking-form-title">Add New Booking</h1>
        <p className="booking-form-text">
          Create a new manager booking and sync it to the forecasting dataset.
        </p>
      </section>

      <section className="booking-form-card">
        <form className="booking-form-grid" onSubmit={onSubmit}>
          <div className="booking-field booking-field-full">
            <label className="booking-label" htmlFor="customer_name">
              Customer Name
            </label>
            <input
              id="customer_name"
              name="customer_name"
              type="text"
              className="booking-input"
              placeholder="Enter customer name"
              value={formData.customer_name}
              onChange={onChange}
              required
            />
          </div>

          <div className="booking-field">
            <label className="booking-label" htmlFor="booking_date">
              Booking Date
            </label>
            <input
              id="booking_date"
              name="booking_date"
              type="date"
              className="booking-input"
              value={formData.booking_date}
              onChange={onChange}
              required
            />
{/* Show a warning if the user selects Monday. */}
            {isSelectedMonday && (
              <p className="booking-helper-text">
                Monday bookings are not allowed because the restaurant is closed.
              </p>
            )}
          </div>

          <div className="booking-field">
            <label className="booking-label" htmlFor="booking_time">
              Booking Time
            </label>
            <select
              id="booking_time"
              name="booking_time"
              className="booking-input booking-select"
              value={formData.booking_time}
              onChange={onChange}
              required
            >
              <option value="">Select booking time</option>
              {bookingTimes.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>

          <div className="booking-field">
            <label className="booking-label" htmlFor="party_size">
              Party Size
            </label>
            <input
              id="party_size"
              name="party_size"
              type="number"
              min="1"
              className="booking-input"
              placeholder="Enter number of guests"
              value={formData.party_size}
              onChange={onChange}
              required
            />
          </div>

          <div className="booking-field">
            <label className="booking-label" htmlFor="booking_type">
              Booking Type
            </label>
            <select
              id="booking_type"
              name="booking_type"
              className="booking-input booking-select"
              value={formData.booking_type}
              onChange={onChange}
            >
              <option value="advance">Advance</option>
              <option value="same_day">Same-day</option>
              <option value="walk_in">Walk-in</option>
            </select>
          </div>

          <div className="booking-field booking-field-full">
            <label className="booking-label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              className="booking-textarea"
              placeholder="Add booking notes"
              value={formData.notes}
              onChange={onChange}
            />
          </div>

          {errorMessage && (
            <div className="booking-message booking-message-error booking-field-full">
              {errorMessage}
            </div>
          )}
{/* Display success feedback after a booking is added. */}
          {successMessage && (
            <div className="booking-message booking-message-success booking-field-full">
              {successMessage}
            </div>
          )}

          <div className="booking-actions">
            <button
              type="button"
              className="booking-cancel-button"
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="booking-submit-button"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add New Booking"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}