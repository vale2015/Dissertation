# Staff registration usability — #69

20 November 2026. Status: Done. PM requested a more user-friendly registration after seeing duplicated draft/After summaries, ambiguous role labels and disabled generic confirmation. The completed #54 release remains historical; this is a new follow-up.

## Scope and acceptance

- Show one authoritative registration review from the server after snapshot; preserve edit Before/After.
- Use System access and Job role with a brief explanation of their different purposes.
- Use Create staff account / Save account changes and a clear primary action.
- Explain password requirements and unmet conditions inline, linked to inputs and announced accessibly; preserve 12–128 character/non-whitespace/matching rules, secure fields and explicit confirmation.
- Group correction controls under Edit details without hiding keyboard focus; keep cancellation visible.
- Add a visible manager-only Manage staff welcome shortcut that opens the private workspace and restores existing drafts.
- Preserve privacy, exact revisions/idempotency, recovery, role restrictions, 120-character names and unchanged backend contracts. No real staff/draft/password mutation is authorized for these UI checks.

## Independent UX pre-review

Reviewed the supplied screenshot, StaffConversation, field definitions and scoped CSS. P1: no actionable disabled-confirmation explanation. P2: duplicate review, ambiguous roles/actions, excessive equal-weight controls and hidden entry. Recommendations above were cleared for frontend implementation without a new product decision.

FULL sequential path: UX pre-review → frontend/self-check → independent QA → independent UX retest → release/browser verification. Use fictional fixtures for visual registration checks and preserve the PM's active draft. Do not register a live account merely to verify presentation.

## Verification and publication

Implementation touches StaffConversation/ManagerChat, their component tests and scoped globals.css. Self-checks:51 component tests/lint passed. Independent QA:65 component/API plus18 access/private-routing/model tests passed (83 total), with lint/whitespace checks. Review confirmed authoritative action.after, unchanged role enums/requests, exact revision/receipt/pointer-only storage and secret clearing. Manage staff opens privately and hides while private work is active.

Coordinator visual checks used the actual component in an isolated localhost Vite fixture with fictional account/API data. Missing/short/whitespace-only/mismatched passwords disable creation with guidance; matching valid passwords enable it. Show/hide works. Native closed Edit details Tab skips hidden controls; open disclosure reaches correction buttons. Correction removes/clears password fields, then requires new review. Actual320px viewport has no horizontal overflow; restored to1280x720. No confirmation was clicked, live service contacted, user draft read/changed or account created by these visual checks. This verifies presentation/interaction with a simulated contract, not a new live registration.

Screenshots in this chat outputs: rfs69-registration-desktop.jpg and rfs69-registration-320.jpg. Independent UX retest cleared source and both fictional screenshots with no blocking finding; its visual execution was coordinator-run. PM explicitly approved production release of PR #23. Merge d671f71 is published; preview frontend dpl_2GCHptepmgfmMFV7vTVMZuiiJzmn/backend dpl_CejjFapJQWZSCDA6rK4u8LNxMjV5 and production frontend dpl_CTpjuxefH8Sa2aJxtHpVTQPiKM3W/backend dpl_ALwdetUqwwNUy7yGiyUdmqCjmiJN are Ready. Preview and production manager shortcut/read-only private entry checks passed, including hidden shortcut during private work and unchanged sidebar. No confirm/cancel action or live account registration was performed. Record exact preview/production state before Done. Link [tracker #69](../product/IMPROVEMENT_TRACKER.md) and [Trello card](https://trello.com/c/CfZ7mVVg).
