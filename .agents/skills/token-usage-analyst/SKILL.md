---
name: token-usage-analyst
description: Run the dedicated RFS token analyst on a sanitized workflow usage report and present measured optimization opportunities.
---

# Token usage analyst

Use for token reporting/optimization and at a meaningful development-workflow completion. Keep the main task's acceptance and privacy gates.

1. Prefer the deterministic capture.mjs command in tools/workflow_usage/ for an explicit root thread/window and one stable run ID/category/scope. It collects, records and prepares a compact analyst brief in one command. The separate usage.mjs/history.mjs commands remain available for diagnostics. Refresh that same ID after analysis rather than adding a duplicate. Never give the analyst raw chats, credentials or tool payloads.
2. Route to rfs_token_analyst using [.agents/model-routing.json](../../model-routing.json): fresh bounded context, gpt-6.1-sol/low. The profile is in [.codex/agents/rfs-token-analyst.toml](../../../.codex/agents/rfs-token-analyst.toml). In runtimes exposing spawn overrides, select the explicit model/effort rather than inheriting the whole chat. Report unavailable model/profile activation instead of silently substituting.
3. Give only totals, per-model/per-thread counters, coverage, task-role labels and sanitized usage-history flags. Ask for at most three priority/evidence/action/verification recommendations, maximum180 words. Check comparable sample size before claiming trends. Never ask this analyst to implement changes or approve a release. Save its review under .workflow-usage/reviews/ and surface important new/persisting flags in the workflow handoff; link the usage history and flags files.
4. Report input, cached/non-cached input, output and reasoning separately. Rank uncached/output usage alongside cached context volume. Cached input and reasoning are subsets; unknown fields stay unknown. Keep snapshot timing and missing telemetry visible. Do not convert subscription quotas to tokens or invent monetary spend. Batch related authorized operations where useful, preserving every approval gate.
5. Include all observed workflow descendants and analyst overhead when available. A report taken before the final response is a snapshot, not a final bill. Do not invoke the analyst recursively to count itself.

Project lifecycle hooks require explicit client review/trust before automatic execution. Never bypass hook trust. Until activation is verified, collect/report manually and label automatic reporting pending.
