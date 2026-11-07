---
name: backlog-handoff
description: Keep RFS's Markdown improvement tracker authoritative through sequential handoffs. Use when a tracked task starts, changes state, or completes, then hand the resulting status to the Trello board mirror.
---

# Markdown backlog handoff

Use `docs/product/IMPROVEMENT_TRACKER.md` as the authoritative actionable status and evidence record. On pickup, record the task as in progress using the tracker's supported status and evidence; on completion, record changed files, tests, Git, Supabase, and Vercel states separately. Mark Done only when all acceptance criteria and required testing are met; where the PM's acceptance is required, do not imply it has happened. Otherwise keep Partial, Verify release, Open, or Deferred accurate. After the tracker update, hand the same numbered task to `move-board-cards` for the RFS Trello mirror if its status has a defined mapping. Do not claim a board move unless that step succeeds; report any unsynced card without altering the tracker.

Handoff in under 250 words: task ID, role, tracker change, acceptance criteria checked, actual evidence, remaining risks, next role, and PM decision needed.
