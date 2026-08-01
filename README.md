RFS — Restaurant Forecasting System

Open the live application

RFS is a full-stack decision-support application for small independent restaurants. It combines booking data, operational dashboards, short-term demand forecasting, and staffing-cost estimates to help restaurant managers make informed planning decisions.

The project was developed by Valerio Gerardi as a BSc (Hons) Computing dissertation at Southampton Solent University.

Project objectives

Consolidate restaurant demand and booking information in one dashboard.

Forecast short-term reservation demand using historical operational data.

Translate predicted demand into staffing requirements and labour-cost estimates.

Provide a secure, usable interface for restaurant managers.

Demonstrate an end-to-end machine-learning workflow in a deployed web application.

Main features

Secure manager login and protected dashboard routes.

Monthly summary metrics and recent operational records.

Booking overview, creation, editing, and deletion.

Short-term reservation-demand forecasts.

Staffing requirements and labour-cost forecasts.

Date-based dashboard navigation and weekly demand summaries.

Database-managed staffing rules, roles, hourly rates, and shift lengths.

Random Forest model training and forecast generation.

Backend and database health checks.

Current deployed architecture

The frontend and backend are deployed independently. The browser communicates with the Next.js application only; Next.js acts as a Backend for Frontend (BFF) and securely communicates with the Flask API.

flowchart LR
    Browser[Browser]
    Next[Next.js 16 on Vercel]
    BFF[Next.js route handlers]
    Flask[Flask API]
    DB[(Supabase PostgreSQL)]
    ML[Random Forest model]

    Browser -->|HTTPS and HttpOnly cookie| Next
    Next --> BFF
    BFF -->|Bearer JWT| Flask
    Flask -->|SQLAlchemy and SSL| DB
    Flask --> ML

Authentication and request flow

The browser submits login credentials to the same-origin Next.js endpoint at /api/auth/login.

The Next.js route handler forwards the credentials to Flask.

Flask validates the user against the PostgreSQL users table and issues an eight-hour JWT.

Next.js stores the JWT in an HttpOnly cookie named rfs_session. Browser JavaScript never receives the token.

The frontend sends protected requests to /api/backend/[...path].

The Next.js proxy reads the cookie and forwards the request to Flask with an Authorization: Bearer header.

Flask middleware validates the JWT before protected blueprints can access restaurant data.

Flask queries Supabase PostgreSQL or runs the forecasting pipeline and returns the result through the Next.js proxy.

The dashboard layout also validates the session on the server before rendering protected pages. Authentication and private-data responses use no-store cache policies.

Technology stack

Layer

Technology

Frontend

Next.js 16, React 19, JavaScript, CSS

Frontend API layer

Next.js App Router route handlers and server components

Backend

Python, Flask, Flask-CORS

Authentication

JWT, HttpOnly cookies, Werkzeug password hashing

Database

Supabase PostgreSQL

Data access

SQLAlchemy, psycopg2, SSL, Supabase transaction pooler

Machine learning

pandas, NumPy, scikit-learn, joblib

Forecasting model

Random Forest Regressor

Hosting

Vercel frontend and backend services

Testing

Postman, Lighthouse, OWASP ZAP, usability testing

Repository structure

Dissertation/
├── backend/
│   ├── app/
│   │   ├── api/                 # Flask blueprints and endpoint definitions
│   │   ├── controllers/         # Request and response handling
│   │   ├── db/                  # PostgreSQL connection configuration
│   │   ├── middleware/          # JWT protection for private blueprints
│   │   ├── ml/                  # Training, prediction, and model artifacts
│   │   └── services/            # Business, data, and authentication logic
│   ├── main.py                  # Serverless Flask entry point
│   ├── requirements.txt
│   └── run.py                   # Local Flask entry point
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/auth/        # Login, logout, and session route handlers
│   │   │   └── api/backend/     # Authenticated proxy to Flask
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/api.js           # Same-origin frontend API base
│   ├── package.json
│   └── next.config.mjs
├── Additional Documentation/    # Research, diagrams, datasets, and evidence
├── package.json                 # Combined local-development scripts
└── README.md

Deployment configuration

Frontend service

The production Vercel project uses frontend as its root directory and builds the Next.js application with:

npm run build

Configure this server-only environment variable in the frontend Vercel project:

BACKEND_API_URL=https://your-backend-deployment.vercel.app/api

Do not prefix this value with NEXT_PUBLIC_. The Flask URL is used only by Next.js server code; browser requests use the same-origin /api/backend proxy.

Backend service

Deploy backend/main.py as the Flask entry point and configure:

SECRET_KEY=replace-with-a-long-random-secret
FRONTEND_URL=https://your-frontend-deployment.vercel.app

Use either separate Supabase pooler values:

POSTGRES_USER=postgres.your-project-reference
POSTGRES_PASSWORD=replace-with-your-database-password
POSTGRES_HOST=your-pooler-host.supabase.com
POSTGRES_PORT=6543
POSTGRES_DATABASE=postgres

Or provide a complete connection string:

DATABASE_URL=postgresql://user:password@host:6543/postgres

The backend also accepts POSTGRES_URL and POSTGRES_DB. Never commit real credentials or local .env files.

Local development

Prerequisites

Node.js and npm

Python 3

Access to a PostgreSQL database containing the required project tables

1. Install JavaScript dependencies

npm install
cd frontend
npm install
cd ..

2. Create the Python environment

cd backend
python -m venv venv

Activate it on Windows:

venv\Scripts\activate

Activate it on macOS or Linux:

source venv/bin/activate

Install the backend dependencies:

pip install -r requirements.txt
cd ..

3. Configure local environment variables

Create backend/.env using the backend variables shown in the deployment section, then replace every placeholder value. At minimum, the backend requires database credentials and a JWT signing key.

Create frontend/.env.local:

BACKEND_API_URL=http://127.0.0.1:5000/api

4. Run both services

On Windows, with the Python environment created at backend/venv:

npm run dev

On macOS or Linux, run the services in separate terminals:

# Terminal 1
cd backend
source venv/bin/activate
python run.py

# Terminal 2
cd frontend
npm run dev

Service

Local URL

Next.js frontend

http://localhost:3000

Flask API

http://127.0.0.1:5000/api

API overview

Authentication and health routes are public. All dashboard, demand, booking, staff-cost, and staffing-rules blueprints require a valid bearer token. In the deployed application, the browser accesses protected endpoints through /api/backend/....

Public Flask endpoints

Method

Endpoint

Purpose

POST

/api/auth/login

Authenticate a user and issue a JWT

POST

/api/auth/logout

Acknowledge logout

GET

/api/auth/me

Validate a JWT and return the current user

GET

/api/health/

Check backend availability

GET

/api/health/database

Check database connectivity

Protected Flask endpoints

Group

Example endpoints

Purpose

Dashboard

GET /api/dashboard/

Return dashboard metrics

Demand

GET /api/demand/, POST /api/demand/

Retrieve or create demand records

Demand forecast

GET /api/demand/forecast

Generate a short-term forecast

Demand history

GET /api/demand/weekly, GET/DELETE /api/demand/date/<date>

Retrieve weekly or date-specific demand

Model training

GET /api/demand/train

Retrain the Random Forest model

Bookings

GET /api/booking/, POST /api/booking/add

List or create bookings

Booking record

GET/PUT/DELETE /api/booking/<booking_id>

Manage one booking

Staff cost

GET /api/staff-cost/, GET /api/staff-cost/forecast

Retrieve or generate staffing-cost forecasts

Staffing rules

GET /api/staffing-rules/

Retrieve staffing rules

Forecasting and data model

The main demand table is restaurant_demand_features. It stores:

Date and day-of-week information.

Same-day, walk-in, and advance covers.

Total covers.

Average visit duration.

Duration-adjusted covers.

The machine-learning pipeline creates calendar, lag, rolling-average, weekend, and UK bank-holiday features. Candidate approaches were compared using a chronological split, and the Random Forest Regressor was selected for its ability to model non-linear demand patterns.

Model performance is evaluated with:

Mean Absolute Error (MAE)

Root Mean Squared Error (RMSE)

R²

Staffing forecasts combine predicted demand with database-managed staffing rules, staff roles, hourly rates, and standard shift lengths.

Security design

JWTs are signed with HS256 and expire after eight hours.

Tokens are stored in HttpOnly cookies instead of localStorage.

Production cookies use Secure and SameSite=Lax settings.

The browser never receives the Flask API URL or bearer token.

Protected Flask blueprints require a valid JWT.

The Next.js proxy rejects cross-origin POST, PUT, PATCH, and DELETE requests.

Flask CORS allows localhost and the configured frontend origin only.

PostgreSQL connections require SSL.

Private responses are not cached.

Flask adds Content Security Policy, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers.

Testing

API: Postman tests for authentication, health, demand, bookings, dashboard, and staff-cost routes.

Security: OWASP ZAP checks, protected-route verification, restricted CORS, and security-header checks.

Performance and accessibility: Google Lighthouse.

Usability: Task-based interface testing and user feedback.

Machine learning: MAE, RMSE, R², and chronological validation.

Current limitations

RFS is an academic prototype, not a commercial restaurant-management platform.

Forecast accuracy depends on the size and representativeness of the available dataset.

The backend uses serverless execution, so occasional cold starts may occur.

Model retraining is triggered through an API route rather than a scheduled production pipeline.

Broader validation with live data from multiple independent restaurants would be required before commercial use.

Author

Valerio Gerardi

BSc (Hons) Computing — First Class Honours

Southampton Solent University
