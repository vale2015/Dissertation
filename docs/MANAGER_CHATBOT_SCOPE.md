# Restaurant manager chatbot — proposed scope (#54–55)

Status: **#55 Partial on a pushed feature branch with a READY frontend preview; #54 Open**, medium priority (Should), not merged or released to production. Last reviewed: 2026-10-24. The [improvement tracker](IMPROVEMENT_TRACKER.md) owns the actionable status. #55 is the first, skeleton-only item; #54 holds the subsequent manager capabilities.

The reviewed engineering and UI/UX design is in [RFS Chatbot Architecture Design](RFS%20Chatbot%20Architecture%20Design.md). It supersedes the preliminary Flask-orchestrator and tool-schema ideas; this scope document remains the product brief.

## Intended manager experience

The chat opens from the app and immediately displays the restaurant's current weather, forecast context, observation time, and a stale/unavailable notice when needed. That weather card should use the existing protected weather API directly; it does not require a language-model call.

The manager can then ask for local events in a date range, generate a management report, or perform the actions currently available in Staff Management. The assistant routes typed, validated requests through existing protected application APIs. It does not click sidebar controls, query the database directly, or invent report totals.

## Included capabilities

| Area | Existing app capability | Chatbot scope and boundary |
|---|---|---|
| Weather on open | Protected `/api/weather/` provides current and seven-day forecast data. | Fetch automatically when the chat opens, show concise current/today values with fetched time and stale/error state. No AI call needed. |
| Local events | Protected `/api/events/` searches a bounded date range. | Resolve a requested range, show source events with dates and links, and say when the provider is unavailable. Do not invent events. |
| Reports | Protected management-report JSON endpoint generates deterministic figures; saved history is separate. | Generate a report for an allowed selected date/range and show a concise result with a link to the full report. Saving or downloading through chat is not assumed in this initial estimate; the existing screen still supports those actions. |
| Staff Management | Protected staff list, filters, detail, roles, registration, edit, status changes, and password-reset-link endpoints. | Support all actions available on the current Staff Management screen: search/filter/view, register, edit name/application or operational role, suspend, deactivate, reactivate, and issue a reset link. There is no delete action in the current screen. |

## Safety and technical design

- Reuse the signed-in user's session and the Flask permission checks; staff-management tools are unavailable without `manage_staff_accounts`. Recheck authorization on each tool execution, not only when the chat opens.
- Keep tool definitions narrow and validate inputs server-side. The model chooses an allowed operation; existing Flask services remain the source of truth for role rules, reports, events, and weather.
- Show the exact target staff account and proposed values in a confirmation card before every staff write. Require a fresh confirmation for registration, role/status changes, and reset-link issuance. Prevent duplicate execution on retries. Existing staff audit records remain authoritative.
- Do not send passwords, reset/activation links, session tokens, or raw staff records to the model. Use a secure form for the initial password and a protected one-time link display after reset; the model receives only the minimum non-secret fields needed to resolve the request.
- Use deterministic weather rendering on chat open. For model-based requests, set bounded steps, timeouts, rate limits, spend monitoring, and a plain-language fallback. Do not make the whole app dependent on model availability.
- Preserve the sidebar and existing screens as fully functional alternatives. This is an added interface, not a rewrite or a new database authority.

## Delivery order

1. **#55 — Chatbot skeleton first.** Define the interaction and tool boundary, then build one accessible launcher/panel, an authenticated chat route, permission gates, and safe empty/loading/error states. Business tools and model-driven writes stay disabled. A shared dashboard layout (#29) should precede this so the launcher is not copied to every page.
2. **#54 — Add capabilities only after the shell passes its tests.** Start with weather on open, then read-only event and report requests, then staff lookup, and finally confirmed staff account mutations. Each tool needs its own authorization, validation, failure, and evaluation evidence before it is considered complete.

## Estimate and assumptions

For one experienced full-stack developer, using the existing Next.js/Flask APIs and with AI Gateway access ready: **2–3 working weeks for a demonstrable pilot** and **5–7 working weeks for production-ready coverage of all listed staff actions plus weather, events, and report generation**. The latter includes role/confirmation checks, secret handling, failure cases, automated tests, privacy review, and deployed end-to-end verification. These are planning estimates, not a delivery commitment. Provider access, a secure registration UX decision, or additional report save/download actions could change them.

The first implementation slice is the skeleton in #55; weather and read-only tools follow under #54. This reuses the installed AI SDK in the existing app; a separate agent service or framework is not required for this bounded, interactive scope.

## Open product decisions

- Should registration remain the current active-account flow with a secure initial-password form, or should chat use the existing invitation service and let staff set their own password? The latter needs a supported API/UI path and may add work.
- Does “generating reports” include saving snapshots and starting PDF/CSV downloads inside chat, or is a link to the existing report screen enough?
- Which staff fields may appear in model context versus only in protected UI, and what conversation retention is acceptable?

Tool execution with explicit human approval is supported by the [AI SDK tool-calling API](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling); that library support does not replace application-level authorization, auditing, or product review.
