import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReportFacts,
  generateReportExplanation,
  validateExplanation,
} from "./report-ai.mjs";

const report = {
  metadata: { start_date: "2026-10-24", end_date: "2026-10-30", currency: "GBP" },
  summary: {
    forecasted_covers: 245,
    average_daily_covers: 35,
    peak_date: "2026-10-25",
    peak_covers: 48,
    quietest_open_date: "2026-10-27",
    quietest_open_day_covers: 21,
    total_staff_assignments: 82,
  },
  financials: {
    estimated_revenue: 7350,
    estimated_labour_cost: 2625,
    estimated_contribution_after_food_and_labour: 3010,
    labour_to_revenue_percentage: 35.71,
  },
  data_sources: { weather: { available: false }, events: { available: true } },
  customer_name: "Must never reach the model",
  notes: "private booking note",
};

test("sends only allowlisted aggregate facts, not report personal data", () => {
  const facts = buildReportFacts(report);
  const text = JSON.stringify(facts);
  assert.match(text, /245 covers/);
  assert.match(text, /Weather context/);
  assert.doesNotMatch(text, /Must never reach|private booking note/);
  assert.equal(facts.length, 10);
  assert.equal(facts.find((fact) => fact.id === "estimated_revenue").value, "£7,350.00");
});

test("financial evidence follows the saved report currency", () => {
  const facts = buildReportFacts({ ...report, metadata: { currency: "EUR" } });
  assert.match(facts.find((fact) => fact.id === "estimated_revenue").value, /€7,350\.00/);
});

test("rejects invented evidence, repeated evidence, figures, and links", () => {
  const facts = buildReportFacts(report);
  const observation = (fact_id, interpretation = "This may need a manager review.") => ({
    fact_id,
    interpretation,
    manager_check: "Check the roster against expected demand.",
  });

  assert.throws(() => validateExplanation({ observations: [observation("made_up")] }, facts));
  assert.throws(() => validateExplanation({ observations: [
    observation("forecast_covers"), observation("forecast_covers"),
  ] }, facts));
  assert.throws(() => validateExplanation({ observations: [
    observation("forecast_covers", "Demand will be 999 covers."),
  ] }, facts));
  assert.throws(() => validateExplanation({ observations: [
    observation("forecast_covers", "Visit https://example.com for advice."),
  ] }, facts));
});

test("returns model text paired with exact saved-report evidence", async () => {
  let request;
  const observations = await generateReportExplanation(report, "test/model", async (options) => {
    request = options;
    return { output: { observations: [{
      fact_id: "peak_day",
      interpretation: "Peak demand may require attention.",
      manager_check: "Check whether the current roster can cover the peak.",
    }] } };
  });

  assert.equal(request.model, "test/model");
  assert.doesNotMatch(request.prompt, /Must never reach|private booking note/);
  assert.equal(observations[0].fact.value, "2026-10-25: 48 covers");
  assert.equal(observations[0].interpretation, "Peak demand may require attention.");
});
