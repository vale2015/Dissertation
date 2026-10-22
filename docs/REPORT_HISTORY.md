# Report history design

This is the implementation note for [improvement 26](IMPROVEMENT_TRACKER.md). It is not a separate backlog.

Managers and supervisors with `view_reports` can explicitly save a 7- or 10-day management report. The server recalculates the report rather than trusting browser-supplied figures, renders PDF and CSV once, and stores all three immutable representations in `public.report_history`. The existing on-demand report endpoints remain unchanged. The single-restaurant prototype shares saved reports among users with `view_reports`; the list records who saved each one.

The PostgreSQL table is private: RLS is enabled with no client policies, and `anon`/`authenticated`/`PUBLIC` table and sequence privileges are revoked in the same migration. Flask uses its existing server-side database connection and permission middleware. The API never includes file bytes in list responses. Files and JSON snapshots are capped at 256 KiB each because the current reports cover at most 10 days. A larger or higher-volume product should move bytes to private object storage, leaving only metadata and object keys in PostgreSQL.

History uses keyset pagination (20 reports per page). Saved reports are available for 90 days, after which every read treats them as absent. A bounded cleanup removes up to 100 expired records on each save or list request. This means physical deletion is traffic-driven, not an exact-time guarantee; a scheduled retention job is needed if a strict deletion deadline becomes a requirement.

Downloads require both the normal authenticated session and a link signed for the report ID, format, and requesting user. The link lasts five minutes and is requested only when the user clicks Download. Responses are `no-store`. Links are not reusable by a different user or for a different report/format.

## Release checks

1. Replay the migration in a fresh local Supabase stack and run the migration CI workflow. Confirm `supabase db push --dry-run` before applying it to the live project; [supabase/README.md](../supabase/README.md) records the current verification gate.
2. Apply the migration, confirm `report_history` has RLS and no `anon`/`authenticated` access, and run the backend test suite plus a real-database create/list/read/download test.
3. Deploy both applications, then verify an authorized save, pagination, stored snapshot, PDF/CSV downloads, unauthenticated/unauthorized denial, and expired-link/expired-report behavior in production. Keep item 26 **Partial** until those checks pass.
