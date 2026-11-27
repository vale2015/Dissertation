# Codex → Claude Code migration and AI architecture review

27 November 2026 · tracker [#72](../product/IMPROVEMENT_TRACKER.md) (migration) and proposed #73–#75 · status **Partial**: implemented and tested locally. Subagent loading and Figma read are verified. Independent review, two PM setup actions and publication are pending.

## 1. What "Codex" meant in this repository

Codex was the **development-agent runtime** only. The restaurant application does not use OpenAI or Codex. The manager chatbot classifies intents with Cloudflare Workers AI (`@cf/qwen/qwen3.8-27b`) through an OpenAI-compatible adapter. Report explanations use Vercel AI Gateway with the model set by `AI_GATEWAY_MODEL`. Section 4 covers the runtime AI separately.

## 2. Migration delivered (#72)

| Before (Codex) | After (Claude Code) |
| --- | --- |
| `AGENTS.md` | `CLAUDE.md` (renamed). A short runtime rule was added at the top; all existing rules are preserved. |
| `.codex/agents/*.toml` (20 profiles) | `.claude/agents/*.md` (20 subagents). Each frontmatter pins `model` and `effort`. Reviewers have `disallowedTools: Edit, Write, NotebookEdit`; the token analyst is limited to `Read`. |
| `.agents/skills/` (16 skills) | `.claude/skills/` (moved unchanged apart from paths and model names). |
| `.agents/model-routing.json` with GPT 6.x models | Schema v2, `runtime: claude_code`. Every route uses `claude-opus-5-5`, with the original effort per route. |
| `packet.mjs` emitted a Codex `spawn` (`fork_turns`, model override) | Emits a Claude Code Agent-tool call (`subagent_type`, `description`, `prompt`). **New guard:** it rejects a profile whose frontmatter name, model or effort drifts from the route. |
| Usage collector read `~/.codex/sessions/rollout-*.jsonl` | Reads `~/.claude/projects/**/<session>.jsonl` and `<session>/subagents/agent-*.jsonl` (`$CLAUDE_CONFIG_DIR` honoured). Responses are deduplicated by `requestId` and `<synthetic>` records are skipped. Anthropic usage is normalized: input = uncached + cache write + cache read; reasoning = thinking tokens. |
| CLI flags `--thread`, `--turn`, `--rollout-dir` | `--session`, `--prompt` (Claude Code `promptId`), `--transcript-dir`. |
| `docs/design/CODEX_FIGMA_CONFIG.toml` | `docs/design/CLAUDE_FIGMA_MCP.example.json`, inactive, in `.mcp.json` format. |

The report schema stays at version 1, so ledgers and briefs keep working. `history.mjs` still accepts earlier `codex_rollout_token_usage_record` entries. Do not treat them as like-for-like baselines for Claude workflows, because the tokenizers and harnesses differ.

Live docs were updated: README, the architecture spec, team and board workflows, the task packet, the token runbook, Figma setup, the knowledge guides, two diagrams and the presentation. Dated records keep their original wording, and only moved paths were fixed so their links still work. That covers tracker evidence, the handover, the imported context memo, the token-efficiency plan and the 22 November improvement list.

### Model routing (PM decision: the most efficient model for each task)

| Route | Model · effort | Reason |
| --- | --- | --- |
| Architecture / security design, UI/UX design, security engineering | Opus 5.5 · high | Highest-stakes reasoning, where errors are expensive. |
| Implementation (frontend, backend, database, chatbot, automation) | Sonnet 5.5 · medium | Everyday coding and agent work at half the Opus per-token price. |
| Independent QA and visual/accessibility review | Opus 5.5 · high | A stronger and different model from the implementer, which restores model diversity in review. |
| Backlog Handoff | Haiku 5.5 · medium | Rule-following tracker and Trello edits; medium effort for precision. |
| Token analyst | Haiku 5.5 · low | Reads one short sanitized brief. |

Reviewers are also independent through a fresh context, a separate profile and harness-enforced read-only tools. Compare later workflows with the token analyst before changing any tier.

## 3. Verification

- `node --test tools/agent_workflow/*.test.mjs tools/workflow_usage/*.test.mjs`: **53 tests, 52 pass, 0 fail, 1 skipped**. The skipped test creates a file symlink, which this Windows host refuses with `EPERM` without Developer Mode. It failed with the same error on unmodified `main`, and now skips the same way the usage tests already did.
- New coverage: Claude transcript fixtures (main and subagent files, multi-line responses, prompt scope, synthetic records, copied transcripts, junction containment, CLI privacy), the `CLAUDE_CONFIG_DIR` default and profile-drift rejection. A registry check found 15 roles, 6 routes and 20 subagents with no path or frontmatter drift.
- **Fresh-session subagent loading: verified.** A new headless Claude Code 2.1.332 session invoked `subagent_type: rfs-token-analyst`. Its metadata shows the project profile (`isBuiltIn: false`), running on `claude-haiku-5-5` at `low` effort with no tool calls, so both frontmatter pins were honoured. The usage collector then captured that session and its subagent with observed coverage and correct per-model attribution.
- **Figma from Claude Code: read verified.** The claude.ai Figma connector is authenticated as the PM's account and lists the three registered pages of the RFS file. Edit access was not tested. The account currently shows View seats on its Starter plans, so verify edit rights before the next design edit.
- Live diagnostic capture of the migrating session: coverage **observed**, 57 responses, 10.73M total tokens, 97.8% of input served from cache, no missing fields. Nothing was added to the ledger.
- **Not yet verified:** independent reviewer pass. Trello sync is recorded on the #72 card.

## 4. PM decisions (27 November 2026)

1. **GitHub apps: keep both, Claude takes precedence.** Both can be installed on the same repository. The ChatGPT Codex Connector (installation `184939334`) stays as a fallback. `CLAUDE.md` now states Claude's precedence, and a minimal root `AGENTS.md` points Codex to `CLAUDE.md`. **PM action:** install the Claude GitHub App for `vale2015/RFS` only (github.com/apps/claude, or `/install-github-app` in an interactive Claude Code terminal). It is needed for cloud scheduled tasks and `@claude` on PRs.
2. **Weekly research task: move to Claude. This is blocked on one PM action.** The publisher accepts only Issues opened by `vale2015` (ID `147600089`). A Claude cloud task reaches GitHub through the Claude GitHub App, so it cannot open Issues as `vale2015`, and no GitHub connector is currently connected. Recommended route, which leaves the security gate unchanged: add the GitHub connector at claude.ai/customize/connectors, signed in as `vale2015`. Then create a Claude cloud scheduled task on Sonnet 5.5, Sundays 10:00 UTC (cron `0 10 * * 0`, which is 10:00 Europe/Dublin in winter and 11:00 in summer), with the replacement prompt from the [implementation guide](../knowledge/RFS_WEEKLY_KNOWLEDGE_BASE_IMPLEMENTATION_GUIDE.md) and the GitHub connector attached. Disable the ChatGPT task in the same step so there is never a duplicate, then verify one real run. The alternative, letting the publisher trust a bot identity, changes a write-enabled workflow and would need a FULL security review.
3. **Model tiers: decided.** The most efficient model for each task, as tabulated in section 2.

## 5. Architecture review: new improvements (added to the tracker)

| # | Improvement | Priority | Why | Acceptance |
| --- | --- | --- | --- | --- |
| 73 | Stop tracking `node_modules/` (6,561 files) and Python bytecode (38 `__pycache__`/`.pyc` files) | Should | Both are already in `.gitignore`, but they were committed in `ffd0865` (May 2026). They bloat clones and diffs, risk stale dependencies and hide real changes. The root `package.json` also carries frontend libraries (`lucide-react`, `dotenv`). | `git ls-files node_modules` and bytecode paths return nothing. A fresh clone with `npm ci` and the backend venv runs every test suite. Vercel builds stay green. |
| 74 | Run the Node test suites in CI | Should | GitHub Actions covers only backend tests, migration replay and knowledge refresh. The frontend chatbot, auth and report tests and the 53 agent-tooling tests are never gated. | A workflow runs frontend tests and lint plus `tools/**` tests on PRs and pushes to `main`. It fails on any test failure and is documented in the README. |
| 75 | Evaluate the runtime AI: whether to keep the model call, and which provider | Could | The intent classifier never sees user text, only the regex-derived signal words (`taskSignals`). That is good prompt-injection containment, but it means the model chooses an intent mostly from words a lookup table could map. Measure first whether the model adds accuracy over deterministic mapping. If it does, compare Qwen on Cloudflare with Claude Haiku 5.5 through the Anthropic SDK (structured output, same allowlist, same no-user-text boundary). Report explanations could use Claude through the existing AI Gateway by setting `AI_GATEWAY_MODEL`, with no code change. | An eval set of real-shaped manager requests records accuracy, latency, failure rate and cost for (a) deterministic only, (b) the current model and (c) the candidate. The PM picks an option based on that evidence. Any provider change keeps the allowlist, the never-user-text egress rule and the failure diagnostics. |

### Strengths to preserve

- Chatbot egress is assembled only from a fixed local vocabulary. The model never sees API results, staff records, credentials or mutation tools, and its output is constrained to an allowlist.
- Report explanations never supply figures: numbers are rendered from the saved report and the model adds only bounded interpretation.
- The delivery workflow enforces one active specialist, bounded 500-word packets and 200-word handoffs, separate review and tracker-first status. These carry over unchanged and now have harness-enforced reviewer tools.

### Minor notes

- The project skill `security-review` has the same name as Claude Code's built-in `/security-review` command. `CLAUDE.md` now tells RFS security reviews to follow the project skill. Rename it if the clash causes confusion.
- `CLAUDE.md` is dense (41 long lines, about 1,600 words) and is loaded every session. Moving dated authorizations into the handover would shrink the per-session context; this fits #68.
