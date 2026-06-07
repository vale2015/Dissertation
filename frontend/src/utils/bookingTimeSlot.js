// Generates booking time slots in 15-minute intervals.
export function generateBookingTimeSlots() {
  const slots = [];
// Create time slots from 12:00 to 21:45.
  for (let hour = 12; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const formattedHour = String(hour).padStart(2, "0");
      const formattedMinute = String(minute).padStart(2, "0");
      slots.push(`${formattedHour}:${formattedMinute}`);
    }
  }
// Add the final available booking time.
  slots.push("22:00");

  return slots;
}