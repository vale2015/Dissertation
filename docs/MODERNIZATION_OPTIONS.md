# Modernization, AI, and low-code options

This is an architectural options and decision-history note, not approval to implement or deploy any further option. The [improvement tracker](IMPROVEMENT_TRACKER.md) owns actionable status. Last reviewed: 2026-10-30.

## Architectural judgment

The current Next.js/React, Flask, and PostgreSQL stack is already modern enough for this product. Replacing Flask with another API framework, replacing PostgreSQL, or moving all logic into an AI agent would not inherently reduce maintenance or increase reliability. Keep deterministic booking, permissions, demand calculations, forecast storage, and report totals in the existing tested application services. Introduce managed/low-code tools at clear boundaries where they remove repetitive operational code.

## Best-fit options, in value order

| Option | Product value and proposed design | Code/operational trade-off | Backlog |
|---|---|---|---|
| **Restaurant manager chatbot** | A typed assistant now provides weather, local events, management reports, and an embedded protected Staff Management workspace. The manager-only launcher sits below the left menu and opens a left dock. | The pilot is deployed but remains Partial: complete authenticated journeys, model-inference, privacy/usage, and staff-write idempotency checks. The Staff Management screen remains in navigation under the later redesign decision. | #54–55; see the [PRD](PRD.md) for product scope and [architecture note](RFS%20Chatbot%20Architecture%20Design.md) for boundaries. |
| **Automated manager briefings and alerts** | After forecast-versus-actual tracking (#21) exists, send an opt-in daily/weekly summary of demand changes, forecast error, staffing gaps, or failed report generation. Use a scheduled trigger and a durable, idempotent workflow; store delivery preferences and an audit record. A manager should be able to inspect the underlying figures and turn notifications off. | Removes repeated manual dashboard checks, but adds messaging costs, consent/preferences, retries, duplicate suppression, and monitoring. A simple scheduled job may suffice; use a durable queue/workflow only when failure recovery requires it. | New #51; depends on #21 and operational gates #46–48. |
| **AI-assisted report explanation** | Add a read-only draft narrative to a saved report or forecast comparison: cite exact saved figures, flag missing data, and distinguish facts from hypotheses. Validate structured output, exclude customer/staff identifiers, track model/version and cost, and require manager review before sharing. Keep all financial and forecasting arithmetic deterministic in Flask. | Makes reports easier to interpret, but adds model cost, latency, privacy review, evaluation cases, and a fallback when AI is unavailable. Start with one report-summary workflow, not a general autonomous agent. | #52; saved-report pilot depends on completed #26; #21 can later enrich it with accuracy comparisons. |
| **Low-code external integration pilot** | If managers need reports or alerts in email/chat/another business tool, pilot a narrowly scoped low-code workflow such as n8n Cloud. Trigger it via an authenticated application webhook carrying only the minimum data, never direct database credentials. Keep booking edits and permissions inside the app. | Less custom integration code for peripheral workflows, but introduces a vendor, secrets, monitoring, pricing, and another failure mode. Compare its total cost with a small in-app job before adopting it. | New #53; conditional on a specific integration request. |

## Existing modernization work—do not duplicate it

- #17–18 already cover durable background model training and model artifact storage. These are higher architectural priorities than adding an AI chat surface.
- #12–13, #23, and #41–48 already cover faster data delivery, shared caches, automated testing/deployment checks, and observability. Those foundations make any AI or automation feature easier to operate.
- #29–32 already cover frontend maintainability and contract safety. Incremental TypeScript or API validation can reduce defects, but a full rewrite is not required.

## Safeguards and decision rule

AI should explain and assist, not silently change bookings, staffing rules, permissions, or financial figures. Any write action would require explicit user confirmation, scoped authorization, audit logging, and tests. Do not send personal booking or staff data to an external model without a privacy and retention review. A model-generated statement should show its source values and be labelled as an interpretation. Evaluate accuracy, usefulness, latency, cost, and failure behaviour against a human-written baseline before rollout.

For less coding, prefer managed scheduling, queues/workflows, and a low-code connector for noncritical communication—but only where a concrete user workflow exists. Avoid adding an AI agent, vector database, or separate microservice before the product need justifies it.

## Current state

The user prefers the manager chatbot to standalone report notes and set #54–55 to medium priority. The chat pilot is deployed but not fully verified; its first skeleton milestone is historical. The #52 saved-report explanation API remains disabled and Partial, with no current report-page control, pending model, budget/privacy approval, evaluation, and release testing; see [AI_REPORT_EXPLANATIONS.md](AI_REPORT_EXPLANATIONS.md). No workflow engine, low-code platform, or chatbot-specific database change has been added. #21 still needs a genuine completed-service comparison before it can be accepted.

## Current product references

- [Vercel AI SDK: structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Vercel: queues versus workflows](https://vercel.com/i/queues-vs-workflows)
- [n8n documentation: low-code workflow automation](https://docs.n8n.io/)
