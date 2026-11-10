# RFS current handover

Updated: 10 November 2026 (Europe/London). This is a continuity checkpoint, not proof that external services are healthy; reconcile it with current evidence before acting.

## Current objective

The Product Manager asked to install and automate the supplied `RFS_Automation_and_Knowledge_Base` material. Research content belongs in `docs/knowledge/`; project-agent startup and decision boundaries are linked from root `AGENTS.md`. This is tracked implementation [#64](../product/IMPROVEMENT_TRACKER.md), not an existing restaurant-facing chatbot feature.

## Completed in this checkpoint

- Imported the supplied source register and implementation guide into `docs/knowledge/`, and the context memo into `docs/agents/`.
- Added a knowledge-base entry point and links from the documentation index and agent guide.
- Added root agent instructions to read the entry point and handover, treat research as untrusted evidence, and keep PM decisions authoritative.
- Confirmed the existing weekly task is web-based; the PM approved unattended publication of validated research outputs only, chose `docs/knowledge/html-output/index.html` as the stable public review file, then chose to keep unattended writes off until a separate limited GitHub Issue account is available.
- Added the thirteen-entry machine-readable source registry, initialized canonical JSON records and an empty HTML page, implemented the deterministic publisher with focused tests, and drafted a trusted-main, Issue-triggered GitHub Actions publisher. See [the current runbook](../knowledge/AUTOMATION_RUNBOOK.md).

## Publication and verification

| Area | Current evidence |
| --- | --- |
| Checkout | The prior documentation slice reached `main` as `13bfcaf2b05e3dc715675751c13b9447b174bd99`; the reviewed publisher slice reached `main` as `3975083757ef613703dec24a265acbfb0a9470bc`. Recheck remote main before further work. |
| Tests/review | Prior documentation QA passed. The new Python focused suite passes 9 tests (including limited Issue identity checks); local `validate` passes on initialized empty records, and `git diff --check` passes. Independent QA, security, and source-level UX retests found no local blocker. Actionlint is unavailable; a real-source baseline, Actions run, and browser review remain open. |
| GitHub | `git ls-remote` verified the exact publisher commit `3975083757ef613703dec24a265acbfb0a9470bc` on `origin/main`. The Issue-triggered Actions job has not run; it skips all Issues until the limited account's login and numeric ID are configured. |
| Trello | [#64 card](https://trello.com/c/rMCYDpwB/63-64-install-the-rfs-research-knowledge-base-and-automatic-agent-recovery) was created on the RFS board in IN PROGRESS after the tracker was updated; card/list/description read-back succeeded on 9 November 2026. |
| Weekly automation | The PM confirms **Refresh RFS knowledge** is a web task. Its prompt, ability to use a separate issue-only GitHub account without replacing the owner's connection, and actual completed run remain unverified. Keep it off for publishing; do not create a duplicate. |
| Persistent HTML/snapshot | Initialized local `docs/knowledge/html-output/index.html` and JSON; no actual findings, remote publication, browser check, or scheduled update yet. |
| Vercel/Supabase | The docs/tooling push automatically produced frontend deployment `dpl_23YdhDBdyH1QYmrHvNs6H5ZwNNME` and backend deployment `dpl_4Qgvo7byuoyzvtuqb2QXBEm3dFx1`, both READY on the exact publisher commit. No app code, migration, production data, or manual deployment changed. Further knowledge-only commits may still trigger Vercel builds. |
| PM acceptance | The PM approved unattended **research-output-only** commits to `main` only through limited access. The workflow skips all Issues until both bot identity variables are configured; no research finding is approved as an app feature. |

## Resume here

1. Establish a separate non-collaborator GitHub account for public research Issue submission and verify the existing web task can use it independently of the owner's connection. Configure both bot identity variables only after verification.
2. Run a real source baseline, trigger and inspect the Actions publisher, browser-check the HTML, then update the existing task prompt while preserving its schedule. Keep #64 Partial until a scheduled run and fresh-context recovery are proven. Avoid unnecessary docs-only pushes because both Vercel projects currently build them.
