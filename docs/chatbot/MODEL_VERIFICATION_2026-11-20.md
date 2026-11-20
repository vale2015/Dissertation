# Model verification — 20 November 2026

## #65 preview authentication: passed

- PM confirmed a fresh token was saved; metadata shows CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID scoped to Preview and Production. No credential was decrypted or printed.
- Rebuilt the existing protected preview with the current environment: dpl_ALDcerWrDGxg4QsiBmoGzbF1bCsy, Ready, source 9d33aa4d0ad7aafa5704c0fbc6c09bd07acc9578. Its frontend/backend application trees equal published main 359cfc5; intervening changes are documentation only.
- Signed-in demo manager sent exactly `nearby happenings`. The assistant returned four local events with dates/provider attribution. A local direct invocation of classifyChatbotMessage for that phrase returns unknown; taskSignals supplies fixed events vocabulary to the model. Thus this was the model-backed interpretation path, not the deterministic events shortcut.
- Scoped runtime query for chatbot_model_failure on that exact deployment returned no records. Absence of logs is supporting evidence, not the primary success proof.
- Preview URL: https://dissertation-8s51vlsb1-valeriogerardi-5538s-projects.vercel.app. Screenshot in this chat: outputs/rfs65-model-success.jpg.

## #66 current verification

Independent QA passed 24 Node model/access/read/staff tests and 63 focused route/chat component tests: 87 passed, zero failed/skipped. Source comparison confirms unchanged application trees. Fixtures cover provider failure/budget refusal, permission denials, staff privacy, reset/calendar/report horizons, fixed task vocabulary, allowlisted output and bounded model calls.

Coordinator live checks on the same fresh preview passed: New chat clears transcript/weather without duplication; `local activities` uses the model-backed path and returns four events; unsupported `tell me a joke` returns bounded capabilities guidance; undated report opens the in-chat calendar; typed 2026-11-29 returns 193 forecast covers across six open days (the seven-day report scope); private staff choices open and Cancel restores a clean composer. No staff draft or report save was made. Previous unchanged staff registration/edit/role/320px/export evidence remains scoped to the 19 November record.

Independent live HTTP execution passed: a fresh ordinary app login returned 200, then exactly one nearby happenings POST returned 200 and four dated/provider-attributed events. No protection bypass, root-session reuse, provider-secret access, extra account or report save. Sanitized evidence is in this chat outputs/rfs66-independent-api.json. QA recommends #66 Done for the agreed bounded matrix. The independent browser provider was unavailable; independent live execution used HTTP and browser checks were coordinator-run. Failure/usage-limit cases used fixtures. No fresh physical-mobile, destructive-limit or concurrent-production claim.

## #67 production activation: passed; PM/sidebar gates pending

Published verification commit e4d4d0e7c0ac5c0cd5479efe40e46557d2a95e08 triggered fresh production builds: frontend dpl_8zu9M7xzA3hHLUHGZWbR7e8VRUKM and backend dpl_DDrKjF2F9ZVDPYR2DKkR7cCcbXwy, both Ready. On the normal production frontend alias, coordinator demo-manager login and nearby happenings returned four dated/provider-attributed events. The exact deployment's scoped model-failure query returned no records. All 12 read-only production checks passed, including signed-out denials, manager recovery, QA accounts6/8 inactive and saved report23/24 horizons. Evidence is in this chat outputs/rfs67-production-smoke-2026-11-20.json and rfs67-production-model-success.jpg.

Weather initialization showed a truthful temporary-unavailability fallback on this check; preview weather had succeeded. This optional provider outcome does not establish continuous weather availability. Events/model inference succeeded. No new operational record was written; only normal sign-in/model-budget activity occurred.

## Limits and next steps

#65 and #66 are Done for their stated scopes. #67 production configuration activation and read-only smoke/inference passed; PM explicitly accepted the tested workflow and authorized finishing #67 on 20 November. The one-line sidebar entry removal is implemented locally; six focused self-checks/lint and independent 78 tests/lint passed; production navigation verification remains before parent closure.

The current model is an intent classifier for existing restaurant actions, not a general-purpose free-form answer generator. No model, paid plan or database schema changed; the accepted final sidebar removal is the only new application change. No staff account was created/reactivated and no report was saved. Normal manager login/model budget activity occurred; existing audits and approved report records remain.

The older HTTP401/Cloudflare10000 evidence and hold in the [19 November record](STAFF_CHAT_VERIFICATION_2026-11-19.md) are historical and superseded by fresh preview and production inference. Reuse unchanged prior staff/report/role evidence only within its recorded scope. Subsequent documentation-only builds with identical application/configuration inputs do not require another model call solely to reproduce this evidence.
