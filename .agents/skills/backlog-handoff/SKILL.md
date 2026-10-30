---
name: backlog-handoff
description: Keep RFS's Markdown improvement tracker accurate through sequential handoffs. Use when a tracked task starts, changes state, or completes; do not use Trello.
---

# Markdown backlog handoff

Use `docs/IMPROVEMENT_TRACKER.md` as the sole actionable status record. On pickup, record the task as in progress using the tracker's supported status and evidence; on completion, record changed files, tests, Git, Supabase, and Vercel states separately. Mark Done only when all acceptance criteria and required testing are met; where the PM's acceptance is required, do not imply it has happened. Otherwise keep Partial, Verify release, Open, or Deferred accurate. Do not invoke Trello or claim a board move. The old `move-board-cards` skill remains unused under `AGENTS.md`.

Handoff in under 250 words: task ID, role, tracker change, acceptance criteria checked, actual evidence, remaining risks, next role, and PM decision needed.
