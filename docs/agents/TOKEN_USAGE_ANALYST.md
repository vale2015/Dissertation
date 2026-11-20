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

## Persistent usage record and improvement flags

The PM clarified that a replaceable current snapshot is insufficient: preserve a local record for each workflow and flag measured opportunities. The independently verified history extension keeps stable workflow IDs, measurement windows, task categories, models, token subsets and coverage; refreshing a workflow updates its existing entry. All files remain directly in the VS Code project under ignored `.workflow-usage/`.

The analyst must distinguish a measured candidate from proven waste. Large average input and dominant coordinator context can suggest smaller handoffs. A comparison needs enough fully measured workflows of the same category; otherwise report insufficient evidence. Token counters alone cannot prove repeated tool calls, retries, redundant tests or monetary spend. Every supported flag needs evidence, an action and a success check. Present important flags during the workflow handoff and retain the review locally.

### Files visible in VS Code

- `.workflow-usage/usage-history.json`: the authoritative local record, with one entry per stable workflow ID.
- `.workflow-usage/USAGE_HISTORY.md`: readable workflow history and token/model summaries.
- `.workflow-usage/OPTIMIZATION_FLAGS.md`: measured optimization candidates, their evidence, actions and verification checks.
- `.workflow-usage/reviews/`: dated analyst reviews saved by the coordinator.

After collection, record or refresh the workflow with:

```powershell
node tools/workflow_usage/history.mjs --report .workflow-usage/current.json --run-id rfs68-history --category workflow-tooling --label "Usage history implementation" --scope full --state snapshot
```

Choose a new run ID for a new workflow; reuse it for later captures of the same workflow. `partial` means measurement began after work started; `full` means the selected start is known. `snapshot` is still being measured; change to `closed` only when that selected window is finished. A capture taken before the final reply excludes future reply tokens. Refreshing must preserve the original identity/start and never reopen a closed record. The storage lock prevents concurrent writers from silently losing records; invalid history is never reset automatically.

Initial heuristics are review candidates, not proof of waste: average input at least 50,000 tokens across at least ten responses; coordinator input at least 250,000 tokens and 60% of recorded input; or workflow total above 1.5 times the median of at least three other comparable full, closed, observed records. Baselines exclude partial/unfinished records. Thresholds are declared in `history.mjs`; no savings or spending limit is enforced by these flags.

## Activation and limits

The coordinator is instructed to perform this reporting step for project workflows. Automatic lifecycle hooks are not installed or verified; this agent is invoked on demand, not continuously running. A future automatic hook requires a concrete reviewed definition and explicit client trust. Never bypass that trust. The current chat started outside this repository, so creating a project profile does not retroactively change its loaded configuration.

Local rollout formats can change. Schema version 1 supports observed `token_usage_record` response counters; unsupported cumulative-only data is reported as unavailable. Keep parser tests and coverage warnings when upgrading. Source: [Codex hooks and transcript caveat](https://learn.chatgpt.com/docs/hooks), [official Codex source](https://github.com/openai/codex).

## Verification checkpoint

History extension: 23 independent checks passed with zero skips after one fix/retest cycle: ten history tests, seven collector tests and six independent arithmetic/threshold/baseline edge checks. The discovered unknown-derived-uncached validation defect is fixed and has permanent regression coverage; rejected imports leave history files unchanged. Two real nonoverlapping records were seeded, and same-ID refresh retained two records. The dedicated analyst reviewed the measured flags; its review is saved under `.workflow-usage/reviews/rfs68-usage-history.md`. No eligible comparable baseline or saving is claimed. Fresh profile loading and automatic hooks remain separate, unverified capabilities.

All work is now in the original VS Code checkout. Implementer/self-check passed six tests with a host-restricted link test skipped; independent QA subsequently passed all seven, including the junction boundary, with zero skips. Syntax and all five TOML profiles passed; independent review found no blocking correctness/privacy issue. Live counters distinguish actual implementation, QA and coordinator models plus automatic approval-review overhead. A fresh gpt-6.1-sol/low analyst completed a tool-free, bounded review of sanitized counters; refreshed local telemetry includes that invocation. Its recommendations are shorter coordinator context, concise implementation handoffs and complete workflow boundaries; no measured saving or dollar charge is inferred. Named-profile loading/tool restrictions remain unproven in a fresh trusted project session. #68 stays Partial until comparable baseline, optimization and adoption criteria are met.
