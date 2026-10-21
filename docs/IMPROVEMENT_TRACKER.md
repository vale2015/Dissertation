# Dissertation architecture improvement tracker

This is the project's canonical living improvement backlog, seeded from the original 50-item architecture plan in this chat. Keep the original numbers and order so that “continue with the improvements” has an unambiguous meaning; append any new improvements with new numbers. Any focused improvement lists also live in `docs/` and are indexed in [README.md](README.md). Last reviewed: 2026-10-21.

## How to use this file

1. Read this backlog before starting **every** project improvement. Take the first unfinished item unless the user chooses a different one; add new improvement requests here before implementing them.
2. Before committing, tell the user exactly what changed and what remains unverified, as requested in this project chat.
3. In the same work session, update the item with the commit, test, database, and deployment evidence. Mark it **Done** as soon as its acceptance criteria are verified; otherwise leave its accurate unfinished status. Do not start another backlog item until this update is made.
4. Keep database, GitHub, and Vercel states separate. A migration applied to Supabase does not prove the app was deployed; a Git push does not prove the migration was applied.
5. If an item is intentionally skipped or no longer fits the product, mark it **Deferred** with the reason rather than deleting it.

Status key: **Done** = acceptance criteria verified; **Verify release** = implementation committed but live behaviour not yet verified; **Partial** = some work done, acceptance criteria unmet; **Open** = original item remains on the roadmap.

## Current position

- **Done:** 1–2.
- **Partial:** 3–4.
- **Verify release:** 5.
- **Open:** 6–50 (45 items).
- **Next implementation item:** 6, after checking the release status of 5 and deciding whether to finish 3–4 first.

## Phase 1 — Data correctness and security

- [x] **1. Make booking and demand updates atomic — Done.** Booking mutation and daily-demand rebuild now share one transaction. Source commit `422a302`; production deployment was verified in the project chat.
- [x] **2. Prevent concurrent demand recalculation conflicts — Done.** Date-scoped transaction locks and a demand-date primary key are in place. Source commit `e561859`; the constraint was applied in Supabase. A reliable simultaneous-request live test was not established, so retain that as a testing gap under item 35.
- [ ] **3. Introduce complete database migrations — Partial.** A repository baseline and forward migrations were committed in `63bea97`, but the original baseline version `20260811000000` is not recorded as applied in the live migration history. Reconcile it with the Supabase CLI only after comparing live schema to baseline; verify a fresh reset and migration checks in CI.
- [ ] **4. Verify and restrict Supabase table access — Partial.** All 10 application tables have RLS enabled; `bookings` and `auth_rate_limits` deny `anon`/`authenticated` table access. The other eight still have grants to those roles, although no RLS policies currently expose rows. Review and revoke unnecessary table/sequence/function grants, prevent future auto-grants, and verify access as each role. Do not add client policies unless direct Data API use is intentionally required.
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
- [ ] **25. Remove network calls from critical report latency — Open.** Use cached optional enrichment, background large reports, private storage, and expiring downloads.
- [ ] **26. Add a report history feature — Open.** Persist report metadata/files, add a paginated Past reports screen, enforce access, and define retention.

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
