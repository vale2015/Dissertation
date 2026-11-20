# Dedicated token-usage analyst

20 November 2026 · #68 · Collector independently verified; bounded analyst demonstrated

The dedicated `rfs_token_analyst` reviews usage and recommends up to three improvements. It does not build features, approve releases or read conversation content. Deterministic Node scripts count tokens; the analyst interprets sanitized results. No external monitoring platform, paid integration or background schedule is installed.

## Models by responsibility

The routing source is `.agents/model-routing.json`. Architecture/security design uses gpt-6.2-astra/high; implementation gpt-6.2-sol/medium; independent QA gpt-6.1-sol/high; visual/accessibility review gpt-6.1-terra/high; token analysis gpt-6.1-sol/low. Select only relevant roles, sequentially. Different tasks can reuse an appropriate model: rotating models arbitrarily creates no measured saving. The main chat model is not changed by these files.

Project agent definitions live in `.codex/agents/`. They become available when the client loads this trusted project. In a runtime exposing only explicit spawn overrides, the coordinator must supply the model, effort and bounded instructions directly. That invocation is not proof the named profile or its tool restrictions was loaded. Never silently fall back when a model is unavailable.

## Collect and review each workflow

Work only in the VS Code project folder specified in AGENTS.md. Record the workflow start in UTC and its root chat ID. Run from this repository:

```powershell
node tools/workflow_usage/usage.mjs --thread ROOT-CHAT-UUID --since 2026-11-20T14:35:29Z --output .workflow-usage/current.json --markdown .workflow-usage/current.md
```

Use a real UUID and the workflow's actual start, not the example date for future tasks. `--until` fixes the exclusive UTC end; default is capture time. `--turn ROOT-TURN-UUID` optionally limits a report to one root turn. A multi-turn task needs a time window covering those turns. Reports remain local in the ignored `.workflow-usage/` directory; never commit them or raw rollouts.

The collector reads session metadata to identify root and descendants, then processes only their response usage records. It deduplicates thread/response IDs and ignores cumulative counters. Reports contain counters and coverage, not prompts, tool arguments or transcript paths. Missing sessions/fields remain unavailable, not zero. Cached input is included in input; reasoning is included in output. Total is input plus output, not the sum of all columns.

Give the analyst only the report and relevant task-role labels, in fresh context. Ask for up to three ranked evidence/action/verification recommendations in 180 words. Refresh the report after it returns to count its overhead; do not recursively analyze the analysis. Preserve required tests, privacy and independent review.

The final reply's future tokens cannot appear in a pre-reply report. Label it a snapshot through capture time. Failed/unrecorded calls and missing descendants are not known free. Subscription utilization percentages are separate from tokens; local counters do not establish a dollar charge. Claim no percentage saving until comparable before/after workflows exist.

## Activation and limits

The coordinator is instructed to perform this reporting step for project workflows. Automatic lifecycle hooks are not installed or verified; this agent is invoked on demand, not continuously running. A future automatic hook requires a concrete reviewed definition and explicit client trust. Never bypass that trust. The current chat started outside this repository, so creating a project profile does not retroactively change its loaded configuration.

Local rollout formats can change. Schema version 1 supports observed `token_usage_record` response counters; unsupported cumulative-only data is reported as unavailable. Keep parser tests and coverage warnings when upgrading. Source: [Codex hooks and transcript caveat](https://learn.chatgpt.com/docs/hooks), [official Codex source](https://github.com/openai/codex).

## Verification checkpoint

All work is now in the original VS Code checkout. Implementer/self-check passed six tests with a host-restricted link test skipped; independent QA subsequently passed all seven, including the junction boundary, with zero skips. Syntax and all five TOML profiles passed; independent review found no blocking correctness/privacy issue. Live counters distinguish actual implementation, QA and coordinator models plus automatic approval-review overhead. A fresh gpt-6.1-sol/low analyst completed a tool-free, bounded review of sanitized counters; refreshed local telemetry includes that invocation. Its recommendations are shorter coordinator context, concise implementation handoffs and complete workflow boundaries; no measured saving or dollar charge is inferred. Named-profile loading/tool restrictions remain unproven in a fresh trusted project session. #68 stays Partial until comparable baseline, optimization and adoption criteria are met.
