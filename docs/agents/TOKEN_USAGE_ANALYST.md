# Dedicated token-usage analyst

20 November 2026 · #68 · Collector independently verified; bounded analyst demonstrated

Updated 27 November 2026 · #72 · Runtime migrated to Claude Code; the collector reads Claude Code transcripts

The dedicated `rfs-token-analyst` subagent reviews usage and recommends up to three improvements. It does not build features, approve releases or read conversation content. Deterministic Node scripts count tokens; the analyst interprets sanitized results. No external monitoring platform, paid integration or background schedule is installed.

## Models by responsibility

The routing source is `.agents/model-routing.json`. Following the PM direction to use the most efficient model for each task (27 November 2026), the routes are: architecture/security design claude-opus-5-5/high; implementation claude-sonnet-5-5/medium; independent QA claude-opus-5-5/high; visual/accessibility review claude-opus-5-5/high; backlog coordination claude-haiku-5-5/medium; token analysis claude-haiku-5-5/low. Compare later workflows with this analyst before changing a tier. Select only relevant roles, sequentially. Different tasks can reuse an appropriate model: rotating models arbitrarily creates no measured saving. The main chat model is not changed by these files.

Project subagent definitions live in `.claude/agents/`. Claude Code loads them when it opens this project. Each profile pins `model`, `effort` and its tool limits in frontmatter. The analyst profile allows only `Read`. A fresh headless session on 27 November confirmed it loads by `subagent_type` and runs on claude-haiku-5-5 at low effort. Invoke a profile by `subagent_type` so those pins apply. `tools/agent_workflow/packet.mjs` rejects a profile whose frontmatter drifts from the routing file. A configured profile is not proof that a particular session loaded it, so record the model the transcript actually shows. Never silently fall back when a model is unavailable.

## Collect and review each workflow

The preferred path is the single capture command, which performs collection/history update and saves a bounded analyst brief:

```powershell
node tools/workflow_usage/capture.mjs --session ROOT-SESSION-UUID --since UTC-START --prompt ROOT-PROMPT-UUID --run-id workflow-id --category task-category --label "Workflow title" --scope full --state snapshot
```

Replace placeholders with the actual session, start and task metadata. The session UUID is the transcript file name under `~/.claude/projects/<project>/`. `--prompt` is optional and uses the `promptId` recorded on the user message. Reuse the same ID and original metadata on refresh; use `--state closed` for a finished selected window. Output is four summary lines. Detailed reports go in `.workflow-usage/reports/` and sanitized analyst briefs in `.workflow-usage/briefs/`, named by run ID. Give the analyst the brief once, then refresh capture to include its overhead. A capture taken before the final reply still excludes future tokens. A failed derived-file publication leaves the authoritative ledger intact and reports how to regenerate the files.

The separate diagnostic commands remain supported below. Compare uncached input and output as well as cached/raw context volume; no token column establishes a monetary charge. See [optimisation actions](TOKEN_USAGE_OPTIMISATION_ACTIONS.md).

Work only in the VS Code project folder specified in CLAUDE.md. Record the workflow start in UTC and its root Claude Code session ID. Run from this repository:

```powershell
node tools/workflow_usage/usage.mjs --session ROOT-SESSION-UUID --since 2026-11-20T14:35:29Z --output .workflow-usage/current.json --markdown .workflow-usage/current.md
```

Use a real UUID and the workflow's actual start, not the example date for future tasks. `--until` fixes the exclusive UTC end; default is capture time. `--prompt ROOT-PROMPT-UUID` optionally limits a report to one root prompt. A multi-prompt task needs a time window covering those prompts. `--transcript-dir` overrides the default `~/.claude/projects` (or `$CLAUDE_CONFIG_DIR/projects`). Reports remain local in the ignored `.workflow-usage/` directory; never commit them or raw transcripts.

The collector finds the root `<session>.jsonl` and its subagent transcripts under `<session>/subagents/`. It processes only their assistant usage records. Claude Code writes one line per content block, so each API response is counted once by `requestId`. Local `<synthetic>` messages are skipped because they were never billed. Each subagent gets a stable derived UUID, so the raw agent ID is never stored. Anthropic reports `input_tokens` without cache reads or writes, and the collector normalizes it: input = uncached + cache write + cache read. Reasoning output is the reported thinking-token subset of output. Reports contain counters and coverage, not prompts, tool arguments or transcript paths. Missing sessions/fields remain unavailable, not zero. Cached input is included in input; reasoning is included in output. Total is input plus output, not the sum of all columns.

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

Local transcript formats can change between Claude Code releases. The report remains schema version 1, with source `claude_code_transcript_usage`. History still accepts earlier `codex_rollout_token_usage_record` ledger entries, so existing baselines survive. Keep the parser tests and coverage warnings current when upgrading. Codex and Claude Code records come from different tokenizers and harnesses, so do not use pre-migration Codex records as a like-for-like baseline for Claude workflows.

## Verification checkpoint

Claude Code migration (27 November 2026, #72): the collector, capture and history tests were rewritten against Claude Code transcript fixtures. These cover main and subagent files, multi-line response deduplication, prompt scoping, synthetic records, copied transcripts, junction containment and CLI privacy. With the packet and board tests, 53 tests run: 52 pass and 1 symlink test is skipped on this Windows host. A live capture of this session was run locally (counts not recorded here). Independent review is pending.

The entries below are historical and describe the earlier Codex runtime.

Capture/efficiency extension: 22 collector/history/capture tests plus three independent edge checks passed with zero skips. Safe identity/overlap/refresh behavior, compact four-line output, sanitized brief, link/hardlink rejection, unknown fields and ledger-preserving report recovery were checked. Crash/stale-lock recovery was inspected rather than process-kill tested. See [the optimisation actions](TOKEN_USAGE_OPTIMISATION_ACTIONS.md).

History extension: 23 independent checks passed with zero skips after one fix/retest cycle: ten history tests, seven collector tests and six independent arithmetic/threshold/baseline edge checks. The discovered unknown-derived-uncached validation defect is fixed and has permanent regression coverage; rejected imports leave history files unchanged. Two real nonoverlapping records were seeded, and same-ID refresh retained two records. The dedicated analyst reviewed the measured flags; its review is saved under `.workflow-usage/reviews/rfs68-usage-history.md`. No eligible comparable baseline or saving is claimed. Fresh profile loading and automatic hooks remain separate, unverified capabilities.

All work is now in the original VS Code checkout. Implementer/self-check passed six tests with a host-restricted link test skipped; independent QA subsequently passed all seven, including the junction boundary, with zero skips. Syntax and all five TOML profiles passed; independent review found no blocking correctness/privacy issue. Live counters distinguish actual implementation, QA and coordinator models plus automatic approval-review overhead. A fresh gpt-6.1-sol/low analyst completed a tool-free, bounded review of sanitized counters; refreshed local telemetry includes that invocation. Its recommendations are shorter coordinator context, concise implementation handoffs and complete workflow boundaries; no measured saving or dollar charge is inferred. Named-profile loading/tool restrictions remain unproven in a fresh trusted project session. #68 stays Partial until comparable baseline, optimization and adoption criteria are met.
