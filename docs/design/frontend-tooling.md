# Frontend Design Tooling & UI Integration Architecture

**Date:** 2026-10-13  
**Auditor:** Agent 1 (Research & Tooling Engineer, Team Nova)  
**Status:** Tooling Installed & Verified

---

## 1. Executive Summary

To ensure FlexPay's user experience meets institutional banking and consumer fintech standards without generic "AI slop" or templated interfaces, Agent 1 installed and verified two primary frontend capability suites:
1. **Emil Kowalski Design & Animation Skills:** 8 specialized skills installed into `.agents/skills/`.
2. **Taste Skill (`design-taste-frontend` v2):** Anti-slop frontend intelligence system installed into `.agents/skills/design-taste-frontend/`.
3. **Figma MCP Server Compatibility Assessment:** Completed against official documentation; client whitelist limitations documented below.

---

## 2. Figma MCP Remote Server Compatibility Assessment

### 2.1 Official Specification
- **Documentation:** `https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/`
- **Remote Server URL:** `https://mcp.figma.com/mcp`
- **Transport:** HTTP (Server-Sent Events / Streamable HTTP)
- **Authentication Model:** Browser-based OAuth 2.0 with strict redirect whitelisting.

### 2.2 Client Support Limitations
The official Figma developer documentation explicitly enforces:
> *"Note: Only clients listed in the Figma MCP Catalog like VS Code, Cursor, or Claude Code can connect to the Figma MCP Server. If you're a developer interested in connecting a new MCP client, you can join the waitlist."*

The only officially supported clients are:
- Claude Code
- Codex by OpenAI
- Cursor
- VS Code
- Xcode (27 beta)

### 2.3 Antigravity Environment Assessment
- **Connection Verdict:** **UNSUPPORTED FOR DIRECT REMOTE MCP OAUTH**
- **Rationale:** Antigravity IDE is not currently listed on Figma's approved client catalog (`figma.com/mcp-catalog`). Attempting an automated OAuth connection will fail at the redirect URI handshake.
- **Security & Integrity Policy:** As mandated by Agent 1's directive, we do not pretend the official connection succeeded, nor do we attempt insecure token scraping.

### 2.4 Documented Supported Alternatives
1. **Figma REST API via Personal Access Token (PAT):**  
   If Figma node inspection is required, scripts can query `https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}` using a standard user-provided Figma PAT stored safely in environment variables.
2. **VS Code / Cursor Sidecar Bridging:**  
   Developers running VS Code or Cursor on the same workspace machine can authenticate through the official Figma extension/plugin to extract design tokens or export code into the repository.
3. **Token & Design System Translation:**  
   Export CSS design variables (colors, typography, spacing, border radii) directly into the frontend styling layer.

---

## 3. Emil Kowalski Skills Suite

The following 8 skills were installed at the project level (`.agents/skills/`) and verified for agent discovery:

| Skill Name | Purpose & Trigger Condition |
|---|---|
| `emil-design-eng` | Core design engineering philosophy: component polish, micro-interactions, layout precision. |
| `animate` | From-scratch animation builder: curve selection, duration, exit transitions, physics. |
| `review-animations` | Strict audit of animation code against frame budgets and interaction feel. |
| `improve-animations` | Project-wide motion audit that generates prioritized implementation plans. |
| `find-animation-opportunities` | Identifies where subtle motion improves UX and rejects frivolous motion. |
| `animation-performance` | Keeps animations within the 60fps frame budget (composite-only properties, transforms, opacity). |
| `break-ui` | Stress-tests components against extreme data (long names, missing values, overflow). |
| `pick-ui-library` | Recommends vetted, focused libraries for complex UI widgets (toasts, OTP inputs, modals). |

---

## 4. Taste Skill (`design-taste-frontend` v2)

### 4.1 Architecture & Design Read Discipline
Taste Skill v2 enforces the **Anti-Slop Protocol**:
- **Design Read Requirement:** Before generating code, the agent must output a one-line design read:  
  *"Reading this as: [page kind] for [audience], with a [vibe] language, leaning toward [design system]."*
- **The Three Core Dials:**
  - `DESIGN_VARIANCE: 8` (1 = Perfect symmetry, 10 = Artsy chaos)
  - `MOTION_INTENSITY: 6` (1 = Static, 10 = Cinematic physics)
  - `VISUAL_DENSITY: 4` (1 = Art gallery, 10 = Cockpit/data-dense)
- **Preset for FlexPay (Fintech Checkout & Orchestration):**
  - `DESIGN_VARIANCE`: **5 - 6** (Restrained, high trust, crisp alignment)
  - `MOTION_INTENSITY`: **4 - 5** (Smooth state transitions, instant financial confirmation)
  - `VISUAL_DENSITY`: **6** (Clear breakdown of ETB 2,000 split, merchant details, audit trail)

### 4.2 Anti-Default Discipline
To maintain institutional credibility:
- **NO generic AI purple gradients.**
- **NO arbitrary dark-mesh backgrounds.**
- **NO generic glassmorphism on critical text.**
- **YES to high-contrast typography, crisp borders (1px border tokens), clear transaction status badges, and Ethiopian Birr (`ETB`) formatting.**

---

## 5. Implementation Recommendations for Agent 2 & Agent 3

1. **Frontend Stack:** Clean React (Vite) + Vanilla CSS or standard modern utilities.
2. **Component Architecture:**
   - `OrderSummary`: Displays ETB 2,000 total, merchant metadata, and eligibility checks.
   - `BenefitSplitCard`: Visual breakdown of ETB 1,500 employer coverage vs. ETB 500 employee co-pay.
   - `MpesaAuthorizer`: Phone number input (`2517XXXXXXXX`), USSD push trigger, live polling status indicator.
   - `ReconciliationConsole`: Audit view showing ledger credits/debits, transaction reference, and reversal triggers.
