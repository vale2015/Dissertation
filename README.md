# RFS — Restaurant Forecasting System

RFS is a full-stack dissertation project for small independent restaurants. It combines booking data, demand forecasting, staffing rules, and labour-cost estimates in a manager-facing dashboard.

The living checklist for the original architecture-improvement plan is [docs/IMPROVEMENT_TRACKER.md](docs/IMPROVEMENT_TRACKER.md). Update it as each improvement is verified.

The current application uses a Next.js backend-for-frontend (BFF) in front of a Flask API. The JWT is carried in an HttpOnly cookie that browser JavaScript cannot read; Next.js reads it server-side and adds it as a bearer token when forwarding protected requests to Flask. The browser does not connect directly to PostgreSQL or the Supabase Data API.

## Current architecture

```mermaid
flowchart LR
    B["Manager's browser"] -->|"HTTPS and HttpOnly session cookie"| N
    subgraph V["Vercel - two projects"]
        N["Next.js 16 / React 19<br/>pages, auth routes and API proxy"]
        F["Flask 3 API<br/>controllers and services"]
        C["Per-instance weather and events cache"]
    end
    N -->|"Server-side JWT bearer token"| F
    F -->|"SQLAlchemy / psycopg2"| D[("Supabase PostgreSQL")]
    F -->|"Predict and retrain"| M["Random Forest model artifact"]
    F -->|"Weather and events routes"| P["Open-Meteo, Ticketmaster,<br/>Skiddle and TheSportsDB"]
    F -->|"Cache optional provider context"| C
```

The frontend and backend are separate Vercel projects. Management reports are assembled by Flask on demand from forecast and database data; they read optional weather and event context from the current instance's cache instead of calling providers during report generation.

### Request and authentication flow

1. The user submits credentials to `POST /api/auth/login` on Next.js.
2. Next.js forwards the credentials to Flask at `POST /api/auth/login`.
3. Flask applies shared PostgreSQL login limits, verifies the password stored in `public.users`, and signs an eight-hour HS256 JWT.
4. Next.js stores the JWT in the `rfs_session` HttpOnly, `SameSite=Lax` cookie. It is also marked `Secure` in production.
5. Browser requests for application data go to `/api/backend/*`. The Next.js proxy reads the cookie server-side, attaches `Authorization: Bearer <token>`, and forwards the request to Flask.
6. Flask authenticates protected requests and applies role permissions to the dashboard, booking, forecasting, staffing, report, weather, event, and staff-administration blueprints. Health and account-entry routes remain public; profile and current-user routes still require a valid session.

The proxy rejects cross-origin state-changing requests and removes an expired session cookie when Flask returns `401`. Flask restricts CORS origins and adds CSP, frame, content-type, and referrer-policy response headers.

Login is limited by normalized email (five attempts in 15 minutes) and by the backend-observed source IP (1,000 attempts in 10 minutes). Public activation and password-reset token endpoints have a separate 1,000-attempt IP limit. Excess attempts receive `429` with `Retry-After`; email locks start at 30 seconds and grow to a 15-minute cap. Successful login clears that email's counter. Counters are shared across Flask instances, contain only HMAC key hashes, and expire through opportunistic cleanup. The high IP threshold reflects that Vercel's Next.js server-side proxy may share an outbound address; a verified client-IP forwarding mechanism would be needed for finer per-visitor limits.

## Features

- authenticated manager login, session checking, and logout;
- dashboard summaries for demand, estimated revenue, food cost, and labour cost;
- booking creation, retrieval, editing, and deletion;
- automatic synchronization of booking changes into daily demand features;
- seven- or ten-day reservation-demand forecasts;
- configurable forecast start dates and Monday closure handling;
- staffing recommendations and labour-cost forecasts;
- staffing-rule and staff-role views;
- standalone monthly local-event searches within the configured restaurant radius;
- local weather in the authenticated dashboard top bar;
- booking, demand, staffing, and report screens;
- on-screen management reports with matching PDF and Excel-compatible CSV downloads;
- manager-controlled staff registration, account status management, password recovery, and user profiles;
- backend-enforced permissions for manager, supervisor, and staff roles;
- model retraining from historical restaurant demand data;
- application and database health checks.

## Technology stack

| Layer | Technology |
|---|---|
| Web application and BFF | Next.js 16.2, React 19.2, JavaScript, CSS |
| REST API | Python, Flask 3.1, Flask-CORS |
| Authentication | Werkzeug password hashes, PyJWT, HttpOnly cookies |
| Database | Supabase-hosted PostgreSQL, SQLAlchemy, psycopg2 |
| Forecasting | pandas, scikit-learn Random Forest, joblib, `holidays` |
| Report exports | ReportLab (A4 landscape PDF), Python standard-library CSV |
| External context | Open-Meteo, Ticketmaster, Skiddle, TheSportsDB, Requests, pygeohash |
| Testing | pytest, Responses, ESLint, Next.js production builds |
| Local orchestration | npm and Concurrently |

## Downloadable management reports

Authenticated managers and supervisors open **Dashboard > Reports** after selecting a dashboard date. The page requests one canonical backend report for either 7 or 10 forecast days; the first forecast row is the day after the selected historical base date. The preview, PDF and CSV use the same calculations and totals.

Protected Flask endpoints (accessed by the browser through `/api/backend/*`) are:

- `GET /api/reports/management?selected_date=YYYY-MM-DD&days_ahead=7|10`
- `GET /api/reports/management/pdf?selected_date=YYYY-MM-DD&days_ahead=7|10`
- `GET /api/reports/management/csv?selected_date=YYYY-MM-DD&days_ahead=7|10`

Reports are generated on demand in memory and are not stored in the database or filesystem. They contain aggregated operational information only—no customer names, contact information, booking notes, authentication data or provider payloads.

Optional, non-secret metadata can be configured with `REPORT_CURRENCY` (default `GBP`), `REPORT_RESTAURANT_NAME` and `REPORT_RESTAURANT_CITY`. The name and city fall back to the existing restaurant variables, then to local development defaults. ReportLab is pinned in `backend/requirements.txt`; no new API key is needed.

Demand prediction is required. Weather and local-event context are optional: report generation uses only context already cached in the current backend instance and never waits for those external providers. A cache miss adds a visible warning and leaves core staffing and financial reporting available; expired cached context is labelled as possibly out of date. Because instance memory is not shared across Vercel functions, optional context may be unavailable on a cold instance until a separate weather or events request has warmed that instance. Weather also appears only when an exact forecast date is available, so historical or later report dates may show **Unavailable**. Financial figures are estimates based on the latest business settings and are intended for management planning, not accounting statements.

## Staff accounts and role-based access

Staff registration is manager-controlled; there is no public registration endpoint. A manager registers a staff member with an initial password and the account is active immediately. Application access roles are separate from operational restaurant roles:

- `manager`: dashboard, bookings, forecasts, reports, staffing rules, staff administration and own profile;
- `supervisor`: dashboard, bookings, forecasts, reports and own profile;
- `staff`: own profile only; personal shift viewing is reserved for future development.

Operational roles continue to come from `public.staff_roles` (for example Kitchen Assistant in Kitchen) and remain the source for staffing and labour-cost calculations. New registrations use the `active` state; legacy accounts may still have the `invited` state. Other states are `suspended` and `inactive`. Flask enforces every permission even when the frontend hides a page or navigation item.

### Database migration

The seven forward-only migrations in [`supabase/migrations/`](supabase/migrations/) cover the original application tables, both staff-account changes, the demand-date primary key, shared authentication rate-limit counters, and server-only access to all application tables and sequences. Flask connects directly to PostgreSQL through SQLAlchemy; it does not use Supabase Auth or the browser-facing Data API. All ten application tables have RLS enabled, and the existing `anon` and `authenticated` table/sequence grants have been revoked. Future Supabase-managed default grants still need verification before access-control item 4 can be marked complete; see the [improvement tracker](docs/IMPROVEMENT_TRACKER.md).

See [`supabase/README.md`](supabase/README.md) for fresh-database setup, live-project reconciliation, and the read-only [`verify_access.sql`](supabase/verify_access.sql) check. The older `backend/migrations/001_staff_accounts.sql` is a combined manual script retained for reference; do not apply it alongside the timestamped migrations. Its rollback remains manual and retains audit history. The [migration replay workflow](.github/workflows/migration-replay.yml) replays the SQL against PostgreSQL 17 and checks table access, but a passing GitHub Actions run has not yet been observed because the account's billing lock prevents its runner from starting.

### Invitation and recovery lifecycle

Managers open **Dashboard > Staff Management**, select **Register staff member**, enter the employee's details and a 12–128 character initial password, and create an immediately active account. The password is hashed by Flask before storage and is never returned by the API.

Managers may create a one-hour password-reset link for an active account. Resetting a password, suspending an account or deactivating it increments `session_version`, invalidating existing sessions on their next Flask request. Accounts are soft-deactivated, never deleted. A manager cannot suspend/deactivate themselves or demote, suspend or deactivate the final active manager. Audit metadata excludes passwords, password hashes, raw tokens, JWTs and API keys.

The current manager interface creates active accounts directly and does not email credentials. The backend and public activation page retain support for one-time invitation tokens for invited accounts, while the active workflow exposes copyable password-reset links only. Email delivery is not included. `FRONTEND_URL` determines the public link origin. Never commit real links, initial passwords, or test passwords.

## Repository structure

```text
DissertationApp/
├── .agents/skills/          # Project skills, including board-card status moves
├── .github/workflows/       # PostgreSQL migration replay check
├── backend/
│   ├── app/
│   │   ├── api/             # Flask blueprints and route definitions
│   │   ├── controllers/     # HTTP validation and response handling
│   │   ├── db/              # SQLAlchemy engine and sessions
│   │   ├── middleware/      # JWT protection for private blueprints
│   │   ├── ml/
│   │   │   ├── artifacts/   # Serialized Random Forest model
│   │   │   └── pipelines/   # Training and prediction pipelines
│   │   ├── services/        # Database, reporting, provider, and domain logic
│   │   └── utils/           # Event, geographic, and weather helpers
│   ├── migrations/          # Legacy staff-account SQL and rollback reference
│   ├── tests/               # pytest service, controller, export, and permission tests
│   ├── .env.example         # Backend configuration template
│   ├── requirements-dev.txt
│   ├── requirements.txt
│   ├── main.py              # Deployment entry point
│   └── run.py               # Local development entry point
├── frontend/
│   ├── public/
│   └── src/
│       ├── app/
│       │   ├── api/auth/    # Login, logout, and session BFF routes
│       │   ├── api/backend/ # Authenticated catch-all Flask proxy
│       │   └── dashboard/   # App Router dashboard pages
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── utils/
├── Additional Documentation/ # Research material and architecture diagrams
├── docs/                     # Product requirements and project documentation
├── supabase/
│   ├── migrations/          # Seven forward-only PostgreSQL migrations
│   ├── schema_snapshot.sql  # Read-only schema fingerprint
│   ├── verify_access.sql    # Read-only role and grant assertions
│   └── README.md            # Migration and verification guide
├── AGENTS.md                # Improvement and backlog coordination rules
├── package.json              # Root development commands
└── README.md
```

## Database responsibilities

The application uses PostgreSQL tables including:

| Table | Purpose |
|---|---|
| `public.users` | User identity, password hash, application role, account status, operational role, and session version |
| `bookings` | Individual restaurant bookings |
| `restaurant_demand_features` | Daily booking aggregates and forecasting features |
| `public.business_settings` | Average spend and food-cost inputs |
| `public.staffing_rules` | Cover bands and required staffing levels |
| `public.staff_roles` | Roles, departments, hourly rates, and shift hours |
| `public.staff_cost_forecast` | Generated staffing and cost forecast rows |
| `public.user_account_tokens` | Hashed, expiring, single-use activation and password-reset tokens |
| `public.staff_account_audit` | Non-secret audit history for staff-account actions |
| `public.auth_rate_limits` | Server-only, HMAC-keyed login and public account-token throttling counters |

Creating, updating, or deleting a booking rebuilds the affected daily aggregate in `restaurant_demand_features`. Mondays are treated as closed days and cannot accept bookings.

Booking mutation and aggregate rebuilding share a transaction. Date-scoped transaction locks prevent concurrent rebuilds for the same day from conflicting, and `restaurant_demand_features` has a demand-date primary key.

## Machine-learning pipeline

The target is daily `total_covers`. Training reads historical demand records, performs a chronological 80/20 split, and trains a `RandomForestRegressor`. Features include:

- seven- and thirty-day rolling averages for demand components and duration;
- one-, seven-, and fourteen-day total-cover lags;
- day, week, month, and restaurant-weekend indicators;
- UK bank-holiday and festive-period indicators.

Training reports MAE, RMSE, R², time-series cross-validation scores, and feature importances. The serialized model and metadata are stored at `backend/app/ml/artifacts/demand_model.pkl`. Prediction uses up to 90 historical days and supports seven- or ten-day horizons.

## Prerequisites

- Node.js and npm;
- Python 3 and pip;
- access to the project's PostgreSQL database.

The root backend command currently uses a Windows virtual-environment path. On macOS or Linux, run Flask directly with the activated virtual environment or adjust the root script.

## Configuration

Configuration files containing secrets are ignored by Git.

### Backend: `backend/.env`

Set a JWT signing key and either separate PostgreSQL values or one complete database URL.

```env
SECRET_KEY=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:3000

POSTGRES_USER=postgres-user
POSTGRES_PASSWORD=postgres-password
POSTGRES_HOST=database-host
POSTGRES_PORT=6543
POSTGRES_DATABASE=postgres
```

Instead of the five `POSTGRES_*` connection values, the backend also accepts:

```env
POSTGRES_URL=postgresql://user:password@host:port/database
```

or:

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

Database connections require SSL. `POSTGRES_DB` is accepted as an alias for `POSTGRES_DATABASE`.

Weather is resolved for the restaurant configured at deployment time, not for the location of the user's browser or device. Configure the restaurant location in `backend/.env` for local development:

```env
RESTAURANT_NAME=Your Restaurant
RESTAURANT_CITY=Your City
RESTAURANT_LATITUDE=
RESTAURANT_LONGITUDE=
RESTAURANT_TIMEZONE=Europe/London
WEATHER_CACHE_TTL_SECONDS=1800

TICKETMASTER_API_KEY=replace-with-your-consumer-key
RESTAURANT_COUNTRY_CODE=GB
EVENT_SEARCH_RADIUS_KM=10
EVENTS_CACHE_TTL_SECONDS=21600
EVENTS_MAX_RESULTS=100
SPORTSDB_LEAGUE_IDS=4328
SKIDDLE_API_KEY=replace-with-your-skiddle-api-key
TICKETMASTER_LOCALE=en-gb

REPORT_CURRENCY=GBP
REPORT_RESTAURANT_NAME=Your Restaurant
REPORT_RESTAURANT_CITY=Your City
```

The name, city, and timezone must not be empty. Latitude must be between `-90` and `90`, longitude between `-180` and `180`, and cache durations must be positive integers. Weather uses Open-Meteo and does not require an API key. `TICKETMASTER_API_KEY` and `SKIDDLE_API_KEY` enable their respective event providers; TheSportsDB uses its documented public free API key internally. Copy `backend/.env.example` as a starting template rather than committing a real `.env` file.

### Frontend: `frontend/.env`

`BACKEND_API_URL` must include Flask's `/api` prefix:

```env
BACKEND_API_URL=http://127.0.0.1:5000/api
```

This variable is read only by Next.js server routes and must not use the `NEXT_PUBLIC_` prefix.

## Installation

From the repository root, install the root and frontend packages:

```powershell
npm install
Set-Location frontend
npm install
Set-Location ..
```

Create the backend environment and install the pinned Python dependencies:

```powershell
Set-Location backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Set-Location ..
```

To run the backend test suite, also install `backend/requirements-dev.txt` in the activated virtual environment.

## Running locally

Start both applications from the repository root:

```powershell
npm run dev
```

| Service | Local address |
|---|---|
| Next.js | `http://localhost:3000` |
| Flask | `http://127.0.0.1:5000` |

The root scripts are:

| Command | Action |
|---|---|
| `npm run frontend` | Starts the Next.js development server |
| `npm run backend` | Starts Flask with `backend/venv/Scripts/python.exe` |
| `npm run dev` | Starts both services with Concurrently |

Frontend-only checks can be run from `frontend/`:

```powershell
npm run lint
npm run build
```

Backend tests can be run from `backend/` after installing both requirement files and configuring `backend/.env` as described above:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest
```

## Deployment

The `main` branch is connected to two Vercel projects. A push to `main` builds and deploys the frontend and backend independently; it does **not** apply Supabase migrations. Apply and verify any new database migration separately before releasing code that depends on it.

| Project | Source directory | Production address |
|---|---|---|
| Next.js frontend and BFF | `frontend/` | [dissertation-valeriogerardi-5538s-projects.vercel.app](https://dissertation-valeriogerardi-5538s-projects.vercel.app/) |
| Flask API | `backend/` | [dissertation-backend-coral.vercel.app](https://dissertation-backend-coral.vercel.app/) |

Configure `BACKEND_API_URL` in the frontend project's server-side environment with the backend's `/api` URL. Configure the backend project's JWT key, PostgreSQL connection, `FRONTEND_URL`, restaurant location, and any optional event-provider keys in its own environment. Keep database credentials and API keys out of the repository and all `NEXT_PUBLIC_` variables.

After a release, check the frontend home page, backend `/api/health/`, and backend `/api/health/database`. A `200` from these endpoints confirms basic availability and database connectivity, not that every authenticated workflow works. As of 22 October 2026, both production projects were `READY` for Git commit `fa4fd77`, and these three checks returned `200`. The separate GitHub migration replay check was still blocked by an account billing issue; consult the tracker for the current verification state.

## HTTP API

Flask listens at `http://127.0.0.1:5000`. Except for health and authentication, direct Flask requests require an `Authorization: Bearer <token>` header. The web application normally accesses protected endpoints through the same-origin Next.js path `/api/backend/<resource>`.

### Public Flask endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health/` | Application health |
| `GET` | `/api/health/database` | Database connectivity |
| `POST` | `/api/auth/login` | Verify credentials and issue a JWT |
| `POST` | `/api/auth/logout` | Stateless logout acknowledgement |
| `POST` | `/api/auth/invitations/validate` | Validate an account-activation token |
| `POST` | `/api/auth/activate` | Activate an invited account and set its password |
| `POST` | `/api/auth/password-reset/validate` | Validate a password-reset token |
| `POST` | `/api/auth/password-reset` | Complete a password reset |

### Protected Flask endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/dashboard/` | Demand and financial dashboard summary |
| `GET` | `/api/auth/me` | Validate a bearer token and return the current user |
| `GET`, `PATCH` | `/api/auth/profile` | Read or update the current user's profile |
| `GET`, `POST` | `/api/demand/` | List or create demand records |
| `GET` | `/api/demand/latest` | Latest demand record |
| `GET` | `/api/demand/stats` | Aggregate demand statistics |
| `GET`, `DELETE` | `/api/demand/date/<date>` | Read or delete demand for a date |
| `GET` | `/api/demand/weekly` | Latest seven-day demand summary |
| `GET` | `/api/demand/forecast` | Generate a demand forecast |
| `GET` | `/api/demand/train` | Retrain and save the Random Forest model |
| `GET` | `/api/booking/` | List bookings |
| `POST` | `/api/booking/add` | Create a booking and sync demand features |
| `GET`, `PUT`, `DELETE` | `/api/booking/<booking_id>` | Read, update, or delete a booking |
| `GET` | `/api/staff-cost/forecast` | Generate and store a staff-cost forecast |
| `GET` | `/api/staff-cost/` | List saved staff-cost forecast rows |
| `GET` | `/api/staff-cost/date/<date>` | Staff-cost rows for one date |
| `GET` | `/api/staffing-rules/` | Staffing rules and role information |
| `GET` | `/api/events/` | Monthly concerts, general events and sports near the restaurant |
| `GET` | `/api/weather/` | Current and forecast restaurant weather |
| `GET` | `/api/reports/management` | Generate the canonical management-report data |
| `GET` | `/api/reports/management/pdf` | Download the management report as PDF |
| `GET` | `/api/reports/management/csv` | Download the management report as CSV |
| `GET` | `/api/staff/` | Search and filter staff accounts (manager only) |
| `GET` | `/api/staff/roles` | List operational restaurant roles (manager only) |
| `POST` | `/api/staff/registrations` | Register an immediately active staff account (manager only) |
| `GET`, `PATCH` | `/api/staff/<user_id>` | Read or update a staff account (manager only) |
| `PATCH` | `/api/staff/<user_id>/status` | Suspend, reactivate, or deactivate an account (manager only) |
| `POST` | `/api/staff/<user_id>/password-reset` | Create a one-hour reset link (manager only) |

Demand forecasting accepts `days_ahead=7|10` and an optional `selected_date=YYYY-MM-DD`. The aliases `days` and `date` are also supported. Staff-cost forecasting accepts `days_ahead` and optional `selected_date` parameters.

Local-event searches accept `start_date` and `end_date` in `YYYY-MM-DD` format for ranges of up to 31 days. The Local Events dashboard page converts the selected calendar month into its exact first and last dates and offers Concerts, General events and Sports filters. Flask combines location-wide Ticketmaster and Skiddle discovery with TheSportsDB schedules; credentials are never exposed to the browser. Results are normalised, deduplicated and cached. The Refresh control sends an authenticated `refresh=1` request that refreshes both frontend and backend caches. Ticketmaster and Skiddle rows are filtered to the configured restaurant radius. TheSportsDB's free schedule feed frequently omits venue coordinates, so the backend applies a small London venue-coordinate lookup and safely excludes unknown venues.

Set `SKIDDLE_API_KEY` to enable location-wide Skiddle discovery; no artist list is required. Skiddle's API terms require visible source credit and use of the event link supplied with each result, both of which are preserved in the Local Events interface. TheSportsDB uses its documented public free v1 key `123`, so it requires no secret or Vercel environment variable. One season-schedule request is made for each configured `SPORTSDB_LEAGUE_IDS` value (English Premier League `4328` by default), then results are filtered to the selected month and restaurant radius. This avoids the free daily endpoint's three-result worldwide limit and Vercel request bursts. Each provider fails independently, so its outage does not remove results from the other services.

### Next.js server endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate and create the HttpOnly session cookie |
| `GET` | `/api/auth/session` | Return the current session user |
| `POST` | `/api/auth/logout` | Expire the session cookie |
| `POST` | `/api/auth/invitation` | Proxy invitation-token validation to Flask |
| `POST` | `/api/auth/activate` | Proxy account activation to Flask |
| `POST` | `/api/auth/reset-password` | Validate or complete password reset through Flask |
| `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `/api/backend/[...path]` | Authenticated proxy to Flask |

## Example booking request

After logging in through the web application, a booking can be created through the BFF:

```http
POST /api/backend/booking/add
Content-Type: application/json
```

```json
{
  "booking_date": "2026-08-08",
  "booking_time": "19:30",
  "party_size": 4,
  "booking_type": "advance",
  "customer_name": "Example Guest",
  "notes": "Window table if available"
}
```

Valid booking types are `advance`, `same_day`, and `walk_in`.

## Further documentation

Research artifacts, contextual interviews, source datasets, notebooks, sequence diagrams, database diagrams, and architecture diagrams are stored in `Additional Documentation/`. The current product requirements document is available at `docs/PRD.md`.

## Project status and limitations

RFS is an academic prototype intended for dissertation evaluation and controlled deployment. Forecast quality depends on the quantity and representativeness of the restaurant's historical data. Reports are generated on demand rather than archived, staff members do not yet have personal shift views, and model retraining is exposed through an authenticated API route rather than a scheduled pipeline. Broader commercial use would require production observability, managed secret rotation, verified migration replay and backup/restore procedures, finer verified-client-IP rate limiting, retention policies, security testing, and wider end-to-end coverage.

## Author

Valerio Gerardi — Dissertation Project, Southampton Solent University
