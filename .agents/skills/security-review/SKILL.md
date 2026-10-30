---
name: security-review
description: Review RFS changes for authorization, data exposure, injection, and unsafe automation. Use when a feature changes sensitive data or action boundaries.
---

# Security review

Check authentication/JWT boundaries, least privilege, validation, injection, secrets and logs, PII exposure, and chatbot tool authorization where relevant. For automated writes, verify explicit user confirmation, auditability, and safe recovery. Report severity, evidence, and remediation; do not approve unsafe writes. Review only the task's risk surface rather than running a blanket audit for every small change.

Handoff in under 250 words: task ID, role, changed files reviewed, acceptance criteria checked, actual review evidence, outstanding risks, next role, and PM decision needed.
