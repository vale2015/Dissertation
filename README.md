RFS – Restaurant Forecasting System

Open the live application

RFS is a full-stack decision-support application for small independent restaurants. It combines operational dashboards, booking data, short-term demand forecasting, and staffing-cost estimates to help restaurant managers make data-informed decisions.

This project was developed by Valerio Gerardi as a BSc (Hons) Computing dissertation at Southampton Solent University.

Current Architecture

The deployed system uses separate frontend and backend services on Vercel, with Supabase providing the managed PostgreSQL database.

flowchart LR
    A[Browser] -->|HTTPS| B[Next.js frontend on Vercel]
    B --> C[Next.js route handlers / BFF]
    C -->|Bearer JWT| D[Flask API on Vercel]
    D -->|SQLAlchemy + SSL| E[(Supabase PostgreSQL)]
    D --> F[Random Forest model]

Request flow

The browser communicates only with same-origin Next.js endpoints.

The Next.js authentication route sends login credentials to Flask.

Flask validates the user against the PostgreSQL users table and returns an eight-hour JWT.

Next.js stores the JWT in an HttpOnly, Secure production cookie named rfs_session. Browser JavaScript never receives the token.

Protected frontend requests use /api/backend/[...path]. The Next.js proxy reads the server-managed cookie and forwards the request to Flask with an Authorization: Bearer header.

Flask middleware validates the JWT before allowing access to demand, dashboard, booking, staff-cost, and staffing-rules blueprints.

Flask queries Supabase PostgreSQL through SQLAlchemy and returns the response through the same Next.js proxy.

All authentication and protected-data responses use no-store cache policies. Cross-origin state-changing proxy requests are rejected.

Main Features

Authenticated restaurant management dashboard

Monthly summary metrics and latest operational records

Booking overview and booking management

Short-term reservation-demand forecasts

Staffing requirements and labour-cost forecasts

Demand data retrieval, insertion, statistics, and weekly summaries

Random Forest model training and forecasting

Date-based dashboard navigation

Backend and database health checks

Technology Stack

Layer

Technology

Frontend

Next.js 16, React 19, JavaScript, CSS

Frontend API layer

Next.js App Router route handlers

Backend

Python, Flask, Flask-CORS

Authentication

JWT, HttpOnly cookies, Werkzeug password hashing

Database

Supabase PostgreSQL

Data access

SQLAlchemy, psycopg2, SSL, NullPool

Machine learning

pandas, scikit-learn, joblib

Forecasting model

Random Forest Regressor

Hosting

Vercel frontend and backend deployments

Testing

Postman, Lighthouse, OWASP ZAP, usability testing

Repository Structure

Dissertation/
├── backend/
│   ├── app/
│   │   ├── api/                 # Flask blueprints
│   │   ├── controllers/         # Request handling
│   │   ├── db/                  # Supabase/PostgreSQL connection
│   │   ├── middleware/          # JWT protection
│   │   ├── ml/                  # ML pipelines and model artifacts
│   │   └── services/            # Business and authentication logic
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/auth/        # Login, logout, and session routes
│   │   │   └── api/backend/     # Authenticated Flask proxy
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/api.js           # Same-origin API base
│   ├── package.json
│   └── next.config.mjs
├── package.json
└── README.md

Security Design

JWTs expire after eight hours and are signed with HS256.

JWTs are stored in HttpOnly cookies instead of localStorage.

Production cookies use Secure and SameSite=Lax settings.

Private Flask blueprints require a valid bearer token.

The Next.js proxy validates the origin of POST, PUT, PATCH, and DELETE requests.

Flask CORS permits only localhost and the configured deployed frontend origin.

Database connections require SSL.

Security headers include Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy.

Error responses avoid exposing database credentials.

Secrets and environment files are excluded from source control.

Environment Variables

Frontend deployment

Configure the following variable in the Vercel project whose root directory is frontend:

BACKEND_API_URL=https://your-backend-deployment.vercel.app/api

This variable is server-only. The browser uses the same-origin /api/backend proxy and does not need the Flask URL.

Backend deployment

Configure the following variables in the Vercel project whose root directory is backend:

SECRET_KEY=use-a-long-random-secret
FRONTEND_URL=https://your-frontend-deployment.vercel.app

# Use either separate Supabase pooler values:
POSTGRES_USER=your-user
POSTGRES_PASSWORD=your-password
POSTGRES_HOST=your-pooler-host
POSTGRES_PORT=6543
POSTGRES_DATABASE=postgres

# Or a complete connection URL:
DATABASE_URL=postgresql://user:password@host:6543/postgres

The backend also accepts POSTGRES_URL and POSTGRES_DB. Do not commit real credentials.

Local Development

Prerequisites

Node.js and npm

Python 3

Access to a PostgreSQL database with the required project tables

1. Install JavaScript dependencies

From the repository root:

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

Install the pinned backend dependencies:

pip install -r requirements.txt

3. Configure local variables

Create backend/.env:

SECRET_KEY=use-a-long-random-local-secret
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@host:6543/postgres

Create frontend/.env.local:

BACKEND_API_URL=http://127.0.0.1:5000/api

4. Run the application

On Windows, the root scripts can start both services:

npm run dev

The root backend script uses backend\venv\Scripts\python.exe. On macOS or Linux, start the services in separate terminals:

# Terminal 1
cd backend
source venv/bin/activate
python run.py

# Terminal 2
cd frontend
npm run dev

Local addresses:

Service

URL

Frontend

http://localhost:3000

Flask API

http://127.0.0.1:5000/api

API Overview

Authentication and health endpoints are public. All other Flask blueprint groups require a valid bearer token. In the deployed frontend, protected calls are made through /api/backend/... rather than directly from browser code.

Public endpoints

Method

Flask endpoint

Purpose

POST

/api/auth/login

Authenticate a user

POST

/api/auth/logout

End a session

GET

/api/auth/me

Return the authenticated user

GET

/api/health/

Check backend availability

GET

/api/health/database

Check the database connection

Protected endpoint groups

Group

Example endpoints

Purpose

Dashboard

GET /api/dashboard/

Dashboard metrics

Demand

GET/POST /api/demand/

Retrieve or add demand records

Demand forecast

GET /api/demand/forecast

Generate a short-term forecast

Demand history

GET /api/demand/weekly, GET/DELETE /api/demand/date/<date>

Weekly and date-specific demand

Model training

GET /api/demand/train

Train the Random Forest model

Bookings

GET /api/booking/, POST /api/booking/add

List and create bookings

Booking record

GET/PUT/DELETE /api/booking/<booking_id>

Manage a booking

Staff cost

GET /api/staff-cost/, GET /api/staff-cost/forecast

Retrieve and generate forecasts

Staffing rules

GET /api/staffing-rules/

Retrieve staffing rules

Database and Forecasting

The main demand table is restaurant_demand_features, containing values such as:

date

same-day, walk-in, and advance covers

total covers

average visit duration

duration-adjusted covers

The forecasting pipeline engineers calendar, lag, rolling-average, weekend, and UK bank-holiday features. Candidate approaches were evaluated using a chronological split, and the Random Forest Regressor was selected for its ability to model non-linear demand patterns.

Model performance is assessed using:

Mean Absolute Error (MAE)

Root Mean Squared Error (RMSE)

R²

Staffing forecasts combine predicted demand with database-managed staffing rules, staff roles, hourly rates, and standard shift lengths.

Testing

API: Postman tests for authentication, health, demand, booking, dashboard, and staff-cost routes

Security: OWASP ZAP checks, protected-route verification, CORS restrictions, and security headers

Performance and accessibility: Google Lighthouse

Usability: Task-based interface testing and user feedback

Machine learning: MAE, RMSE, R², and chronological validation

Current Limitations

The project is an academic prototype rather than a commercial restaurant platform.

Forecast quality depends on the size and representativeness of the available dataset.

The deployed backend uses serverless execution, so occasional cold starts may occur.

Broader validation with live data from multiple independent restaurants would be required before production use.

Author

Valerio GerardiBSc (Hons) Computing – First Class HonoursSouthampton Solent University
