# RFS memo: MANDATORY AUTOMATIC STARTUP AND CONTEXT RECOVERY

> Repository import note (9 November 2026): this is the supplied context-recovery specification. The root `AGENTS.md` now links the knowledge entry point and handover, but a fresh-context recovery test and the full weekly research workflow remain open under tracker #64. Dated service identifiers below must be verified before use.

Prepared for Valerio Gerardi on 8 November 2026.

## FIRST REQUIREMENT: NO MANUAL REMINDER FROM THE USER

**Every new context window MUST automatically trigger project-context recovery as the agent's first action when it runs. The user must not have to say “read AGENTS.md,” “check the handover,” “look at Trello,” or explain the project again.**

This is a mandatory startup responsibility, not an optional checklist. It applies to a fresh project session, a resumed session, and recovery after context compaction or reset. Before substantive project work, the agent must find the current files, load the latest relevant content, reconcile the actual project and service state, identify unfinished authorised work, and determine the next action itself.

**Recovery is incomplete if it depends on the user supplying file paths or repeating decisions that are already recorded.** The agent must also maintain the tracker, destination map, and handover as part of its work, without being reminded to save context.

**Purpose:** establish automatic continuity as the foundation for an orderly application-maintenance process: recover current state → continue authorised work → verify results → record evidence → checkpoint for the next context window.

**Suggested repository location:** `docs/agents/RFS_CONTEXT_WINDOW_MEMO.md`.

This is a prepared memo with a section ready to merge into the root `AGENTS.md`. The repository has not been modified by preparing this file. The proposed `docs/agents/CONTEXT_HANDOVER.md` did not exist on `main` when checked; its initial template is included below.

## Automatic trigger and operating cycle

| Trigger | Required action initiated by the agent |
| --- | --- |
| First run in a new project context window | Discover the repository instructions, read the mapped continuity files, refresh current state, and identify the next authorised action. No file-reading prompt from the user. |
| Resume after compaction, reset, or interruption | Reconcile the saved handover with the actual working tree, tracker, recent commits, and relevant live service evidence before continuing. |
| New user direction during existing work | Apply the latest instruction while preserving completed work, confirmed decisions, and remaining obligations that still apply. |
| Meaningful implementation or verification milestone | Update the authoritative task evidence and checkpoint the handover immediately. |
| Task-state handoff | Update the Markdown tracker first, then mirror the uniquely matched Trello card through the existing board workflow. |
| Before ending or handing off the session | Record the exact unfinished action, changed files, actual checks, publication state, blockers, and next step. |
| A document moves or a service destination changes | Correct this map and the documentation index in the same session so future recovery uses the new location. |

At startup, refresh GitHub's current reference and identify the active task's Trello state and both Vercel projects' relevant deployment references. Check the Supabase project identity and retrieve current migration/schema evidence when the task involves the database. Use read-only discovery for this recovery stage. If a service is inaccessible, record the gap and continue independent work; request user action only when the missing access actually blocks the task.

Continue unfinished work already authorised by the user, respecting the current task and existing review/release rules. When no authorised unfinished work exists, retain the recovered state and identify the next decision needed. Context recovery itself requires no repeated permission, and it does not expand product scope or override an outstanding approval.

## Verified external destinations

These destinations were checked through the connected services on 8 November 2026. They identify the project; they do not establish that every application journey has passed release verification.

| Destination | Exact location or identifier | What the agent should retrieve |
| --- | --- | --- |
| GitHub repository | https://github.com/vale2015/Dissertation | Current source, repository instructions, documentation, and commit history. |
| Published code reference | `main`; https://github.com/vale2015/Dissertation/tree/main | Latest published project content. Check ongoing branch and uncommitted work separately. |
| GitHub instructions | https://github.com/vale2015/Dissertation/blob/main/AGENTS.md | Current coordination, task, review, and release rules. |
| Documentation index | https://github.com/vale2015/Dissertation/blob/main/docs/README.md | Current document locations after the documentation reorganization. |
| GitHub checks | https://github.com/vale2015/Dissertation/actions | Relevant workflow results for the exact commit under review. |
| Trello board | https://trello.com/b/vF796eiJ/rfs-backlog-tasks | The RFS BACKLOG TASKS visual mirror; match cards to stable tracker numbers. |
| Vercel frontend project | https://vercel.com/valeriogerardi-5538s-projects/dissertation | Frontend deployments, exact deployed commit, build/runtime logs, and environment scope. |
| Frontend entry URL | https://dissertation-valeriogerardi-5538s-projects.vercel.app/ | Application entry point returned by Vercel project metadata. |
| Vercel backend project | https://vercel.com/valeriogerardi-5538s-projects/dissertation-backend | Backend deployments, exact deployed commit, build/runtime logs, and environment scope. |
| Backend entry URL | https://dissertation-backend-coral.vercel.app/ | Backend host returned by Vercel domain metadata; consult the code for endpoint paths. |
| Supabase project | https://supabase.com/dashboard/project/szvihzuaybmqkxwkoyli | Dissertation Project: current database and applied migration evidence when relevant to the task. |

### Stable service identifiers

| Service | Identifier |
| --- | --- |
| GitHub | `vale2015/Dissertation`; default branch `main` |
| Trello workspace | `663e11a16b3c43e0d91d1a4e` |
| Trello board | `6ae4dee9466522b9f1a2e03e` |
| Trello board ARI | `ari:cloud:trello::board/workspace/663e11a16b3c43e0d91d1a4e/6ae4dee9466522b9f1a2e03e` |
| Vercel team | `team_KGUi66NBGRaYuf8ectrvPEG9`; slug `valeriogerardi-5538s-projects` |
| Vercel frontend | `dissertation`; `prj_EK0npFGJxfkzxdGJBKhpB0OC1ab2` |
| Vercel backend | `dissertation-backend`; `prj_MNn4dSKSDfwen8fzF6FohH27v8Aj` |
| Supabase | `Dissertation Project`; project ref `szvihzuaybmqkxwkoyli` |

### Trello list destinations

| Tracker status | Trello list | List ID |
| --- | --- | --- |
| Open, not picked up | READY | `6aef47e6a6b428d4c1a0c826` |
| Started or Partial | IN PROGRESS | `6aef47e84c222f49e16b10f1` |
| Verify release or awaiting final acceptance | IN REVIEW | `6aef490ddb0dd0de4516f6c2` |
| Done, supported by required acceptance and testing | DONE | `6aef47e9fdbe36746ec376ee` |
| Deferred | No card | Follow the existing board workflow. |

For tools requiring a list ARI, use the returned identifier in this form: `ari:cloud:trello::list/workspace/663e11a16b3c43e0d91d1a4e/<list ID>`. Recheck board/list membership before a future write. The Markdown tracker remains authoritative; update it before mirroring a handoff on Trello.

## Repository file map

All paths below are relative to the repository root. Existing paths were checked against `main`; the handover and this memo are proposed additions. Resolve the root from the active checkout rather than reusing an old conversation's temporary absolute path.

| Need | File or directory | When to read |
| --- | --- | --- |
| Agent coordination and permissions | `AGENTS.md` | Every new session; also check applicable instructions in the directories being changed. |
| Last session and exact next step | `docs/agents/CONTEXT_HANDOVER.md` **(new)** | Every new session once installed. |
| Navigation through current documentation | `docs/README.md` | Every new session. |
| Task status, acceptance, tests, Git, database, and release evidence | `docs/product/IMPROVEMENT_TRACKER.md` | Read Current position and the relevant numbered item; expand to related evidence as needed. |
| Priorities and dependencies | `docs/product/MOSCOW_PRIORITIZATION.md` | Before choosing an improvement. |
| Product scope and requirements | `docs/product/PRD.md` | Before product behavior changes or acceptance decisions. |
| RFS assistant and delivery-agent boundaries | `docs/agents/AGENT.md` | When working on the assistant or delivery process. |
| Sequential delivery and review | `docs/agents/RFS_AI_TEAM_WORKFLOW.md` | Before feature delivery or specialist handoffs. |
| Board synchronization | `docs/agents/TRELLO_BOARD_WORKFLOW.md` | Before creating, editing, or moving task cards. |
| Specialist instructions | `.agents/skills/` | Read the relevant `SKILL.md` before using that workflow. |
| Current design language | `docs/design/DESIGN_SYSTEM.md` | Before UI work. |
| Current UI decisions and outstanding acceptance | `docs/design/RFS_UI_UX_REDESIGN_PLAN.md` | Before UI work; later PM decisions take precedence over the historical mockup. |
| Historical visual reference | `docs/design/RFS_UI_UX_REDESIGN.md`; `docs/design/RFS Restaurant Analytics Dashboard.png` | For design history and reference, alongside current decisions. |
| System and deployment boundaries | `docs/architecture/ARCHITECTURE.md` | For cross-component, API, data, or deployment work. |
| Forecast behavior and evidence | `docs/architecture/FORECAST_RUNS.md`; `docs/architecture/FORECAST_ACCURACY.md` | For forecasting and accuracy tasks. |
| Saved report contracts | `docs/architecture/REPORT_HISTORY.md` | For report/history tasks. |
| Chatbot architecture | `docs/chatbot/RFS Chatbot Architecture Design.md` | For assistant routing, API, and model-boundary tasks. |
| Staff actions through chat | `docs/chatbot/STAFF_MANAGEMENT_CHAT_WORKFLOW.md` | For the proposed staff registration/editing workflow; verify implemented state in the tracker. |
| AI report pilot | `docs/chatbot/AI_REPORT_EXPLANATIONS.md` | For the separate report-explanation pilot. |
| Frontend implementation | `frontend/src/app/`; `frontend/src/components/`; `frontend/src/lib/` | Read the actual files affected by the current task. |
| Backend implementation | `backend/app/api/`; `backend/app/controllers/`; `backend/app/services/`; `backend/app/db/` | Read the actual routes, permissions, services, and data access affected. |
| Model implementation | `backend/app/ml/` | For prediction, training, feature, and model-artifact tasks. |
| Database procedure and schema history | `supabase/README.md`; `supabase/migrations/` | For database changes; reconcile repository history with the live project. |
| Database verification | `supabase/verify_access.sql`; `.github/workflows/migration-replay.yml` | For relevant schema/access verification. |
| Tests and supported commands | `backend/tests/`; `frontend/package.json`; root `package.json`; `backend/requirements.txt` | Before choosing checks; discover commands from current files. |
| Runtime configuration references | `backend/.env.example`; `backend/app/config.py`; `backend/vercel.json` | When configuration is relevant. Use service settings for the active environment. |

Cloudflare Workers AI and optional weather/event providers are described in the architecture and chatbot documents. Their exact account destinations have not been verified for this memo. Resolve non-secret account/project/model identifiers from current configuration when an affected task needs them, then add the confirmed destination here. Credentials belong in configured connections or environment settings, never in this memo or the handover.

## Section ready to add to root AGENTS.md

Merge the following section with the current file, preserving its existing project rules.

```markdown
## MANDATORY AUTOMATIC STARTUP — NEVER WAIT FOR A USER REMINDER

Treat every new project context window, resumed session, and post-compaction
recovery as an automatic startup trigger. Perform this protocol as your first
action when the agent runs, before substantive project work. The user must
never need to tell you to read files, restore context, check the board, or
repeat decisions already recorded. This is an always-applicable project rule.

1. Establish the active repository root, branch, working-tree changes, and
   latest relevant commit. Preserve ongoing work. GitHub main is the published
   reference; identify any newer uncommitted or feature-branch work separately.
2. Read this AGENTS.md and applicable directory instructions, then
   docs/agents/RFS_CONTEXT_WINDOW_MEMO.md for the destination map.
3. Read docs/agents/CONTEXT_HANDOVER.md if present, followed by docs/README.md,
   the Current position and relevant task in
   docs/product/IMPROVEMENT_TRACKER.md, and priorities when choosing work.
4. Read the relevant requirement, design, architecture, workflow, and specialist
   files from that map. Load only the content needed for the current task.
5. Verify the handover against the actual checkout and current tracker.
   Refresh GitHub's current reference, the active task's Trello state, and the
   relevant frontend/backend Vercel deployment references. Confirm the mapped
   Supabase project and check live migration/schema evidence for database work.
   Record exact commits, environments, check times, and any inaccessible source.
6. Determine and continue the first unfinished authorised action yourself,
   incorporating the user's latest direction. Do not wait for a restore-context
   or continue prompt. Preserve confirmed decisions and existing authorization.
   Ask only for a missing decision or access that genuinely blocks dependent work.
7. Checkpoint the recovered objective, source references, outstanding work,
   and next action in docs/agents/CONTEXT_HANDOVER.md. A planned read, remembered
   summary, or destination list alone does not count as recovered current state.

Startup succeeds only when you can identify the current task, applicable rules,
latest relevant files and service evidence, unfinished work, and next action
without the user supplying that context. State any real recovery blocker briefly;
do not ask the user to repeat information available in the project files.

Source responsibilities:
- AGENTS.md holds project workflow rules; the user's current instructions govern scope.
- The tracker owns numbered tasks, status, acceptance criteria, and evidence.
- Trello mirrors tracker status at handoffs; it is not a second backlog.
- Git establishes which code exists; Vercel establishes which commit is deployed.
- Supabase establishes live database/migration state when freshly checked.
- The handover records continuity; validate it against current evidence.
- Current PRD and design decisions guide behavior; historical notes retain their dates.

Maintain continuity automatically at each meaningful milestone and before
ending or handing off the session; never wait for the user to request an update:
- Update the current tracker item and focused documentation with actual evidence.
- Refresh docs/agents/CONTEXT_HANDOVER.md with the task, changes, branch/commit,
  uncommitted work, actual checks, blockers, current decisions, and next action.
- Record Git, frontend deployment, backend deployment, database, and PM acceptance
  separately. Mark unavailable evidence as not checked or blocked.
- Mirror a changed task state to its uniquely matched Trello card using the
  existing backlog-handoff and move-board-cards workflows; record sync failures.
- Add or correct destinations when a file moves or a service changes, and update
  docs/README.md when adding project documentation.

If the handover is missing or stale, reconstruct the minimum state from the
tracker, working tree, recent commits, and relevant live services, then write
an accurate handover. Report inaccessible sources and continue independent work.
Do not treat missing access or an old note as evidence of completion.

Use repository-relative paths and stable service identifiers. Keep credentials,
session tokens, connection strings, and private business data out of continuity
files. Follow the existing sequential team and release rules; this context
restoration section operates during agent runs and preserves existing authority.
```

## Initial handover template

Create `docs/agents/CONTEXT_HANDOVER.md` during installation. Fill fields with verified information; keep unknowns explicit. Update the same file rather than creating competing “latest” copies. Git history retains earlier versions.

```markdown
# RFS current handover

Updated: <ISO date/time and timezone>
Prepared by: <agent or person>

## Current objective
- User request and scope:
- Existing authorisation and the action it covers:
- Tracker task number(s) and current status:
- Acceptance criteria / PM decision still needed:

## Latest decisions and work
- Confirmed decisions and constraints:
- Changes completed, with repository-relative file paths:
- Work still unfinished:
- Relevant document and evidence links:
- Automatic recovery: sources actually loaded, when checked, and unresolved gaps:

## Checkout and publication
- Repository root in the active environment:
- Active branch and HEAD commit:
- Remote main commit and time checked:
- Uncommitted files / work to preserve:
- Changes already merged/pushed versus still local or branch-only:

## Verification and external state
| Area | Evidence / exact reference | Status and time checked |
| --- | --- | --- |
| Tests and independent review | <actual commands, results, evidence> | <passed / failed / not run / blocked> |
| Trello | <task card URL and list> | <synced / unsynced / not applicable> |
| Vercel frontend | <deployment ID, commit SHA, environment> | <observed build and app-check results> |
| Vercel backend | <deployment ID, commit SHA, environment> | <observed build and app-check results> |
| Supabase | <project ref, relevant migration versions/checks> | <applied / pending / not checked / not applicable> |
| PM acceptance | <decision and scope> | <accepted / awaiting decision / not applicable> |

## Resume here
1. First exact unfinished action:
2. Next dependent action:
3. Blocker, owner, and what resolves it:

Keep this concise. Link detailed evidence in the tracker or focused document.
```

## One-time installation and automatic-startup acceptance

1. Add the ready-to-paste section to root `AGENTS.md`.
2. Add this memo under `docs/agents/` and link it from `docs/README.md`.
3. Create and fill `docs/agents/CONTEXT_HANDOVER.md`; link it from the documentation index.
4. Ensure the coding environment opens this repository and discovers root `AGENTS.md` automatically. Keep the essential startup rule in that file; explicitly link its companion files. Check for applicable overrides and instruction-size limits that could prevent the rule being loaded.
5. Test a fresh project context using an ordinary task or the environment's normal resume mechanism. Supply no file paths, context-recovery prompt, or previous-chat explanation. The agent must initiate recovery itself before substantive work.
6. Repeat after a context reset/compaction and with an interruption leaving unfinished work. Verify that the agent resumes the correct authorised step, preserves uncommitted work, and distinguishes tested code from deployed and accepted behavior.
7. Verify that a meaningful milestone updates the tracker and handover without a user reminder. Check that missing or stale handover data is reconstructed from current evidence, and that an inaccessible service is reported accurately.

**Acceptance fails if the user has to say “read AGENTS.md,” supply the tracker or handover path, remind the agent to save context, or explain a recorded decision again.** Do not label automatic startup implemented and verified until this fresh-session behavior has actually been demonstrated.

After the one-time setup, the startup and checkpoint duties belong to the agent on every run. An unexpected interruption may precede a final update, so checkpoints must happen during work as well as at the end.

The environment must make the repository and its instructions available to the agent. Opening an idle window alone does not start an agent run. Once a run starts with the installed instructions, context recovery must require no special user prompt. This memo defines that behavior; it has not installed or demonstrated it in the repository.

### Basis for automatic discovery

Official OpenAI documentation describes `AGENTS.md` as persistent instructions discovered by the coding environment before work. Explicit links and rules in that file direct the agent to companion context documents. A separate handover filename is a project convention and needs that explicit instruction; it is not automatically recognised just because it exists. See [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) and [Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex).

## Verification record

- Repository: `vale2015/Dissertation`, default branch `main`.
- Observed `main` commit: `ecd9e7bd9f9663dd7f2397fbeb0aeaa4abcc9927` on 8 November 2026. Re-read the current head in future sessions.
- Sources read: root `AGENTS.md`, `docs/README.md`, architecture guide, team workflow, board workflow, the tracker opening/current-position sections, and the database migration guide; file destinations checked against the repository tree.
- Service records checked: Trello board and four lists; Vercel frontend/backend project records, frontend aliases, backend domain, and owning team; matching Supabase project identity.
- This memo does not claim a new commit, card change, migration, deployment, or authenticated application test.
- Updated on 8 November 2026 to make automatic startup, recovery without a user reminder, automatic checkpointing, and fresh-session acceptance the primary requirements. These behavior tests remain to be run after installation.
