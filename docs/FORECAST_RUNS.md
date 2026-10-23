# Immutable forecast runs

This is the implementation note for [improvement 20](IMPROVEMENT_TRACKER.md), not a separate backlog.

The old staffing forecast deleted earlier rows for the same date whenever it regenerated. That erased the original recommendation and prevented a meaningful forecast-versus-actual comparison. The new design stores each complete prediction and its daily staffing rows under a unique run ID. A single-row pointer identifies the current run; the old runs remain readable for later accuracy analysis.

## Creation and activation

The backend first calculates a 7- or 10-day demand prediction. It rejects an incomplete forecast, a missing model fingerprint, invalid counts, or non-consecutive dates before opening a write transaction. In one transaction it inserts the run, all forecast days, and staffing rows, then switches the active pointer last. Missing staffing rules or required roles and any write error roll the transaction back, leaving the previous active run intact. Snapshot rows are protected against UPDATE and DELETE by database triggers. The model version is a SHA-256 fingerprint of the loaded model artifact.

The staffing page sends POST to create a run; generating a run is no longer a GET side effect. Existing read endpoints and the dashboard select only the active run. Before any new run exists, they continue to show legacy staffing rows. The new protected `GET /api/staff-cost/runs` and `GET /api/staff-cost/runs/<id>` endpoints expose the latest 20 runs and an individual stored prediction plus staffing rows. This supports the forecast-versus-actual work in item 21.

## Release gate

Do not call item 20 Done until the new migration replays successfully, the live Supabase privileges and snapshot immutability are checked, and the production staffing page creates and reads a complete run without losing an earlier run. Confirm the dashboard points at the new active run and an incomplete/failed run leaves the prior one active. The official local Supabase reset and the future-object default-grant issue remain separately tracked under items 3 and 4; this migration explicitly revokes client access from its new objects.

The page currently creates a new run on load or horizon change. A later UX increment can make generation explicit to avoid duplicate runs from refreshes, but no old run is overwritten by those duplicates.

## Verification state — 2026-10-23

Feature commit `82b43b7` passed all 197 backend tests, frontend lint and build, and [GitHub migration replay](https://github.com/vale2015/Dissertation/actions/runs/39935073350). A Supabase CLI dry-run showed only this migration pending; the CLI then applied it. Read-only live checks confirmed all 212 legacy staffing rows remain, all three new tables have RLS, all three immutability triggers exist, and client roles have no table, sequence, or trigger-function access. No forecast run was created by the preview attempt.

Both Vercel previews built, but the frontend preview's backend proxy targeted the old production backend, so the new run request returned an HTML 404 rather than reaching the new backend preview. The user declined a protected-preview access link and authorized production-first verification. [PR #3](https://github.com/vale2015/Dissertation/pull/3) was already merged as `f89a0ba`; both frontend and backend production deployments reached READY on that SHA. The PR's [migration replay](https://github.com/vale2015/Dissertation/actions/runs/39936121162) passed. A second local run passed all 197 backend tests, frontend lint with zero errors (one pre-existing warning), and a webpack production build.

In production, the public demo manager account created run #1 for seven days and run #2 for ten days. The staffing page displayed each saved ID and complete forecast; the protected list/detail endpoints returned both snapshots with only #2 active. Read-only database checks found 7 and 10 forecast-day rows, 24 and 32 staffing rows respectively, the active pointer at #2, and all 212 legacy staffing rows untouched. The dashboard's £4,948.99 labour-cost total matched the active ten-day run. Signed-out access to the run list was denied. RLS remained enabled on the three new tables with no `anon` or `authenticated` table privileges; the last-hour frontend/backend runtime-error scan was clean. Transaction rollback and snapshot immutability were verified in automated tests and migration replay, not by inducing a destructive production failure. The two demo runs remain stored as immutable verification evidence. Item 20 is **Done**.
