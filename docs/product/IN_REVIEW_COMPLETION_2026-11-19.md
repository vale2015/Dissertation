# RFS completion verification — 19 November 2026

**Current acceptance — 19 November 2026:** The PM approved #21 as a demonstration feature and instructed moving it to Done. All three reviewed tasks (#21, #29 and #56) are Done. The 31 actuals remain labelled synthetic; genuine service/model validation remains under #61. Earlier Verify release statements below record the historical acceptance gate and are superseded.


Production tested: `d2e941b308bb684facb3259df82a1caf7c235f3c` (Next.js/preset 16.4.6). Both production builds are READY. No runtime application code change was needed in this continuation.

## #21 synthetic expansion

The user requested invented data based on existing data. Added four non-active, labelled demo forecast runs for 19 September–16 October. Baselines use existing weekday cover averages with bounded deterministic variation. Seed output: 28 dates, four closed Mondays, 24 open days, 23 actuals, one zero and one awaiting entry. True generation timestamps are preserved.

Independent QA checked schema, calendar, overlap, atomicity and replay. Applied and replayed: four runs/28 days/23 new demo actuals, zero bad Mondays, unchanged checksum `c759707ac0bb3406c5b27c5197e33d5b`. Active run 18, 17 real runs, zero genuine actuals unchanged. Seed: `supabase/manual/demo_forecast_accuracy_expansion_20261119.sql`.

Browser demo view displayed 29/31 actuals, MAE 3.93, one zero day excluded from percentage error, and prominent invented-data labels. Authorized live write checks then filled the awaiting demo dates:

- Manager 23 October: record 68 (201), duplicate rejected (409), short reason rejected (400), correction to 69 with reason (200).
- Supervisor 16 October: production UI record 55, then correct to 54 with reason; success notices displayed.
- Database confirms source=demo and corrections 68→69 by manager ID 1, 55→54 by QA supervisor ID 4.
- Total demo actuals now 31; genuine actuals remain zero, active run remains 18.

Requested expansion is complete. The unchanged original genuine-service comparison criterion is still unmet; invented figures must not be presented as genuine evidence.

## #29/#56 production role checks

User explicitly approved temporary supervisor/staff QA accounts with random passwords kept out of chat, followed by deactivation. Created through normal manager registration/review/confirmation. Existing accounts were not re-roled, reset or disabled.

| Role | Observed patched-production result |
|---|---|
| Manager | Login, Dashboard, Staff Management and Reports render in one shell. Saved report #2 renders its 10-day dates and management summary. Screenshots confirm shell/detail. Earlier post-release HTTP health/session/dashboard/report/accuracy checks passed. |
| Supervisor | Login lands on Dashboard; navigation omits Staff Management. Direct staff page denies without shell; staff API returns FORBIDDEN. Saved report detail `/dashboard/reports/history/2` renders in shared shell. Settings has Personal account only, no staffing-rules tab. Forecast Accuracy and audited demo entry/correction work. |
| Staff | Login lands on own profile with Settings-only navigation. Own Settings/profile render in shell without staffing-rules tab or assistant. Direct staff-management, forecast-accuracy and saved-report-detail pages deny. Saved-report-detail and demo-accuracy APIs return FORBIDDEN without data. |

QA accounts IDs 4 (supervisor) and 5 (staff) were deactivated through normal manager endpoints, guarded by exact QA-email checks. Cleanup response confirms inactive. Browser reload of the previously authenticated staff Settings page displayed **Session unavailable / Invalid token**, confirming session revocation.

Dependencies previously passed clean install/zero-finding audit, 20 unit +60 component +10 route tests, lint zero errors/one existing warning, webpack/Turbopack builds and independent security review. This continuation supplies missing production role/visual checks. Corrected 30-minute deployment-scoped error/fatal queries returned no entries for either service. The initial 1-hour query exceeded plan retention and was not treated as empty logs.

Final independent QA/security review passed with no blockers. It independently reran seven access tests, checked the unique shared-shell source and report-descendant permission mapping, verified Next.js/preset 16.4.6, and read back both inactive QA accounts/session versions plus demo correction audits. The user explicitly accepted #56. **#29 and #56 are Done; #21 remains Verify release for genuine-service validation.**

`rfs-release-smoke.json` is an earlier checkpoint whose incomplete browser/restricted-role fields are superseded by this final record. The completed role checks and session-revocation evidence above are current. No credentials are retained here. Synthetic QA identities use example.com. Unrelated chatbot drafts and staged documentation are preserved.
