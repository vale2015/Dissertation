# MoSCoW prioritization of architecture improvements

This is a **value-first** product-priority view of all 59 items in the canonical [improvement tracker](IMPROVEMENT_TRACKER.md), not a second backlog. It reflects the [PRD](PRD.md): a single-restaurant dissertation prototype focused on helping managers prepare services, reuse reports, and judge whether forecasts are accurate. Last reviewed: 2026-10-30.

**Must** = direct, high-value product outcomes or the minimum safeguards and tests required to deliver them safely. **Should** = meaningful usability, scalability, or operational benefit that can follow the next product increment. **Could** = lower-evidence optimization or structural work. **Won't for now** = explicitly deferred or outside current single-restaurant scope; reconsider if the user or product direction changes.

Priority is independent of delivery state. A Must can already be **Done**, and a Could can be **Open**. The [tracker](IMPROVEMENT_TRACKER.md) alone records work state; Trello is not used. Original numbers remain stable identifiers, but this ranking is an explicit user-directed departure from numeric implementation order. These priorities are provisional because there are no measured traffic, error-budget, or delivery-deadline constraints yet.

## Recommended value-first sequence

1. **Prove forecast usefulness:** #20 is Done; finish #21 with genuine completed-service actuals and an authenticated accuracy journey before making performance claims from demo data.
2. **Close release verification on the redesigned manager experience:** #57 has the approved shared shell, charts, notifications, Settings, and left-docked assistant, but remains Partial until its remaining acceptance checks pass. #29's shared layout is implemented and still awaits signed-in role checks.
3. **Finish chatbot safety and evidence:** #54–55 are deployed pilots, not completed capabilities. Verify live model inference, protected manager/restricted-role journeys, report and staff actions, durable staff-write idempotency, privacy, and usage limits. Keep the separate #52 report-note pilot disabled until reviewed.
4. **Maintain database and security gates:** close the remaining #3–4 migration/access work and the relevant #7–8 safeguards as features change. Track applied migrations separately from code and deployment.
5. **Apply quality gates continuously:** use #35, #37, #39, #41, #43, and #56 as applicable to each release; a READY deployment is not proof of a successful user journey.
6. **Keep product documentation usable:** #58 establishes the sequential PM-led team; #59 consolidates current requirements in the PRD and maintains the canonical tracker. Prioritize subsequent Should items from measured bottlenecks and manager feedback.

The latest user-directed initiatives are **#57 (RFS UI/UX redesign), #58 (sequential agent team), and #59 (documentation consolidation)**. #21 remains a high-value forecasting outcome awaiting genuine completed-service evidence. The chatbot (#54–55) remains Partial; #52 remains Partial and disabled in production. Security and test work remains Must because a feature that risks customer data or cannot be verified is not ready for users.

## Must — user value and minimum safe-delivery gates (17)

| # | Improvement | Why Must |
|---|---|---|
| 1 | Make booking and demand updates atomic | Prevent inconsistent operational totals. Already Done. |
| 2 | Prevent concurrent demand recalculation conflicts | Prevent lost or conflicting aggregates. Already Done. |
| 3 | Introduce complete database migrations | Complete work already started so new features have reproducible schema changes. |
| 4 | Verify and restrict Supabase table access | Protect customer and staff data before adding more stored reports. |
| 7 | Strengthen browser security headers | Protect authenticated user sessions and downloads. |
| 8 | Add API request limits and validation | Keep booking and report inputs safe and predictable. |
| 20 | Create immutable forecast runs | Required to compare a prediction with the eventual actual without rewriting history. |
| 21 | Add prediction-versus-actual tracking | Show managers whether forecasts are useful and meet a stated PRD goal. |
| 25 | Remove network calls from critical report latency | Make reports dependable even when optional weather or event services lag. |
| 26 | Add a report history feature | Give managers the requested ability to retrieve and compare past reports. |
| 35 | Add real database integration tests | Verify booking correctness, access, and new persisted history with real database behavior. |
| 37 | Add end-to-end tests | Verify the manager's complete booking, forecast, and report journeys. |
| 39 | Repair dependency reproducibility | Ensure value-bearing changes can be built and tested from a clean environment. |
| 41 | Add continuous integration | Keep the essential tests running on each change. |
| 43 | Add deployment smoke tests | Confirm the new manager-facing flows work after release. |
| 56 | Remediate audited frontend dependency vulnerabilities | The patched branch has a clean audit; authenticated preview and production release checks remain before Done. |
| 57 | Implement the approved RFS UI/UX redesign | User-approved dashboard and assistant experience is the next visible product direction; its bell must show real, recipient-scoped notifications, while Reports stays view-only and Settings reuses existing capabilities. Deliver without fabricated data or broken permissions. |

## Should — meaningful next benefits (28)

| # | Improvement | Why Should |
|---|---|---|
| 6 | Standardize safe API errors | Improve recovery and support when a manager's request fails. |
| 9 | Add pagination to list endpoints | Keep report and booking history usable as records grow. |
| 10 | Push filtering and aggregation into PostgreSQL | Speed up manager views when measured data volume warrants it. |
| 11 | Add the necessary database indexes | Target the actual slow queries rather than guessing. |
| 12 | Consolidate dashboard requests | Make the daily planning view faster. |
| 13 | Add frontend query caching and deduplication | Reduce wait time and repeated loading. |
| 15 | Add timeouts and cancellation to the BFF | Avoid long hangs when backend calls fail. |
| 17 | Move training out of web requests | Keep interactive planning available during model training. |
| 18 | Store model files in durable object storage | Preserve usable forecasts across deployments and instances. |
| 23 | Replace instance-local provider caches | Improve weather/event availability without making it core. |
| 29 | Create a shared dashboard layout | Make navigation and authorization more consistent. |
| 32 | Add runtime response validation | Show safe failures when services disagree on data shape. |
| 33 | Standardize loading, error and empty states | Help users distinguish no data from broken data. |
| 34 | Improve accessibility | Make planning and reports usable by more users. |
| 36 | Add frontend component tests | Protect important forms and tables as features change. |
| 38 | Add API contract tests | Reduce cross-service regressions after the core journeys are covered. |
| 40 | Remove the multiple-lockfile ambiguity | Simplify clean builds once dependency reproducibility is secured. |
| 42 | Make deployment configuration reproducible | Reduce manual release mistakes. |
| 45 | Create a safe rollback strategy | Limit disruption if a release fails. |
| 46 | Add structured logging | Speed up diagnosis of user-visible problems. |
| 47 | Add centralized error monitoring | Detect failures before users repeatedly report them. |
| 48 | Add technical and business metrics | Measure report use, forecast quality, and actual bottlenecks. |
| 49 | Add health and readiness endpoints | Improve diagnosis of unavailable services. |
| 50 | Add provider circuit breakers | Keep optional external failures from spreading. |
| 54 | Add a restaurant manager chatbot for existing app actions | Medium priority by user direction; useful manager workflows, after the skeleton and with account-action safeguards. |
| 55 | Design and build the chatbot skeleton | First chatbot implementation milestone; shared entry point, authentication, accessibility, and disabled tool boundary before features. |
| 58 | Establish the PM-led sequential AI delivery team | Improve delivery quality and role clarity for future changes without slowing every small task; the first handoff must prove the workflow. |
| 59 | Audit and refresh project documentation | Give the PM and future specialists a reliable current architecture and navigation guide without losing historical design decisions. |

## Could — lower-evidence optimization and structure (12)

| # | Improvement | Why Could |
|---|---|---|
| 14 | Reduce authentication database amplification | Optimize after measuring session-query load. |
| 16 | Version the API | Useful before external clients or incompatible route changes. |
| 19 | Add a model registry | Valuable for a mature model lifecycle after durable artifacts exist. |
| 22 | Optimize prediction requests | Optimize only after latency measurements identify a bottleneck. |
| 24 | Fetch independent providers concurrently | Improve optional event discovery after core reliability work. |
| 27 | Make the tenancy decision explicit | The PRD already excludes multi-site use; formalize it if onboarding scope changes. |
| 30 | Break large frontend files into focused components | Improve maintainability without changing behavior. |
| 31 | Introduce TypeScript incrementally | Reduce type errors after API contracts are stabilized. |
| 44 | Align deployment regions | Revisit when measured cross-region latency warrants a move. |
| 51 | Automate manager briefings and alerts | Future scheduled, opt-in summaries after forecast-versus-actual exists; distinct from #57's approved event-driven in-app notification inbox. |
| 52 | Add AI-assisted report explanations | The disabled pilot is Partial, but the user now prefers a chatbot that performs existing manager workflows. Revisit as an optional chat capability after quality and cost review. |
| 53 | Pilot a low-code external integration | Could remove custom integration code when a specific external workflow is requested. |

## Won't for now — explicitly deferred or outside current scope (2)

| # | Improvement | Why not now / revisit trigger |
|---|---|---|
| 5 | Verify login throttling and account protection in production | The user declined further work on this item on 2026-10-23. Existing protections remain deployed; live `429`/`Retry-After` and recovery are unverified. Reopen if requested or if login issues appear. |
| 28 | Separate global identity from restaurant membership | Multi-restaurant administration is outside the current PRD. Revisit only if item 27 changes the tenancy decision. |

Item 5 is Deferred in the tracker; item 28 remains Open because its trigger is conditional rather than a user decision to stop work. No board is used.
