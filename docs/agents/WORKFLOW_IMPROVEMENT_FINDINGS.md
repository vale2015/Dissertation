# Where the RFS agent workflow should improve (#68)

27 November 2026 · #68 · analysis of the seven Claude Code workflows recorded on 27 November

**Purpose.** #68's goal is to show where the delivery workflow wastes effort, so that changes target the biggest measured costs. This page splits each recorded workflow by stage: the root coordinator and each specialist subagent. The split comes from Claude Code transcripts for the workflow windows in the private usage history. Figures are observed tokens, not billing. Savings below are estimates that still need a comparison run.

## What the measurements show

Almost all tokens are input that is re-read on every response; output is under 1% of the total and about 95% of input is cached. **Cost is driven by how many responses each stage takes multiplied by how large its context is**, not by how much the agents write.

| Workflow | Root share | Root first / average input per response | Specialists (share of input) | Backlog handoff share |
| --- | ---: | --- | --- | ---: |
| rfs62 demand writes | 42% | 70k / 92k | security engineer 12%, security reviewer 25% | 20% |
| rfs7 security headers | 31% | 147k / 149k | security engineer 41%, reviewer 12% | 16% |
| rfs78-79 follow-ups | 50% | 173k / 198k | four engineers/reviewers 24% | 26% (two runs) |
| rfs72 weekly task | 86% | 258k / 282k | none | 14% |
| rfs68 baselines | 91% | 298k / 311k | analyst under 1% | 9% |
| rfs76 generic 500s (fresh session) | 55% | 77k / 107k | backend engineer 17%, reviewer 13% | 14% |
| rfs68 packet `--next` | 71% | 194k / 208k | automation engineer 9%, reviewer 10% | 10% |

## Where to improve, in order of measured size

1. **Specialist start-up overhead: about 50k tokens per response before any work.** Every engineer, reviewer and backlog subagent's first response is 49–50k input. The token analyst, whose profile allows only `Read`, starts at 8–9k. The difference is the tool definitions and listings that every unrestricted profile loads, including the large connector catalogues (Vercel, Figma, Gmail and others) that most roles never use. Because this cost is replayed on every response, it is roughly 26–35% of all input in the four delivery workflows (estimated upper bound). **Action:** give each subagent profile an explicit `tools:` allowlist of only what its role needs, starting with the backlog handoff and the reviewers. **Check:** first-response input for the restricted roles falls well below 50k, with reviews and handoffs still completing.

2. **Long-running root sessions.** The root coordinator's starting context is 70–77k in a fresh session and 147–298k when the session carries earlier workflows. Its average input per response is 92–107k when fresh and 149–311k when continued. The three workflows run late in one long session had the highest root shares (71–91%). **Action:** keep action 7, a fresh root session per workflow, as a firm rule, and leave tracker and Trello writing to the backlog step. **Check:** root first-response input under 100k and root share under 50% over the next three workflows.

3. **The backlog handoff costs as much as the implementation.** The Haiku backlog step takes 8–21 responses and 9–26% of input. Its context grows to 126–146k because it reads the 154 KB tracker, where single rows exceed 14,000 characters. In rfs62 and rfs78-79 it used more input than the implementing engineers. **Action:** have the coordinator's backlog packet supply the exact row text to change and the evidence to add, so the agent edits once without searching. Also keep tracker rows short and move dated evidence into the focused document. **Check:** backlog stage at most 8 responses and under 10% of workflow input.

4. **Coordinator self-checks repeat specialist work.** The root commonly ran 10–12 read/search commands and 6–10 git or Vercel checks per workflow, partly re-verifying what reviewers had already checked. **Action:** the root reads the reviewer's handoff and runs only the publication checks it owns (commit, push and remote verification, deployment state) in one batched command. **Check:** root tool calls per delivery workflow under 12.

5. **Packet input handling** (existing action 9): one coordinator rejection remained because `--next` does not save the derived reviewer input. This is small in tokens but costs a retry each time. **Action:** add a save option to `--next`.

## What is not a problem

- Model routing is working: Haiku handles backlog and analysis, Opus handles review and security, and specialists' averages stay around 60–100k.
- Output and reasoning tokens are small; shortening agents' written answers alone saves little.
- Independent review is not the main cost; reviewers took 4–25% and should stay.

## Limits

Seven workflows on one day, of different kinds, are too few to establish trends. Each estimated saving needs a measured comparison on later workflows. Ranges such as 26–35% are upper bounds that assume start-up overhead could be removed entirely.
