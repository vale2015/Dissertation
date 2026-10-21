# Product Requirements Document: RFS Restaurant Forecasting System

| Field | Value |
|---|---|
| Product | RFS — Restaurant Forecasting System |
| Document status | Working baseline |
| Version | 1.0 |
| Date | 21 October 2026 |
| Product owner | Valerio Gerardi |
| Primary users | Independent restaurant managers, supervisors, and staff |
| Platforms | Responsive web application; separate Next.js and Flask services |

## 1. Executive summary

RFS is a decision-support application for small independent restaurants. It consolidates bookings, short-term demand forecasts, staffing recommendations, labour-cost projections, local weather, nearby events, and management reporting in one authenticated workspace.

The product addresses a common operational problem: restaurant managers must make staffing and purchasing decisions using fragmented booking information, personal judgement, and limited visibility of factors that affect demand. RFS converts historical and upcoming booking data into actionable forecasts and staffing guidance while preserving a clear human decision point.

The current product is an academic prototype and dissertation deliverable. This PRD defines the existing MVP, its expected behaviour, and the next product increments required to make it more useful and measurable in real restaurant operations.

## 2. Product vision

Enable an independent restaurant manager to prepare for each service with greater confidence by turning booking, historical demand, staffing-cost, weather, and local-event data into a simple operational plan.

## 3. Problem statement

Small restaurants often plan staffing manually. Relevant information may be spread across reservation systems, spreadsheets, weather services, event websites, and the manager's experience. This creates several problems:

- demand spikes can be missed, producing slow service and poor guest experiences;
- quiet services can be overstaffed, increasing avoidable labour costs;
- forecasts are difficult to explain or validate after the service;
- operational reports take time to assemble and may use inconsistent calculations;
- access to sensitive booking and staffing information may not reflect employee responsibilities.

RFS should reduce this fragmentation without presenting forecasts as guaranteed outcomes. Managers retain responsibility for final staffing and operational decisions.

## 4. Goals and success criteria

### 4.1 Product goals

1. Give managers a reliable seven- or ten-day view of expected covers.
2. Translate expected covers into understandable staffing and labour-cost guidance.
3. Reduce the time required to prepare and share operational reports.
4. Centralise the internal and external signals used for service planning.
5. Protect restaurant and customer information with authenticated, role-based access.
6. Make forecast quality observable so the model can be evaluated and improved.

### 4.2 Proposed success metrics

The prototype should establish baselines before fixed targets are adopted.

| Area | Metric | Initial target |
|---|---|---|
| Adoption | Weekly active managers or supervisors | At least 80% of invited decision-makers |
| Planning efficiency | Median time to prepare a weekly staffing plan | 30% lower than the pre-RFS baseline |
| Forecast quality | MAE and MAPE for eligible open days | Recorded for every completed forecast period |
| Forecast bias | Mean signed error | Within ±10% after sufficient data is available |
| Reporting | Successful report exports | At least 95% of initiated exports |
| Reliability | Successful authenticated API requests | At least 99% excluding provider outages |
| Security | Unauthorised access to protected functions | Zero accepted requests |
| Data quality | Booking changes reflected in daily demand aggregates | 100% of successful mutations |

Targets involving forecast accuracy must be reviewed after enough real operating data has been collected. Closed days and days without valid actuals must be excluded consistently.

## 5. Users and personas

### 5.1 Restaurant manager

The manager is accountable for bookings, labour planning, financial performance, and staff access. They need the complete operational picture, downloadable reports, and administrative controls.

Key needs:

- understand upcoming demand and its operational impact;
- add or correct booking records;
- assess staffing cost before committing to a rota;
- share a consistent report with owners or senior staff;
- create and manage employee accounts;
- understand why the forecast may change.

### 5.2 Supervisor

The supervisor prepares or runs individual services but should not manage accounts or sensitive administrative settings.

Key needs:

- view bookings, forecasts, reports, weather, and local events;
- prepare service-level staffing decisions;
- access only the functions permitted by their role.

### 5.3 Staff member

The staff member has limited access and primarily needs personal account information. Future versions may include personal shifts.

Key needs:

- securely access and update their own profile;
- see only information appropriate to their role;
- eventually view assigned shifts and availability.

## 6. Product principles

- **Decision support, not automatic authority:** forecasts recommend; managers decide.
- **One calculation, multiple formats:** the on-screen report and exported files must use the same source data and calculations.
- **Explain uncertainty:** estimates, missing context, closures, and provider failures must be visible.
- **Least-privilege access:** every protected operation must be enforced by the backend, not only hidden in the interface.
- **Operational clarity:** screens should prioritise what the user needs for the next service.
- **Graceful degradation:** optional weather or event-provider failures must not block core forecasts and reports.

## 7. Scope

### 7.1 Current MVP scope

- secure login, logout, session validation, password reset, and profile management;
- manager-controlled staff registration and account administration;
- role-based access for manager, supervisor, and staff roles;
- dashboard summaries for covers, booking mix, revenue estimates, food cost, and labour cost;
- booking creation, retrieval, editing, and deletion;
- automatic rebuilding of daily demand features after booking changes;
- seven- and ten-day Random Forest demand forecasts;
- staffing recommendations and estimated labour costs;
- configurable staffing rules and operational staff roles;
- current and forecast weather for the configured restaurant location;
- nearby concerts, general events, and sports discovery;
- management report preview and PDF/CSV downloads;
- application and database health endpoints.

### 7.2 Recommended next scope

1. Historical report archive and period comparison.
2. Forecast-versus-actual accuracy monitoring.
3. Configurable operational alerts and recommendations.
4. Scenario planning for covers, wage rates, opening hours, and staffing choices.
5. Personal shift viewing and staff availability.

### 7.3 Out of scope for the current product

- processing customer payments;
- public online table reservations;
- payroll submission or accounting-grade financial statements;
- automatic publication of a legally binding staff rota;
- employee time and attendance tracking;
- automated purchasing from suppliers;
- multi-restaurant or franchise administration;
- replacing the manager's judgement with fully autonomous decisions.

## 8. Functional requirements

Priority definitions: **Must** is necessary for the product's core purpose, **Should** materially improves usability or evaluation, and **Could** is a later enhancement.

### 8.1 Authentication and access control

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| AUTH-01 | Must | Users can sign in with an authorised email and password. | Valid credentials create an eight-hour session; invalid credentials return a generic error without revealing whether an account exists. |
| AUTH-02 | Must | Authentication tokens remain inaccessible to browser JavaScript. | The JWT is stored in an HttpOnly cookie and protected API calls are proxied server-side. |
| AUTH-03 | Must | Protected functions enforce role permissions. | Direct API requests without the required permission return `401` or `403`, even if the frontend route is manually entered. |
| AUTH-04 | Must | Managers can register, suspend, deactivate, and recover staff accounts subject to safeguards. | Passwords are hashed; the final active manager cannot be demoted or disabled; sensitive values are excluded from audit metadata. |
| AUTH-05 | Should | Users can view and update permitted profile fields. | Changes persist and do not allow privilege escalation. |

### 8.2 Booking management

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| BOOK-01 | Must | Authorised users can create a booking with date, time, party size, and booking type. | Required fields are validated; party size is positive; booking type is `advance`, `same_day`, or `walk_in`. |
| BOOK-02 | Must | Authorised users can view, edit, and delete existing bookings. | The interface confirms successful changes and displays useful errors when a record is missing or invalid. |
| BOOK-03 | Must | Booking mutations update the relevant daily demand aggregate. | After creation, editing, or deletion, cover totals and booking-type totals match the underlying bookings for every affected date. |
| BOOK-04 | Must | Bookings cannot be added or moved to a configured closed day. | Monday bookings are rejected in the current configuration with an explanatory message. |
| BOOK-05 | Should | Booking lists support useful filtering and search. | Users can narrow records by date and key booking attributes without losing the original dataset. |

### 8.3 Dashboard and operational context

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| DASH-01 | Must | The dashboard summarises recent demand and financial indicators. | Cards and charts use current backend data and expose loading, empty, and failure states. |
| DASH-02 | Must | Users can select a planning date used across relevant dashboard views. | Navigation preserves the selected date where required. |
| DASH-03 | Should | The dashboard shows weather for the configured restaurant location. | Weather is labelled by date/location and a provider failure does not block other dashboard content. |
| DASH-04 | Should | Users can inspect nearby events for a selected month and category. | Results are normalised, deduplicated, linked to their source, and limited to the configured radius when coordinates are available. |

### 8.4 Demand forecasting

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FCST-01 | Must | Authorised users can generate a seven- or ten-day demand forecast. | Each eligible day returns a date, predicted covers, closure state, and context required by the interface. |
| FCST-02 | Must | Forecasts respect configured business closures. | Closed days return zero demand and are clearly labelled rather than treated as ordinary predictions. |
| FCST-03 | Must | Forecasting uses a versioned, reproducible model artifact and feature definition. | Training metadata includes feature names, row counts, and evaluation metrics alongside the saved model. |
| FCST-04 | Should | Managers can understand forecast limitations. | The UI identifies estimates and presents warnings when data or optional context is unavailable. |
| FCST-05 | Should | The product records forecast-versus-actual accuracy over time. | For every eligible completed date, actual covers and the original prediction can be compared without regenerating the historical prediction. |

### 8.5 Staffing and labour cost

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| STAFF-01 | Must | Predicted covers map to a staffing rule. | The selected rule corresponds to the configured cover band and returns department/role requirements. |
| STAFF-02 | Must | The system estimates labour cost using staffing quantities, hourly rates, and standard shift lengths. | Totals reconcile with the displayed role-level calculations. |
| STAFF-03 | Must | Authorised users can inspect the staffing rules and role inputs used. | The relevant cover bands, roles, departments, rates, and hours are visible according to permissions. |
| STAFF-04 | Could | Managers can compare alternative staffing scenarios. | Adjustments remain provisional until explicitly saved and show their effect on coverage and cost. |

### 8.6 Management reporting

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| RPT-01 | Must | Managers and supervisors can generate a management report for a selected date and forecast horizon. | The preview includes summary, financials, booking mix, daily forecasts, insights, and warnings. |
| RPT-02 | Must | Reports can be downloaded as PDF and Excel-compatible CSV. | Downloaded figures match the on-screen canonical report; files contain no customer names, notes, passwords, tokens, or provider payloads. |
| RPT-03 | Must | Optional provider failures do not prevent report generation. | Weather or event failures produce a visible warning while core forecast and financial sections remain available. |
| RPT-04 | Should | Users can access previous generated reports or regenerate historical periods. | A report archive records period, generation time, creator, format, and calculation/model version without duplicating sensitive raw data. |
| RPT-05 | Should | Users can compare two periods. | The product shows changes in covers, booking mix, labour cost, revenue estimate, and forecast accuracy using consistent definitions. |

### 8.7 Alerts and recommendations

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| ALERT-01 | Should | Managers can configure thresholds for high demand, low demand, labour cost, and forecast error. | Thresholds are stored per restaurant and validated before activation. |
| ALERT-02 | Should | The dashboard highlights triggered operational alerts. | Every alert states the triggering data, threshold, affected date, severity, and recommended action. |
| ALERT-03 | Could | Users can opt into email or other delivery channels. | Consent and channel preferences are recorded; repeated alerts are deduplicated; delivery failure does not block the dashboard. |

## 9. Key user journeys

### 9.1 Prepare for next week's services

1. The manager signs in and selects a planning date.
2. They review the dashboard summary, booking trend, weather, and local events.
3. They open the reservation forecast and review expected covers and closure days.
4. They open the staff forecast and review department, role, and cost recommendations.
5. They apply judgement to any event, weather, or business context not captured by the model.
6. They download the management report for discussion or record-keeping.

### 9.2 Maintain accurate booking data

1. An authorised manager or supervisor opens the booking view.
2. They create, correct, or remove a booking.
3. The system validates the change and rebuilds demand aggregates for all affected dates.
4. Updated summaries and future forecasts use the corrected data.

### 9.3 Review performance after service

1. The manager selects a completed service date.
2. The system displays the original forecast alongside actual covers and staffing cost.
3. The manager sees absolute error, percentage error, and whether the model over- or under-predicted.
4. They compare performance by weekday and forecast horizon.
5. When enough new data exists, an authorised manager can initiate controlled retraining and review the new metrics before adoption.

## 10. Data requirements

### 10.1 Core data entities

- users and account states;
- staff roles and departments;
- bookings;
- daily restaurant demand features;
- business settings;
- staffing rules;
- staff-cost forecasts;
- password/invitation tokens and audit events;
- future: immutable forecast snapshots, actual results, report metadata, alert rules, and alert events.

### 10.2 Data handling rules

- Passwords must be stored only as secure hashes.
- Raw JWTs, reset tokens, invitation tokens, passwords, and API keys must never appear in logs or reports.
- Customer-identifying booking fields and notes must not be included in management report exports unless a separately approved use case requires them.
- Monetary values must include an explicit currency and consistent rounding rules.
- Forecast snapshots must retain model/calculation version information so historical accuracy is valid.
- Account deactivation should be soft deletion where auditability is required.
- Data retention and deletion rules must be documented before commercial deployment.

## 11. Non-functional requirements

### 11.1 Security

- All production traffic must use HTTPS.
- Authentication cookies must be HttpOnly, Secure in production, and use an appropriate SameSite policy.
- Protected Flask endpoints must validate bearer tokens and current account state.
- State-changing proxy requests must reject mismatched origins.
- Database access must use encrypted connections and least-privilege credentials.
- Secrets must be stored in deployment environment variables, not source control.
- Security-sensitive actions must be auditable without recording secret values.

### 11.2 Performance

- Primary dashboard data should normally become usable within three seconds on a typical broadband connection, excluding a cold start.
- Cached weather and event data should avoid unnecessary external API calls.
- A management report should normally preview or download within ten seconds.
- Booking mutations should return a clear result without requiring a full page reload.

### 11.3 Reliability and resilience

- Core booking, demand, staffing, and reporting functions must not depend on optional weather or event providers.
- Provider errors must be isolated and displayed as warnings.
- Database mutations must avoid partial booking/aggregate updates.
- Production errors should be logged with correlation information while excluding sensitive data.

### 11.4 Accessibility and usability

- The application should target WCAG 2.2 AA for keyboard access, labels, contrast, focus visibility, and status announcements.
- Charts must have text or tabular equivalents for essential information.
- Dates, currency, units, estimates, and closure states must be unambiguous.
- Empty, loading, validation, unauthorised, and provider-error states must be designed explicitly.

### 11.5 Maintainability

- API routes, controllers, services, and data access responsibilities should remain separated.
- Business calculations should have automated unit tests.
- Critical authenticated journeys should have integration or end-to-end coverage.
- Database changes should use reviewed, repeatable migrations with rollback guidance.
- Frontend and backend deployment configuration must be documented and reproducible.

## 12. Dependencies and integrations

| Dependency | Purpose | Product behaviour on failure |
|---|---|---|
| Supabase PostgreSQL | Users, bookings, features, settings, rules, and forecasts | Core product unavailable; show a safe service error |
| Vercel frontend | Next.js UI and BFF routes | Web application unavailable |
| Vercel backend | Flask API and ML/report execution | Protected data functions unavailable |
| Open-Meteo | Restaurant weather | Hide context or show warning; preserve core functions |
| Ticketmaster | Nearby events | Preserve results from other providers and show warning if appropriate |
| Skiddle | Nearby events | Preserve results from other providers and show warning if appropriate |
| TheSportsDB | Sports fixtures | Preserve results from other providers and show warning if appropriate |

## 13. Analytics and instrumentation

The product should collect operational telemetry without recording customer details or secrets.

Recommended events:

- login succeeded/failed and session expired;
- dashboard loaded/failed;
- booking created, updated, or deleted;
- forecast requested, completed, or failed;
- staffing forecast requested and completed;
- report previewed or downloaded by format;
- event/weather provider succeeded, failed, or served cached data;
- alert viewed or acknowledged;
- model retraining initiated, completed, rejected, or failed.

Each event should include timestamp, authorised user identifier where appropriate, role, request correlation ID, and non-sensitive outcome metadata.

## 14. Delivery plan

### Phase 1 — Current MVP stabilisation

- maintain the existing dashboard, booking, forecast, staffing, reporting, event, weather, and account features;
- complete automated tests for permission boundaries and booking-to-demand synchronisation;
- add production observability and documented operational recovery procedures;
- validate accessibility and responsive behaviour.

### Phase 2 — Measurement and historical reporting

- persist immutable forecast snapshots before their service dates;
- capture actual results and calculate forecast accuracy;
- add historical report metadata and regeneration;
- add period comparison and trend views;
- define accuracy baselines and product KPI dashboards.

### Phase 3 — Proactive planning

- add configurable alerts and in-product recommendations;
- add staffing and financial scenario planning;
- add staff availability and personal shift views;
- evaluate scheduled report delivery after consent and access controls are defined.

### Phase 4 — Commercial readiness assessment

- evaluate multi-restaurant tenancy only if validated by user research;
- formalise data retention, privacy, backup, incident response, and support processes;
- conduct security testing and performance/load validation;
- validate forecasting across more restaurants before generalising the model.

## 15. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Limited or biased historical data | Forecasts may be inaccurate or misleading | Show uncertainty, track accuracy, retain human approval, and avoid unsupported generalisation |
| Data leakage through reports or logs | Privacy and security harm | Aggregate exports, redact sensitive fields, test permissions, and review logging |
| External provider outages or quota changes | Missing context or slow screens | Cache responses, isolate providers, use timeouts, and degrade gracefully |
| Incorrect staffing rules or wage inputs | Misleading labour recommendations | Make inputs visible, validate ranges, record versions, and require manager review |
| Forecasts regenerated after actuals are known | Invalid accuracy claims | Store immutable forecast snapshots with generation time and model version |
| Serverless cold starts or execution limits | Slow forecasts or reports | Monitor latency, optimise dependencies, cache safe results, and reassess runtime when needed |
| Scope expansion beyond dissertation evidence | Reduced delivery quality | Prioritise measurable workflows and phase optional integrations |

## 16. Assumptions

- The initial deployment supports one restaurant and one configured location.
- The restaurant is closed on Mondays unless closure configuration is generalised.
- Managers remain accountable for staffing and financial decisions.
- Booking and cover data are sufficiently accurate to support forecasting.
- The deployed database contains the required schema and migrations.
- Reports are operational estimates rather than accounting statements.
- Internet access is available for hosted services and optional external context.

## 17. Open product decisions

1. Should historical reports be stored as generated files, stored as structured snapshots and regenerated, or both?
2. What forecast accuracy threshold is acceptable for staffing decisions after a valid baseline is collected?
3. Which alert channels are justified: in-app only, email, SMS, or messaging integrations?
4. Should managers be able to override a forecast, and how should the original prediction and reason be preserved?
5. Which fields may supervisors edit compared with managers?
6. Should staffing plans become saved rotas, or remain recommendations exported to another system?
7. What retention period applies to customer booking details, reports, audit history, and forecast snapshots?
8. Is multi-restaurant support a genuine user need or outside the intended product boundary?

## 18. Definition of done

A product increment is complete when:

- acceptance criteria are met and traceable to tests;
- frontend and backend permission checks agree;
- loading, empty, validation, error, and unauthorised states are handled;
- responsive and keyboard behaviour has been checked;
- sensitive data is excluded from logs, analytics, and exports;
- database changes include a reviewed migration and recovery guidance;
- relevant automated tests, linting, and production builds pass;
- README/API documentation reflects user-visible or operational changes;
- the Vercel preview is verified before production promotion.

