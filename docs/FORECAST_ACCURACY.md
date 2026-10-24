# Forecast accuracy (improvement 21)

This is an implementation note for [tracker item 21](IMPROVEMENT_TRACKER.md), not a second backlog. Status: **Verify release** as of 2026-10-24. The feature is merged and both production services are READY, but a real completed-service comparison and authenticated production flow have not yet been verified.

## What is measured

The existing `forecast_runs` and `forecast_run_days` tables retain the original prediction. The accuracy query takes the **earliest eligible run for each service date**, ordered by generation time and run ID. A run is eligible only if it was saved before midnight at the beginning of that date in `Europe/London` and marked the day open. This prevents post-service or closed-day forecasts from appearing accurate through hindsight. Future and current service dates are excluded.

Booking totals in `restaurant_demand_features` are not assumed to be guests served. The restaurant has no POS integration, so a manager or supervisor manually records the actual served covers after a completed service in `service_actual_covers`. A correction requires a reason; `service_actual_corrections` retains the previous and new numbers, actor, and timestamp. There is no automatic import or synthetic backfill. A day without a recorded actual is explicitly shown as awaiting entry.

The protected `GET /api/staff-cost/accuracy?days=30|90|180` endpoint returns eligible daily comparisons, summary metrics, and weekday/forecast-lead segments. `POST /api/staff-cost/actuals` records the first actual; `PATCH /api/staff-cost/actuals/<date>` corrects one. The read uses `view_forecasts`; writes also require `manage_bookings`. Next.js forwards the authenticated cookie to Flask via the existing protected API proxy. New tables have RLS enabled and explicitly revoke `anon` and `authenticated` Data API privileges.

MAE is the average absolute difference in covers. Mean bias is forecast minus actual, so a positive number means overprediction. MAPE excludes zero-actual days to avoid division by zero; those days still count toward MAE and bias. The UI shows sample counts and the number of zero-actual days excluded from MAPE. A 14-day recent-error chart and daily comparison table expose trends, with weekday and lead-day breakdowns.

## Release and verification gate

Local evidence: all 202 backend tests passed; frontend lint passed (one pre-existing warning); an isolated webpack production build passed and included `/dashboard/forecast-accuracy`. A read-only `EXPLAIN` against the live forecast tables accepted the pre-service query and used `forecast_run_days_date_idx`. The normal `.next` build path was blocked by a OneDrive file-lock error, so a temporary alternate output directory was used and then removed; no build-config change remains. The migration enforces the same numeric bounds as the API and makes correction history immutable. [GitHub migration replay 40077356251](https://github.com/vale2015/Dissertation/actions/runs/40077356251) passed all PostgreSQL 17 schema, privilege, and immutability checks.

The feature commit `f0a0438` was pushed on `codex/forecast-accuracy`; [PR #4](https://github.com/vale2015/Dissertation/pull/4) was subsequently merged into `main` as `454a42e` by another actor. The new migration version also appeared in Supabase without this session applying it. Read-only verification found the expected tables, bounds, indexes, trigger, RLS enabled, no `anon`/`authenticated` table read, sequence usage, or trigger-function execution, and zero actual/correction rows. Vercel production frontend `dpl_CKqD3n1u3AEbuQnY9hhiqAsP5Du9` and backend `dpl_CxPbB8qMQRMwZ84z3rqTurFeXyDr` both reached READY on `454a42e`; neither project had a runtime error in the one-hour scan. A READY deployment is not an end-to-end test.

A read-only live check on 2026-10-24 found the existing saved forecast dates run from **2026-11-30 through 2026-12-09**, with zero eligible completed open-day rows. The page therefore cannot display a genuine live accuracy metric yet. Do not backdate a forecast or substitute bookings for served covers to manufacture a verification sample.

The signed-out production page and `GET /api/backend/staff-cost/accuracy` both returned “Authentication required” on 2026-10-24. Before marking Done: verify authenticated read, manager/supervisor record and correction, staff-role denial, no duplicate actuals, live metrics, and a completed service with a genuinely pre-service forecast. Keep deployment and database state separate. Until then, the feature is **Verify release**, not Done.
