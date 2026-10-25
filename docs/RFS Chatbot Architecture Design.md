# RFS chatbot architecture design

Status: revised engineering and UI/UX design. #54 and #55 are Partial on a local feature branch, not released. Last revised 2026-10-25. The [improvement tracker](IMPROVEMENT_TRACKER.md) owns delivery status. The user's later top-bar, typed-only, chat-complete workflow decision supersedes the original bottom-right preview design below where noted.

## 1. Product intent and release boundary

RFS lets a restaurant manager type requests for weather, nearby events, fresh and past management reports, report save/download, and current Staff Management actions. The chatbot is another interface to the same protected capabilities, not a second source of truth. Its launcher replaces the top-bar weather widget. The sidebar removes Local Events, Past Reports, and Staff Management; the Reports entry becomes view-only. Existing direct routes stay available for recovery until the replacement is fully verified.

The first published branch had an inert **skeleton** (#55), but the user's revised acceptance requires a usable typed composer and no shortcut cards. Current local #54 work adds protected read flows and an embedded staff workspace; it does not write to Supabase directly. It is not yet a verified release.

## 2. Architecture decision

The existing application already has Next.js route handlers, an installed AI SDK, an HttpOnly session cookie, a Flask API with role/permission checks, and Supabase PostgreSQL behind Flask. Keep those boundaries. A new Flask-hosted Claude/OpenAI adapter would duplicate AI plumbing and require a second provider integration without adding product value.

```mermaid
flowchart LR
  M[Manager] --> UI[Dashboard chat panel]
  UI --> BFF[Next.js /api/chatbot]
  BFF --> AUTH[Flask /auth/me]
  BFF --> API[Protected Flask APIs]
  BFF -. ambiguous intent only .-> LLM[Cloudflare Workers AI / Qwen 3.8]
  API --> DB[(Supabase PostgreSQL)]
  API --> EXT[Weather and event providers]
```

- **Browser:** renders the panel and source-linked results. It never receives the session JWT, model credential, or database connection.
- **Next.js route:** reads the HttpOnly cookie, verifies identity with Flask, checks manager access, validates each request, and orchestrates bounded model classification and allowlisted backend requests. It does not trust a role, tool name, or confirmation flag supplied by the browser.
- **Flask:** remains authoritative for permissions, business validation, staff audits, report calculations, weather, and events. Every future tool request must pass through protected Flask endpoints or the same service boundary.
- **Supabase:** remains behind Flask. The skeleton adds no table or migration.

The user selected Cloudflare Workers AI and its documented `@cf/qwen/qwen3.8-27b` model to avoid a funded account for the prototype. The Next.js server uses the installed AI SDK OpenAI-compatible provider with `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` stored as private Vercel Preview variables. The model only classifies ambiguous text into allowlisted intents; it never receives backend records or executes tools. Direct, explicit requests work without a model. No separate agent framework, durable workflow, WebSocket, or Redis is needed for read-only work; durable idempotency is still required before staff writes meet the final acceptance criteria. See [Cloudflare model](https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/), [compatible endpoint](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/), and [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## 3. Current local chat contract (#54–55)

- GET /api/chatbot: requires a valid manager session verified against Flask /auth/me; fetches protected weather without a model call, and returns no-store status plus a weather or unavailable message.
- POST /api/chatbot: checks origin, manager session, bounded JSON message, optional validated report context, and a local intent parser. Ambiguous non-sensitive requests may use Cloudflare for intent classification. It calls only fixed protected Flask routes or returns a staff-workspace instruction; model output is never an authorization decision.
- The manager-only launcher appears in the top bar. The panel has an enabled typed composer, short capability greeting, no starter cards/options, and in-chat results or secure staff forms. Escape and Close restore focus to the launcher.

An unavailable backend must fail closed for requests. Weather failure does not disable the rest of the chat; model unavailability falls back to explicit typed commands.

## 4. Future capability contract (#54)

| Capability | Existing source | Permission | Interaction |
| --- | --- | --- | --- |
| Weather on open | GET /api/weather/ | view_forecasts | Deterministic card, fetched when chat opens; no model call needed. Show observation time and stale/unavailable state. |
| Local events | GET /api/events/?start_date=&end_date= | view_forecasts | Bound and validate dates; show provider, date, source link, and unavailable state. |
| Fresh and saved management reports | GET /api/reports/management?selected_date=&days_ahead=, report-history endpoints, and protected downloads | view_reports | Generate, summarize exact source figures, save, list, view, and download in chat without page navigation. The Reports sidebar entry is a read-only view. |
| Staff search/detail | GET /api/staff/ and GET /api/staff/{id} | manage_staff_accounts | Return minimum needed fields; do not send raw records or secret links to the model. |
| Staff registration/edit/status/reset | Existing POST/PATCH staff routes | manage_staff_accounts | Require a reviewed proposal card, explicit confirmation, fresh authorization, and idempotent execution. Never pass passwords or activation/reset links through model context. |

The first draft's clock-in, clock-out, mark-sick, schedule, and reassign-role actions are **not** current RFS Staff Management endpoints. They are excluded rather than invented. The current app supports registration, edit, status changes (suspend/deactivate/reactivate), and reset-link issuance.

Tool visibility to the model is a usability filter, **not** authorization. Recheck the user's current permissions in the server executor and in Flask for every call. The model's instructions are never a grant of access.

## 5. Read and write flows

```mermaid
sequenceDiagram
  participant M as Manager
  participant UI as Chat panel
  participant N as Next.js
  participant F as Flask
  participant L as Model
  M->>UI: Ask for events or a report
  UI->>N: Send bounded message
  N->>F: Verify session and permission
  N->>L: Offer only allowed read tools
  L-->>N: Structured tool request
  N->>F: Validate and call protected endpoint
  F-->>N: Authoritative result
  N-->>UI: Answer plus source data/link
```

For a staff write, the model may only **propose** a typed action. The server creates a short-lived pending action tied to the user, target, expected before-state, and a stable idempotency key. The UI shows the exact person and before/after values. Confirmation is a second, explicit request; the server reloads the action and permissions, verifies the expected state, performs one existing Flask operation, and records the outcome. Cancel/expiry performs no write. Network retries must return the original result, not repeat the mutation.

No write action is safe with only an in-memory pending card or a browser-generated key. The confirmed-action store, uniqueness constraint, and audit trail require a separate migration and tests before staff write tools are enabled.

## 6. UI/UX design

The panel is a non-modal dashboard companion launched from the top bar, with no starter cards or shortcut options. On mobile it fits within the viewport without covering the close control. Keyboard users can open it with Enter/Space, close with Escape or the labelled button, and return focus to the launcher. Buttons and inputs have visible focus states; status and errors use appropriate live regions. Reduced-motion preferences should be respected as animation is added.

Future conversation design should distinguish user messages, AI interpretation, verified source results, and proposed actions. Weather should appear automatically on open, not wait for a greeting. Reports and events need timestamps and links to the original screen/source. Every proposed staff change needs a separate confirmation card; never hide confirmation inside ordinary prose. Errors should name what failed and provide a safe retry without duplicating writes.

The panel must state when capabilities are unavailable. It must not impersonate a working AI assistant before model and tool tests pass.

## 7. Privacy, reliability, and evaluation

- Keep secrets, JWTs, passwords, activation/reset links, and raw staff records out of model prompts, logs, and browser-readable state.
- Limit user input length, date ranges, tool steps, runtime, and spend. Add per-user rate limits and cost alerts before enabling model calls.
- Treat model text and retrieved provider content as untrusted; validate structured tool arguments and render text safely.
- Log minimal evaluation metadata (user pseudonym or internal ID, intent category, tool name, authorization outcome, latency, model usage, error code) with retention. Do not store full message text or tool arguments by default. An interaction table is optional and requires a privacy decision and migration.
- Do not keep server conversation or pending-action state in process memory. For an initial read-only chat, a bounded client-side transcript can be ephemeral; server-validated pending writes must be durable.
- Evaluate intent routing, tool selection, source fidelity, refusal of unauthorized actions, duplicate-confirm prevention, accessibility, and recovery paths with scripted cases before release.

The preliminary pronouns-column proposal is **deferred**. The assistant can address the manager directly and use neutral language without adding sensitive profile data. If users later request an optional self-reported preference, design consent, editing, deletion, and retention separately; never infer pronouns from names or use them for authorization. An avatar must not be inferred from pronouns.

## 8. Delivery and acceptance

1. **#55 revised shell:** manager-only top-bar launcher/panel, authenticated GET and typed POST, responsive and keyboard design, error handling, unit/build/access tests, automatic weather, no option blocks.
2. **#54 read-only and reports:** bounded event lookup and fresh/saved report generation, save and download in chat. Model classifies only ambiguous requests after privacy/usage checks; source figures remain deterministic.
3. **#54 staff reads and writes:** embedded protected staff workspace with review/confirmation, followed by durable idempotency, audit, and permission tests for registration, edit, status, and reset.
4. **Release quality:** authenticated manager and restricted-role browser journeys, end-to-end success/failure tests, runtime monitoring, and rollback evidence. Git push, migration, and Vercel READY are separate milestones.

For #55, “Done” requires the panel to open/close by mouse and keyboard on representative dashboard pages, deny signed-out and non-manager access, leave POST and business actions inert, and pass focused tests plus a clean build. A deployment alone does not satisfy this.

## 9. Decisions still needed before #54

- Resolved: chat report generation includes save, history, view, and PDF/CSV download without navigating to another page.
- For staff registration, should chat use the current active-account/password form or a future invitation flow?
- Which minimal staff fields may enter model context, if any, and what conversation retention is acceptable?
- Resolved provider/model for the prototype: Cloudflare Workers AI/Qwen 3.8 on the free account. Remaining: verify the free allowance, Preview credentials, privacy/usage limits, and evaluation threshold before release.
