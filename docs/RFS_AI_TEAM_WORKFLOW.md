# RFS sequential AI delivery team

**Product owner:** the user, acting as Product Manager (PM). **Backlog:** [IMPROVEMENT_TRACKER.md](IMPROVEMENT_TRACKER.md), item #58. **Priority:** Should (user-directed delivery process). **Current status:** Partial until exercised on a real task.

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
| Backlog coordinator | `backlog-handoff` | Keep tracker evidence and status accurate; no board actions. |

QUICK uses one implementation specialist and a focused self-check for an isolated, low-risk task. STANDARD adds a separate QA handoff. FULL adds only the UX, security, or AI review warranted by the change, one at a time. A short handoff states task ID, changed files, criteria checked, actual test results, outstanding risks, next role, and PM decision needed. An implementer's self-check is never represented as independent QA. After two unsuccessful fix/retest cycles, report the blocker instead of looping.

The supplied starter pack contained a Trello handoff and an outdated right-side chatbot direction. Those are deliberately adapted: the project's prior no-Trello instruction remains in force, the Markdown tracker is canonical, and the live chatbot is left-docked. The existing `move-board-cards` skill is not invoked. This workflow does not authorize a merge, deployment, production-data change, or privileged operation by itself.

The skill metadata/name format check passed, and an independent QA agent reviewed the configuration. Its finding that the old board skill could auto-route ordinary status updates was fixed and rechecked. This is a configuration review, not a feature-delivery trial.

**Verification still needed:** run one real task through triage, an implementation specialist, independent QA where selected, an accurate tracker update, and PM acceptance. Until then, the skill files and coordination rules are installed but the handoff behavior is not proven end to end.
