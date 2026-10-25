# Restaurant manager chatbot — proposed scope (#54–55)

Status: **#54 and #55 Partial**, medium priority (Should), not merged or released to production. Last reviewed: 2026-10-25. The [improvement tracker](IMPROVEMENT_TRACKER.md) owns actionable status. The user has since replaced the skeleton-only product direction with a typed-only chatbot in the top bar; the implementation is local and uncommitted.

The reviewed engineering and UI/UX design is in [RFS Chatbot Architecture Design](RFS%20Chatbot%20Architecture%20Design.md). It supersedes the preliminary Flask-orchestrator and tool-schema ideas; this scope document remains the product brief.

## Intended manager experience

The chat opens from the top bar where the weather widget used to be. It shows a concise introduction in the conversation, then automatically displays the restaurant's current weather with a stale/unavailable notice when needed. There are no starter cards, shortcut options, or sidebar-page links in the chat. Weather uses the protected weather API directly, without a language-model call.

The manager can type requests for local events, a fresh or past management report, saving and PDF/CSV downloads, or any current Staff Management action. The assistant routes validated requests through existing protected application APIs and keeps the result and secure staff workspace inside the chat. It does not click sidebar controls, query the database directly, or invent report totals. The sidebar retains only Dashboard, Bookings Overview, Add New Booking, Reservation Forecast, Staff Forecast, Forecast Accuracy, Staffing Rules, Reports (view-only), My Profile, and Logout. The removed pages remain as direct routes for recovery until release verification.

## Included capabilities

| Area | Existing app capability | Chatbot scope and boundary |
|---|---|---|
| Weather on open | Protected `/api/weather/` provides current and seven-day forecast data. | Fetch automatically when the chat opens, show concise current/today values with fetched time and stale/error state. No AI call needed. |
| Local events | Protected `/api/events/` searches a bounded date range. | Resolve a requested range, show source events with dates and links, and say when the provider is unavailable. Do not invent events. |
| Reports | Protected management-report JSON and saved-history endpoints provide deterministic figures, snapshots, and fresh download links. | Generate, save, list, view, and download PDF/CSV entirely inside chat. The Reports sidebar page only views a report. |
| Staff Management | Protected staff list, filters, detail, roles, registration, edit, status changes, and password-reset-link endpoints. | Support all actions available on the current Staff Management screen: search/filter/view, register, edit name/application or operational role, suspend, deactivate, reactivate, and issue a reset link. There is no delete action in the current screen. |

## Safety and technical design

- Reuse the signed-in user's session and the Flask permission checks; staff-management tools are unavailable without `manage_staff_accounts`. Recheck authorization on each tool execution, not only when the chat opens.
- Keep tool definitions narrow and validate inputs server-side. The model chooses an allowed operation; existing Flask services remain the source of truth for role rules, reports, events, and weather.
- Show the exact target staff account and proposed values in a confirmation card before every staff write. Require a fresh confirmation for registration, role/status changes, and reset-link issuance. Prevent duplicate execution on retries. Existing staff audit records remain authoritative.
- Do not send passwords, reset/activation links, session tokens, or raw staff records to the model. Use a secure form for the initial password and a protected one-time link display after reset; the model receives only the minimum non-secret fields needed to resolve the request.
- Use deterministic weather rendering on chat open. Cloudflare Workers AI with `@cf/qwen/qwen3.8-27b` is the user-selected model for ambiguous intent classification, called only from the Next.js server with a bounded request and allowlisted output. The common explicit requests work without a model. Preview needs `CLOUDFLARE_ACCOUNT_ID` and Secret `CLOUDFLARE_API_TOKEN` in the `dissertation` Vercel project; neither is a browser variable. Do not enable production until privacy, usage, rate-limit, and authenticated-flow checks pass.
- Keep the named sidebar entries above; remove Local Events, Past Reports, and Staff Management entries because their workflows are now in chat. The old direct routes can remain temporarily as recovery paths without appearing in navigation.

## Delivery order

1. **#55 — Revised chat shell.** Replace the top-bar weather widget with the accessible typed-only chat, automatic weather, protected route, loading/error states, and no shortcut blocks.
2. **#54 — Verified actions.** Weather, events, reports, report history/downloads, and the embedded staff workspace use existing protected APIs. Keep staff writes behind review/confirmation; add durable idempotency and complete end-to-end testing before claiming all actions Done.

## Estimate and assumptions

For one experienced full-stack developer, using the existing Next.js/Flask APIs and with AI Gateway access ready: **2–3 working weeks for a demonstrable pilot** and **5–7 working weeks for production-ready coverage of all listed staff actions plus weather, events, and report generation**. The latter includes role/confirmation checks, secret handling, failure cases, automated tests, privacy review, and deployed end-to-end verification. These are planning estimates, not a delivery commitment. Provider access, a secure registration UX decision, or additional report save/download actions could change them.

The first implementation slice is the skeleton in #55; weather and read-only tools follow under #54. This reuses the installed AI SDK in the existing app; a separate agent service or framework is not required for this bounded, interactive scope.

## Resolved and remaining decisions

- Should registration remain the current active-account flow with a secure initial-password form, or should chat use the existing invitation service and let staff set their own password? The latter needs a supported API/UI path and may add work.
- Resolved: generating reports includes saving snapshots, finding past reports, and PDF/CSV downloads inside chat; no sidebar-page navigation.
- No backend staff records or secure-form passwords enter model context. User-typed text may be sent to Cloudflare for ambiguous intent classification; a final privacy review and conversation-retention decision remain.

Tool execution with explicit human approval is supported by the [AI SDK tool-calling API](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling); that library support does not replace application-level authorization, auditing, or product review.
