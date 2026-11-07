# RFS — Restaurant Forecasting System

RFS is a single-restaurant dissertation prototype for planning services. It combines bookings, short-term demand forecasts, staffing guidance, saved management reports, and selected external context in a role-protected web app. Forecasts and financial figures are decision support, not guaranteed outcomes or accounting statements.

The [Product Requirements Document](docs/product/PRD.md) is the main product reference. The [improvement tracker](docs/product/IMPROVEMENT_TRACKER.md) is the source of truth for delivery and verification status; a deployed feature is not automatically marked Done.

## Current product

- Dashboard: the calendar sits below Settings in the sidebar, defaults to the current Europe/London day, and opens a selected-day view immediately. The page shows observed and predicted covers, staffing and revenue estimates, and accessible charts.
- Bookings and forecasts: the Add Booking form separates required service details from optional guest details; protected booking changes update daily demand. Reservation Forecast presents seven- or ten-day estimates with closure context and a daily table. Staffing Forecast presents recommended department and role levels with estimated labour costs from a saved run—not a rota or actual sales. Immutable runs preserve earlier predictions. Forecast Accuracy compares eligible pre-service predictions with manually entered served covers; its separate demo sample is explicitly synthetic.
- Staff and settings: managers can currently administer staff accounts from the sidebar page or the protected in-chat workspace. Settings combines own-account fields with manager-authorized Staffing Rules. Supervisors can use operational views but cannot administer accounts; staff can access their own profile.
- Reports: the Reports page is **view-only** for saved snapshots. The manager-only RFS AI assistant generates, saves, retrieves, and downloads reports as PDF or CSV through protected APIs. Reports contain aggregate operational data, not customer names or booking notes.
- RFS AI: its launcher sits below the left navigation. On desktop the chat opens as a left dock and shifts the page rather than covering it; on smaller screens it stays in flow. It shows restaurant weather when opened and accepts typed requests for events, bookings/forecasts, reports, and a protected in-chat Staff Management workspace. Suggested prompts fill the composer but do not send a request automatically. Cloudflare Workers AI/Qwen classifies ambiguous requests when configured; explicit supported requests use deterministic routing. The model does not authorize actions or receive raw staff records.
- Notifications: a real, recipient-scoped inbox shows completed report-save events with unread/read state. Weather and event-provider failures do not block core forecasting or reports.

The approved next staff workflow will let a manager register or edit an account through a typed conversation, with secure password capture, exact-account review, explicit confirmation, and retry-safe execution. **It is not implemented yet.** Staff Management stays in the sidebar until those journeys and the other in-chat actions pass release checks. See the [staff-in-chat delivery plan](docs/chatbot/STAFF_MANAGEMENT_CHAT_WORKFLOW.md) and [#54](docs/product/IMPROVEMENT_TRACKER.md).

The app has **no POS integration**. Booking totals are not actual guests served; genuine forecast accuracy requires a completed service and a manually recorded actual. Current release and acceptance gaps are recorded under [#21](docs/architecture/FORECAST_ACCURACY.md), [#54–55](docs/product/IMPROVEMENT_TRACKER.md), and [#57](docs/design/RFS_UI_UX_REDESIGN_PLAN.md).

### Forecast modernization in progress

The forecast-serving update removes the CPU-heavy web retraining endpoint, restricts each forecast read to its required 90-day history, and reuses the bundled Random Forest artifact within a warm process. The accuracy API also adds WAPE and a saved-model-version breakdown. These changes passed 224 backend tests and independent security/QA review, but live latency and accuracy improvements have not been established. They are partial steps under [#17, #22, and #61](docs/product/IMPROVEMENT_TRACKER.md). Retraining remains available offline, not through the app. A durable manager-only training job, real performance measurements, and a fair recursive 7/10-day benchmark against genuine served-cover actuals remain open. The synthetic demo sample cannot justify promoting another model. The independent review also identified a separate existing demand-write permission gap, tracked as [#62](docs/product/IMPROVEMENT_TRACKER.md). The tracker records Git, database, and Vercel release evidence separately.

## Architecture

```mermaid
flowchart LR
  B[Browser] -->|HTTPS + HttpOnly cookie| N[Next.js 16 / React 19 UI and BFF]
  N -->|Server-side JWT bearer token| F[Flask 3 API]
  F -->|SQLAlchemy| D[(Supabase PostgreSQL)]
  F -->|Forecasting| M[Random Forest model artifact]
  F -->|Optional context| P[Open-Meteo / Ticketmaster / Skiddle / TheSportsDB]
  N -. Bounded ambiguous-intent classification .-> C[Cloudflare Workers AI / Qwen]
```

The browser calls same-origin Next.js routes, not PostgreSQL or the Supabase Data API. Next.js stores the Flask-issued JWT in an HttpOnly session cookie and forwards protected requests with a server-side bearer token. Flask checks the current account and permissions and remains authoritative for booking, forecast, report, staff, and notification operations. Cloudflare credentials remain server-side; the model only classifies ambiguous text into an allowlisted intent. Saved reports and notification events are persisted in PostgreSQL. Optional provider results use a backend instance cache, so context can be unavailable on a cold instance.

The frontend and backend are separate Vercel projects. The Random Forest artifact is bundled with the backend deployment, not stored in a model registry or durable object store. Supabase migrations are a separate release step; pushing code does not apply them. See [database setup and migration history](supabase/README.md) and the tracker for open migration/access checks.

## Repository map

| Path | Purpose |
|---|---|
| [`frontend/`](frontend/) | Next.js pages, protected API proxy, manager assistant, and UI tests |
| [`backend/`](backend/) | Flask routes, services, forecasting, reports, and pytest tests |
| [`supabase/migrations/`](supabase/migrations/) | Ordered, forward-only PostgreSQL schema changes |
| [`docs/`](docs/README.md) | PRD, current backlog, design decisions, and implementation evidence |
| [`.agents/skills/`](.agents/skills/) and [`AGENTS.md`](AGENTS.md) | Sequential PM-led delivery roles and coordination rules |

## Run locally

Prerequisites: Node.js/npm, Python 3/pip, and an authorized PostgreSQL database. Do not commit credentials or real session links.

1. Install the root and frontend packages: `npm install`, then `npm --prefix frontend install`.
2. Create a Python virtual environment at `backend/venv` and install `backend/requirements.txt` (plus `backend/requirements-dev.txt` to run tests).
3. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and configure the JWT key, PostgreSQL connection, restaurant location, and any optional event keys. Set `BACKEND_API_URL=http://127.0.0.1:5000/api` in a private `frontend/.env`; do not prefix it with `NEXT_PUBLIC_`.
4. On Windows, run `npm run dev` from the repository root. This starts Next.js at `http://localhost:3000` and Flask at `http://127.0.0.1:5000`. The root backend script uses `backend/venv/Scripts/python.exe`; on other platforms start Flask with the activated virtual environment instead.

For the manager assistant's optional ambiguous-intent model, configure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` **only** in the frontend server environment. Keep the token out of Git and browser variables. Explicit supported chat requests can work without model configuration. The separate AI report-explanation pilot is off by default; its current production enablement was not rechecked in the documentation audit. See [its release gates](docs/chatbot/AI_REPORT_EXPLANATIONS.md).

### Checks

From `frontend/`, run `npm run lint`, `npm run test:unit`, `npm run test:components`, `npm run test:routes`, and `npm run build`. With the backend virtual environment active and development requirements installed, run `python -m pytest` from `backend/`. Some local Next.js builds in this OneDrive checkout have encountered Windows file locks; the tracker records when an alternate clean output directory was used for verification.

## Deployment and verification

GitHub `main` is connected to separate Vercel frontend and backend projects. The [live frontend](https://dissertation-valeriogerardi-5538s-projects.vercel.app/) is a controlled prototype, not a claim of commercial readiness. Apply and verify new Supabase migrations before code that depends on them is released. After deployment, check health, authenticated manager and restricted-role journeys, relevant data changes, and runtime errors. [The tracker](docs/product/IMPROVEMENT_TRACKER.md) records Git, Supabase, Vercel, and end-to-end verification separately.

## PM-led agentic delivery team

The Product Manager (you) owns scope, priorities, and final product acceptance. `AGENTS.md` coordinates reusable project skills; it does not create agents that run continuously. For each task, the engineering lead chooses a QUICK, STANDARD, or FULL path. Specialists work **one at a time**, with independent QA and risk-based UX, security, or AI evaluation when needed. An implementer cannot approve their own non-trivial work. The [RFS BACKLOG TASKS Trello board](https://trello.com/b/vF796eiJ/rfs-backlog-tasks) shows task progress, while the [Markdown tracker](docs/product/IMPROVEMENT_TRACKER.md) remains authoritative for acceptance, tests, and release evidence. Agents update the tracker first, then the matching card at a task handoff; there is no unattended background sync.

```mermaid
flowchart LR
  PM[PM: story, priority, acceptance] --> Lead[Engineering lead: triage]
  Lead --> Impl[One implementer: frontend or backend]
  Impl --> Check{Risk-appropriate check}
  Check -->|QUICK| Self[Focused self-check]
  Check -->|STANDARD or FULL| QA[Independent QA]
  QA --> Extra[UX / security / AI review if needed]
  Self --> PM2[PM acceptance]
  Extra --> PM2
  Lead -. pickup .-> T[(Markdown tracker)]
  PM2 -. evidence and status .-> T
  T -. status mirror at handoff .-> B[Trello board]
```

The board uses READY (not picked up), IN PROGRESS (work under way), IN REVIEW (release checks or acceptance pending), and DONE (fully tested and accepted). Deferred task #5 stays off the board by PM choice. Each numbered card has a description and acceptance criteria. See the [board workflow](docs/agents/TRELLO_BOARD_WORKFLOW.md), [agent guide](docs/agents/AGENT.md), and [team workflow](docs/agents/RFS_AI_TEAM_WORKFLOW.md) for handoff requirements. The team configuration is still **Partial** under tracker #58: a real feature has exercised the sequential handoff, but explicit PM acceptance of that full process is not recorded. A role never grants permission to merge to `main`, deploy, or change production data without PM approval.

## Documentation and limitations

Start with the [PRD](docs/product/PRD.md), then use the [docs index](docs/README.md) to find the [architecture](docs/architecture/ARCHITECTURE.md), [design system](docs/design/DESIGN_SYSTEM.md), and release notes. The project is a single-restaurant academic prototype. Forecast quality depends on representative historical and served-actual data; live chatbot inference, staff-write idempotency, signed-in responsive/accessibility checks, genuine accuracy comparisons, and some migration/access gates still require verification. Consult the tracker before treating any feature as fully tested.

## Author

Valerio Gerardi — Dissertation Project, Southampton Solent University
