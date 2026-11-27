# RFS sequential AI delivery team

For #68, task-specific model routes are in `.agents/model-routing.json`. Persist one usage-history record per workflow, refresh it without duplication and retain analyst reviews. The dedicated token analyst consumes sanitized counters/history and surfaces important optimization flags with evidence, an action and a success check; it does not implement or approve changes. See [the runbook](TOKEN_USAGE_ANALYST.md). Use the PM-authorized checkout recorded in [CLAUDE.md](../../CLAUDE.md) and keep one workflow and one specialist active at a time.

**Product owner:** the user, acting as Product Manager (PM). **Backlog:** [IMPROVEMENT_TRACKER.md](../product/IMPROVEMENT_TRACKER.md), item #58. **Priority:** Should (user-directed delivery process). **Current status:** Partial until the demonstrated sequence receives explicit PM acceptance and remaining validation.

The coordinator explicitly invokes each role from the [role registry](../../.agents/team.json). The engineering lead starts with `feature-triage`, defines the outcome, criteria, and risks, and selects a delivery tier. The PM owns product decisions and final acceptance.

| Specialist | Implementer | Dedicated reviewer | Review focus |
| --- | --- | --- | --- |
| Frontend | `RFS-FE` | `RFS-FE-REVIEW` | Next.js behavior, client state, responsive layout, and keyboard access |
| Backend | `RFS-BE` | `RFS-BE-REVIEW` | Flask contracts, validation, permissions, and regressions |
| UI/UX design | `RFS-UX` | `RFS-UX-REVIEW` | Manager workflows, responsive design, and accessibility |
| Security | `RFS-SEC` | `RFS-SEC-REVIEW` | Authorization, least privilege, privacy, and sensitive actions |
| Database | `RFS-DB` | `RFS-DB-REVIEW` | Schema compatibility, migrations, data integrity, and access |
| AI/chatbot | `RFS-BOT` | `RFS-BOT-REVIEW` | Routing, grounding, fallback behavior, and safe tools |
| Automation | `RFS-AUTO` | `RFS-AUTO-REVIEW` | Trigger scope, retries, repeat execution, and recovery |

| Tier | Independent review |
| --- | --- |
| QUICK | Focused checks against the acceptance criteria for an isolated, low-risk change. |
| STANDARD | Acceptance checks plus relevant regression coverage. |
| FULL | Acceptance and regressions plus the UX, security, AI, or other domain risk checks warranted by the change. |

1. **Implement.** Generate a [task packet](../../.agents/task-packet.md) with a role-specific model route and fresh context. Include the outcome, criteria, relevant file references, and approval limits in at most 500 words. The implementer runs focused self-checks and ends its turn with at most 200 words on changed files, actual checks, gaps, and the next action.
2. **Review.** After the implementer ends, explicitly invoke the paired reviewer with a fresh packet and the short implementation handoff. A separate reviewer runs the tier's checks and reports findings without editing implementation or approving a release. Cross-domain or additional risk reviews run in sequence. Return defects to implementation, with a fresh review on each attempt. After two unsuccessful fix/retest cycles on the same defect, record the blocker.
3. **Hand off to the backlog.** Once review ends, explicitly invoke `RFS-BACKLOG` with the checked or blocked outcome. It updates the numbered tracker item first, then uses `move-board-cards` and `ticket-comment-handoff` for authorized actions on the matching card. Preserve existing domain and delivery-tier labels. Keep incomplete checks and pending PM acceptance visible before any move to Done.

During a coordinator-authorized knowledge-base intake handoff, unreviewed proposals use Proposed and mirror to **Open**. Canonical tracker Open still mirrors to **READY**. The coordinator verifies the recorded PM decision before a proposal leaves Proposed. See the [board workflow](TRELLO_BOARD_WORKFLOW.md) for the decision evidence and routing rules.

At meaningful handoffs, keep one evidence-based Trello comment per role, including incomplete outcomes. Work within the authorized connector scope. For a status change, update the tracker and board list before posting the comment. When Trello is unavailable, give the PM a copyable comment draft and record that synchronization is pending.

The packet helper produces explicit invocation fields and leaves execution order with the coordinator. Client support determines whether fresh-context invocation and the requested model are available. Report any gap and leave independent verification open until the required review runs.

The supplied starter pack contained a Trello handoff and an outdated right-side chatbot direction. The original no-Trello instruction was reversed by the PM on 7 November 2026: the [RFS board](TRELLO_BOARD_WORKFLOW.md) now mirrors numbered tracker status, while the Markdown tracker remains canonical and the live chatbot remains left-docked. The Trello connector is used only for this board and does not authorize a merge, deployment, or production-data change.

The PM also designated GitHub `main` as the reference for each latest completed, tested update and approved an automatic merge/push there after the required checks and a change summary. Temporary feature branches are implementation workspaces, not the published outcome. A `main` push can trigger a Vercel production build; verify Git and Vercel separately, and leave unfinished acceptance in the tracker and Trello rather than claiming Done. This standing approval does not cover failed or unreviewed changes, manual deployments, or production-data mutations.

The initial skill metadata/name format check passed, and an independent QA agent reviewed the original configuration. Its finding that the old board skill could auto-route ordinary status updates was fixed and rechecked. The later Trello re-enablement requires board updates only at task handoffs, after the tracker changes; it is not a background sync.

**Current evidence (7 November 2026):** the [#63 Staffing Forecast redesign](../product/IMPROVEMENT_TRACKER.md) exercised triage, implementation, independent UX/QA, and tracker handoff. Explicit PM acceptance of that complete sequence is not yet recorded, so #58 remains Partial. The team files and `CLAUDE.md` are present in `origin/main`; the original setup note's branch-only state is historical. No standalone Vercel deployment or Supabase migration is required for the repository workflow itself.

PM comment preference (19 November 2026): use short **Result**, **Checked**, **Next** and **Evidence** sections, with bullets and descriptive links. The template is maintained in .claude/skills/ticket-comment-handoff/SKILL.md. Keep original dates and status-at-the-time when reformatting historical comments.
