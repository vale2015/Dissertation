---
name: ticket-comment-handoff
description: Post one concise RFS specialist handoff result on the matching Trello task card after meaningful work or an unresolved blocker.
---

# Trello ticket comment handoff

Use the connected [RFS BACKLOG TASKS board](https://trello.com/b/vF796eiJ/rfs-backlog-tasks) only. Read the numbered item in `docs/product/IMPROVEMENT_TRACKER.md` and the [board workflow](../../../docs/agents/TRELLO_BOARD_WORKFLOW.md). A comment reports work; it never changes the authoritative tracker status or proves acceptance.

For each specialist's meaningful task handoff, post **one** comment on the uniquely matched `#NN` card. Include the role, date, outcome, concrete test or review evidence, remaining gaps or blocker, and the next action/PM decision. Link a commit, deployment, or tracker entry when useful. Distinguish self-check from independent QA and preview from production. Do not post credentials, personal staff/customer data, private logs, or unsupported success claims. Avoid repeat comments for retries that add no new evidence.

Read the board/card before writing, match both task number and title, and stop on duplicates or ambiguity. If the card is absent, hand it to `backlog-handoff`/`move-board-cards` to create it before commenting; do not invent a parallel card. If this handoff changes task state, update the tracker first and synchronize the board list before the comment. Read back the posted comment. If Trello is unavailable, include a copyable comment draft in the handoff and tell the PM that the card was not updated.
