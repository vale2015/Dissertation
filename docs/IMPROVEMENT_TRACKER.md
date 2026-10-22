# Dissertation architecture improvement tracker

This is the project's canonical living improvement backlog, seeded from the original 50-item architecture plan in this chat. Keep the original numbers and order so that “continue with the improvements” has an unambiguous meaning; append any new improvements with new numbers. Any focused improvement lists also live in `docs/` and are indexed in [README.md](README.md). Last reviewed: 2026-10-22.

## How to use this file

1. Read this backlog and [MOSCOW_PRIORITIZATION.md](MOSCOW_PRIORITIZATION.md) before starting **every** project improvement. Select work by expected user/product value and necessary safety dependencies, not the lowest unfinished number, unless the user chooses a specific item. Add new improvement requests here before implementing them.
2. Before committing, tell the user exactly what changed and what remains unverified, as requested in this project chat.
3. In the same work session, update the item with the commit, test, database, and deployment evidence. Mark it **Done** as soon as its acceptance criteria are verified; otherwise leave its accurate unfinished status. Do not start another backlog item until this update is made.
4. Keep database, GitHub, and Vercel states separate. A migration applied to Supabase does not prove the app was deployed; a Git push does not prove the migration was applied.
5. If an item is intentionally skipped or no longer fits the product, mark it **Deferred** with the reason rather than deleting it.

Status key: **Done** = acceptance criteria verified; **Verify release** = implementation committed but live behaviour not yet verified; **Partial** = some work done, acceptance criteria unmet; **Open** = original item remains on the roadmap.

## Current position

- **Done:** 1–2.
- **Partial:** 3–4, 25.
- **Verify release:** 5.
- **Open:** 6–24 and 26–50 (44 items).
- **Selected work:** the user chose item 25 next, despite 3–5 remaining unfinished. Item 26 is the following manager-facing feature, then forecast evaluation (20–21). Complete the relevant Must security and verification gates before releasing those increments.

## MoSCoW priority

Priority is separate from implementation status. This provisional, **value-first** ranking assumes the current single-restaurant dissertation prototype and the goals in [PRD.md](PRD.md). It favors manager-facing benefits (retrieving past reports and measuring forecast quality) while retaining data protection and release checks as non-negotiable gates. The per-item rationale and recommended sequence are in [MOSCOW_PRIORITIZATION.md](MOSCOW_PRIORITIZATION.md). Keep original item numbers as stable identifiers; prioritize by value and dependency rather than number where they differ.

| Priority | Item numbers |
|---|---|
| **Must** | 1, 2, 3, 4, 5, 7, 8, 20, 21, 25, 26, 35, 37, 39, 41, 43 |
| **Should** | 6, 9, 10, 11, 12, 13, 15, 17, 18, 23, 29, 32, 33, 34, 36, 38, 40, 42, 45, 46, 47, 48, 49, 50 |
| **Could** | 14, 16, 19, 22, 24, 27, 30, 31, 44 |
| **Won't for now** | 28 |

**Done** items 1–2 remain Must because priority describes their importance, not whether they still need work. Revisit this ranking if manager research, usage data, a second restaurant, or release criteria change the expected value.

## Phase 1 — Data correctness and security

- [x] **1. Make booking and demand updates atomic — Done.** Booking mutation and daily-demand rebuild now share one transaction. Source commit `422a302`; production deployment was verified in the project chat.
- [x] **2. Prevent concurrent demand recalculation conflicts — Done.** Date-scoped transaction locks and a demand-date primary key are in place. Source commit `e561859`; the constraint was applied in Supabase. A reliable simultaneous-request live test was not established, so retain that as a testing gap under item 35.
- [ ] **3. Introduce complete database migrations — Partial.** A repository baseline and forward migrations were committed in `63bea97`. On 2026-10-22, all six files replayed successfully in disposable PGlite/PostgreSQL 17.5 and 18 databases; the normalized ten-table application-schema fingerprint matched the live PostgreSQL 17 project (`04d4ff8e7f049068d9f4acb0b4312c5f`). A conditional, history-only insert recorded the missing baseline `20260811000000` in live Supabase, and a subsequent read confirmed all six ordered versions; no application table or data was changed. The replay and live privilege checks confirmed server-only access for `bookings` and `auth_rate_limits`. A PostgreSQL 17 [migration replay workflow](../.github/workflows/migration-replay.yml) and [schema snapshot](../supabase/schema_snapshot.sql) were committed as `4365f46` and pushed to `codex/migration-replay-check`, but [GitHub Actions run 39799268212](https://github.com/vale2015/Dissertation/actions/runs/39799268212) failed before a runner started because GitHub reports the account is locked due to a billing issue. No passing CI run, official local Supabase reset, or CLI `db push --dry-run` has been observed. Keep Partial until those checks pass; see [supabase/README.md](../supabase/README.md).
- [ ] **4. Verify and restrict Supabase table access — Partial.** Migration [`20261022151002_restrict_public_application_access.sql`](../supabase/migrations/20261022151002_restrict_public_application_access.sql) was applied to the live Supabase project on 2026-10-22. It removed `anon`/`authenticated` grants from all 10 application tables and eight sequences, revoked client execution of the unused public trigger function, and removed client/PUBLIC grants from `postgres` default privileges. Live checks found zero effective client privileges on those objects; actual queries as both client roles returned permission denied (`42501`), while `postgres` and `service_role` retained access. A disposable PostgreSQL 17.5 replay passed with and without the historical function. On 2026-10-22, the read-only [`verify_access.sql`](../supabase/verify_access.sql) passed again against live Supabase. The app uses a direct server-side database connection, not Supabase's client Data API. **Remaining:** A fresh live default-ACL inspection confirmed that Supabase-managed `supabase_admin` still grants `anon` and `authenticated` access to new public tables, sequences, and functions. The connected `postgres` role cannot modify those defaults, and the available Supabase connector cannot change the project-level “Automatically expose new tables and functions” setting. Disable that setting in the Supabase dashboard (or use another supported project-level control), then verify a newly created public object has no client privileges. [Migration replay CI run 39804029501](https://github.com/vale2015/Dissertation/actions/runs/39804029501) was retried on 2026-10-22 but GitHub again stopped the job before a runner started because the account is locked due to a billing issue. Re-run it after billing is resolved. Do not mark Done until future-object exposure and the release check are verified. No Vercel deployment was involved.
- [ ] **5. Add login throttling and account protection — Verify release.** Shared counters, progressive email lockouts, token-endpoint throttling, generic login failure, and tests were committed in `8286e21`; the counter migration was applied in Supabase. Confirm frontend and backend production deployments, then safely smoke-test `429`/`Retry-After` and recovery. The app has no public reset-email request endpoint, so that original subtask is not applicable.
- [ ] **6. Standardize safe API errors — Open.** Add centralized Flask handlers and a consistent `{code, message, request_id}` response; keep internal details in logs and test that exceptions never leak.
- [ ] **7. Strengthen browser security headers — Open.** Review the existing Flask headers and cookie settings, add missing browser-facing Next.js headers and production HSTS, then verify pages and downloads.
- [ ] **8. Add API request limits and validation — Open.** Centralize body-size, date-range, field-length, numeric-boundary, and unknown-field rules with malformed-input tests.

## Phase 2 — Database and API scalability

- [ ] **9. Add pagination to list endpoints — Open.** Add bounded, stable cursor pagination for bookings, demand, and staff lists; update tables and contract tests.
- [ ] **10. Push filtering and aggregation into PostgreSQL — Open.** Replace full-table reads and Python-side range selection with selective SQL projections, range predicates, and aggregates; measure query plans.
- [ ] **11. Add the necessary database indexes — Open.** Profile actual booking, demand, settings, and forecast queries, then add only justified indexes as migrations.
- [ ] **12. Consolidate dashboard requests — Open.** Build a dashboard bootstrap response, remove duplicate sidebar fetching, lazy-load secondary data, and measure request count and load time.
- [ ] **13. Add frontend query caching and deduplication — Open.** Adopt one query-cache approach with stable keys, freshness rules, mutation invalidation, and shared loading states.
- [ ] **14. Reduce authentication database amplification — Open.** Measure repeated session lookups, then consider a short shared cache with prompt invalidation and fresh checks for sensitive actions.
- [ ] **15. Add timeouts and cancellation to the BFF — Open.** Bound backend fetches, propagate cancellation, use separate report deadlines, and test timeout responses.
- [ ] **16. Version the API — Open.** Define `/api/v1` contracts, compatibility/deprecation rules, and cross-service tests before changing routes.

## Phase 3 — Forecasting and machine-learning lifecycle

- [ ] **17. Move training out of web requests — Open.** Use a manager-only POST to enqueue one durable training job, expose status, and keep CPU work out of interactive requests.
- [ ] **18. Store model files in durable object storage — Open.** Save immutable model artifacts privately with checksums, metadata, an active pointer, and rollback support.
- [ ] **19. Add a model registry — Open.** Record model version, training window, features, parameters, metrics, creator, and active/retired state.
- [ ] **20. Create immutable forecast runs — Open.** Build and validate a complete run, then atomically activate it without deleting earlier runs.
- [ ] **21. Add prediction-versus-actual tracking — Open.** Preserve forecasts, compare with actual demand, segment accuracy, and expose trends.
- [ ] **22. Optimize prediction requests — Open.** Query only required history, cache a versioned model per warm instance, and measure cold/warm latency.

## Phase 4 — External integrations and reports

- [ ] **23. Replace instance-local provider caches — Open.** Add shared TTL caching, stale fallback, single-flight refresh, and hit/miss metrics for weather and events.
- [ ] **24. Fetch independent providers concurrently — Open.** Give each event provider an independent deadline, combine successful results, and guard repeated failures.
- [ ] **25. Remove network calls from critical report latency — Partial.** The cache-only weather/event report path is present in source commit `96d4ae1`: a miss is reported as unavailable and expired data is labelled stale in warnings. On 2026-10-22, generation/render measurements and safe duration logging were added for JSON, CSV, and PDF; the Next.js proxy forwards the `Server-Timing` header. Route-level tests reject any optional HTTP request in all three formats. All 178 backend tests, frontend lint (one unrelated warning), and a production webpack build passed locally. The normal Turbopack build stalled and was stopped; the first webpack build hit a Windows/OneDrive `EPERM` while writing `.next`, then passed with normal filesystem access. The current 7/10-day range is bounded, so there is no large-report mode requiring a background queue. Private retained files and expiring downloads belong to item 26; the current on-demand responses are authenticated and `no-store`. The instance-local optional cache is item 23. **Remaining:** push/release the timing and test changes, then measure real production report latency and verify the deployed JSON/PDF/CSV paths before marking Done. No Supabase migration or Vercel deployment was made for this increment.
- [ ] **26. Add a report history feature — Open.** Persist report metadata and files in private durable storage, add a paginated Past reports screen, enforce access, define retention, and provide expiring authenticated downloads. This is the storage/background-work boundary for reports that need retention or exceed the current 7/10-day synchronous range.

## Phase 5 — Multi-restaurant readiness

- [ ] **27. Make the tenancy decision explicit — Open.** Decide single-site versus multi-site; document the decision or add tenant-scoped schema, queries, caches, and tests before onboarding a second restaurant.
- [ ] **28. Separate global identity from restaurant membership — Open.** If multi-site is chosen, move restaurant roles to memberships and audit role/context changes.

## Phase 6 — Frontend maintainability

- [ ] **29. Create a shared dashboard layout — Open.** Move repeated shell/navigation into one layout while preserving authorization.
- [ ] **30. Break large frontend files into focused components — Open.** Separate page orchestration, data hooks, charts, tables, and forms without changing behaviour.
- [ ] **31. Introduce TypeScript incrementally — Open.** Type shared API contracts and migrate high-change frontend modules in manageable steps.
- [ ] **32. Add runtime response validation — Open.** Validate critical Flask responses at the Next.js boundary and handle schema mismatches safely.
- [ ] **33. Standardize loading, error and empty states — Open.** Create reusable UI patterns for pending, failed, empty, and stale data.
- [ ] **34. Improve accessibility — Open.** Audit keyboard flow, focus, labels, contrast, tables, and announcements; fix and test the findings.

## Phase 7 — Testing and delivery

- [ ] **35. Add real database integration tests — Open.** Run transaction, RLS/grant, and concurrent booking tests against disposable PostgreSQL/Supabase.
- [ ] **36. Add frontend component tests — Open.** Test key forms, tables, auth states, and accessibility behaviour.
- [ ] **37. Add end-to-end tests — Open.** Cover login, booking, forecast, report download, and access-control journeys in a browser.
- [ ] **38. Add API contract tests — Open.** Verify Next.js/Flask request and response compatibility in CI.
- [ ] **39. Repair dependency reproducibility — Open.** Pin/install backend and frontend dependencies consistently and verify clean-environment setup.
- [ ] **40. Remove the multiple-lockfile ambiguity — Open.** Select one package-root strategy and remove build-root warnings without discarding needed dependency locks.

## Phase 8 — Deployment and operations

- [ ] **41. Add continuous integration — Open.** Run lint, tests, builds, migration checks, and security checks on each change.
- [ ] **42. Make deployment configuration reproducible — Open.** Version safe Vercel configuration and environment templates; document secrets and promotion steps.
- [ ] **43. Add deployment smoke tests — Open.** Check health, auth, representative API calls, and report download after each deployment.
- [ ] **44. Align deployment regions — Open.** Measure cross-region latency and place frontend, backend, and database appropriately.
- [ ] **45. Create a safe rollback strategy — Open.** Define app rollback, backward-compatible migrations, database backup/restore, and model rollback procedures.

## Phase 9 — Observability and reliability

- [ ] **46. Add structured logging — Open.** Propagate request IDs and log safe, searchable fields without credentials or tokens.
- [ ] **47. Add centralized error monitoring — Open.** Capture backend/frontend failures with redaction, alerting, and release context.
- [ ] **48. Add technical and business metrics — Open.** Track latency, database load, provider health, cache effectiveness, forecast quality, and report duration.
- [ ] **49. Add health and readiness endpoints — Open.** Separate liveness from dependency readiness and test their deployment use.
- [ ] **50. Add provider circuit breakers — Open.** Stop repeatedly calling failing integrations, recover after cooldown, and preserve partial results.

## Verification notes

- 2026-10-21: `main` and `origin/main` both point to `8286e21`; the worktree was clean before this tracker was created.
- 2026-10-21: Supabase migration history contains the staff-account, demand-date, bookings-security, and auth-counter migrations, but not baseline `20260811000000`.
- 2026-10-21: Read-only privilege check found RLS enabled on all 10 application tables; eight retain `anon` and `authenticated` SELECT grants. RLS/grants are separate controls; see [Supabase's API security guide](https://supabase.com/docs/guides/api/securing-your-api).
- 2026-10-22: Read-only Supabase checks confirmed the live baseline migration is still absent from history and the seven original table shapes match the repository migration chain at the inspected catalog level. No production SQL or migration history was changed. CLI/Docker were unavailable for the required fresh reset and full diff.
- 2026-10-22: Report preview/export code now uses cache-only optional provider lookups; 172 local backend tests passed. This is not a shared cache or proof of production performance. Item 25 remains Partial.
- 2026-10-22: Item 3 live migration history was reconciled after PostgreSQL 17.5 and 18 isolated replays matched the live application schema. Verification commit `4365f46` was pushed only to `codex/migration-replay-check`; GitHub Actions could not start due to an account billing lock. Official Supabase-stack reset and CLI dry-run remain unverified. No Vercel deployment was made for this increment.
