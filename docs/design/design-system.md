# FlexPay Design System Specification

**Product:** FlexPay (Benefits-First Purchasing & Payment Orchestration for Ethiopia)  
**Organization:** Markova Technologies PLC  
**Author:** Principal Product Designer & Senior Frontend Engineer  
**Status:** Living Design System (Version 2.0 - Elevated Fintech)

---

## 1. Visual Identity & Art Direction

### Design Read
> **"Reading this as: Institutional Ethiopian fintech platform for enterprise employers, retail merchants, and salaried employees, with a high-trust, high-precision dark aesthetic, leaning toward calibrated emerald/amber allocations, crisp tabular figures, and Emil Kowalski micro-interactions."**

### Dial Configuration (Taste Skill v2)
- `DESIGN_VARIANCE: 5` (Structured, trustworthy, clean institutional alignment)
- `MOTION_INTENSITY: 5` (Subtle state morphs, proportional split animation, tactile button feedback)
- `VISUAL_DENSITY: 6` (Clear transaction breakdown, multi-ledger accounting, zero wasted space)

---

## 2. Color Tokens

### 2.1 Foundational Surfaces
- `--fp-bg`: `#060A14` (Deep obsidian midnight base)
- `--fp-surface-1`: `#0C1322` (Standard cards and content containers)
- `--fp-surface-2`: `#121C32` (Elevated modals, popovers, active selection)
- `--fp-surface-3`: `#182542` (Hover highlights, inputs, secondary controls)
- `--fp-border`: `rgba(255, 255, 255, 0.08)` (Subtle crisp division)
- `--fp-border-strong`: `rgba(255, 255, 255, 0.16)` (Interactive container outline)
- `--fp-border-focus`: `rgba(16, 185, 129, 0.5)` (Accessible focus ring)

### 2.2 Semantic Financial Allocation Accents
- **Employer-Funded Benefit (Emerald / Jade):**
  - `--fp-benefit`: `#10B981` (Crisp, high-contrast positive allocation)
  - `--fp-benefit-dim`: `rgba(16, 185, 129, 0.12)` (Tinted container background)
  - `--fp-benefit-border`: `rgba(16, 185, 129, 0.28)`
  - `--fp-benefit-glow`: `rgba(16, 185, 129, 0.20)`
- **Employee Salary-Linked Co-Pay (Warm Amber):**
  - `--fp-salary`: `#F59E0B` (Clear distinction for authorized employee funds)
  - `--fp-salary-dim`: `rgba(245, 158, 11, 0.12)`
  - `--fp-salary-border`: `rgba(245, 158, 11, 0.28)`
- **Platform / Network (Electric Cobalt):**
  - `--fp-primary`: `#3B82F6`
  - `--fp-primary-dim`: `rgba(59, 130, 246, 0.12)`

### 2.3 Status Hierarchy
- `COMPLETED`: `--fp-success` (`#10B981`)
- `PENDING_MPESA_CALLBACK` / `REFUND_PENDING`: `--fp-pending` (`#F59E0B`)
- `FAILED_REJECTED` / `FAILED_TIMEOUT`: `--fp-danger` (`#EF4444`)
- `REVERSED`: `--fp-reversed` (`#A855F7`)
- `SIMULATION_MODE`: `--fp-sim` (`#60A5FA`)

---

## 3. Typography & Figure Legibility

- **Primary Sans:** `'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif`
  - Weights: `400` (Regular), `500` (Medium), `600` (Semi-bold), `700` (Bold)
- **Financial Monospace & Tabular Figures:**
  - Tabular formatting: `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`
  - Identifier Code: `'JetBrains Mono', 'Fira Code', monospace` (Used for receipts, transaction IDs, shortcodes, and ledger accounts).

---

## 4. Spacing, Radii, and Elevation

- **Radius Scale:**
  - Small elements / badges: `6px` (`--fp-r-sm`)
  - Inputs / buttons: `10px` (`--fp-r-md`)
  - Cards & containers: `14px` (`--fp-r-lg`)
  - Modal sheets: `20px` (`--fp-r-xl`)
  - Pill badges: `9999px` (`--fp-r-pill`)
- **Shadow Tokens:**
  - Surface elevation: `0 4px 16px rgba(0, 0, 0, 0.45)`
  - Modal drop: `0 20px 48px rgba(0, 0, 0, 0.70), 0 0 0 1px rgba(255, 255, 255, 0.1)`

---

## 5. Motion & Micro-Interactions (Emil Kowalski Philosophy)

1. **Button Feedback:**
   - Active state press: `transform: scale(0.98)`
   - Hover transition: `150ms ease-out`
2. **Modal / Dialog Entrance:**
   - Enters from `opacity: 0, scale: 0.96` to `opacity: 1, scale: 1`
   - Curve: `cubic-bezier(0.23, 1, 0.32, 1)` (duration: `220ms`)
3. **Allocation Split Bar:**
   - Fluid width interpolation with smooth spring physics via `motion/react`.
   - Never delays user action or hides financial totals.
4. **Accessible Reduced Motion:**
   - Strictly respects `@media (prefers-reduced-motion: reduce)` by bypassing all non-essential transform animations while preserving instant state changes.
