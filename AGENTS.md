# Project improvement coordination

- Whenever you produce a list of improvements for this project, save or update it as a Markdown file in `docs/` before handing it to the user. Link the file in the response. Do not leave the only copy in a chat message.
- Use `docs/IMPROVEMENT_TRACKER.md` as the canonical actionable backlog. Add newly proposed items there with unique numbers, or update existing items instead of creating duplicates. If a focused list merits its own document, put it in `docs/` and add it to `docs/README.md`; keep its actionable items synchronized with the tracker.
- Before starting any improvement, read the tracker and the relevant focused list. Prioritize expected user/product value and necessary safety dependencies using `docs/MOSCOW_PRIORITIZATION.md`; preserve item numbers as identifiers, not a mandatory implementation sequence. Reassess priority when evidence or user direction changes.
- Update the tracker in the same work session when an item is finished. Record implementation and verification evidence; mark it **Done** only when its acceptance criteria are met. Otherwise keep its accurate **Partial**, **Verify release**, **Open**, or **Deferred** status. Do not start the next item before updating the one just worked on.
- Keep Git, Supabase, and Vercel status distinct. Written code, a Git push, an applied migration, and a live deployment are different states.
- The user asked to see proposed changes before commits. Explain the implementation and any incomplete verification before committing or pushing improvement work.

## Task tracking

- Use `docs/IMPROVEMENT_TRACKER.md` for task status. The user has explicitly asked not to use Trello; do not open it, query it, or move cards. Leave the existing board skill unused unless the user changes this instruction.
- **Done** still requires the acceptance criteria and full testing. A commit, Git push, migration, or deployment alone is not proof of completion.

## Sequential RFS delivery team

- The user is the Product Manager (PM) and owns product scope, priorities, and final product acceptance. The canonical backlog remains `docs/IMPROVEMENT_TRACKER.md`; the team does not use Trello.
- For a requested feature or improvement, start with the engineering-lead `feature-triage` skill. Choose the smallest suitable path: QUICK (one specialist and focused self-check), STANDARD (one implementer followed by independent QA), or FULL (sequential implementation, QA, and risk-based UX/security review). Work on one specialist role at a time; do not launch agents in parallel.
- Specialist skills live in `.agents/skills/`: `frontend-implementation`, `backend-implementation`, `ai-chatbot-evaluation`, `quality-assurance`, `ux-design-review`, `security-review`, and `backlog-handoff`. Use only the roles relevant to the task. A specialist may advise on scope but does not silently change PM decisions.
- The implementer cannot independently approve their own work. If a separate QA agent is unavailable, label self-review as such and leave independent verification open. For non-trivial work, hand off with the task ID, changed files, acceptance checks, actual test results, risks, next role, and PM decision needed; keep the handoff short.
- Stop after two fix/retest cycles on the same defect and report the blocker. Prefer focused checks before broad suites. Explain changes and incomplete verification before commits as required above. Do not merge to `main` or another protected branch, deploy, or change production data without the PM's approval for that action; a role or skill never grants extra authority.
- The old `move-board-cards` skill is retained for history but must not be invoked while the no-Trello instruction above remains in force. See [the team workflow](docs/RFS_AI_TEAM_WORKFLOW.md).
