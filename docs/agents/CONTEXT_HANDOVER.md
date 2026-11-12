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
| Checkout | The manual research publication reached `main` as `6611ce1bd324d53e6f73ed96fb5ebe659bdea0fc`; the exact remote commit was read back on 12 November. Recheck remote main before further work. |
| Tests/review | Prior documentation QA passed. The manual input passed isolated publisher validation (`coverage: partial`, two changed records), nine focused tests, and independent security/QA review before submission. The live Actions publisher and its tests succeeded; 13 registered results and matching JSON snapshot IDs were read back. Actionlint, browser rendering of the HTML, a complete source baseline, scheduled execution, and fresh-context recovery remain open. The owner's broader GitHub permissions remain a known risk. |
| GitHub | [Issue #19](https://github.com/vale2015/Dissertation/issues/19) triggered [Actions run 43206462552](https://github.com/vale2015/Dissertation/actions/runs/43206462552), which completed successfully and published exactly the four allowlisted research files at `6611ce1bd324d53e6f73ed96fb5ebe659bdea0fc`. The connector cannot create or close Issues (403); the PM approved browser submission and closure. GitHub read-back confirms #19 closed as completed. This was a manual scan, not a scheduled run. |
| Trello | [#64 card](https://trello.com/c/rMCYDpwB/63-64-install-the-rfs-research-knowledge-base-and-automatic-agent-recovery) remains IN PROGRESS; its same-account scope, criteria, and publication evidence were read back on 10 November 2026. |
| Weekly automation | The PM confirms **Refresh RFS knowledge** is a web task. Its current prompt, ability to submit an Issue without direct file edits, and actual completed run remain unverified. Do not create a duplicate or claim the schedule is proven. |
| Persistent HTML/snapshot | A manual **partial** scan reached all thirteen entry pages and published two attributed vendor observations, zero opportunity proposals, and matching snapshot `34c181b6fb882e0c98949deda9d1d8f8950a4e7c32b537c10191b90cdd01e47a`. The generated HTML is on `main`, but rendered browser review remains unverified: the in-app browser timed out on localhost. The HTML has no opportunity cards because none were proposed. |
| Vercel/Supabase | The README/knowledge documentation commit `6f9f61d` automatically produced frontend deployment `dpl_9xVot3baRS3yfj2AaCTTBf3fWQ5e` and backend deployment `dpl_DczMPLA5r7RbmN3UMJqx2XDC11o1`, both production READY. No app runtime code, migration, production restaurant data, or manual deployment changed. Further knowledge-only commits may still trigger Vercel builds. |
| PM acceptance | The PM approved the same-account route on 10 November 2026 with a knowledge-output-only publisher workflow. This is not a restriction on the connected owner's wider GitHub permissions. No research finding is approved as an app feature, and no actual unattended publication has been verified. |

## Resume here

1. Inspect and update the existing web task prompt to submit research Issues only, preserving its schedule. The task is web-based and not visible in the local Codex automation registry; do not create a duplicate. The GitHub connector still returns 403 for Issue writes, so test whether the web task itself can submit using an authorized route. The workflow limits its own output, not the connected owner's wider GitHub permissions.
2. Browser-check the generated HTML and confirm its filters, links, and snapshot ID. The current manual scan is partial; a complete baseline and linked opportunity/PM-decision lifecycle remain open.
3. Prove an actual scheduled web-task run and fresh project context reading the published knowledge without a supplied path. Keep #64 Partial until these are done. Avoid unnecessary docs-only pushes because both Vercel projects build them.
