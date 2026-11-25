# Figma as the RFS UI source of truth

Research checked: 25 November 2026. Status: Figma file connected and edited; workspace pages and UI foundations created. Current product screen assembly and the separate VS Code connection remain to be verified.

**VS Code / Codex setup, 25 November:** the PM selected Codex as the VS Code agent. Session permissions rejected writing the active `.codex/config.toml` configuration. An [inactive configuration example](CODEX_FIGMA_CONFIG.toml) is provided instead; it does not enable the connection by itself. In Codex's gear menu, open MCP servers, select Add server, choose Streamable HTTP, enter `figma` and `https://mcp.figma.com/mcp`, save, restart the extension, and select Authenticate when offered. Complete Figma sign-in locally. Project configuration requires project trust; do not bypass that prompt. No credentials or approval overrides belong in the example. The Codex CLI was not found on this session's PATH. The Figma VS Code extension is installed, but Codex authentication and design-file access remain unverified.

## Decision

Use Figma Design as the central home for approved UI layouts, reusable components, design variables and clickable prototypes. GitHub remains the source of the executable Next.js application. The connection is a design/development workflow; the running restaurant app does not need a Figma dependency, API token or backend integration.

Start by matching the implemented interface, then improve it through approved design changes. Preserve the left-docked RFS AI workflow and current navigation; do not recreate the older right-hand assistant or a retired Staff Management sidebar entry from historical images.

## Ownership

| Home | Owns |
| --- | --- |
| Figma Design | Approved screen layouts, components and variants, variables/styles, responsive frames, prototypes and design comments. |
| GitHub | React/Next.js components, CSS, assets used by the app, tests, implementation evidence and design-to-code references. |
| Project documentation | Product requirements, approval evidence, selected Figma file/frame links, implementation status and source mappings. |
| Trello | Task coordination and links to the relevant Figma frame and code change. |

Figma captures are dated design snapshots. A design edit is implemented through a reviewed code change; a code change is captured or reconciled back into Figma. Installing the connection does not establish continuous two-way synchronization.

## Connection options

### Recommended: Figma integration in Codex

1. Install Figma from the app's Plugins area and authorize the intended Figma account.
2. Confirm the integration is connected and the agent can identify the account.
3. Open a specific RFS Figma file link and verify read access.
4. Verify edit access separately before creating or changing a small test frame.

The Figma integration is now connected in this session. Reads and edits of the selected RFS file succeeded on 25 November. See the [file register](FIGMA_FILE_REGISTER.md) for the created pages and assets. This does not verify OAuth in a separate VS Code Codex process.

Figma's official remote MCP endpoint is https://mcp.figma.com/mcp. It is a developer-tool connection, separate from any optional Figma-to-GitHub app authorization.

For a Codex CLI installation, the documented command is:

~~~sh
codex mcp add figma --url https://mcp.figma.com/mcp
~~~

For VS Code's own MCP client, use its user or workspace MCP configuration:

~~~json
{
  "inputs": [],
  "servers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp",
      "type": "http"
    }
  }
}
~~~

Use the client that actually runs the agent. A VS Code MCP setting does not prove that a separate Codex CLI/app session is connected. These are reference snippets, not installed configuration.

### Optional later: Code Connect

Code Connect maps Figma components to their actual code counterparts. It is useful after reusable components exist in Figma; it is not required to store screens or begin using Figma with Codex.

The current documentation lists Dev or Full seats on Professional, Organization and Enterprise plans. Professional supports one active library and one active framework. The UI workflow requires published components.

In the Figma library, open Dev Mode, choose Library > Connect components to code, and map the published components. Optionally connect the GitHub account from Code Connect settings and select only vale2015/Dissertation when the authorization interface permits repository selection. File ownership or organization-admin permissions apply. Manual component-path mapping is also possible without the GitHub connection.

This provides component references and implementation context; it does not deploy the app or automatically rewrite the repository.

## File organization

For Starter, begin with one file named **RFS Product UI** and three pages:

| Page | Sections |
| --- | --- |
| Foundations and components | Colors, typography, spacing, surfaces, navigation, cards, charts, calendar, forms and chat components. |
| Product screens | Current desktop and mobile screens; loading, empty, error and permission-specific states; approved versus proposed sections. |
| Flows and archive | Clickable journeys, review notes and clearly dated superseded frames. |

Starter team files are limited to three pages. Keep older frames in an Archive section rather than adding unlimited pages.

If the chosen plan supports published libraries, split reusable assets into **RFS Design System**, with **RFS Product UI** consuming that library. Use a separate **RFS UX and Architecture** FigJam/file only if useful. Publishing shared component/style/variable libraries requires an eligible plan; Starter can use local components within its file. Confirm the current plan and seat before deciding to upgrade.

## Populate Figma from the current app

1. Choose the current app build or start the local frontend/backend as needed.
2. Use approved demo content for captures. Keep customer/staff records, credentials and private chat information out of the design file.
3. Capture a pilot: Dashboard with RFS AI closed and open, plus a narrow/mobile state.
4. Inspect the captured result against the running app, including fonts, clipping, selected dates and chart labels.
5. Consolidate repeated elements into native components with variants and Auto Layout; define semantic color and spacing variables.
6. Expand to Bookings, Create Booking, Reservation Forecast, Staffing Forecast, Reports, Settings, sign-in, notifications and in-chat staff actions. Include role-dependent and failure/empty states. Use route availability and permissions, not historical mockups, to select states.
7. Record the application commit, viewport and capture date on each approved screen section.

Figma's Code to canvas can capture live browser UI as editable layers. Its documentation distinguishes these flat-layer captures from library-connected components: a capture is not a complete design system. Refine and bind components/variables afterward. Its write-to-canvas capabilities can create native components, variables and layouts, subject to plan, permissions and supported-client availability. Test available tools after connection rather than promising them in advance.

## Existing project references

| Figma area | Starting evidence in this repository |
| --- | --- |
| Current visual contract | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) and [rfs-redesign.css](../../frontend/src/app/rfs-redesign.css). |
| Typography and global styles | [globals.css](../../frontend/src/app/globals.css); verify the actually rendered font rather than assuming a CSS family is loaded. |
| Navigation and calendar | [sidebar.jsx](../../frontend/src/components/layout/sidebar.jsx). |
| Notifications | [NotificationBell.jsx](../../frontend/src/components/layout/NotificationBell.jsx). |
| RFS AI | [ManagerChat.jsx](../../frontend/src/components/chatbot/ManagerChat.jsx), [ChatbotShell.jsx](../../frontend/src/components/chatbot/ChatbotShell.jsx), [StaffConversation.jsx](../../frontend/src/components/chatbot/StaffConversation.jsx). |
| Screens and reusable features | [dashboard routes](../../frontend/src/app/dashboard) and [components](../../frontend/src/components). |
| Technical/agent diagrams | [Diagram catalogue](../diagrams/README.md). SVG exports can be imported into Figma as editable vector layers; retain drawio sources and repository archives. SVG import may change markers/fonts, so visually verify it. |

These are candidate component mappings, not published Code Connect mappings.

## Working agreement for the agents

The UI/UX designer updates proposed Figma frames; the PM identifies the approved frame; the frontend engineer reads that exact frame and reuses existing components. The independent reviewer compares the actual implementation with the approved design, responsive behavior, accessibility and permissions. Backlog handoff records both the frame URL and code evidence.

For each screen/component, record: Figma file URL, node/frame link, code path, approved revision/date, implementation commit and verification status. Put the register beside this guide once real file IDs exist. Do not invent file keys or node IDs.

Use states such as Proposed, Approved for implementation, Implemented, Verified and Archived. Capturing a frame does not make it approved or prove the UI is implemented.

## Pilot acceptance

- Correct Figma account, file and read/edit permissions verified.
- One captured Dashboard screen and RFS AI state visually match the selected build.
- One reusable component and its states are editable and reusable in Figma.
- Agent can retrieve the selected frame's design context and identify the matching existing code.
- One small PM-approved design adjustment is implemented and independently checked.
- File/frame URLs and implementation evidence are recorded; unrelated runtime/deployment/data changes are absent.

The RFS file has been selected and its account reports Starter. Still needed: foundation visual checks, current product screen assembly, PM-approved screen revisions and separate VS Code authentication. No paid upgrade, library publication, runtime app change or automatic synchronization is claimed.

## Official sources

Checked 25 November 2026; features, eligibility and usage allowances can change.

- [Codex and Figma setup](https://help.figma.com/hc/en-us/articles/39888629089175-Codex-and-Figma-Set-up-the-MCP-server)
- [Remote MCP setup and VS Code configuration](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)
- [Code to canvas, capture workflow and limitations](https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/)
- [Native write-to-canvas features and eligibility](https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/)
- [Publish a reusable library](https://help.figma.com/hc/en-us/articles/360025508373-Publish-a-library)
- [Starter team-file page limits](https://help.figma.com/hc/en-us/articles/360038511293-Create-and-manage-pages)
- [Code Connect eligibility and purpose](https://developers.figma.com/docs/code-connect/)
- [Code Connect GitHub integration](https://developers.figma.com/docs/code-connect/code-connect-ui-github/)
- [Code Connect UI setup and manual mappings](https://developers.figma.com/docs/code-connect/code-connect-ui-setup/)
- [Current MCP rate limits](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/)
- [SVG import behavior](https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs)
