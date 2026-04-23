export function generateBookingTimeSlots() {
  const slots = [];

  for (let hour = 12; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const formattedHour = String(hour).padStart(2, "0");
      const formattedMinute = String(minute).padStart(2, "0");
      slots.push(`${formattedHour}:${formattedMinute}`);
    }
  }

  slots.push("22:00");

  return slots;
}