# RFS — Restaurant Forecasting System

RFS is a full-stack dissertation project for small independent restaurants. It combines booking data, demand forecasting, staffing rules, and labour-cost estimates in a manager-facing dashboard.

The current application uses a Next.js backend-for-frontend (BFF) in front of a Flask API. The browser never receives the authentication token: Next.js stores it in an HttpOnly cookie and adds it as a bearer token when forwarding protected requests to Flask.

## Current architecture

```mermaid
flowchart LR
    U[Restaurant manager] --> N[Next.js 16 / React 19]
    N --> A[Next.js auth routes]
    N --> P[Next.js API proxy]
    A -->|login and session checks| F[Flask 3 REST API]
    P -->|JWT bearer token| F
    F --> S[Controllers and services]
    S --> D[(Supabase PostgreSQL)]
    S --> M[Random Forest pipeline]
    S --> W[Open-Meteo weather API]
    S --> T[Ticketmaster, Skiddle and TheSportsDB APIs]
    M --> X[demand_model.pkl]
```

### Request and authentication flow

1. The user submits credentials to `POST /api/auth/login` on Next.js.
2. Next.js forwards the credentials to Flask at `POST /api/auth/login`.
3. Flask verifies the password stored in `public.users` and signs an eight-hour HS256 JWT.
4. Next.js stores the JWT in the `rfs_session` HttpOnly, `SameSite=Lax` cookie. It is also marked `Secure` in production.
5. Browser requests for application data go to `/api/backend/*`. The Next.js proxy reads the cookie server-side, attaches `Authorization: Bearer <token>`, and forwards the request to Flask.
6. Flask middleware protects the demand, dashboard, booking, staff-cost, and staffing-rules blueprints. Health and authentication routes remain public.

The proxy rejects cross-origin state-changing requests and removes an expired session cookie when Flask returns `401`. Flask restricts CORS origins and adds CSP, frame, content-type, and referrer-policy response headers.

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
| Local orchestration | npm and Concurrently |

## Repository structure

```text
DissertationApp/
├── backend/
│   ├── app/
│   │   ├── api/             # Flask blueprints and route definitions
│   │   ├── controllers/     # HTTP validation and response handling
│   │   ├── db/              # SQLAlchemy engine and sessions
│   │   ├── middleware/      # JWT protection for private blueprints
│   │   ├── ml/
│   │   │   ├── artifacts/   # Serialized Random Forest model
│   │   │   └── pipelines/   # Training and prediction pipelines
│   │   └── services/        # Database and domain logic
│   ├── requirements.txt
│   └── run.py               # Local Flask entry point
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
├── docs/
├── package.json              # Root development commands
└── README.md
```

## Database responsibilities

The application uses PostgreSQL tables including:

| Table | Purpose |
|---|---|
| `public.users` | Manager identity, password hash, and role |
| `bookings` | Individual restaurant bookings |
| `restaurant_demand_features` | Daily booking aggregates and forecasting features |
| `public.business_settings` | Average spend and food-cost inputs |
| `public.staffing_rules` | Cover bands and required staffing levels |
| `public.staff_roles` | Roles, departments, hourly rates, and shift hours |
| `public.staff_cost_forecast` | Generated staffing and cost forecast rows |

Creating, updating, or deleting a booking rebuilds the affected daily aggregate in `restaurant_demand_features`. Mondays are treated as closed days and cannot accept bookings.

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
```

The name, city, and timezone must not be empty. Latitude must be between `-90` and `90`, longitude between `-180` and `180`, and the cache duration must be a positive integer. Weather uses Open-Meteo and does not require an API key.

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

## HTTP API

Flask listens at `http://127.0.0.1:5000`. Except for health and authentication, direct Flask requests require an `Authorization: Bearer <token>` header. The web application normally accesses protected endpoints through the same-origin Next.js path `/api/backend/<resource>`.

### Public Flask endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health/` | Application health |
| `GET` | `/api/health/database` | Database connectivity |
| `POST` | `/api/auth/login` | Verify credentials and issue a JWT |
| `POST` | `/api/auth/logout` | Stateless logout acknowledgement |
| `GET` | `/api/auth/me` | Validate a bearer token and return its user |

### Protected Flask endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/dashboard/` | Demand and financial dashboard summary |
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

Demand forecasting accepts `days_ahead=7|10` and an optional `selected_date=YYYY-MM-DD`. The aliases `days` and `date` are also supported. Staff-cost forecasting accepts `days_ahead` and optional `selected_date` parameters.

Local-event searches accept `start_date` and `end_date` in `YYYY-MM-DD` format for ranges of up to 31 days. The Local Events dashboard page converts the selected calendar month into its exact first and last dates and offers Concerts, General events and Sports filters. Flask combines location-wide Ticketmaster and Skiddle discovery with TheSportsDB schedules; credentials are never exposed to the browser. Results are normalised, deduplicated and cached. The Refresh control sends an authenticated `refresh=1` request that refreshes both frontend and backend caches. Ticketmaster and Skiddle rows are filtered to the configured restaurant radius. TheSportsDB's free schedule feed frequently omits venue coordinates, so the backend applies a small London venue-coordinate lookup and safely excludes unknown venues.

Set `SKIDDLE_API_KEY` to enable location-wide Skiddle discovery; no artist list is required. Skiddle's API terms require visible source credit and use of the event link supplied with each result, both of which are preserved in the Local Events interface. TheSportsDB uses its documented public free v1 key `123`, so it requires no secret or Vercel environment variable. One season-schedule request is made for each configured `SPORTSDB_LEAGUE_IDS` value (English Premier League `4328` by default), then results are filtered to the selected month and restaurant radius. This avoids the free daily endpoint's three-result worldwide limit and Vercel request bursts. Each provider fails independently, so its outage does not remove results from the other services.

### Next.js server endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate and create the HttpOnly session cookie |
| `GET` | `/api/auth/session` | Return the current session user |
| `POST` | `/api/auth/logout` | Expire the session cookie |
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

Research artifacts, contextual interviews, source datasets, notebooks, sequence diagrams, database diagrams, and architecture diagrams are stored in `Additional Documentation/`.

## Project status and limitations

RFS is an academic prototype intended for local development and dissertation evaluation. Forecast quality depends on the quantity and representativeness of the restaurant's historical data. A production deployment would also require operational monitoring, managed secret rotation, database migrations, rate limiting, backup procedures, and broader automated test coverage.

## Author

Valerio Gerardi — Dissertation Project, Southampton Solent University
