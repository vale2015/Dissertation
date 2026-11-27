# Chatbot release verification — 20 November 2026

**#54, #55, #65, #66 and #67: Done.** PM explicitly accepted the tested workflow and authorized finishing #67. The final sidebar change is published and verified in production.

## Final application release

Application commit **b29ca525074b0f32c99d8e2e591c01b5265dbb41** removes only the Staff Management sidebar menu entry. ManagerChat, private registration/editing, Other staff controls, embedded staff management, protected APIs and the guarded /dashboard/staff recovery page remain.

Both production builds are Ready:
- Frontend dpl_GDqMThnECw74oBoXHDnD3aDx1mxg.
- Backend dpl_27a9bMFdGDmdbRyXTNA28uE2WNqf.

Subsequent closure-documentation commits have identical application source. Their build readiness is recorded separately; no repeated model call is needed solely for a documentation change with unchanged configuration.

## Actual verification

| Area | Result and scope |
| --- | --- |
| Authentication recovery #65 | PM saved a fresh token for Preview/Production. Metadata was checked without decryption. Fresh protected preview dpl_ALDcerWrDGxg4QsiBmoGzbF1bCsy on 9d33aa4 answered nearby happenings with four dated/provider-attributed events. Its application tree equals pre-navigation main359cfc5. |
| Model-path proof | Local deterministic classifyChatbotMessage returns unknown for nearby happenings and local activities; fixed events signals reach the model-backed route. The UI returned events; scoped model-failure log queries were empty. Absence of logs is supporting evidence, not the success proof. |
| Independent QA #66 | 24 Node model/access/read/staff tests and 63 route/chat-component tests passed: 87, zero failures/skips. Separate fresh-session normal HTTP login and exactly one model-backed request returned200/four events. No bypass or root-cookie reuse. Independent browser execution was unavailable; browser checks were coordinator-run. |
| Coordinator browser matrix | Second model-routed request local activities succeeded; unsupported tell me a joke returned bounded capabilities guidance. New chat cleared transcript/weather without duplication. Undated report opened calendar; typed2026-11-29 returned193 forecast covers/six open days in the seven-day report scope. Private staff choices/cancel worked without creating a draft. |
| Final navigation QA #67 | Six sidebar self-checks/lint passed. Independent review passed67 sidebar/chat/staff/API component tests plus11 access/private-routing tests: 78 total, zero failures/skips, with lint/whitespace checks. The only application diff is the deleted menu entry. |
| Final production UI | Sidebar Staff Management link count is zero. Assistant launcher/private choices and embedded Other staff controls remain. Manager can access guarded recovery. Desktop and actual320px browser viewport checks passed. Keyboard Enter opens assistant and submits; private focus lands on Register, Cancel returns composer focus, Escape returns launcher focus. Viewport restored to1280x720. |
| Production model | On production e4d4d0e before the one-line navigation change, normal manager nearby happenings returned four events. Model/API/configuration inputs are unchanged in b29ca52. No model failure logs on that tested deployment. |
| Final production smoke | All12 read-only checks passed again on b29ca52: health, signed-out denials, manager session/current action/roles, assistant initialization, inactive QA6/8 and saved reports23/24 seven-/ten-day horizons. |
| Earlier unchanged evidence | Recorded backend262 regular plus16 PostgreSQL checks and prior independent AI/security/UX, real staff registration/edit/retry/role and report/export/narrow checks remain valid within the [19 November record](STAFF_CHAT_VERIFICATION_2026-11-19.md). They were not rerun or added to today's counts. |

## Limits and cleanup

The model classifies supported restaurant intents; this release does not add general-purpose free-form generation. Failure/usage-limit scenarios used fixtures; no fresh destructive-limit, production concurrency or physical-mobile certification claim.

Weather initialization briefly showed its truthful temporary-unavailability fallback, then current conditions succeeded on the final navigation release. This does not promise continuous optional-provider availability.

QA accounts6/8 remain inactive; no pending manager draft remains. No new accounts, report saves, model/paid-plan change or schema migration was performed. Normal sign-in/model-budget activity and retained historical audit/report records remain.

## Evidence

- [Final application commit](https://github.com/vale2015/RFS/commit/b29ca525074b0f32c99d8e2e591c01b5265dbb41)
- [Production frontend build](https://vercel.com/valeriogerardi-5538s-projects/dissertation/GDqMThnECw74oBoXHDnD3aDx1mxg)
- [Production backend build](https://vercel.com/valeriogerardi-5538s-projects/dissertation-backend/27a9bMFdGDmdbRyXTNA28uE2WNqf)
- [Staff workflow criteria](STAFF_MANAGEMENT_CHAT_WORKFLOW.md)
- Thread outputs: rfs65-model-success.jpg; rfs66-independent-api.json; rfs67-production-model-success.jpg; rfs67-production-smoke-2026-11-20.json; rfs67-final-staff-navigation.jpg; rfs67-final-navigation-320.jpg.

#68 token/workflow efficiency remains Open with research complete and implementation not started. No next feature was automatically picked up.
