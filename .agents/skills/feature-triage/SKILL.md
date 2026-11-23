---
name: feature-triage
description: Engineering-lead triage for RFS product features and improvements. Use when the PM starts or changes a project task and a delivery path must be selected.
---

# Engineering lead: feature triage

Read `AGENTS.md`, the canonical tracker, and any focused task document. Identify the PM's requested outcome, acceptance criteria, value, dependencies, risks, and relevant specialist. Do not invent product scope.

Choose the smallest sequential path. QUICK pairs one implementer with a dedicated reviewer for focused independent checks. STANDARD adds relevant regressions. FULL adds any risk review warranted by the change. Select the pair from `.agents/team.json` and record the tier in the task packet. End implementation before invoking the reviewer with fresh context and a handoff of at most 200 words. Keep one workflow and one specialist active at a time. Ask the PM when a missing decision materially changes the result. Stop before unapproved destructive or production actions.

Handoff in under 250 words: task ID, role, scope/criteria, changed files (if any), checks and actual results, risks, next role, and PM decision needed. Never claim a role has run or an acceptance criterion has passed without evidence.

After a meaningful handoff, use `ticket-comment-handoff` to record the engineering-lead outcome on the matching numbered Trello card.
