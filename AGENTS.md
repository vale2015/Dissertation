# Project improvement coordination

- Whenever you produce a list of improvements for this project, save or update it as a Markdown file in `docs/` before handing it to the user. Link the file in the response. Do not leave the only copy in a chat message.
- Use `docs/IMPROVEMENT_TRACKER.md` as the canonical actionable backlog. Add newly proposed items there with unique numbers, or update existing items instead of creating duplicates. If a focused list merits its own document, put it in `docs/` and add it to `docs/README.md`; keep its actionable items synchronized with the tracker.
- Before starting any improvement, read the tracker and the relevant focused list. Prioritize expected user/product value and necessary safety dependencies using `docs/MOSCOW_PRIORITIZATION.md`; preserve item numbers as identifiers, not a mandatory implementation sequence. Reassess priority when evidence or user direction changes.
- Update the tracker in the same work session when an item is finished. Record implementation and verification evidence; mark it **Done** only when its acceptance criteria are met. Otherwise keep its accurate **Partial**, **Verify release**, or **Open** status. Do not start the next item before updating the one just worked on.
- Keep Git, Supabase, and Vercel status distinct. Written code, a Git push, an applied migration, and a live deployment are different states.
- The user asked to see proposed changes before commits. Explain the implementation and any incomplete verification before committing or pushing improvement work.

## Board coordination

- Use `.agents/skills/move-board-cards/SKILL.md` whenever work requires moving a Dissertation project card on the connected board. Add future project skills as sibling folders under `.agents/skills/`.
- Board statuses mean: **READY** = not picked up; **IN PROGRESS** = actively being worked on; **DONE** = fully tested. Do not treat a commit, Git push, migration, or deployment alone as proof of DONE.
