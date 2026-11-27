# Compact specialist task packet

The coordinator runs one workflow and one specialist at a time and prepares a separate packet for each explicit invocation. Read the active tracker item and relevant files, then summarize only the requested outcome, current evidence, acceptance checks, and limits. Use a briefing of at most 500 words including any previous handoff. Supply references to existing files without embedding source, transcripts, or logs. Exclude credentials and private records from paths and prose.

## Input and invocation

Run `node tools/agent_workflow/packet.mjs < /path/to/task.json` from the checkout or import `buildInvocation(input)` from the same module. The helper reads [.agents/team.json](team.json) and [.agents/model-routing.json](model-routing.json), validates the packet, and prints one JSON invocation record. Pass its `agent` object (`subagent_type`, `description`, `prompt`) to the Claude Code Agent tool. Do not add a `model` or `effort` override: the subagent profile in `.claude/agents/` pins both, and the generator rejects a profile that drifts from the route. The record also carries a distinct `task_name`, which serves as the specialist identity for handoff checks, and the resolved `route` for reporting. Subagents always start in a fresh context. The briefing points the specialist to its registered skill. Supply this briefing explicitly if named profiles are unavailable. If the selected model or fresh-context invocation is unavailable, report the gap and obtain the PM's choice. The helper generates fields only. The coordinator controls invocation order and checks that the previous specialist has ended.

```json
{
  "task_id": "#58",
  "workflow_id": "rfs58-review-packet",
  "tier": "QUICK",
  "role_ref": "RFS-AUTO",
  "outcome": "Verify that reviewer invocations use bounded fresh context.",
  "acceptance_criteria": ["A generated reviewer invocation uses a distinct identity and fresh context."],
  "relevant_paths": ["tools/agent_workflow/packet.mjs"],
  "approval_limits": ["Use local checks only. No external writes."]
}
```

Use an existing numbered `task_id` and a short, stable lower-case `workflow_id`. Set `tier` to QUICK, STANDARD, or FULL and select a registered `role_ref`. The allowed fields include one single-line `outcome`, 1–8 `acceptance_criteria`, 1–12 `relevant_paths` to existing repository files, and 1–6 `approval_limits`. Optional fields are `checks` (1–8 entries), `source_revision` (commit hash), and `attempt` (1–3, default 1). Reference a new file once it exists or name the intended output briefly in the outcome. Keep summaries and list entries on single lines. The generator checks for unsafe paths and recognizable private material. The coordinator still sanitizes every field before submission.

## Sequential handoff

1. **Implementation.** Invoke the selected engineer with the generated fields. Wait for its turn to end. Capture the actual changed files, check results, gaps, and recommended next action in at most 200 words.
2. **Review.** Select that engineer's designated reviewer with the same task, workflow, tier, and attempt. Update the relevant paths to include the actual changed and review files. Add `implementation_handoff` with `role_ref` (the engineer's role), `agent_id` (the completed engineer's `task_name` from its invocation record, or the Claude Code agent ID if you track that instead), and `summary` (the sanitized implementation handoff). The reviewer runs independent checks and ends before another specialist starts. If review finds defects that need fixing, increment `attempt` and run a new implementation and review sequence. Stop after two unsuccessful fix/retest cycles and report the blocker.
3. **Backlog Handoff.** Use `role_ref: "RFS-BACKLOG"` with a `review_handoff` containing the completed reviewer's `role_ref`, client identity as `agent_id`, and sanitized `summary` of at most 200 words. Supply the tracker path and relevant evidence. Include any unresolved checks or PM acceptance. Maintain the numbered tracker item first and mirror status and comments on the matching card only when authorized. Preserve existing domain and delivery-tier labels.

For cross-domain work, repeat the paired implementation and review sequentially for each needed domain. Give the backlog specialist the final review summary with earlier evidence referenced in the packet. The coordinator retains oversight of tracker, Trello, publication, and workflow usage, including permitted writes. Return concise specialist comment drafts when the coordinator owns the external action.
