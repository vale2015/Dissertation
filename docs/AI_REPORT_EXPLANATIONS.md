# AI-assisted saved-report explanations (#52)

Status: **Partial**, feature-gated pilot (2026-10-23). Feature commit `5b32c7d` reached GitHub `main`; the frontend and backend production deployments reached READY on that SHA. AI generation remains disabled in production because no `AI_` variables are configured. The [tracker](IMPROVEMENT_TRACKER.md) owns the actionable status and exact release evidence. No Supabase change was made.

## Manager experience

This is a gated API pilot, **not a visible action on the current view-only Reports page**. If a future reviewed interface enables it, a manager could request up to three draft observations and practical checks from a saved report. Each would appear beside an exact source figure taken from that immutable report and its report ID, labelled for manager review. It cannot alter bookings, staffing, forecasts, or report totals. When AI is disabled or fails, the normal report and downloads remain available. The current product workflow is defined in the [PRD](PRD.md).

## Boundary and data handling

- The Next.js server checks the existing session cookie and asks Flask for the saved report with the same bearer token and permission checks as the ordinary report page. The browser cannot submit arbitrary report content to the model.
- A strict allowlist extracts aggregate covers, staffing-assignment count, selected estimated financial totals, and missing-data indicators. Names, contact details, booking notes, raw daily rows, and staff records are not sent to the model.
- The model returns a structured list of evidence IDs, interpretations, and manager checks. Unknown or duplicate evidence IDs, and model prose containing figures or links, are rejected. Exact evidence is rendered from the saved report, not copied from model text.
- The model is instructed to treat evidence as data, avoid causal claims, and present suggestions rather than automatic actions. This does not prove its interpretations are correct; human review and an evaluation set are still required.
- If a reviewed interface is added, the request must run only after the manager explicitly invokes it. The existing route has a 20-second model deadline and returns a safe error if the backend or model is unavailable. Responses are not cached or written to the report history.

## Configuration and release gates

The feature is **off by default**. A production rollout requires server-only `AI_REPORT_EXPLANATIONS_ENABLED=true`, an approved `AI_GATEWAY_MODEL`, working [Vercel AI Gateway authentication](https://vercel.com/docs/ai-gateway/getting-started), and the existing `BACKEND_API_URL`. Do not put Gateway credentials or session tokens in browser variables. Select a model and review provider data handling/retention before enabling it. Set and monitor a spend budget in [AI Gateway](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets); add per-user usage limits before broad access.

Before marking #52 Done: approve the privacy and cost posture; test a representative set of saved reports (including missing financial/weather data) against human-reviewed expected interpretations; record incorrect/unsupported claim rate, latency, token use, and spend; test manager authorization, signed-out denial, model failure, and normal-report fallback in the deployed app. Forecast-versus-actual commentary can be added after #21 and needs its own evidence/evaluation checks.

## Local evidence

On 2026-10-23, four focused Node tests passed for fact projection, report-currency formatting, output rejection, and exact evidence pairing. Frontend lint passed with one existing warning unrelated to this feature; the production webpack build passed. Turbopack stalled during its initial compilation; a first webpack attempt hit a Windows/OneDrive file-permission error, then passed with normal workspace access. A local HTTP smoke attempt could not connect to the development machine's loopback port from this tool environment, so signed-out and cross-origin route responses remain unverified over HTTP. `npm audit` reported 16 advisories in the frontend dependency tree; no automatic dependency upgrade was made. Live Gateway generation and end-to-end browser verification remain outstanding.

The implementation uses the [AI SDK structured-output API](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) with a server-selected model. It does not introduce an autonomous agent, vector database, new Supabase tables, or a background workflow.
