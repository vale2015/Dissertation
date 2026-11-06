import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDateDDMMYYYY } from "./DateFormat.js";

test("date-only calendar values do not shift in western timezones", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    assert.equal(formatDateDDMMYYYY("2026-11-10"), "10-11-2026");
    assert.equal(formatDateDDMMYYYY("2026-02-30"), "2026-02-30");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
