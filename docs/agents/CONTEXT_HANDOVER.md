# RFS current handover

Updated: 12 November 2026 (Europe/London). This is a continuity checkpoint, not proof that external services are healthy; reconcile it with current evidence before acting.

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
| Checkout | The latest documentation release reached `main` as `506b00ab371f680f27397cb3423ba2239fc37318`; the exact remote commit was read back on 12 November. Recheck remote main before further work. |
| Tests/review | Prior documentation QA passed. Independent QA for the same-account revision passed 9 focused Python tests, local knowledge validation, workflow YAML parsing, and `git diff --check`. Independent security review found no code-level blocker after exact history-file staging but confirmed the owner's wider account permissions remain. Actionlint, a real-source baseline, Actions run, and browser review remain open. |
| GitHub | The reviewed same-owner identity/path restriction was pushed as `ac2b547018a15f13a5794debc5333d796c05706c` and read back on GitHub `main`. The Issue-triggered Actions job has not run. |
| Trello | [#64 card](https://trello.com/c/rMCYDpwB/63-64-install-the-rfs-research-knowledge-base-and-automatic-agent-recovery) remains IN PROGRESS; its same-account scope, criteria, and publication evidence were read back on 10 November 2026. |
| Weekly automation | The PM confirms **Refresh RFS knowledge** is a web task. Its current prompt, ability to submit an Issue without direct file edits, and actual completed run remain unverified. Do not create a duplicate or claim the schedule is proven. |
| Persistent HTML/snapshot | Initialized local `docs/knowledge/html-output/index.html` and JSON; no actual findings, remote publication, browser check, or scheduled update yet. On 12 November a manual partial scan reached all thirteen entry pages and checked two vendor observations in an untracked draft input. Isolated publisher dry-run validated `coverage: partial`, `changed_records: 2`; nine focused tests passed. Canonical records were not changed. |
| Vercel/Supabase | The README/knowledge documentation commit `6f9f61d` automatically produced frontend deployment `dpl_9xVot3baRS3yfj2AaCTTBf3fWQ5e` and backend deployment `dpl_DczMPLA5r7RbmN3UMJqx2XDC11o1`, both production READY. No app runtime code, migration, production restaurant data, or manual deployment changed. Further knowledge-only commits may still trigger Vercel builds. |
| PM acceptance | The PM approved the same-account route on 10 November 2026 with a knowledge-output-only publisher workflow. This is not a restriction on the connected owner's wider GitHub permissions. No research finding is approved as an app feature, and no actual unattended publication has been verified. |

## Resume here

1. Resolve the 12 November publication blocker: the connected GitHub integration returns `403 Resource not accessible by integration` for Issue creation, even though the signed-in owner can read the repository. The browser fallback did not submit an Issue; do not claim an Actions run. A locally validated manual input draft is `docs/knowledge/scan-input-20261112-manual.json` and is **untracked**. Recheck its `base_repository_commit` against current remote `main` immediately before any submission; its timestamps are approximate and coverage is partial. Never post private data in a public Issue.
2. Inspect and update the existing web task prompt to submit research Issues only, preserving its schedule. The task is web-based and not visible in the local Codex automation registry; do not create a duplicate. The workflow limits its own output, not the connected owner's wider GitHub permissions.
3. Trigger and inspect a valid Actions publication, browser-check the generated HTML, then prove a scheduled run and fresh-context recovery. Keep #64 Partial until these are done. Avoid unnecessary docs-only pushes because both Vercel projects build them.
