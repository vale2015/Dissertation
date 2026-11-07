# RFS documentation

## Start here

1. [PRD](product/PRD.md) — the primary product reference: users, outcomes, behaviour, requirements, and open decisions.
2. [AGENT.md](agents/AGENT.md) — the manager-facing RFS AI and the PM-led sequential specialist framework, with orchestration diagrams and safety boundaries.
3. [DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) — the implemented visual language, layout, components, responsive rules, and remaining visual checks.
4. [ARCHITECTURE.md](architecture/ARCHITECTURE.md) — the overall frontend, API, ML, database, provider, security, and deployment architecture, with data-flow diagrams.

This index stays at the top of `docs/`; all other files are grouped by topic below. The original 17 Markdown files were reviewed against the repository on 7 November 2026, before this folder reorganization; the Trello workflow note was added later. Dated implementation notes preserve release history and are not necessarily current UI specifications. The [improvement tracker](product/IMPROVEMENT_TRACKER.md) is the **authoritative actionable backlog** and source of truth for work status, tests, Git, Supabase, and Vercel; Trello mirrors its task status.

## Product (`product/`)

- [PRD](product/PRD.md) — primary product requirements and open decisions.
- [Improvement tracker](product/IMPROVEMENT_TRACKER.md) — canonical backlog and implementation/release evidence.
- [MoSCoW priorities](product/MOSCOW_PRIORITIZATION.md) — value ranking of the same 63 tracker items, not another backlog.
- [Modernization options](product/MODERNIZATION_OPTIONS.md) — options and decision history, not implementation approval.

## Design (`design/`)

- [Design system](design/DESIGN_SYSTEM.md) — implemented visual language and responsive patterns.
- [UI/UX implementation plan](design/RFS_UI_UX_REDESIGN_PLAN.md) — current interface decisions, release history, and remaining acceptance checks for #57.
- [Original UI/UX specification](design/RFS_UI_UX_REDESIGN.md) and [approved dashboard image](design/RFS%20Restaurant%20Analytics%20Dashboard.png) — historical visual target; later PM decisions are in the implementation plan.

## Chatbot and AI (`chatbot/`)

- [RFS chatbot architecture](chatbot/RFS%20Chatbot%20Architecture%20Design.md) — protected API/model boundary and remaining safety work for #54–55.
- [Staff registration and editing in RFS AI](chatbot/STAFF_MANAGEMENT_CHAT_WORKFLOW.md) — proposed delivery features and release gates for #54; the sidebar is not removed yet.
- [AI-assisted report explanations](chatbot/AI_REPORT_EXPLANATIONS.md) — separate off-by-default pilot and release gates for #52; it is not a report-page action.

## Architecture and data (`architecture/`)

- [Architecture](architecture/ARCHITECTURE.md) — current frontend, API, ML, database, provider, and deployment boundaries.
- [Forecast accuracy](architecture/FORECAST_ACCURACY.md) — real versus demo actuals and release gate for #21.
- [Immutable forecast runs](architecture/FORECAST_RUNS.md) — persisted prediction snapshots and verification for #20.
- [Saved report history](architecture/REPORT_HISTORY.md) — immutable JSON/PDF/CSV snapshots, retention, access, and verification for #26.
- [Database migration guide](../supabase/README.md) — schema procedure outside `docs/`; use the tracker for latest live status.

## Agentic delivery team (`agents/`)

- [Agent guide](agents/AGENT.md) — manager-facing RFS AI and the PM-led specialist framework, with orchestration and safety boundaries.
- [Sequential team workflow](agents/RFS_AI_TEAM_WORKFLOW.md) — team-setup record and remaining acceptance proof for #58.
- [Trello board workflow](agents/TRELLO_BOARD_WORKFLOW.md) — card fields, status mapping, and tracker-first handoff rules for the PM's board.

The old chatbot product-scope brief was consolidated into the PRD; its technical boundaries remain in the chatbot architecture document. The early HTML chat mockup and a stray diagram backup were removed because neither represents the current product. Git history retains them. Do not use historical design checklists as release status; use the tracker.
