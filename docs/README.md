# RFS documentation

- [RFS Agentic Workflows](presentations/RFS_Agentic_Workflows.html) - current delivery architecture and the connected Figma UI workspace.
- [Connected Figma design file](design/FIGMA_FILE_REGISTER.md) - page links, reusable assets and the next UI screens.
- [Figma setup and working agreement](design/FIGMA_UI_SOURCE_OF_TRUTH.md) - connection options and the design-to-code workflow.

- [Diagram gallery](diagrams/index.html) — 33 reviewed diagrams with SVG previews, editable diagrams.net sources, and the preserved originals. Includes seven diagrams of the agentic development team.
- [Diagram catalogue and evidence](diagrams/README.md) — original-to-redesign mapping, source references and independent verification.

- [New specialist architecture](agents/RFS_AGENTIC_ARCHITECTURE.md) — seven engineer/reviewer pairs, Backlog Handoff and compact fresh-context invocation.

- [22 November agentic improvements](agents/RFS_AGENTIC_IMPROVEMENTS_2026-11-22.md) — ordered specialist, reviewer, context and Trello implementation under #58/#68.

- [Current project state](agents/CURRENT_STATE.md) — compact startup index; use targeted tracker/handover reads.
- [Token optimisation actions](agents/TOKEN_USAGE_OPTIMISATION_ACTIONS.md) — approved context/execution changes and validation status; detailed usage figures remain private.
- [Workflow improvement findings #68](agents/WORKFLOW_IMPROVEMENT_FINDINGS.md) — per-stage token split of the 27 November Claude Code workflows and where to improve, in order of measured size.

- [RFS Agentic Workflows presentation](presentations/RFS_Agentic_Workflows.html) — recovered HTML presentation updated with the token analyst, workflow usage history and improvement flags.

- [Dedicated token-usage analyst #68](agents/TOKEN_USAGE_ANALYST.md) — persistent local workflow usage records, task-model routes and evidence-backed improvement flags; execution/coverage limits are explicit.

- [Staff registration usability #69](chatbot/STAFF_REGISTRATION_UX_2026-11-20.md) — active follow-up for clearer review, role labels, password feedback and staff discovery.

- [20 November live model verification](chatbot/MODEL_VERIFICATION_2026-11-20.md) — #54/#55/#65–67 Done after preview/production inference, independent QA, PM acceptance and final navigation checks.

- [AI token efficiency and workflow architecture](agents/TOKEN_EFFICIENCY_WORKFLOW_PLAN.md) — #68 research, measured pilot and Linear/n8n/tool comparison; chatbot release stays first.

## Start here

1. [PRD](product/PRD.md) — the primary product reference: users, outcomes, behaviour, requirements, and open decisions.
2. [AGENT.md](agents/AGENT.md) — the manager-facing RFS AI and the PM-led sequential specialist framework, with orchestration diagrams and safety boundaries.
3. [DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) — the implemented visual language, layout, components, responsive rules, and remaining visual checks.
4. [ARCHITECTURE.md](architecture/ARCHITECTURE.md) — the overall frontend, API, ML, database, provider, security, and deployment architecture, with data-flow diagrams.

This index stays at the top of `docs/`; all other files are grouped by topic below. The original 17 Markdown files were reviewed against the repository on 7 November 2026, before this folder reorganization; the Trello workflow note was added later. Dated implementation notes preserve release history and are not necessarily current UI specifications. The [improvement tracker](product/IMPROVEMENT_TRACKER.md) is the **authoritative actionable backlog** and source of truth for work status, tests, Git, Supabase, and Vercel; Trello mirrors its task status.

## Product (`product/`)

- [19 November completion verification](product/IN_REVIEW_COMPLETION_2026-11-19.md) — #29/#56 closure, synthetic #21 expansion, live role checks and QA-account cleanup.

- [PRD](product/PRD.md) — primary product requirements and open decisions.
- [Improvement tracker](product/IMPROVEMENT_TRACKER.md) — canonical backlog and implementation/release evidence.
- [Staff and booking chatbot workflow requirements](product/STAFF_AND_BOOKING_WORKFLOW_REQUIREMENTS.md) — PM requirements for #81 (staff registration, organisation, role access) and #82 (chatbot booking creation).
- [MoSCoW priorities](product/MOSCOW_PRIORITIZATION.md) — value ranking of the same 64 tracker items, not another backlog.
- [Modernization options](product/MODERNIZATION_OPTIONS.md) — options and decision history, not implementation approval.

## Design (`design/`)

- [Design system](design/DESIGN_SYSTEM.md) — implemented visual language and responsive patterns.
- [UI/UX implementation plan](design/RFS_UI_UX_REDESIGN_PLAN.md) — current interface decisions, release history, and remaining acceptance checks for #57.
- [Original UI/UX specification](design/RFS_UI_UX_REDESIGN.md) and [approved dashboard image](design/RFS%20Restaurant%20Analytics%20Dashboard.png) — historical visual target; later PM decisions are in the implementation plan.

## Chatbot and AI (`chatbot/`)

- [RFS chatbot architecture](chatbot/RFS%20Chatbot%20Architecture%20Design.md) — protected API/model boundary and remaining safety work for #54–55.
- [Staff registration and editing in RFS AI](chatbot/STAFF_MANAGEMENT_CHAT_WORKFLOW.md) — proposed delivery features and release gates for #54; the sidebar is not removed yet.
- [Staff conversation verification](chatbot/STAFF_CHAT_VERIFICATION_2026-11-19.md) — current #54 evidence, testing limits and remaining release checks.
- [Model authentication diagnostics](chatbot/MODEL_AUTH_DIAGNOSTICS.md) — bounded server diagnostics, credential-format handling and the observed inference blocker.
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
- [Context-recovery memo](agents/RFS_CONTEXT_WINDOW_MEMO.md) — proposed startup and continuity specification; installation and fresh-session proof remain under #64.
- [Codex → Claude Code migration and AI architecture review](agents/CLAUDE_MIGRATION_REVIEW_2026-11-27.md) — runtime migration #72, verification, PM decisions and proposed #73–#75.
- [Current handover](agents/CONTEXT_HANDOVER.md) — concise checkpoint for resuming authorised project work; verify it against the tracker and working tree.

## Research knowledge (`knowledge/`)

- [Knowledge-base entry point](knowledge/README.md) — installed research components, current verification gaps, agent usage, and approval boundary.
- [Weekly automation runbook](knowledge/AUTOMATION_RUNBOOK.md) — same-account Issue intake, workflow-only output restriction, stable HTML output, and remaining scheduled-run checks.
- [Feature-discovery sources](knowledge/RFS_FEATURE_DISCOVERY_SOURCES.md) — supplied publisher register and dated baseline checks.
- [Weekly knowledge-base implementation guide](knowledge/RFS_WEEKLY_KNOWLEDGE_BASE_IMPLEMENTATION_GUIDE.md) — specification for the research records, HTML review, scheduler, publication, and acceptance tests; not evidence of completion.

The old chatbot product-scope brief was consolidated into the PRD; its technical boundaries remain in the chatbot architecture document. The early HTML chat mockup and a stray diagram backup were removed because neither represents the current product. Git history retains them. Do not use historical design checklists as release status; use the tracker.

- [First-priority chatbot blocker plan](chatbot/CHATBOT_BLOCKER_RESOLUTION.md) — ordered work packages #65–67 for parent #54 and foundation #55.
