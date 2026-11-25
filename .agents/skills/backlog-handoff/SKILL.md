---
name: backlog-handoff
description: Keep RFS's Markdown improvement tracker authoritative through sequential handoffs. Use when a tracked task starts, changes state, or completes, then hand the resulting status to the Trello board mirror.
---

# Markdown backlog handoff

For a delivery handoff, receive the independent reviewer’s checked criteria, actual results, gaps, and PM decision after review ends. Use `docs/product/IMPROVEMENT_TRACKER.md` as the authoritative actionable status and evidence record. On pickup, record the task as in progress using the tracker's supported status and evidence; on completion, record changed files, tests, Git, Supabase, and Vercel states separately. Mark Done only when all acceptance criteria and required testing are met; where the PM's acceptance is required, do not imply it has happened. Otherwise keep Partial, Verify release, Open, or Deferred accurate. After the tracker update, hand the same numbered task to `move-board-cards` for the RFS Trello mirror if its status has a defined mapping and the board action is authorized. Do not claim a board move unless that step succeeds; report any unsynced card without altering the tracker.

For an authorized research intake handoff, reserve Proposed for an unreviewed knowledge-base proposal. Trello mirrors it in **Open**. Canonical tracker Open continues to mirror to **READY**. Before changing a knowledge-base proposal from Proposed, require the coordinator to verify that the recorded PM decision applies to the proposal and supports its next tracker state. Record the decision reference with the tracker update and pass it to `move-board-cards` along with the knowledge-base origin. Publication and decision references alone confer no implementation authority.

Preserve every existing label ID during moves and completion, including labels outside the development and delivery-tier catalog. Pass the reviewed domains and the single triage tier for an authorized label action. Follow the [additive board policy](../../../docs/agents/TRELLO_BOARD_WORKFLOW.md#card-labels), verify labels by readback, and report unresolved tier or label-name conflicts.

When a grouping refresh is authorized, the coordinator follows the [epic index procedure](../../../docs/agents/TRELLO_BOARD_WORKFLOW.md#epic-indexes) using fresh numbered card labels. Preserve numbered task statuses and index-card manual notes. Record any epic sync gap separately from the numbered tracker state.

Handoff in at most 200 words: task ID, role, tracker change, acceptance criteria checked, actual evidence, remaining risks, next role, and PM decision needed.

After a meaningful tracker/status handoff and any necessary board synchronization, use `ticket-comment-handoff` to record the coordinator's outcome on the matching numbered Trello card. Do not duplicate a specialist's unchanged evidence.
