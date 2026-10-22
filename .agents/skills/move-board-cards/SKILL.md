---
name: move-board-cards
description: Move Dissertation project cards between READY, IN PROGRESS, and DONE on the connected board. Use when the user asks to pick up, start, progress, complete, or move a card, or when a tracked improvement changes work state.
---

# Move board cards

Use the connected Trello board for the Dissertation project. This skill changes card status by moving the existing card to the corresponding list; it does not create cards, lists, or labels.

## Status rules

- **READY**: the work has not been picked up.
- **IN PROGRESS**: work has actually started and is not yet fully tested.
- **DONE**: the card's acceptance criteria are met and the change has been fully tested. A commit, push, migration, or deployment by itself is not sufficient.

When the card represents a project improvement, read `docs/IMPROVEMENT_TRACKER.md` and any relevant focused list before starting. Keep the tracker accurate in the same work session. The tracker may have more detailed states than the three board lists; do not collapse **Partial** or **Verify release** into **Done**. Do not move a card to **DONE** while its tracker item remains incomplete.

## Move procedure

1. Identify the exact Dissertation board and the requested card. Prefer a card URL or ID; otherwise search by the item's unique tracker number and title. If more than one board or card matches, ask the user which one they mean.
2. Read the card and the board's lists. Resolve the destination list by its actual name, matching **READY**, **IN PROGRESS**, or **DONE** case-insensitively. If the list is absent or ambiguous, stop and ask; do not create or rename one.
3. For **DONE**, check the card's acceptance criteria and concrete test results. If evidence is missing, keep the card **IN PROGRESS**, explain what remains, and leave the tracker at its accurate status.
4. If the card is already in the destination list, make no write. Otherwise use the connected Trello card move action with the card's resolved ID and destination list ID. Do not change other card fields or move it to another board.
5. Read the card again to confirm its new list. Report the card, previous and new status, test evidence when marking **DONE**, and any tracker update. Distinguish the board move from Git, Supabase, and Vercel state.

If Trello is unavailable or the intended board cannot be identified, do not claim the card moved. Report the connection or identification issue and ask for the board/card link if needed.
