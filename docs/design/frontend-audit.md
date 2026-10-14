# FlexPay Frontend Design & Experience Audit

**Date:** 2026-10-14  
**Auditor:** Principal Product Designer & Senior Frontend Engineer (Team Nova)  
**Target:** FlexPay Point-of-Sale & Benefits Orchestration Interface  
**Baseline Artifacts Inspected:** `src/client/`, rendered browser session at `http://localhost:3100`, Playwright test runner.

---

## 1. Executive Summary

FlexPay's frontend baseline is functional, clean, and structurally sound. The core user journeys (Dashboard, POS Checkout, Transactions, Transaction Detail with Double-Entry Ledger, Employer Portal, and Ops Settlement) are all routed and connected to the backend API contract.

However, the visual craft is currently sitting at a functional prototype stage rather than an institutional, world-class fintech experience. It uses generic dark-mode container borders, a neon green accent that feels slightly uncalibrated for enterprise finance, basic monospace numbers that lack typographic elegance, and rigid layout transitions.

By applying **UI/UX Pro Max** fintech design patterns, **Taste Skill** anti-slop guidelines, and **Emil Kowalski's** micro-interaction principles, we will transform FlexPay into an authoritative, tactile, and visually compelling product.

---

## 2. Five Critical Design & Polish Opportunities

| Issue Area | Current State | Target State (Redesign) | Reference Framework |
|---|---|---|---|
| **1. Accent Palette & Contrast** | Primary accent is an uncalibrated bright neon green (`#00f076`) that feels gaming-adjacent. | Calibrated deep emerald (`#059669` / `#10B981`) paired with warm amber (`#F59E0B`) for salary co-pay and deep slate surfaces (`#080E1C`, `#0F172A`). | UI/UX Pro Max (Fintech Modern) |
| **2. Typographic Craft & Figures** | Currency numbers use standard monospace without tabular alignment or optical kerning, appearing slightly detached. | Tabular figure styling (`font-feature-settings: "tnum"`) with `Plus Jakarta Sans` / `Inter`, bold weights for currency, and proportional labels. | Emil Kowalski (Craft & Precision) |
| **3. Allocation Split Visualizer** | Static progress bar with plain text blocks (`75%` vs `25%`). | Animated, fluid proportional allocation component with tactile badges, tooltip/popover breakdown, and clear employer vs employee ownership indicators. | Master Hero Transaction (ETB 2,000 = 1,500 + 500) |
| **4. Motion & State Feedback** | Basic CSS transitions (`all 200ms ease`); instant state jumps on checkout submit. | Fluid layout transitions with `motion/react`, scale feedback on button presses (`active: scale(0.98)`), smooth dialog enter/exit easing curves (`cubic-bezier(0.23, 1, 0.32, 1)`). | Emil Kowalski (`emil-design-eng`, `animate`) |
| **5. Information Density & Polish** | Large empty card spaces on desktop; sidebar feels utilitarian. | Refined density hierarchy, subtle surface elevation layers (`surface-1`, `surface-2`), institutional header with employee avatar/org badge, and clear simulation mode status. | Taste Skill (Anti-Default Discipline) |

---

## 3. Working Foundations Preserved

- **API Contract:** Preserving all `/api` endpoints: `/employees/:id`, `/merchants`, `/checkout`, `/authorize`, `/payments/:id/status`, `/transactions`, `/ops/summary`, `/ops/reconcile`.
- **Double-Entry Ledger:** Preserving exact debit/credit presentation (`LIABILITY_EMPLOYER_BENEFIT`, `ASSET_MPESA_CLEARING`, `LIABILITY_MERCHANT_PAYABLE`).
- **Demo Scenarios:** Preserving scenario switcher (`SUCCESS`, `USER_CANCELLED`, `TIMEOUT`, `INSUFFICIENT_BENEFIT`, `INELIGIBLE_MERCHANT`).
- **E2E Playwright Suite:** All redesign changes will preserve test IDs and accessibility roles to ensure 100% test pass rate.
