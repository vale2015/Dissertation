# MoSCoW prioritization of architecture improvements

This is a **value-first** product-priority view of all 50 items in the canonical [improvement tracker](IMPROVEMENT_TRACKER.md), not a second backlog. It reflects the [PRD](PRD.md): a single-restaurant dissertation prototype focused on helping managers prepare services, reuse reports, and judge whether forecasts are accurate. Last reviewed: 2026-10-22.

**Must** = direct, high-value product outcomes or the minimum safeguards and tests required to deliver them safely. **Should** = meaningful usability, scalability, or operational benefit that can follow the next product increment. **Could** = lower-evidence optimization or structural work. **Won't for now** = outside current single-restaurant scope; reconsider if the product direction changes.

Priority is independent of delivery state. A Must can already be **Done**, and a Could can be **Open**. Trello's **READY / IN PROGRESS / DONE** lists describe work state, not MoSCoW priority. Original numbers remain stable identifiers, but this ranking is an explicit user-directed departure from numeric implementation order. These priorities are provisional because there are no measured traffic, error-budget, or delivery-deadline constraints yet.

## Recommended value-first sequence

1. **Finish commitments already in flight:** close the migration/access work in 3–4 and verify the release of 5. This protects existing user data and avoids building on uncertain deployment state.
2. **Deliver reusable reports:** tackle 25 and 26 together so managers can generate reports without optional provider delays and download past reports. Add relevant security, database, and browser tests before calling the feature Done.
3. **Prove forecast usefulness:** implement immutable runs in 20, then forecast-versus-actual tracking in 21. This enables the PRD's accuracy metrics rather than merely producing predictions.
4. **Apply release gates throughout, not as a late phase:** complete 7–8 and the relevant portions of 35, 37, 39, 41, and 43 before shipping the affected flows. The remaining Should items follow measured bottlenecks and user feedback.

The direct product-value leaders are **26 (past reports)** and **21 (forecast accuracy tracking)**. Items 25 and 20 are their respective dependencies. Security and test work remains Must because a feature that risks customer data or cannot be verified is not ready for users.

## Must — user value and minimum safe-delivery gates (16)

| # | Improvement | Why Must |
|---|---|---|
| 1 | Make booking and demand updates atomic | Prevent inconsistent operational totals. Already Done. |
| 2 | Prevent concurrent demand recalculation conflicts | Prevent lost or conflicting aggregates. Already Done. |
| 3 | Introduce complete database migrations | Complete work already started so new features have reproducible schema changes. |
| 4 | Verify and restrict Supabase table access | Protect customer and staff data before adding more stored reports. |
| 5 | Add login throttling and account protection | Finish release verification for the public sign-in safeguard. |
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

## Should — meaningful next benefits (24)

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

## Could — lower-evidence optimization and structure (9)

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

## Won't for now — outside the current product scope (1)

| # | Improvement | Why not now / revisit trigger |
|---|---|---|
| 28 | Separate global identity from restaurant membership | Multi-restaurant administration is outside the current PRD. Revisit only if item 27 changes the tenancy decision. |

This classification does **not** mark item 28 Deferred or Done in the tracker: it remains an Open, conditional architecture item. No Trello cards or lists are moved by this document.
