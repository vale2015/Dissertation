---
name: ai-chatbot-evaluation
description: Evaluate RFS chatbot intent routing, tool safety, and unsupported claims. Use when chatbot behavior, model, or tools change.
---

# AI chatbot evaluation

The coordinator invokes the dedicated reviewer after the implementer ends, using a fresh task packet and the bounded implementation handoff. Work only on independent review. Return findings for rework without editing implementation.

Define the allowed intents and tool schemas for the changed chatbot scope. Test staffing, bookings, forecasts, reports, multi-intent, ambiguous, and adversarial prompts as relevant. Compare expected versus actual routing and record errors, unsupported claims, and fallback behavior. State-changing workflows must keep role checks, explicit confirmation, and backend validation. Evaluate a proposed model or framework experimentally against the current approach rather than assuming improvement.

Handoff in at most 200 words: task ID, role, changed files, acceptance criteria checked, commands and actual results, outstanding risks, next role, and PM decision needed. Do not claim a live-model test unless it actually ran.

Give the coordinator a concise `ticket-comment-handoff` draft after meaningful review. Route checked evidence to Backlog Handoff and defects to the coordinator for rework.
