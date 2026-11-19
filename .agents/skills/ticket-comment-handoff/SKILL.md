---
name: ticket-comment-handoff
description: Post one concise RFS specialist handoff result on the matching Trello task card after meaningful work or an unresolved blocker.
---

# Trello ticket comment handoff

Use the connected [RFS BACKLOG TASKS board](https://trello.com/b/vF796eiJ/rfs-backlog-tasks) only. Read the numbered item in `docs/product/IMPROVEMENT_TRACKER.md` and the [board workflow](../../../docs/agents/TRELLO_BOARD_WORKFLOW.md). A comment reports work; it never changes the authoritative tracker status or proves acceptance.

For each specialist's meaningful task handoff, post **one** comment on the uniquely matched `#NN` card. Include the role, date, outcome, concrete test or review evidence, remaining gaps or blocker, and the next action/PM decision. Link a commit, deployment, or tracker entry when useful. Distinguish self-check from independent QA and preview from production. Do not post credentials, personal staff/customer data, private logs, or unsupported success claims. Avoid repeat comments for retries that add no new evidence.

Read the board/card before writing, match both task number and title, and stop on duplicates or ambiguity. If the card is absent, hand it to `backlog-handoff`/`move-board-cards` to create it before commenting; do not invent a parallel card. If this handoff changes task state, update the tracker first and synchronize the board list before the comment. Read back the posted comment. If Trello is unavailable, include a copyable comment draft in the handoff and tell the PM that the card was not updated.

## Readable comment template

Use the PM's short, scannable format below. Prefer 80–150 words, short bullets and everyday language. Put commit/deployment identifiers behind descriptive links under Evidence, rather than in the main prose. Omit empty sections except Next: say "No action needed" when complete. Preserve the difference between independent QA, self-check, preview and production. For edited historical comments, retain their original date, role and status at that time; do not rewrite earlier uncertainty as a later success.

```markdown
**#NN — Status at this update: Done / In progress / Blocked / In review**
Date · Role

**Result**
- What changed or what was decided.

**Checked**
- The actual checks and their results.
- One remaining limit, if relevant.

**Next**
- The next action and owner, or "No action needed."

**Evidence**
[Verification record](URL)
```
