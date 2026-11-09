# RFS current handover

Updated: 9 November 2026 (Europe/London). This is a continuity checkpoint, not proof that external services are healthy; reconcile it with current evidence before acting.

## Current objective

The Product Manager asked to add the supplied `RFS_Automation_and_Knowledge_Base` material to the project agent. Research content belongs in `docs/knowledge/`; project-agent startup and decision boundaries are linked from root `AGENTS.md`. This is new tracked implementation [#64](../product/IMPROVEMENT_TRACKER.md), not an existing restaurant-facing chatbot feature.

## Completed in this checkpoint

- Imported the supplied source register and implementation guide into `docs/knowledge/`, and the context memo into `docs/agents/`.
- Added a knowledge-base entry point and links from the documentation index and agent guide.
- Added root agent instructions to read the entry point and handover, treat research as untrusted evidence, and keep PM decisions authoritative.

## Publication and verification

| Area | Current evidence |
| --- | --- |
| Checkout | `main` at `ecd9e7bd9f9663dd7f2397fbeb0aeaa4abcc9927` before this local change; preserve uncommitted knowledge-base files. Recheck remote main before publication. |
| Tests/review | Independent QA checked local links across 10 affected files, 64 unique tracker IDs, balanced code fences, import fidelity, and `git diff --check`; the documentation slice passed after this handover correction. Fresh-context recovery and the weekly pipeline have not been demonstrated. |
| GitHub | This knowledge-base addition is local and uncommitted at this checkpoint. |
| Trello | [#64 card](https://trello.com/c/rMCYDpwB/63-64-install-the-rfs-research-knowledge-base-and-automatic-agent-recovery) was created on the RFS board in IN PROGRESS after the tracker was updated; card/list/description read-back succeeded on 9 November 2026. |
| Weekly automation | The supplied documents describe an existing task, but current configuration, writer permissions, and any completed run have not been verified here. Do not create a duplicate. |
| Persistent HTML/snapshot | Not created or published. |
| Vercel/Supabase | No application or database change is intended. No deployment or migration is required for the documentation slice. |
| PM acceptance | The PM approved adding the material to the project, not any research finding as an app feature. |

## Resume here

1. Explain the completed documentation slice and remaining weekly-workflow gap before any commit/push; then verify the exact remote result if published.
2. Build and verify the scheduled research pipeline separately under #64; do not mark the full task Done from documentation alone.
