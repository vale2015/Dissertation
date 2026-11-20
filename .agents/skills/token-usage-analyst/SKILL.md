---
name: token-usage-analyst
description: Run the dedicated RFS token analyst on a sanitized workflow usage report and present measured optimization opportunities.
---

# Token usage analyst

Use for token reporting/optimization and at a meaningful development-workflow completion. Keep the main task's acceptance and privacy gates.

1. Run the deterministic collector in tools/workflow_usage/ for an explicit root thread and workflow time window. Do not give the analyst raw chats, credentials or tool payloads.
2. Route to rfs_token_analyst using [.agents/model-routing.json](../../model-routing.json): fresh bounded context, gpt-6.1-sol/low. The profile is in [.codex/agents/rfs-token-analyst.toml](../../../.codex/agents/rfs-token-analyst.toml). In runtimes exposing spawn overrides, select the explicit model/effort rather than inheriting the whole chat. Report unavailable model/profile activation instead of silently substituting.
3. Give only totals, per-model/per-thread counters, coverage and task-role labels. Ask for at most three evidence/action/verification recommendations, maximum180 words. Never ask this analyst to implement changes or approve a release.
4. Report input, cached/non-cached input, output and reasoning separately. Cached input and reasoning are subsets. Unknown fields stay unknown; snapshot timing and missing telemetry remain visible. Do not convert subscription quotas to tokens or invent monetary spend.
5. Include all observed workflow descendants and analyst overhead when available. A report taken before the final response is a snapshot, not a final bill. Do not invoke the analyst recursively to count itself.

Project lifecycle hooks require explicit client review/trust before automatic execution. Never bypass hook trust. Until activation is verified, collect/report manually and label automatic reporting pending.
