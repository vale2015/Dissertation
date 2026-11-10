# RFS current handover

Updated: 10 November 2026 (Europe/London). This is a continuity checkpoint, not proof that external services are healthy; reconcile it with current evidence before acting.

## Current objective

The Product Manager asked to install and automate the supplied `RFS_Automation_and_Knowledge_Base` material. Research content belongs in `docs/knowledge/`; project-agent startup and decision boundaries are linked from root `AGENTS.md`. This is tracked implementation [#64](../product/IMPROVEMENT_TRACKER.md), not an existing restaurant-facing chatbot feature.

## Completed in this checkpoint

- Imported the supplied source register and implementation guide into `docs/knowledge/`, and the context memo into `docs/agents/`.
- Added a knowledge-base entry point and links from the documentation index and agent guide.
- Added root agent instructions to read the entry point and handover, treat research as untrusted evidence, and keep PM decisions authoritative.
- Confirmed the existing weekly task is web-based; the PM approved unattended publication of validated research outputs only, chose `docs/knowledge/html-output/index.html` as the stable public review file, then chose to keep unattended writes off until a separate limited GitHub Issue account is available.
- On 10 November, the PM changed that choice: use the existing `vale2015` GitHub account and restrict the trusted publisher's output to the knowledge base. The verified owner identity is login `vale2015`, numeric ID `147600089`. This cannot restrict the connected owner's other repository actions; no repository-wide ruleset was applied because the same owner needs to keep updating app code.
- Added the thirteen-entry machine-readable source registry, initialized canonical JSON records and an empty HTML page, implemented the deterministic publisher with focused tests, and drafted a trusted-main, Issue-triggered GitHub Actions publisher. See [the current runbook](../knowledge/AUTOMATION_RUNBOOK.md).
- Refreshed the main README with a research-workflow diagram and explicit installed-versus-unverified boundaries. The docs index, agent and architecture guides, knowledge entry point, and historical source/guide notices now point to the same-account runbook. Independent documentation QA found no broken local links or unbalanced Mermaid fences; the diagram was not visually rendered. No app runtime or database code changed.

## Publication and verification

| Area | Current evidence |
| --- | --- |
| Checkout | `main` reached `e8c77f1481647d57a8271c33181498ebd95a0d5e` after the same-account publisher and evidence updates; the local worktree was clean at the start of this documentation refresh. Recheck remote main before further work. |
| Tests/review | Prior documentation QA passed. Independent QA for the same-account revision passed 9 focused Python tests, local knowledge validation, workflow YAML parsing, and `git diff --check`. Independent security review found no code-level blocker after exact history-file staging but confirmed the owner's wider account permissions remain. Actionlint, a real-source baseline, Actions run, and browser review remain open. |
| GitHub | The reviewed same-owner identity/path restriction was pushed as `ac2b547018a15f13a5794debc5333d796c05706c` and read back on GitHub `main`. The Issue-triggered Actions job has not run. |
| Trello | [#64 card](https://trello.com/c/rMCYDpwB/63-64-install-the-rfs-research-knowledge-base-and-automatic-agent-recovery) remains IN PROGRESS; its same-account scope, criteria, and publication evidence were read back on 10 November 2026. |
| Weekly automation | The PM confirms **Refresh RFS knowledge** is a web task. Its current prompt, ability to submit an Issue without direct file edits, and actual completed run remain unverified. Do not create a duplicate or claim the schedule is proven. |
| Persistent HTML/snapshot | Initialized local `docs/knowledge/html-output/index.html` and JSON; no actual findings, remote publication, browser check, or scheduled update yet. |
| Vercel/Supabase | The latest evidence-only commit `e8c77f1` automatically produced frontend deployment `dpl_EhxR5TQ6Gz4cq6cumSnWG2BGRf8g` and backend deployment `dpl_47NV1JxqN1pBZZEUr8234ATGqd2H`, both production READY. No app runtime code, migration, production restaurant data, or manual deployment changed. Further knowledge-only commits may still trigger Vercel builds. |
| PM acceptance | The PM approved the same-account route on 10 November 2026 with a knowledge-output-only publisher workflow. This is not a restriction on the connected owner's wider GitHub permissions. No research finding is approved as an app feature, and no actual unattended publication has been verified. |

## Resume here

1. Inspect and update the existing web task prompt to submit research Issues only, preserving its schedule. The task is web-based and not visible in the local Codex automation registry; do not create a duplicate. The workflow limits its own output, not the connected owner's wider GitHub permissions.
2. Run a real source baseline, trigger and inspect the Actions publisher, browser-check the HTML, and prove a scheduled run and fresh-context recovery. Keep #64 Partial until these are done. Avoid unnecessary docs-only pushes because both Vercel projects currently build them.
