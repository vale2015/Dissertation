# RFS system architecture

**Current-state guide — 10 November 2026.** This is the overall component and data-flow reference for the single-restaurant dissertation prototype. The [PRD](../product/PRD.md) owns product requirements, the [agent guide](../agents/AGENT.md) covers both assistant and delivery agents, and the [tracker](../product/IMPROVEMENT_TRACKER.md) owns implementation/release evidence. Diagrams show code and deployed boundaries, not a claim that every end-to-end acceptance check has passed.

## System context and deployment

```mermaid
flowchart LR
  U[Manager / supervisor / staff browser] -->|HTTPS| N[Next.js 16 / React 19 frontend and BFF]
  N -->|Server-side bearer JWT| F[Flask 3 API]
  F -->|SQLAlchemy / psycopg2| P[(Supabase PostgreSQL)]
  F -->|Prediction| M[Versioned Random Forest artifact]
  F -->|Optional context| W[Open-Meteo / event providers]
  N -. Ambiguous non-secret intent only .-> C[Cloudflare Workers AI / Qwen]
```

The frontend and backend are separate Vercel projects. Supabase is a separate managed database and migration release step. The browser uses same-origin Next.js routes; it has no direct PostgreSQL connection or Cloudflare credential. `BACKEND_API_URL` points the Next.js server to the Flask API. Flask issues the session JWT and checks current account state and permissions; Next.js stores the token in an HttpOnly cookie, validates protected pages, and forwards it in server-side requests. Mutating proxy requests reject mismatched origins. Frontend visibility is usability, **not** authorization.

The current frontend includes the sidebar calendar below Settings, the redesigned Add Booking form, a read-only reservation-planning page, and a staffing-planning page that generates a saved run and displays role/cost detail. The code is present in the current branch; the [tracker](../product/IMPROVEMENT_TRACKER.md) distinguishes preview, production, and still-open signed-in checks for each slice.

## Components and ownership

| Component | Responsibility | Primary implementation |
| --- | --- | --- |
| Next.js App Router UI | Signed-in shell, dashboard, bookings, forecasts, staff, view-only Reports, Settings, notifications, RFS AI. | `frontend/src/app/dashboard/`, `frontend/src/components/` |
| Next.js BFF | Auth cookie routes, same-origin backend proxy, manager chatbot orchestration, off-by-default AI report-explanation route. | `frontend/src/app/api/` |
| Flask API | Authentication, permission checks, request validation, booking/demand, forecast, staffing, reports, events/weather, notifications. | `backend/app/api/`, `controllers/`, `services/` |
| ML pipeline | Train and load the Random Forest demand model, produce short-horizon predictions. | `backend/app/ml/` |
| PostgreSQL | Application records, immutable forecast runs, served-cover actuals, saved report snapshots, notification inbox. | `supabase/migrations/`, `backend/app/db/` |
| External context | Weather and nearby events; optional and isolated from core reports/forecasts. | `backend/app/services/weather_service.py`, `events_service.py` |
| Cloudflare classifier | Classify only ambiguous chatbot text into allowlisted intents; no business-data or staff-write authority. | `frontend/src/lib/chatbot-model.mjs` |

The app supports one configured restaurant/location. Manager, supervisor, and staff are application roles: managers administer staff/rules and use RFS AI; supervisors can use permitted operational views; staff have own-profile access. The Flask permission map is authoritative; the shared dashboard layout and sidebar apply matching UI guards.

## Main data flows

### Booking to demand and forecast

```mermaid
sequenceDiagram
  participant U as Browser
  participant N as Next.js proxy
  participant F as Flask services
  participant D as PostgreSQL
  participant M as Random Forest
  U->>N: Create / change / delete booking
  N->>F: Authenticated request
  F->>D: Transactional booking + affected demand update
  D-->>F: Consistent result
  F-->>N: Validated response
  N-->>U: Same-origin result
  U->>N: Request demand forecast
  N->>F: Protected read request
  F->>M: Predict eligible dates
  F-->>N: Predicted covers (not persisted here)
  N-->>U: Same-origin result
  U->>N: Request staffing forecast
  N->>F: Protected staffing request
  F->>M: Predict demand for staffing
  F->>D: Insert and activate immutable forecast run
  F-->>N: Staffing result and run reference
  N-->>U: Same-origin result
```

Booking mutations and their demand aggregates are designed to be atomic. Forecasts respect configured closed days and are estimates, not booking totals or actual guests served. The standalone demand-forecast endpoint predicts without saving a run; the staffing-forecast path persists an immutable run and activates it for later comparison. There is **no POS integration**: an authorised person enters served-cover actuals after service. The forecast-accuracy feature distinguishes real actuals from synthetic demo fixtures; genuine pre-service versus completed-service and role journeys still require release verification ([#21](../product/IMPROVEMENT_TRACKER.md)).

### Reports and notifications

The manager asks RFS AI to generate, save, retrieve, or download a management report. Next.js calls protected Flask report endpoints; Flask calculates from canonical operational data and generates JSON/PDF/CSV without trusting browser-submitted totals. Saved snapshots are immutable and available for 90 days through authenticated, user/format-bound downloads. The sidebar Reports page only views stored snapshots. A successful save inserts a recipient-scoped `report_saved` notification in the same database transaction. The bell reads a bounded inbox and marks only the signed-in recipient's rows read. The migration was applied and RLS/grants checked, but a live end-to-end notification event and cross-user browser checks remain open ([#57](../product/IMPROVEMENT_TRACKER.md)).

### Manager assistant

`GET /api/chatbot` verifies a manager session and fetches weather without a model call. `POST /api/chatbot` validates the request, routes explicit commands deterministically, and may send an ambiguous **user-typed message** to Cloudflare Workers AI after a limited obvious-secret screen. That screen is not comprehensive personal-data protection; privacy review and stronger controls remain open. The route then calls fixed protected Flask endpoints or opens the embedded Staff Management workspace. The model never receives backend records or executes mutations. Secure forms and confirmation handle staff writes; durable idempotency and live model/usage checks remain open. The separate AI saved-report explanations pilot is feature-gated **off by default**, its current production enablement has not been rechecked, and it is not a current Reports-page control. See [AGENT.md](../agents/AGENT.md) and [#54–55](../product/IMPROVEMENT_TRACKER.md).

**Planned, not deployed:** the PM has requested conversational staff registration and editing, followed by removal of Staff Management from the visible sidebar. The [staff-in-chat workflow](../chatbot/STAFF_MANAGEMENT_CHAT_WORKFLOW.md) diagrams the proposed confirm-and-execute boundary; it requires durable pending-action/idempotency storage, a reviewed migration, protected execution, and release checks before the navigation change. The current embedded staff workspace and guarded direct page remain in place until then.

## Data and security boundaries

- The database schema is an ordered, forward-only chain under `supabase/migrations/`; the [migration guide](../../supabase/README.md) records safe replay procedures. Git push, migration application, and Vercel deployment are distinct states.
- Application tables holding private data are server-only in the intended access model, with RLS and revoked client grants where applied; complete project-wide access/default-grant verification remains tracked under [#3–4](../product/IMPROVEMENT_TRACKER.md).
- Flask authenticates protected blueprints and checks the permission associated with each operation. Report and notification services filter data by authorization/recipient. Session and provider secrets must not enter model prompts or browser variables.
- Optional provider failures should produce warnings or unavailable states without blocking core booking, forecasting, or reporting. Provider caches are instance-local, not a distributed cache.
- The prototype is not multi-tenant; scaling to high traffic or multiple restaurants would require deliberate tenancy, storage/cache, background-work, and performance decisions rather than assuming the current serverless boundaries suffice.

The project research pipeline is outside the runtime app architecture. A web-based weekly task is intended to submit public research Issues; a trusted GitHub Actions workflow validates them and writes only generated files under `docs/knowledge/`. The workflow cannot narrow the existing owner's GitHub connection, and its first real publication remains unverified. See the [knowledge runbook](../knowledge/AUTOMATION_RUNBOOK.md) and tracker [#64](../product/IMPROVEMENT_TRACKER.md).

## Verification and known limits

Use the [tracker](../product/IMPROVEMENT_TRACKER.md) for the exact status of each increment. Current gaps include authenticated role and responsive checks for the redesigned UI, durable staff-write idempotency, live assistant model/privacy/usage evaluation, real-data accuracy evidence, some migration/access gates, and broader end-to-end coverage. A Vercel READY state or passing unit test does not close these gaps. Historical design and release notes remain indexed in [docs/README.md](../README.md); this guide is the concise current architecture map.
