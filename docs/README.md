# RFS documentation

## Four current-state guides

1. [PRD](PRD.md) — the primary product reference: users, outcomes, behaviour, requirements, and open decisions.
2. [AGENT.md](AGENT.md) — the manager-facing RFS AI and the PM-led sequential specialist framework, with orchestration diagrams and safety boundaries.
3. [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — the implemented visual language, layout, components, responsive rules, and remaining visual checks.
4. [ARCHITECTURE.md](ARCHITECTURE.md) — the overall frontend, API, ML, database, provider, security, and deployment architecture, with data-flow diagrams.

These are the entry points for the **current state as of 31 October 2026**. Supporting files below are retained because they contain backlog obligations, migration procedure, release evidence, or historical decisions. The [improvement tracker](IMPROVEMENT_TRACKER.md) is the **only actionable backlog** and source of truth for work status, tests, Git, Supabase, and Vercel. The [MoSCoW view](MOSCOW_PRIORITIZATION.md) ranks the same 59 items by value; it is not a second backlog.

## Current design and delivery

- [RFS UI/UX implementation plan](RFS_UI_UX_REDESIGN_PLAN.md) — current interface decisions, release history, and remaining acceptance checks for #57.
- [RFS chatbot architecture](RFS%20Chatbot%20Architecture%20Design.md) — protected API/model boundary and remaining safety work for #54–55; read its current-status note before older proposals.
- [Sequential AI team workflow](RFS_AI_TEAM_WORKFLOW.md) — original team-setup record and remaining proof for #58; the current overview is in [AGENT.md](AGENT.md).
- [Forecast accuracy](FORECAST_ACCURACY.md) — real versus demo actuals and release gate for #21.

## Implemented architecture and operations

- [Immutable forecast runs](FORECAST_RUNS.md) — persisted prediction snapshots and verification for #20.
- [Saved report history](REPORT_HISTORY.md) — immutable JSON/PDF/CSV snapshots, retention, access, and verification for #26.
- [AI-assisted report explanations](AI_REPORT_EXPLANATIONS.md) — separate disabled pilot and release gates for #52; it is not a current report-page action.
- [Database migration guide](../supabase/README.md) — schema history and migration procedure; use the tracker for latest live status.

## Product and design history

- [Original RFS UI/UX specification](RFS_UI_UX_REDESIGN.md) and [approved dashboard image](RFS%20Restaurant%20Analytics%20Dashboard.png) — original visual target; later PM decisions are in the implementation plan.
- [Modernization options](MODERNIZATION_OPTIONS.md) — options and decision history, not approval to implement them.

The old chatbot product-scope brief was consolidated into the PRD; its technical boundaries remain in the chatbot architecture document. The early HTML chat mockup and a stray diagram backup were removed from this folder because neither represents the current product. Git history retains them. Do not use historical design checklists as release status; use the tracker.
