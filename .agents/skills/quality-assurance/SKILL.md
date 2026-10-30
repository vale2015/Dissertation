---
name: quality-assurance
description: Independently verify RFS acceptance criteria and regressions after implementation. Use for non-trivial feature and release QA.
---

# Independent quality assurance

Read the PM's criteria, implementation handoff, and changed files. Run targeted tests first, then relevant regression, lint, build, or browser checks. Cover normal, boundary, negative, and permission scenarios proportionate to risk. Record exact commands and outcomes, defects, and coverage gaps. Reject a handoff if a critical criterion fails; do not mark the tracker Done on incomplete evidence. Do not describe an implementer's self-check as independent QA.

Handoff in under 250 words: task ID, role, changed files reviewed, acceptance criteria checked, commands and actual results, outstanding risks, next role, and PM decision needed.
