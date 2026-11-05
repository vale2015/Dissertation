"use client";

import { generateBookingTimeSlots } from "@/utils/bookingTimeSlot";

export default function AddNewBooking({
  formData = {
    booking_date: "", booking_time: "", party_size: "", booking_type: "",
    customer_name: "", notes: "",
  },
  loading = false,
  successMessage = "",
  errorMessage = "",
  onChange = () => {},
  onSubmit = () => {},
  onCancel = () => {},
}) {
  const bookingTimes = generateBookingTimeSlots();
  const isSelectedMonday = formData.booking_date
    ? new Date(`${formData.booking_date}T00:00:00`).getDay() === 1
    : false;

  return (
    <div className="rfs-booking-page">
      <header className="rfs-booking-header">
        <p className="rfs-booking-kicker">Bookings / New booking</p>
        <h1>Add booking</h1>
        <p>Record a booking and update the daily demand totals used for planning.</p>
      </header>

      <form className="rfs-booking-form" onSubmit={onSubmit}>
        <section className="rfs-booking-section" aria-labelledby="booking-service-heading">
          <div className="rfs-booking-section-heading">
            <div>
              <h2 id="booking-service-heading">Service details</h2>
              <p>When the party is coming and how many guests to expect.</p>
            </div>
            <span className="rfs-booking-required-note">All fields required</span>
          </div>
          <div className="rfs-booking-grid">
            <div className="rfs-booking-field">
              <label htmlFor="booking_date">Booking date <span aria-hidden="true">*</span></label>
              <input id="booking_date" name="booking_date" type="date" value={formData.booking_date} onChange={onChange} aria-invalid={isSelectedMonday} aria-describedby={isSelectedMonday ? "booking-date-warning" : undefined} required />
              {isSelectedMonday && <p id="booking-date-warning" className="rfs-booking-warning">The restaurant is closed on Mondays. Choose another date.</p>}
            </div>
            <div className="rfs-booking-field">
              <label htmlFor="booking_time">Booking time <span aria-hidden="true">*</span></label>
              <select id="booking_time" name="booking_time" value={formData.booking_time} onChange={onChange} required>
                <option value="">Select a time</option>
                {bookingTimes.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div className="rfs-booking-field">
              <label htmlFor="party_size">Party size <span aria-hidden="true">*</span></label>
              <input id="party_size" name="party_size" type="number" min="1" step="1" inputMode="numeric" placeholder="Number of guests" value={formData.party_size} onChange={onChange} required />
            </div>
            <div className="rfs-booking-field">
              <label htmlFor="booking_type">Booking type <span aria-hidden="true">*</span></label>
              <select id="booking_type" name="booking_type" value={formData.booking_type} onChange={onChange} required>
                <option value="">Select a type</option>
                <option value="advance">Advance</option>
                <option value="same_day">Same-day</option>
                <option value="walk_in">Walk-in</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rfs-booking-section" aria-labelledby="booking-guest-heading">
          <div className="rfs-booking-section-heading">
            <div>
              <h2 id="booking-guest-heading">Guest details</h2>
              <p>Helpful for service, but not required to record demand.</p>
            </div>
            <span className="rfs-booking-optional-note">Optional</span>
          </div>
          <div className="rfs-booking-grid">
            <div className="rfs-booking-field rfs-booking-field-full">
              <label htmlFor="customer_name">Customer name <span className="rfs-booking-optional-label">Optional</span></label>
              <input id="customer_name" name="customer_name" type="text" maxLength="100" autoComplete="off" placeholder="Name for the reservation" value={formData.customer_name} onChange={onChange} />
            </div>
            <div className="rfs-booking-field rfs-booking-field-full">
              <label htmlFor="notes">Notes <span className="rfs-booking-optional-label">Optional</span></label>
              <textarea id="notes" name="notes" maxLength="500" rows="3" placeholder="Service notes, if needed" value={formData.notes} onChange={onChange} />
              <p className="rfs-booking-field-hint">Only add details needed to prepare this booking.</p>
            </div>
          </div>
        </section>

        {(errorMessage || successMessage) && <div className={`rfs-booking-feedback ${errorMessage ? "rfs-booking-feedback-error" : "rfs-booking-feedback-success"}`} role={errorMessage ? "alert" : "status"}>
          {errorMessage || successMessage}
        </div>}
        <div className="rfs-booking-actions">
          <button type="button" className="rfs-booking-cancel" onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="submit" className="rfs-booking-submit" disabled={loading || isSelectedMonday}>{loading ? "Saving booking…" : "Save booking"}</button>
        </div>
      </form>
    </div>
  );
}
