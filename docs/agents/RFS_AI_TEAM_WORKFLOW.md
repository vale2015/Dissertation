# RFS sequential AI delivery team

**Product owner:** the user, acting as Product Manager (PM). **Backlog:** [IMPROVEMENT_TRACKER.md](../product/IMPROVEMENT_TRACKER.md), item #58. **Priority:** Should (user-directed delivery process). **Current status:** Partial until the demonstrated sequence receives explicit PM acceptance and remaining validation.

This is a repository configuration, not seven continuously running services. Codex can invoke one specialist at a time for a particular PM-approved task. The engineering lead starts with `feature-triage`, chooses a proportional path, and hands off sequentially. The PM owns product decisions and final product acceptance.

| Role | Skill | Responsibility |
|---|---|---|
| Engineering lead | `feature-triage` | Define scope, criteria, risks, and QUICK/STANDARD/FULL path. |
| Frontend engineer | `frontend-implementation` | Build and self-check Next.js UI changes. |
| Backend engineer | `backend-implementation` | Build and self-check Flask/API/data changes. |
| AI evaluator | `ai-chatbot-evaluation` | Test chatbot intent routing and safe tool use. |
| QA engineer | `quality-assurance` | Independently verify acceptance and regressions. |
| UX reviewer | `ux-design-review` | Review manager usability, responsive design, and accessibility when relevant. |
| Security reviewer | `security-review` | Review sensitive data, permissions, and automated actions when relevant. |
| Backlog coordinator | `backlog-handoff`, then `move-board-cards` | Keep tracker evidence and status authoritative, then mirror the numbered task on Trello. |

QUICK uses one implementation specialist and a focused self-check for an isolated, low-risk task. STANDARD adds a separate QA handoff. FULL adds only the UX, security, or AI review warranted by the change, one at a time. A short handoff states task ID, changed files, criteria checked, actual test results, outstanding risks, next role, and PM decision needed. An implementer's self-check is never represented as independent QA. After two unsuccessful fix/retest cycles, report the blocker instead of looping.

The supplied starter pack contained a Trello handoff and an outdated right-side chatbot direction. The original no-Trello instruction was reversed by the PM on 7 November 2026: the [RFS board](TRELLO_BOARD_WORKFLOW.md) now mirrors numbered tracker status, while the Markdown tracker remains canonical and the live chatbot remains left-docked. The Trello connector is used only for this board and does not authorize a merge, deployment, or production-data change.

The initial skill metadata/name format check passed, and an independent QA agent reviewed the original configuration. Its finding that the old board skill could auto-route ordinary status updates was fixed and rechecked. The later Trello re-enablement requires board updates only at task handoffs, after the tracker changes; it is not a background sync.

**Current evidence (7 November 2026):** the [#63 Staffing Forecast redesign](../product/IMPROVEMENT_TRACKER.md) exercised triage, implementation, independent UX/QA, and tracker handoff. Explicit PM acceptance of that complete sequence is not yet recorded, so #58 remains Partial. The team files and `AGENTS.md` are present in `origin/main`; the original setup note's branch-only state is historical. No standalone Vercel deployment or Supabase migration is required for the repository workflow itself.
