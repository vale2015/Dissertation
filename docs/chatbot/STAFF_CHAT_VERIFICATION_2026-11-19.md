# #54 staff conversation verification

19 November 2026. Status: **Partial / Trello IN PROGRESS**. The PM chose to keep live model verification blocked for now. Do not mark Done or remove Staff Management navigation.

## Current publication

- GitHub main is c2efc072addb68423c7d3876cfed19659dcfa9c9, merged through PR #21. Its application tree matches tested diagnostic source a6304f7.
- Frontend production dpl_5Jk9Wp2GSdJi8YPmh53wkYhVrGwP and backend production dpl_GwsrMFdx1sEfwcEa6EtgRQ3vR7K1 are Ready on that SHA, with the normal production aliases attached.
- Root pushed review branches only; the main merges were observed and reconciled separately. No manual deployment or new schema application was performed.
- Supabase already records migration 20261112120000. Its nine stored statements match reviewed SQL after formatting normalization; columns, constraints and indexes match, RLS is enabled and anon/authenticated table privileges are denied. Do not apply it again.

## Verification

| Area | Actual evidence | Limit |
| --- | --- | --- |
| Backend suite | Current-main CI: 262 passed, 7 intentionally isolated database cases skipped. | Windows Python failed before collection because Application Control blocks a native dependency; it was not bypassed. |
| PostgreSQL 17 | Dedicated CI job: 16 passed, zero skipped. Two real sessions concurrently confirmed registration/editing with one audited operation and stable receipts. Stale edits, real rollback/retry, actor and ownership denial passed. | Disposable CI database, not a production race test. |
| Frontend regression | Current released source: 31 unit, 95 component and 14 API tests passed; targeted lint passed. | Prior full lint has one existing warning. Build readiness is separate from live behavior. |
| Independent review | Separate QA, security, frontend AI evaluation and diagnostic QA passed their recorded scopes. The name-length, private-history and keyboard findings were fixed and independently retested. | Live inference remains failed/on hold; no full product acceptance. |
| Privacy | Punctuated, contracted, mixed and credential-bearing account requests enter private clarification. Tests prove no generic transcript/API or secret lookup/draft import for the tested cases. Provider input is fixed task vocabulary. | Bounded tested language cases, not unlimited natural-language recognition. |
| Registration | Manager registered the two approved temporary accounts inside chat, with secure password fields, exact review, explicit confirmation and verified result. Invalid name, mismatched password and duplicate email were rejected; correction succeeded. | No real staff account was modified. |
| Editing | Exact identity disambiguation, before/after name and application/restaurant-role edits passed. Missing required restaurant role was rejected and corrected. Email/password remained separate. | Last-manager and cross-actor destructive cases were tested safely in source/isolated CI. |
| Recovery/retries | Refresh recovered a completed receipt. Two password-free retries per registration and the first edit returned identical saved receipts. Five completed live QA actions each have one audit entry. | Live retries were sequential; actual concurrent confirmation is covered in PostgreSQL CI. |
| Permissions | Real supervisor and staff sessions hide assistant/staff navigation and deny direct assistant API, staff-action API and recovery page. Manager can access the new protected endpoints. | All-method denial is additionally covered by API tests. |
| Desktop/narrow UX | Keyboard choices, edit input, role/match choices, secure confirmation/result and Cancel/Finish focus passed. Actual 320px viewport review/secure fields, duplicate feedback/cancellation and a successful edit of an inactive QA account passed. | Browser viewport testing, not physical-device certification; the narrow registration attempt intentionally reused an existing email. |
| Other controls | Protected in-chat workspace exposes search, filters and edit/status/reset controls. | No real-user status or password was changed. |
| Reports | Calendar ten-day and typed seven-day generation passed. Fresh CSV/PDF and saved CSV downloads passed. Approved saved reports 23/24 retain seven/ten days; the ten-day CSV contains ten dates through 2026-12-09. | Exactly two approved saved test records remain under normal retention. PDF download/header checked; no new PDF-layout claim. |
| Cleanup | QA accounts 6/8 are inactive/session_version2; old4/5 remain inactive2. Prior staff session is rejected after reload. Only two new QA accounts were created, two cancelled drafts are cleared and no manager draft remains. | Audit/history records intentionally remain. Random QA passwords were not saved in files or chat. |
| Production smoke | All 12 read-only health/authentication/initialization/cleanup/report checks passed on current production aliases. | No production inference request or operational write in that smoke test. |

## Model blocker

The latest harmless request on a6304f7 returned **HTTP401 / Cloudflare10000**. Safe logs confirm expected account-ID shape and no surrounding whitespace or quotes. The SDK Bearer header/base URL match current official documentation. The PM confirms the account, token and Read/Edit permissions match and explicitly chose to keep model verification blocked.

The reviewed diagnostics log only category, bounded status, up to five numeric error codes and format booleans; raw messages/bodies/headers/URLs/input/credential values are excluded. Public responses remain category-only. Parsing is bounded to 16,384 UTF-16 code units. No stored credential, model or paid plan was changed, and no token was tool-decrypted.

Do not retry unchanged authentication or request credentials in chat. Resume after a deliberate credential/configuration change and a new build, then obtain final independent release review/PM acceptance before sidebar removal and Done.

## Evidence

- [Current-main backend/PostgreSQL checks](https://github.com/vale2015/Dissertation/actions/runs/44573126364)
- [Published source / PR #21](https://github.com/vale2015/Dissertation/pull/21)
- [Production frontend build](https://vercel.com/valeriogerardi-5538s-projects/dissertation/5Jk9Wp2GSdJi8YPmh53wkYhVrGwP)
- [Production backend build](https://vercel.com/valeriogerardi-5538s-projects/dissertation-backend/GwsrMFdx1sEfwcEa6EtgRQ3vR7K1)
- [Staff acceptance criteria](STAFF_MANAGEMENT_CHAT_WORKFLOW.md)
- [Safe diagnostic implementation](MODEL_AUTH_DIAGNOSTICS.md)
