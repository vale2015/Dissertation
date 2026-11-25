---
name: database-implementation
description: Implement approved RFS Supabase and PostgreSQL changes with local migration and policy checks.
---

# Database implementation

Read the scoped schema and migration history identified by the fresh task packet. Implement the approved schema, constraint, index, function, or row-level security change. Preserve existing data and caller compatibility where required. Coordinate application contract changes with the backend engineer and clarify access rules with the security engineer.

Use a disposable local database and synthetic records to check the migration from the relevant prior schema, representative existing rows, and affected roles. Record any locks or recovery constraints and report checks the local environment could not execute. Applying the migration to a live database requires separate authorization.

Return a handoff of at most 200 words with the task ID, changed files, actual checks, gaps, and next reviewer. End the specialist turn before the coordinator starts review.
