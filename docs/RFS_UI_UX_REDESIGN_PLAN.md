# RFS UI/UX redesign — implementation plan

**Backlog item:** [#57 in the improvement tracker](IMPROVEMENT_TRACKER.md) · **Priority:** Must (user-directed product redesign) · **Status:** Partial implementation in the local worktree
**Sources:** [Redesign specification](RFS_UI_UX_REDESIGN.md) and [approved dashboard PNG](RFS%20Restaurant%20Analytics%20Dashboard.png) (1536 × 1024 reference viewport)
**Decisions recorded 2026-10-30:** Follow the new mockup for the sidebar and assistant, including Staff Management and suggested chat prompts. Reproduce the pictured mascot as a standalone production asset; build a real notification feature; keep Reports view-only with generation in chat; and put Staffing Rules and personal account settings in Settings. The underlying access rules still apply.

## Outcome and constraints

Make the signed-in product recognizably match the approved reference: compact white left sidebar, restrained red accents, spacious dashboard cards and charts, top-right account area, and a branded floating **RFS AI** conversation panel. The image is a visual target, not a source of sample data or permission rules. Keep the existing Next.js/Flask architecture, routes, and protected operations unless a specific phase identifies a necessary contract change.

The screenshot's `48`, `142`, `€2,130`, percentage deltas, October 2026 dates, scheduled-staff series, and forecast band are illustrative. Never put them into production as constants. Display only values derived from the current authenticated restaurant's data, with the correct currency, units, date range, and observed/estimated/predicted labels. If a comparison or schedule is unavailable, use a clearly labelled unavailable state rather than inventing it.

## Navigation and interaction contract

| Mockup control | Implementation target | Guardrail |
|---|---|---|
| Dashboard | `/dashboard` | Preserve `VIEW_DASHBOARD`. |
| Bookings | `/dashboard/bookings`; expose `/dashboard/createBooking` as a prominent in-page action | Do not call aggregated covers a reservation count. |
| Reservation Forecast | `/dashboard/reservation-forecast`; link to `/dashboard/forecast-accuracy` from forecast details | Keep forecast accuracy discoverable without adding an extra top-level mockup item. |
| Staffing Forecast | Existing `/dashboard/staff-forecast` route, new visible label | Preserve `VIEW_FORECASTS` and forecast-run provenance. |
| Staff Management | Existing `/dashboard/staff` route, restored sidebar link | Render only for `MANAGE_STAFF_ACCOUNTS`; existing in-chat staff tools remain available. |
| Reports | Existing `/dashboard/reports` view | Display existing report content only: no generate, save, or download controls on this page. RFS AI handles generation, saving, archive lookup, and downloads. No Past Reports sidebar entry. |
| Settings | `/dashboard/settings` hub containing Staffing Rules and personal account settings | Reuse the existing Staffing Rules flow only for `MANAGE_STAFFING_RULES`; show each signed-in user only their own existing profile fields and full-name edit. Do not invent password, preference, or other account operations. |
| Top-right account | Profile menu with Settings and Logout | Preserve current session/logout behaviour; keep the existing profile route as a deep link or redirect to its Settings section. |
| Notifications | Real top-bar bell with unread count and accessible inbox | Show persisted, recipient-scoped notifications from completed app events; support read state. No decorative bell, fabricated alerts, or cross-user access. |
| RFS AI launcher/panel | Re-skin `ManagerChat.jsx` with approved branding, a right-side panel, immediate greeting, and suggested prompts | Chips only prefill a supported, role-allowed request; sending remains explicit. No unsupported operation or automatic staff mutation. |

The user approved the exact mascot appearance shown in the PNG. That approval is a visual target, not proof that a separately licensed source asset exists: the mascot is embedded in a flattened screenshot. Obtain the original standalone asset if available, or recreate it as a separate transparent production asset and compare it with the reference before release; confirm usage rights if the original artwork came from a third party. Keep both source design files in `docs/` under the repository's documentation rules; do not move the Markdown into the chatbot component directory solely because the source specification suggests that path.

## Delivery slices, ordered by visible value and dependency

| Slice | Work | Exit gate |
|---|---|---|
| 0. Baseline and data contract | Capture current desktop/tablet/mobile screens and supported manager/restricted-role routes. Map each proposed KPI and chart to its API, date basis, currency, unit, and permission. Audit actual event producers for the first notification types and source or recreate the standalone mascot. | No mockup metric is mistaken for real data; notification events and mascot asset path are recorded. |
| 1. Shared UI foundation | Add design tokens and reusable card, chart-panel, button, field, status, tooltip, loading/empty/error, and dialog patterns. Rework the shared dashboard layout, sidebar, top bar, account menu, and responsive shell. | Dashboard shell matches the reference at 1536 × 1024, and shared controls work with keyboard, touch, and role gating. |
| 2. Dashboard and RFS AI first visible release | Replace the dashboard's fragmented layout with the welcome/date header, truthful KPI row, historical Bookings Trend, reservation/demand forecast, staffing overview, and quick actions. Re-skin the existing assistant with the mascot, welcome message, allowed prompt chips, message states, and mobile panel. | Manager can understand each number's basis and complete existing chat tasks; unavailable data is honest; no permissions regress. |
| 3. Real notifications | Add a minimal persisted in-app notification feed from confirmed backend events, protected list/unread-count and mark-read endpoints, and an accessible top-bar inbox with empty/error states. | A real event reaches only its intended recipient, unread counts and read state are correct, duplicate events are prevented, and the bell works on desktop/mobile. |
| 4. Core planning journeys | Redesign Bookings, Create Booking, Reservation Forecast, and Staff Forecast using the shared components. Carry date/range context through links; keep existing calculations and backend writes. Add detail interactions only where the API supplies the data. | Booking, forecast, and staffing journeys remain functional on desktop/tablet/mobile, with no fabricated scheduled staffing or uncertainty. |
| 5. Supporting journeys | Apply the system to Reports (view-only), Forecast Accuracy, Staffing Rules, Staff Management, and the Settings hub with personal account settings. Keep report generation, saving, archive lookup, and downloads in chat. | All signed-in pages have consistent states and unchanged authorization; the mockup navigation still reaches every existing capability. |
| 6. Validation and release | Compare reference screenshots at 1536 × 1024 and responsive views, run accessibility and regression checks, then verify a protected preview with manager and restricted-role accounts before release. | Acceptance checklist below passes on the exact commit; production is checked separately after release. |

Slices should be small reviewable changes, not one large CSS rewrite. Start with the shell/dashboard and assistant because those dominate the approved image; expand to other pages only after the shared patterns have been validated. Existing backlog items #33 (states), #34 (accessibility), #36 (component tests), #37 (end-to-end tests), and #54–55 (assistant) supply cross-cutting acceptance work; do not create duplicate tracker items for them.

## Technical implementation notes

- Use the existing shared App Router layout (`frontend/src/app/dashboard/layout.jsx`) and current role-permission map. Change visual composition, not authorization semantics.
- Put tokens and component styles in maintainable modules or clearly sectioned styles; the current `frontend/src/app/globals.css` is already large. Avoid adding a heavyweight design-system dependency unless a measured need appears.
- Derive dashboard cards/charts from existing `useDashboardData`, active forecast runs, and backend financial summaries. Add a small documented API contract only if a requested metric cannot be calculated reliably from current responses.
- Keep chart data and accessible text summaries in one source of truth. A tooltip must not be the only way to read a value.
- Preserve current chatbot server-side allowlisted actions and staff confirmation safeguards. Suggestions should be role-filtered and should populate the composer, not silently perform writes.
- Implement notifications through the existing Flask API and database, not direct browser access to notification rows. Store recipient, event type/source, content, creation/read timestamps, and an idempotency key; enforce recipient and role checks server-side. The first genuine event is a saved management report, inserted in the same transaction as its report snapshot. Use a bounded list and refresh on opening/focusing the inbox; realtime delivery and scheduled briefings are separate future work (#51). Retain notifications for 90 days with bounded cleanup and keep the table server-only.
- Reuse the current own-profile endpoint and Staffing Rules page in Settings; permission-gate the rules section. Existing `/dashboard/profile` and `/dashboard/staffing-rules` links may redirect or remain deep links, but should not create parallel settings implementations.
- Do not infer scheduled staff from recommended staff, and do not render a confidence band without a defensible backend calculation.
- Coordinate with #56 before release: the dependency update is in a protected preview but not yet in `main` or production. Plan the redesign branch from the eventual approved base, not an outdated checkout.

## Acceptance and verification

1. Desktop visual review compares spacing, hierarchy, palette, typography, sidebar, charts, cards, assistant panel, and mascot with the PNG; intentional data-driven deviations are documented.
2. Tablet and mobile views keep every primary action reachable; the sidebar and chat are usable without covering critical content.
3. Real data and labels are verified for current, historical, forecast, closed-day, and missing-data states. No static sample figures, unsupported percentages, fake schedules, or fake notifications appear.
4. An actual completed backend event creates one recipient-scoped notification; unread count, opening, marking read, deduplication, empty/error states, and cross-user denial are verified.
5. Manager and restricted-role browser checks verify navigation visibility, direct-route denial, view-only Reports, report generation in chat, Settings permissions, chatbot prompts/actions, staff confirmations, and logout.
6. Keyboard-only and screen-reader checks cover sidebar, account menu, notification inbox, date control, charts' text alternatives, dialog focus, chatbot, and reduced motion; target WCAG 2.2 AA.
7. Component/route tests cover each shared state and changed interaction; existing lint, unit, integration, end-to-end, and production build checks pass.
8. A protected Vercel preview is reviewed before any main merge. Git push, preview READY, authenticated functional checks, production deployment, and post-release smoke checks are recorded separately in #57.

## Confirmed product decisions and remaining asset check

- The RFS AI mascot must visually match the reference. A standalone transparent asset must be sourced or recreated and reviewed; if it comes from third-party artwork, usage rights must be confirmed before release.
- The notification bell is a real feature, with persisted notifications and working read/unread behavior. It is not an optional visual exception.
- Reports remains a view-only page. Generation, saving, archive retrieval, and download are chatbot actions.
- Settings contains Staffing Rules and personal account settings, using only the existing permitted operations.

## Implementation record — 2026-10-30

The first local slice adds the new shared shell styling, branded sidebar and assistant, a standalone transparent mascot candidate, the role-gated Staff Management link, a Settings hub using the existing own-profile and Staffing Rules components, and in-page links to Add Booking and Forecast Accuracy after their sidebar links were removed. Suggested assistant prompts currently cover only the four actions actually recognized by the chatbot: weather, events, reports, and staff management. They fill the composer without submitting. The Reports page already has no generate/save/download buttons, so it was not changed in this slice.

At this first-slice checkpoint, the mascot still needed visual sign-off against the reference; notifications, the full dashboard/page redesign, chatbot bookings/forecast prompts, responsive visual review, authenticated browser checks, and release verification remained. Lint had zero errors (one pre-existing hook warning); 18 frontend unit, 9 existing component, 2 new Settings, and 6 chatbot-route tests passed. Restricted Turbopack stalled and restricted webpack hit an `EPERM` creating `.next` output in the OneDrive workspace; a build with normal Windows file access then compiled, type-checked, and generated all 25 routes successfully. No Supabase migration, commit, push, or deployment was made for this slice.

The next local slice adds the notification migration, transactional `report_saved` event, protected Flask inbox/list/mark-read routes, and a top-bar bell with unread count, empty/error/retry states, and accessible read action. The server queries always filter by authenticated recipient, and the migration enables RLS while revoking `anon`/`authenticated` table and sequence grants. Eight new backend notification tests pass. After making an existing event DST test independent of the wall-clock date, all 211 backend tests pass. The frontend has 18 unit, 13 component, and 6 route tests passing; lint has zero errors (one pre-existing warning), and the production build passes with normal Windows file access. The Supabase CLI generated the migration and a remote **dry-run only** found it as the sole pending migration. The CLI is not linked locally, and Docker/PostgreSQL is unavailable, so migration replay, security advisors, database integration, and a real authenticated browser flow remain unverified. Do not deploy the backend code before the migration is applied and its privileges are checked. No live Supabase change, Git commit/push, or Vercel deployment was made.

The third local slice replaces the dashboard's old stacked summaries with the approved KPI/chart/quick-action composition using current API data and explicit observed-versus-predicted labels. It does not claim reservation counts, scheduled staff, percentage changes, confidence bands, or a comparable revenue/labour margin when those data are unavailable. Reports now lists and reads saved snapshots only; opening it no longer calls the report-generation endpoint, and direct saved-report pages no longer offer download/AI-generation controls. The assistant supports the mockup's four suggestions through protected booking-today, demand-forecast, active-staffing-forecast, and report paths; prompts still only prefill. A transparent mascot revision now has the exact RFS chest badge. Two new backend tests, one new Reports component test, and a new chatbot route test bring local results to 213 backend, 18 frontend unit, 14 component, and 7 route tests passing; lint has zero errors and one pre-existing warning. A webpack production build passed; local Turbopack again stalled in the OneDrive checkout. These are local checks only; authenticated visual, responsive, accessibility, database migration replay, live notification event, and release checks are still required.
