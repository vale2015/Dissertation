# RFS — Complete UI/UX Redesign Specification

> **Status:** Original approved design brief; substantially implemented but still Partial under [tracker #57](IMPROVEMENT_TRACKER.md). Its checklists record the initial target, not current release status. Later PM decisions removed the white top strip and cards below the charts and moved RFS AI to a left dock. See the [implementation plan](RFS_UI_UX_REDESIGN_PLAN.md) for the current contract.
> **Design reference:** Approved RFS dashboard and RFS AI mockup (26 October 2026)

## 1. Objective

Modernize the Restaurant Forecasting System into an actionable restaurant operations and decision-support platform. Redesign the visual presentation of the UI and interactions while retaining the approved look and current business logic.

### Preserve

- Existing red, white, neutral, dark accent palette and font choices.
- Established page positioning: left sidebar, top navigation, content region, chatbot launcher.
- Current capabilities and role/permission restrictions.
- Approved RFS AI mascot: cream helmet, dark jacket, orange bow tie, RFS name badge, utensils in pocket, tablet in hand; branding reads **RFS AI**.
- Forecasts and financial figures must come from real data, not illustrative figures.

### Change

Component hierarchy, cards, charts, tables, dialogs, states, interactions, navigation clarity, and responsive usability. Build a consistent reusable UI kit instead of redesigning pages independently.

## 2. Source-code inventory reviewed

- `frontend/src/components/dashboard/dashboardContent.jsx`: dashboard summary metrics, operational/financial snapshots, historical/forecast states, bookings/staffing charts.
- `frontend/src/components/dashboard/summaryCard.jsx`: reusable KPI card.
- `frontend/src/components/layout/sidebar.jsx`: page navigation, role-based links, date handling and logout.
- `frontend/src/components/layout/topbar.jsx`: brand, session/user details and ManagerChat.
- `frontend/src/app/dashboard/layout.jsx`: shared app shell.
- `frontend/src/app/dashboard/bookings/page.jsx`: historical demand and booking overview.
- `frontend/src/app/dashboard/reservation-forecast/page.jsx`: 7/10-day forecast and details table.
- `frontend/src/app/dashboard/staff-forecast/page.jsx`: staffing and cost calculations with per-date breakdown.
- `frontend/src/app/dashboard/staffing-rules/page.jsx`: staffing-rule management.
- `frontend/src/app/dashboard/reports/page.jsx` and `reports/history/page.jsx`: management reports and archives.
- `frontend/src/components/chatbot/ManagerChat.jsx`: existing assistant widget.

This is a code-based inventory, **not** a verified pixel-level review of the deployed, authenticated UI. Test the rendered UI and data integrations before implementation.

## 3. Feature backlog

### A. Shared design system — P0

- [ ] Reusable KPI cards (label, main value, comparison, explanation, optional action).
- [ ] Reusable chart panels, status cards, insight cards and action cards.
- [ ] Button variants: primary, secondary, tertiary, destructive; focus, hover, disabled and loading states.
- [ ] Standard form fields, search fields, filters, selects, calendars and segmented controls.
- [ ] Tables with sort, filter, pagination, responsive overflow and accessible headings.
- [ ] Status tags, contextual tooltips, breadcrumbs where valuable, badges and icons.
- [ ] Confirmation dialogs, contextual menus, toasts, drawers and popovers.
- [ ] Loading skeletons, empty states, no-results states, server errors, retries and success states.
- [ ] Consistent spacing, radius, borders, icon scale, grid rhythm and typography hierarchy **without changing approved fonts/colours/overall positioning**.
- [ ] Accessible keyboard navigation, reduced-motion support, WCAG 2.2 AA contrast and focus checks.
- [ ] Clear differentiation between actual, predicted and estimated values; consistent dates, currency and units.

### B. Main dashboard — P0

- [ ] Welcome/header with operational context and clear relevant date range.
- [ ] Improved KPI cards for bookings/covers, expected demand, estimated revenue and recommended staffing (subject to data).
- [ ] Real historical comparisons where available; no fictitious percentage changes.
- [ ] Interactive Bookings Trend chart with tooltip, legend and accessible summary.
- [ ] Main demand/reservation forecast visualization, clearly labeled as predicted.
- [ ] Staffing overview comparing required and scheduled counts **only if scheduling data is present**.
- [ ] Operational Insights: busy periods, unusual booking spikes, staffing risks and recommended next actions.
- [ ] Quick actions to manage bookings, review forecast, plan staffing and generate a report.
- [ ] Click-through from cards and chart points into detailed pages, carrying date/range context.
- [ ] Financial snapshot grouped by revenue, labour costs and gross margin.
- [ ] Correct handling of selected historical date, forecast date, latest snapshot and unavailable data.
- [ ] Consistent loading, refresh, stale, empty and API error displays.

### C. Bookings experience — P0

- [ ] Separate aggregated historical covers insights from individual reservation management.
- [ ] Searchable, sortable and paginated reservations list when individual booking records exist.
- [ ] Filters for date, status, source and party size where supported.
- [ ] Optional calendar/list toggle; synchronize date context.
- [ ] Reservation-detail side drawer with relevant guest and booking information.
- [ ] Add/edit/cancel booking actions subject to existing API capabilities and permissions.
- [ ] Better Create Booking form: clear steps, required fields, validation and confirmation.
- [ ] Accessible status labels and confirmation for destructive actions.
- [ ] Data summaries by booking source and historical trend visualizations.
- [ ] Meaningful empty state, no-results state, permission restrictions and mobile table treatment.

### D. Reservation forecast — P1

- [ ] Large interactive 7-/10-day demand chart with real forecast values.
- [ ] Clear active state and feedback for existing 7/10-day control.
- [ ] KPI cards: total expected covers, peak day, lowest open day and average per open day.
- [ ] Highlight busy and quiet service days without relying on colour alone.
- [ ] Expandable daily forecast table rows with source inputs and plain-language descriptions.
- [ ] Optional historical-to-forecast comparisons where equivalent data exists.
- [ ] Explain model assumptions, data quality and limitations.
- [ ] Display uncertainty only if a defensible calculation is implemented.
- [ ] Closed-trading-day handling and date-context continuity.
- [ ] Link selected dates to staff-forecast insights.
- [ ] Loading, unavailable, empty and error states.

### E. Staff forecast — P1

- [ ] Visual daily staffing needs by department (front-of-house, kitchen, bar, management where supported).
- [ ] Improved staff-count vs labour-cost segmented control.
- [ ] KPI cards: peak staffing day, average staff, projected covers, expected labour cost.
- [ ] Interactive daily drilldown showing staff by department and role.
- [ ] Required-vs-scheduled comparison and shortfall signals **only with actual schedule data**.
- [ ] Labour-cost breakdown, role rates and explanatory units.
- [ ] Closed-day and unstaffed-day states.
- [ ] Keep forecast run ID as useful, discreet metadata.
- [ ] Cross-link relevant staffing rules when authorized.
- [ ] Accessible charts and mobile-responsive breakdowns.

### F. RFS AI chatbot — P0

**Brand and entry**
- [ ] Use approved mascot and **RFS AI** lettering beside the launcher.
- [ ] Keep robot details: badge marked RFS, kitchen tools in pocket, tablet in hand.
- [ ] Floating launcher opens a right-side conversational panel.
- [ ] Panel header contains brand, assistant label, minimize and close controls.

**Welcome and prompts**
- [ ] Show greeting immediately on opening, not after the first user message:

> 👋 Hi there! I'm your RFS Assistant!
> I'm here to make your day easier! Ask me anything, let me handle tasks, or get help managing your restaurant. Just tell me what you need!

- [ ] Suggested chips: check today's bookings, view reservation forecast, suggest staffing, generate report.
- [ ] Show only prompts backed by implemented actions and authorized user capabilities.

**Interaction and safety**
- [ ] Differentiated user/assistant bubbles, chat composer and useful timestamps.
- [ ] Typing/progress indication, disabled-send states and retry on failure.
- [ ] Structured answer cards for real forecasts, staffing, bookings and reports.
- [ ] Confirmation before creating, editing or deleting application records.
- [ ] Clear success and error messages and reference to the action performed.
- [ ] No assertion of conversation persistence unless implemented and disclosed.
- [ ] Keyboard focus handling, close on Escape, screen-reader support and scroll behavior.
- [ ] Responsive chat layout with sufficient room for page controls.
- [ ] Preserve permissions and prevent unsupported automation/operations.

### G. Sidebar and top bar — P1

- [ ] Consistent navigation icons, active indicators, focus and hover feedback.
- [ ] Logical groupings for Overview, Bookings, Forecasting, Operations, Reports and Account.
- [ ] Preserve left sidebar position; optional collapse for narrower viewports.
- [ ] Harmonize per-page date picker behaviour and date-range labels.
- [ ] Profile menu and sign-out confirmation with current session logic.
- [ ] Clear page title and contextual actions; no clutter in global toolbar.
- [ ] Notification icon only if a genuine notification stream exists.
- [ ] Keep RFS AI access recognizable and discoverable across pages.

### H. Reports — P1

- [ ] Executive summary as first content section.
- [ ] Group bookings, demand, revenue, labour costs, staffing and performance figures.
- [ ] Clear report date span and optional comparison period.
- [ ] Generate and download actions with loading, success and failure feedback.
- [ ] Report history with accessible saved-report entries and empty archive state.
- [ ] AI-assisted report functions only if compatible with current backend.
- [ ] Distinguish observed results from estimates and forecasts.
- [ ] Maintain secure, short-lived links for stored report downloads.

### I. Staffing rules — P2

- [ ] Clear department and demand-level groups.
- [ ] Editable role/rate/headcount tables with authorization checks.
- [ ] Add/edit forms with inline validation and confirmation.
- [ ] Explain rules' relationship to staff recommendations.
- [ ] Clear unsaved-changes, read-only and error states.

### J. Forecast accuracy — P2

- [ ] Explain available model measures (e.g. MAE and RMSE) in plain terms and with units.
- [ ] Actual vs predicted visualization using genuine evaluation samples.
- [ ] Evaluation period filters if historical evaluation data permits.
- [ ] Clearly communicate sample size, model limits and unavailable metrics.
- [ ] Never invent accuracy percentages or confidence bands.

### K. Forms, dialogs and feedback — P1

- [ ] Consistent labels, inline helper text, validation and required fields.
- [ ] Confirmation modals for cancellation/deletion; success messages for saved operations.
- [ ] Accessible error text, retry and prevention of duplicate submissions.
- [ ] Clear actions and predictable keyboard focus in dialogs.
- [ ] Consistent skeleton, empty, no-match and permission-denied states.

### L. Responsive design and accessibility — P0

- [ ] Desktop preserves approved overall positioning.
- [ ] Tablet reduces card columns and optionally collapses sidebar.
- [ ] Mobile uses stacked cards, drawer navigation and usable chart/table overflow.
- [ ] Chat panel switches to usable mobile-height/fullscreen behaviour as necessary.
- [ ] Visible focus, readable contrast, generous touch targets and reduced-motion compliance.
- [ ] Charts have text summaries and tables have meaningful headers.
- [ ] Test major actions with keyboard, screen reader and different viewport sizes.

### M. Operational intelligence and storytelling — P1

- [ ] Every insight explains *what happened/what is expected*, *why it matters* and *what action to consider*.
- [ ] Explain base time period and comparison logic for changes.
- [ ] Highlight forecast peaks, staffing shortages and unusual patterns only with valid signals.
- [ ] Show direct navigation to related booking or staffing workflows.
- [ ] Separate rules-based alerts from AI-generated commentary, including uncertainty.
- [ ] Do not present guesses as real business facts.

## 4. Proposed delivery sequence

| Phase | Scope | Exit criteria |
|---|---|---|
| 1 — Foundation | Design tokens, shared components, loading/empty/error and responsive shell | Reusable UI kit verified on representative pages |
| 2 — Core | Dashboard, Bookings, Reservation and Staff Forecasts | Insights and actions are clear; existing workflows still work |
| 3 — AI | Launcher, welcome, prompts, message UI, confirmations and structured results | Accessible panel executes only supported authorized actions |
| 4 — Supporting | Reports, Staffing Rules, Forecast Accuracy, forms and profile/navigation polish | All pages use same visual language |
| 5 — Validation | Visual QA, responsive, accessibility, usability, regression | Approved mockup alignment and no broken critical paths |

## 5. Global definition of done

Each implementation backlog item must document:

1. User goal and acceptance criteria.
2. Affected routes and React components.
3. Data/API requirements and relevant role permissions.
4. Loading, empty, failure and confirmation states.
5. Responsive and WCAG 2.2 AA considerations.
6. Tests, screenshots and measured usability outcomes.
7. Comparison with the approved RFS UI reference.

## 6. Out of scope unless separately approved

- Replacement of brand colours or fonts.
- Major repositioning of sidebar, top bar or chat entry point.
- Replacing ML models or backend architecture.
- Fabricated KPIs, comparison percentages, staffing schedules or booking records.
- Unverified chatbot actions or destructive changes without confirmation.

## 7. Repository organization

Keep **this Markdown specification in the same existing chatbot directory** as `ManagerChat.jsx`. The directory can later house a chatbot-specific component README and UI assets, while this document serves as the cross-application redesign plan. Do not move existing components purely to accommodate the specification.
