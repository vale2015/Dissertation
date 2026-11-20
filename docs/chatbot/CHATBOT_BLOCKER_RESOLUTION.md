# Chatbot blocker-resolution plan

PM decision: **19 November 2026 — chatbot delivery takes precedence over every other project task.** Work sequentially through #65 → #66 → #67, under parent #54 and shared foundation #55. Only work necessary to deliver the chatbot safely may interrupt this queue. Other backlog statuses are preserved; this is a priority change, not a claim they are finished.

This is a QUICK planning/backlog update with focused self-checks. Executing the plan requires the existing FULL sequential implementation/independent QA/security/AI/UX gates where relevant. No provider requests, credential changes, new QA accounts, report saves or deployments are performed by this planning update. The PM resumed the configuration step on 20 November and fresh-preview inference passed; #66/#67 remain open. See [current verification](MODEL_VERIFICATION_2026-11-20.md).

## Ordered work packages

### 1. #65 — Restore Cloudflare authentication for the manager chatbot
**Done · Must · preview authentication verified 20 November 2026.** Parent #54; also unblocks #55.

- Use the recorded HTTP401 / Cloudflare10000 evidence; do not keep retrying unchanged settings.
- Configuration owner deliberately replaces or corrects the Workers AI credential/account configuration in Vercel project **dissertation**, scoped to Preview and Production. Keep tokens out of chat, repository, browser transcripts and logs.
- Verify permissions/account using official Workers AI guidance. Use the existing model; a different model/provider or paid plan is a separate PM decision.
- Build a fresh protected preview so the new configuration is actually loaded.
- Run one harmless manager request and inspect only bounded, sanitized diagnostics. If it fails, record the exact safe status/code and stop for a specific configuration action.

**Done when:** actual inference succeeds on the exact fresh preview, without authentication failure; commit/build/environment and sanitized result are recorded. A green Cloudflare token entry or configured variable alone is insufficient.

### 2. #66 — Verify live chatbot AI journeys and safe failures
**Done · Must · independent verification cleared 20 November 2026.** Reuses #54/#55 evidence; not a second chatbot implementation.

- Independently verify normal typed conversation and representative model-routed requests, clarifications, unavailable/failure responses and usage-limit behavior without deliberately incurring excessive calls.
- Verify fresh chat/reset and calendar/typed-date report generation, seven-/ten-day horizons, save/download behavior, staff private routing and explicit confirmation. Reuse unchanged deterministic/live evidence; repeat affected journeys after fixes.
- Confirm fixed task vocabulary reaches the model, no staff identity/password or report personal data is exposed, and manager/supervisor/staff/signed-out access remains correct.
- Record desktop/keyboard/narrow viewport results and any scope limits. Use fixtures or isolated tests for destructive/race/limit cases.
- Existing QA accounts stay inactive; do not create more accounts or save extra reports without separate authorization.

**Done when:** independent QA plus relevant AI/security/UX reviews clear the agreed live matrix on an exact source/build, with successful real inference and safe negative cases. Record separate remaining #55 criteria rather than silently closing them.

### 3. #67 — Complete chatbot release acceptance and close parent tasks
**Partial / IN PROGRESS · Must · production/final acceptance underway after #66.**

- Reconcile #54 and #55 acceptance criteria with their actual evidence; include the already-tested staff/report behavior and any remaining foundation checks.
- Publish reviewed fixes through normal main/production gates; verify exact frontend/backend builds and aliases, configuration loading, a harmless live model request and affected smoke journeys. Do not manually deploy or change schema unnecessarily.
- Present results for PM acceptance before removing Staff Management from the sidebar.
- After acceptance, remove the sidebar entry while retaining in-chat account controls and the guarded recovery route; independently check navigation, roles, keyboard/narrow behavior and production.
- Confirm temporary-account/session cleanup, no pending drafts and retained audit/report records. Update tracker first, then Trello using Result / Checked / Next / Evidence comments.

**Done when:** exact production release and sidebar change pass required checks and PM acceptance is recorded. Close #54 and #55 only individually when every criterion is met; do not infer completion from #67 or a Ready build alone.

## Scope and handoff

Trello queue: [#65 authentication](https://trello.com/c/Ppb8CHd2) → [#66 live verification](https://trello.com/c/vSlZUZBq) → [#67 release acceptance](https://trello.com/c/DvMyM9JR). Parent [#54](https://trello.com/c/8CJKQMtq); foundation [#55](https://trello.com/c/DQ69mG8L).

#52 AI-assisted report explanations remains a separate off-by-default pilot. It follows core chatbot completion unless the PM reprioritizes it; this plan does not enable it. #21/#29/#56 remain Done, and genuine forecast validation stays under #61 after chatbot priority.

Current baseline: application published through [PR #21](https://github.com/vale2015/Dissertation/pull/21); [verification record](STAFF_CHAT_VERIFICATION_2026-11-19.md); [safe model diagnostics](MODEL_AUTH_DIAGNOSTICS.md). Planning creates no new successful inference evidence. See the canonical [tracker](../product/IMPROVEMENT_TRACKER.md) and [priority order](../product/MOSCOW_PRIORITIZATION.md).
