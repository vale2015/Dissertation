# RFS documentation

Start with the [Product Requirements Document](PRD.md): it is the main reference for the product, current manager experience, role boundaries, and open decisions. The [improvement tracker](IMPROVEMENT_TRACKER.md) is the **only actionable backlog** and the source of truth for work status, test evidence, Git, Supabase, and Vercel state. The [MoSCoW view](MOSCOW_PRIORITIZATION.md) ranks all 59 tracker items by value; it does not create a second backlog.

## Current design and delivery

- [RFS UI/UX implementation plan](RFS_UI_UX_REDESIGN_PLAN.md) — current interface decisions, release history, and remaining acceptance checks for #57.
- [RFS chatbot architecture](RFS%20Chatbot%20Architecture%20Design.md) — protected API/model boundary and remaining safety work for #54–55; read its current-status note before older proposals.
- [Sequential AI team workflow](RFS_AI_TEAM_WORKFLOW.md) — PM ownership, role skills, handoffs, and remaining proof for #58.
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
