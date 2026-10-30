# Report history design

This is the implementation note for [improvement 26](IMPROVEMENT_TRACKER.md). It is not a separate backlog.

The protected API permits authorised report saves, but the current user-facing generation/save/download workflow is in the manager-only RFS AI assistant; the Reports page is view-only. Managers and supervisors with `view_reports` can read saved history. On save, the server recalculates a 7- or 10-day report rather than trusting browser-supplied figures, renders PDF and CSV once, and stores all three immutable representations in `public.report_history`. The existing on-demand report endpoints remain unchanged. The single-restaurant prototype shares saved reports among users with `view_reports`; the list records who saved each one. See the [PRD](PRD.md) for the approved product workflow.

The PostgreSQL table is private: RLS is enabled with no client policies, and `anon`/`authenticated`/`PUBLIC` table and sequence privileges are revoked in the same migration. Flask uses its existing server-side database connection and permission middleware. The API never includes file bytes in list responses. Files and JSON snapshots are capped at 256 KiB each because the current reports cover at most 10 days. A larger or higher-volume product should move bytes to private object storage, leaving only metadata and object keys in PostgreSQL.

History uses keyset pagination (20 reports per page). Saved reports are available for 90 days, after which every read treats them as absent. A bounded cleanup removes up to 100 expired records on each save or list request. This means physical deletion is traffic-driven, not an exact-time guarantee; a scheduled retention job is needed if a strict deletion deadline becomes a requirement.

Downloads require both the normal authenticated session and a link signed for the report ID, format, and requesting user. The link lasts five minutes and is requested only when the user clicks Download. Responses are `no-store`. Links are not reusable by a different user or for a different report/format.

## Release checks

1. Replay the migration in a fresh local Supabase stack and run the migration CI workflow. Confirm `supabase db push --dry-run` before applying it to the live project; [supabase/README.md](../supabase/README.md) records the current verification gate.
2. Apply the migration, confirm `report_history` has RLS and no `anon`/`authenticated` access, and run the backend test suite plus a real-database create/list/read/download test.
3. Deploy both applications, then verify an authorized save, pagination, stored snapshot, PDF/CSV downloads, unauthenticated/unauthorized denial, and expired-link/expired-report behavior in production.

## Release verification — 2026-10-23

Item 26 is **Done** in the [tracker](IMPROVEMENT_TRACKER.md). GitHub migration replay [run 39930072476](https://github.com/vale2015/Dissertation/actions/runs/39930072476) passed, and all 190 backend tests passed. Both production Vercel applications reached READY on the user's merged commit `5f01401`. The live Supabase migration was observed applied, with RLS and no client-role table or sequence DML grants. The authenticated production app saved, listed, reopened, and downloaded report snapshots; stored PDF/CSV bytes were confirmed. A 21-row history exercised pagination, and an expired record disappeared and was cleaned up. Signed-out access and an invalid download token were denied. Nineteen temporary pagination records were removed, leaving two manager-saved demo reports. Time-based link expiry and role-specific denial passed automated tests but were not repeated with a live wait or staff login. The official local Supabase-stack reset and project-wide future-object default-grant check remain tracked separately under items 3 and 4.
