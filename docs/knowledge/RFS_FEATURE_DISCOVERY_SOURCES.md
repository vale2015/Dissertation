# RFS feature discovery: sources and weekly refresh

> Current-state note (12 November 2026): this is the PM-supplied historical source and collection specification. Its 8 November baseline, nine-entry count, same-file update procedure, and weekly-task statements are not the live publication contract. The machine-readable [registry](sources.json) has 13 entry pages; the [runbook](AUTOMATION_RUNBOOK.md) defines the existing-account Issue → validated GitHub Actions → JSON/HTML workflow. A **partial manual scan** was published through [Issue #19](https://github.com/vale2015/Dissertation/issues/19); no scheduled publication has been verified. See [README.md](README.md) and tracker [#64](../product/IMPROVEMENT_TRACKER.md).

Owner: Valerio Gerardi. Created: 8 November 2026. Timezone: Europe/Dublin.

## Confirmed scope

Collect new features, improvements, release changes, and deprecations from public AI-platform and restaurant/hospitality-technology websites. Keep a current research knowledge base that the RFS development agent can consult. The user requested an automatic refresh every seven days.

This document establishes the sources and collection process. Feature eligibility, prioritisation, and implementation approval are separate decisions to define next. Findings enter as research candidates; existing project instructions continue to govern implementation and releases.

The original persistent research file was copied into this repository on 9 November 2026 and linked from `AGENTS.md`. The original file's identity and the current scheduler state have not yet been verified from this checkout.

## Confirmed weekly task

- Task: **Refresh RFS knowledge**; enabled on 8 November 2026.
- Schedule: every Sunday around 10:00, Europe/Dublin; first scheduled check 15 November 2026. The time is flexible because the user specified a seven-day cadence without a clock time.
- Destination: update this same persistent research file and retain its history, then provide a concise linked digest.
- Scheduled execution evidence: no completed scheduled run yet. Task creation and an initial file save are confirmed; future execution and saves must be reported from actual run results.
- GitHub synchronization and automatic consumption by the repository agent: not configured. Installation must either give the development agent access to this current file or synchronize it into the repository and link it from AGENTS.md.

## Verified source register

All listed entry pages were opened on 8 November 2026. These are primary publisher sources. Feature descriptions remain attributed to the publisher; their value for RFS is a separate hypothesis.

| ID | Publisher and entry pages | Information to collect | Baseline check |
| --- | --- | --- | --- |
| AI-001 | [OpenAI API changelog](https://developers.openai.com/api/docs/changelog) | Model/API/tool changes, agent capabilities, integration changes, and linked deprecations relevant to RFS. | 2026-11-08; page reached. |
| AI-002 | [Anthropic Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview) | Claude API, SDK, console, tool-use, context, reliability, and integration changes. | 2026-11-08; page reached. |
| HOSP-001 | [Nory blog](https://www.nory.ai/blog) and [restaurant AI assistants](https://www.nory.ai/agentic-ai) | Restaurant forecasting, staffing, operational assistants, reporting, and related product announcements. | 2026-11-08; both pages reached. |
| HOSP-002 | [Tenzo resources](https://www.gotenzo.com/resources/) and [developer updates](https://support.gotenzo.com/developers/) | Restaurant reporting, forecasting, contextual data, integrations, APIs, and AI-assistant connectivity. | 2026-11-08; both pages reached. |
| HOSP-003 | [SevenRooms product/company news](https://sevenrooms.com/press/) and [restaurant AI features](https://sevenrooms.com/platform/artificial-intelligence/) | Booking workflows, guest information, operational AI, feedback, and newly announced integrations. | 2026-11-08; both pages reached. |
| HOSP-004 | [OpenTable newsroom](https://www.opentable.com/blog/newsroom/) | Restaurant product/technology announcements, reservations, reporting, automation, and integrations. Follow relevant announcement links. | 2026-11-08; page reached. |

Filter discoveries for relevance to RFS bookings, demand forecasts, staffing, labour costs, management reports, and the restaurant assistant. Broader hospitality product news can be retained with a clear explanation of its possible relevance. Keep source selection expandable through confirmed official URLs.

The source register is curated, not an exhaustive scan of the web. Search public announcements for related developments and verify technical claims against the original publisher's documentation. Add a newly found publisher to a proposed-source section until its identity and relevance are checked.

## Weekly collection procedure

1. Read the current version of this same persistent file. Preserve the source register, previous findings, per-source checkpoints, and unresolved access failures.
2. Open the registered pages and relevant newly linked release announcements. Use a public feed only when the publisher exposes one and its exact endpoint has been verified. No feed URLs are assumed here.
3. Check for changes since each source's last successful scan. Allow an overlapping date window and deduplicate so a missed run or delayed indexing does not lose updates. Inspect revised documentation when a feature's status changes.
4. Record publication date separately from discovery/check time. If a page is undated, mark its date unknown; a newly observed page is not automatically a newly released feature.
5. Record the publisher's explicit availability status: announced, testing, preview/beta, generally available, deprecated, or unclear. Preserve prerequisites, region restrictions, and API/product distinctions that affect interpretation.
6. Summarise only the relevant change and link its original page. Record the possible RFS use as an inference. Product marketing claims require later evaluation before becoming implementation evidence.
7. Deduplicate by canonical source URL plus the release item/feature identity. Update an existing finding when its availability or details change. A single changelog URL can contain many distinct release items; do not deduplicate solely by that URL.
8. Update per-source last-successful-check timestamps only after a successful fetch/review. If a page fails, retain its older checkpoint and record the failure. Report partial coverage accurately.
9. Append the scan result below and save a new version of this same file. Provide a concise user update with linked findings and the refreshed file. Report a failed write explicitly; a chat summary alone does not count as refreshing the knowledge base.

Do not duplicate discoveries into the authoritative development backlog during this source-collection phase. Match known topics to existing tracker numbers when that can be verified, and retain new findings as research candidates pending the next feature-selection policy.

## Discovery record format

| Field | Required content |
| --- | --- |
| Finding ID | Stable identifier, such as DISC-0001. |
| Source | Registered source ID and publisher. |
| Original evidence | Exact announcement/documentation URL and title. |
| Dates | Published/updated date if stated; first seen; last checked, with timezone. |
| Capability/change | Brief attributed paraphrase of what the publisher describes. |
| Availability | Announced/testing/preview/beta/available/deprecated/unclear, as supported. |
| RFS connection | Potential user problem or component affected; explicitly label inference. |
| Existing work | Verified related tracker item, or not yet mapped. |
| Research status | New, updated, unchanged, superseded, or needs verification. |

Example of availability handling: OpenTable's [26 August 2026 product announcement](https://www.opentable.com/blog/press/page/summer-product-launch/) describes conversational reporting as being in testing. If captured as a finding, preserve that status and its publication date; do not label it a newly released November feature. This example illustrates source handling and is not an approved RFS feature.

## Tools and permissions

| Capability | What it requires |
| --- | --- |
| Run without a manual weekly prompt | An enabled cloud scheduler with a recurring task; the schedule is separate from AGENTS.md startup instructions. |
| Read the selected public pages | Web search and page retrieval. No provider API key or vendor MCP connection is needed merely to read public announcements. |
| Refresh this research file | Authenticated access to read and replace this persistent file, preserving its identity/version history. |
| Let a fresh development context consume the updated knowledge | Installed AGENTS.md instructions pointing to the current research destination, plus read access from that development environment. A one-time downloaded copy needs synchronization to stay current. |
| Keep the same knowledge directly in GitHub later | Repository-content read/write access and the project's normal commit/review policy, plus a scheduled runtime able to use that access. This repository sync is not configured by creating this research file. |
| Use a vendor's model or product in RFS later | Any API credentials, account entitlement, integration permissions, and evaluation required for that specific implementation. Research access does not establish implementation access. |

Trello, Vercel, and Supabase are not required for reading public announcements and updating this research file. Their connections become relevant when subsequent approved work needs task synchronization, release evidence, or database changes.

An MCP server is one way to expose tools; it is not itself the timer that starts a weekly run. A cloud task or a repository-hosted scheduled workflow supplies that trigger. The current weekly task is intended to refresh this research file; application code and deployment changes retain their existing approval and verification rules.

## Scan history and checkpoints

### 8 November 2026 — source baseline

- Six publishers and nine entry pages verified as reachable through public web retrieval.
- All per-source baseline checks are 2026-11-08. Future successful scans should store exact timestamps and coverage for each source.
- This baseline establishes the source list. No feature has been approved or implemented from it.
- Requested cadence: every seven days, Europe/Dublin. Weekly task creation confirmed on 8 November 2026 for Sunday mornings around 10:00, starting 15 November; the scheduler remains the authority for enabled status and future execution.
- No scheduled refresh has executed yet. Future runs must append their actual findings, coverage, and save status here.

## Source or access problems

None observed for the nine registered public entry pages during the initial baseline. Future failures must be recorded here without advancing the failed source's last-successful-check timestamp.

## Next design topic

Define how a research candidate becomes eligible for automatic feature selection, using the existing PRD, MoSCoW priorities, and authoritative improvement tracker. This document does not settle that next policy.
