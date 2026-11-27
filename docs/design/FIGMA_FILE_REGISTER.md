# RFS connected Figma UI workspace

Updated: 25 November 2026. The file is connected to this design workflow and is the central workspace for RFS UI design assets. Updated screen layouts and approval evidence are still being developed.

## Open the design

| Area | Figma link | Verified content |
| --- | --- | --- |
| File | [RFS Restaurant Forecasting System](https://www.figma.com/design/vPKrtyR0JhVRLpyThwLtzm/RFS---Restaurant-Forecasting-System) | Existing user-owned file; connected-session reads and edits succeeded. |
| Original designs | [01 Original research and UI](https://www.figma.com/design/vPKrtyR0JhVRLpyThwLtzm/RFS---Restaurant-Forecasting-System?node-id=0-1) | Page renamed; all 106 original top-level research and prototype items retained. |
| Current screens | [02 Current product UI](https://www.figma.com/design/vPKrtyR0JhVRLpyThwLtzm/RFS---Restaurant-Forecasting-System?node-id=206-413) | Page created; no new current-product screen frames assembled yet. |
| Shared UI assets | [03 UI foundations](https://www.figma.com/design/vPKrtyR0JhVRLpyThwLtzm/RFS---Restaurant-Forecasting-System?node-id=206-414) | Twelve shared paint styles, eight initial text styles plus navigation typography, reusable UI families and source assets. |

## Existing reusable assets

The [state ledger](FIGMA_SYNC_STATE.json) stores the authoritative known IDs. These are construction results, not a claim of completed visual verification.

| Asset | Current node |
| --- | --- |
| Button family | 207:435 |
| Field | 207:442 |
| KPI card | 207:447 |
| Screen heading | 207:451 |
| Navigation family | 208:462 |
| Table row | 207:461 |
| Chat message | 207:467 |
| Notice family | 207:470 |
| Date control | 207:480 |
| Sidebar family | 208:484 |
| Chart family | 208:749 |
| Brand | 208:478 |
| Assistant launcher | 208:481 |
| Source mascot | 213:611 |
| Notification icon | 213:614 |
| Account controls | 213:615 |
| Header action | 213:621 |
| Assistant panel | 213:623 |

The navigation family 207:454 was replaced by 208:462. Do not reuse the old ID. Twelve source-derived navigation icon components are recorded in the ledger. The mascot uses the existing `frontend/public/brand/rfs-ai-mascot-v2.png` asset; no complete-screen raster was used as an editable UI substitute.

## Design and code relationship

Figma holds layouts, local reusable assets, shared styles and prototypes. GitHub `main` is the current published access point for application code and documentation. A PM-approved frame guides the frontend implementer; a separate reviewer checks the result. File links and matching code paths must remain recorded beside implementation evidence.

The connection is verified for this session. The original connection was verified from the earlier Codex session. After the 27 November move to Claude Code (#72), Figma read access from Claude Code has not yet been demonstrated. The [inactive Claude Code MCP example](CLAUDE_FIGMA_MCP.example.json) is a reference, not an installed configuration. Figma and GitHub are not continuously synchronized automatically.

## Next work

1. Inspect the ledger and live file before any mutation. Reuse exact existing IDs; do not rebuild or replay creation scripts blindly.
2. Review the assistant launcher after its mascot was appended to a horizontal layout; check that text and asset fit the available width.
3. Check fill and wrapping behavior for field internals, KPI descriptions and notices, and resizing of chart marks and day labels. Component creation alone does not establish these checks passed.
4. Assemble current desktop/mobile screens, beginning with Dashboard and RFS AI closed/open. Use the actual six navigation destinations and keep staff account actions inside the assistant.
5. Add the remaining source-supported screen states and journeys; use explicitly labelled fictional examples rather than restaurant customer/staff records.
6. Verify native structure, fonts, responsive behavior and visual fidelity against the selected running build; record PM-approved frame links.
7. Authenticate Figma from Claude Code in VS Code (claude.ai connector or project `.mcp.json`) and verify a read of a specific frame.

The file is on Starter. The three-page structure fits its page limit. No paid upgrade or published cross-file library is claimed.

## Evidence and continuation

- [Agentic workflow presentation](../presentations/RFS_Agentic_Workflows.html) describes the connected design workflow.
- [Figma working agreement](FIGMA_UI_SOURCE_OF_TRUTH.md) contains setup options and official sources.
- [Current visual contract](DESIGN_SYSTEM.md) and [redesign CSS](../../frontend/src/app/rfs-redesign.css) are the source-led starting point.
- [Canonical backlog](../product/IMPROVEMENT_TRACKER.md) records task #71 as Partial.
- [Construction record](figma/01-foundations.js) is file-specific and superseded in parts by later edits; it is not a general deployment or synchronization script.

No further Figma mutation was performed during this documentation update. Current screen assembly, native visual QA and PM acceptance remain distinct from the verified connection and existing foundation assets.

