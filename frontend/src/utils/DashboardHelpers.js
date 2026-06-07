// Converts different date formats into YYYY-MM-DD format.
export function normalizeDate(value) {
  if (!value) return "";

  const text = String(value).trim();
  // Keep the date if it is already in ISO format.
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return text;
  }
  // Convert DD/MM/YYYY into YYYY-MM-DD.
  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return "";
}

export function getStaffFromCovers(covers) {
  const total = Number(covers || 0);
  if (total <= 20) return 3;
  if (total <= 30) return 4;
  if (total <= 40) return 6;
  return 8;
}

export function getBookingTypeFromRecord(record) {
  if (!record) return "-";

  const advance = Number(record.advance_covers || 0);
  const walkIn = Number(record.walk_in_covers || 0);
  const sameDay = Number(record.same_day_covers || 0);

  const max = Math.max(advance, walkIn, sameDay);

  if (max === advance) return "Advance";
  if (max === walkIn) return "Walk-in";
  return "Same-day";
}

export function getBookingTypeFromForecastInput(inputFeatures) {
  if (!inputFeatures) return "-";

  const advance = Number(inputFeatures.advance_avg_7 || 0);
  const walkIn = Number(inputFeatures.walk_in_avg_7 || 0);
  const sameDay = Number(inputFeatures.same_day_avg_7 || 0);

  const max = Math.max(advance, walkIn, sameDay);

  if (max === advance) return "Advance";
  if (max === walkIn) return "Walk-in";
  return "Same-day";
}
// Builds the latest five booking records for dashboard display.
export function buildRecentBookings(allDemandData) {
  return [...allDemandData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)
    .map((item, index) => {
      let type = "Same-day";

      if (
        Number(item.advance_covers || 0) >= Number(item.walk_in_covers || 0) &&
        Number(item.advance_covers || 0) >= Number(item.same_day_covers || 0)
      ) {
        type = "Advance";
      } else if (
        Number(item.walk_in_covers || 0) >= Number(item.same_day_covers || 0)
      ) {
        type = "Walk-in";
      }

      return {
        id: index + 1,
        date: normalizeDate(item.date),
        covers: item.total_covers,
        type,
        duration: `${Math.round(item.avg_duration_covers_summary || 0)} min`,
        status: "Recorded",
      };
    });
}