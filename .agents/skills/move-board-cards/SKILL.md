---
name: move-board-cards
description: Mirror RFS improvement status to the connected RFS BACKLOG TASKS Trello board after the Markdown tracker is updated. Use at project task-state handoffs; never treat a board move as completion evidence.
---

# Move board cards

The PM re-enabled Trello for the [RFS BACKLOG TASKS board](https://trello.com/b/vF796eiJ/rfs-backlog-tasks). Use this skill only for that board and the numbered tasks in `docs/product/IMPROVEMENT_TRACKER.md`. The Markdown tracker is authoritative for status, tests, and release evidence; the board is a visual mirror. Read [the board workflow](../../../docs/agents/TRELLO_BOARD_WORKFLOW.md) for board identity, list mapping, and exceptions before any write.

Use the connected Trello account; never require an API key in the repository. Create a single card for a newly added or newly picked-up numbered item if no matching card exists. The PM explicitly requested a one-time import of existing non-deferred tracker items on 2026-11-07; that does not authorize future bulk imports. Do not create other lists/labels, archive cards, or touch other boards without a separate PM request.

## Status rules

- **READY**: tracker Open and not picked up.
- **IN PROGRESS**: tracker Partial or work has actually started and implementation/verification remains open.
- **IN REVIEW**: tracker Verify release, or implementation is complete and awaiting final PM acceptance.
- **DONE**: tracker Done after its acceptance criteria and required tests (including PM acceptance where required) are met. A commit, push, migration, or deployment alone is insufficient.
- **Deferred**: the PM chose to leave #5 off the board. Do not create a deferred card or mislabel it as READY/IN REVIEW.

Before a board write, read the numbered tracker item and any focused list. Run `backlog-handoff` first so the tracker reflects the actual state and evidence. Never infer Done from the board itself or move a card to DONE while its tracker item remains incomplete.

## Move procedure

1. Read the exact board by its documented URL/ID, then its lists and cards. Match a task by unique `#NN` prefix and tracker title. If duplicates or an ambiguous match exist, stop and ask instead of guessing.
2. Resolve the destination from the current tracker state. Confirm the board has exactly one matching READY, IN PROGRESS, IN REVIEW, or DONE list; do not create/rename lists as part of a routine handoff.
3. If no card exists for this numbered item, create one in the resolved list with title `#NN — tracker title` and a description containing the work scope and testable acceptance criteria, plus the tracker path and current evidence state. This is normally a one-item handoff; the one-time PM-requested import is the exception.
4. If the card exists, update its description when the task scope, acceptance criteria, or tracker status changed; preserve unrelated content. Move it within this board only when the mapped list differs. If its description and list already match, make no write. Do not mark a card complete separately from its list status or change unrelated card fields.
5. Read the card again to confirm its list. Report the card link, previous and new list, tracker status, and any verification gap. Distinguish Trello state from Git, Supabase, and Vercel state.

If Trello is unavailable, the intended board/list cannot be identified, or the card cannot be uniquely matched, do not claim synchronization. Leave the tracker accurate and report the exact unsynced task. This skill acts only during a task handoff, not as a background monitor.
