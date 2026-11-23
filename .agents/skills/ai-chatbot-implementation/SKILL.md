---
name: ai-chatbot-implementation
description: Implement approved RFS chatbot routing, tool contracts, grounding, and fallbacks.
---

# AI/chatbot implementation

Use the fresh task packet to define the affected intents, expected routes, and tool inputs and outputs. Implement routing, tool adapters, grounded responses, or user-facing fallback behavior within the approved scope. Preserve backend role checks, validation, and explicit confirmation for state changes. Keep unapproved personal data out of prompts, fixtures, and logs.

Check representative supported, ambiguous, and unsupported requests. Exercise unavailable services and denied actions with synthetic inputs or mocks. Distinguish live model checks from mocked results. Hand off domain mutations and provider approval to their owners, and leave independent evaluation to the designated reviewer.

Return a handoff of at most 200 words with the task ID, changed files, actual checks, gaps, and next reviewer. End the specialist turn before the coordinator starts review.
