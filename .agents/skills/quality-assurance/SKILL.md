---
name: quality-assurance
description: Independently verify RFS acceptance criteria and regressions after implementation. Use for focused QUICK checks or broader feature and release QA.
---

# Independent quality assurance

The coordinator invokes the dedicated reviewer after the implementer ends, using a fresh task packet and the bounded implementation handoff. Work only on independent review. Return findings for rework without editing implementation.

Read the PM's criteria, implementation handoff, and changed files. Run targeted tests first, then relevant regression, lint, build, or browser checks. Cover normal, boundary, negative, and permission scenarios proportionate to risk. Record exact commands and outcomes, defects, and coverage gaps. Reject a handoff if a critical criterion fails; do not mark the tracker Done on incomplete evidence. Do not describe an implementer's self-check as independent QA.

Handoff in at most 200 words: task ID, role, changed files reviewed, acceptance criteria checked, commands and actual results, outstanding risks, next role, and PM decision needed.

Give the coordinator a concise `ticket-comment-handoff` draft after meaningful review. Route checked evidence to Backlog Handoff and defects to the coordinator for rework.
