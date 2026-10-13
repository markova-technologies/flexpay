# Team Nova Agent Ownership & Responsibility Matrix

**Date:** 2026-10-13  
**Project:** FlexPay (Benefits-First Purchasing & Payment Orchestration for Ethiopia)  
**Author:** Agent 1  

---

## 1. Team Nova Roster & Mission Overview

| Agent | Designation | Primary Mandate |
|---|---|---|
| **Agent 1** | **Research, Tooling & Reconnaissance** *(Completed)* | Codebase inspection, developer environment setup, Playwright tooling, Safaricom Ethiopia API research, design skills installation, shared contract definitions. |
| **Agent 2** | **Frontend UI & Presentation Specialist** | Craft high-polish checkout interface, benefit split visualization, live payment polling status, and merchant/admin demo controls according to `design-taste-frontend` and Emil Kowalski guidelines. |
| **Agent 3 (Opus)** | **Lead Implementation & Systems Engineer** | Build the core authoritative backend, double-entry financial ledger, benefit allocation policy engine, Safaricom M-PESA adapter (live sandbox + mock mode), and database schemas. |
| **Agent 4** | **QA, Verification & Reliability Engineer** | Implement and run automated Playwright E2E tests for the 8 core scenarios, verify idempotency, execute stress-testing, and produce the final delivery audit. |

---

## 2. Codebase Ownership & File Boundaries

```
d:\Projects\Markova Projects\Flex Pay\
├── .agents/skills/                   <-- Managed by Agent 1 (Installed: 9 skills)
├── docs/                             <-- Managed by Agent 1 & Agent 3
│   ├── design/
│   │   └── frontend-tooling.md
│   ├── engineering/
│   │   ├── agent-ownership.md
│   │   ├── architecture-proposal.md
│   │   ├── implementation-status.md
│   │   └── repository-audit.md
│   └── integrations/
│       └── safaricom-research.md
├── src/
│   ├── server/                       <-- Owned by Agent 3 (Opus)
│   │   ├── api/                      <-- REST route handlers
│   │   ├── domain/                   <-- Benefit allocation, policy guard
│   │   ├── ledger/                   <-- Double-entry accounting engine
│   │   ├── mpesa/                    <-- Safaricom OAuth, STK push, Reversals, Webhooks
│   │   └── storage/                  <-- SQLite schema & repository layer
│   └── client/                       <-- Owned by Agent 2 / Agent 3
│       ├── components/               <-- Checkout, SplitCard, MpesaModal, AuditLog
│       └── styles/                   <-- CSS tokens & theme
└── tests/                            <-- Owned by Agent 1 (Smoke test) & Agent 4 (Full E2E)
    ├── smoke.spec.js                 <-- Verified by Agent 1
    └── e2e/                          <-- 8 Demo scenario tests (Agent 4)
```

---

## 3. Strict Operating Invariants & Handoff Rules

1. **No Unilateral Architecture Drift:** Agent 3 and Agent 2 must adhere to the modular monolith architecture and domain contracts defined in `docs/engineering/architecture-proposal.md`.
2. **Backend Financial Authority:** The frontend must never be granted authority to compute or split monetary values.
3. **Dual Gateway Modes:** The Safaricom adapter created by Agent 3 must toggle cleanly between `SAFARICOM_ENV=sandbox` (actual Safaricom network) and `SAFARICOM_ENV=mock` (deterministic local simulator for CI/automated testing).
4. **Idempotency Guarantee:** Webhook endpoints must reject duplicate callbacks for the same `CheckoutRequestID` without double-crediting ledger accounts.
5. **No Secret Printing:** Agent logs, test output, and documentation must never contain real consumer secrets, private keys, or credentials.

---

## 4. Exact Next Task for Agent 3 (Opus)

Agent 3 should proceed directly to **Task 1 of Implementation**:
1. Review proposed interfaces in `docs/engineering/architecture-proposal.md`.
2. Implement the core SQLite database schema with foreign keys and WAL mode:
   - `merchants`, `employees`, `benefit_accounts`, `orders`, `payment_records`, `journal_entries`.
3. Implement the **Benefit Allocation Engine** (`calculateSplit(orderTotal, employeeId, merchantId)`).
4. Implement the **Double-Entry Ledger Engine** with atomic journal transactions.
5. Implement the **Safaricom M-PESA Adapter** supporting token caching, STK push, status query, and reversal (with mock simulation mode for testing).
