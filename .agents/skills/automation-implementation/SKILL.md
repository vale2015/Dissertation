---
name: automation-implementation
description: Implement approved RFS triggers and workflow scripts with dry-run and recovery checks.
---

# Automation implementation

Read the fresh task packet and check existing jobs for the same trigger or output. Implement the approved trigger, schedule definition, or workflow script. Preserve the source of truth and existing approval gates. Define scoped inputs and outputs with clear handling for retries, duplicate events, partial failures, and interrupted runs.

Use dry runs, mocks, or synthetic inputs to verify representative events and safe recovery. Report what actually executed and any limits on verification. Live schedule activation, external publication, and production writes require their existing approvals.

Return a handoff of at most 200 words with the task ID, changed files, actual checks, gaps, and next reviewer. End the specialist turn before the coordinator starts review.
