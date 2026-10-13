# FlexPay System Architecture & Contract Proposal

**Date:** 2026-10-13  
**Author:** Agent 1 (Research & Tooling Engineer, Team Nova)  
**Target Reviewer:** Agent 3 (Opus / Lead Implementation Engineer)  
**Status:** PROPOSED CONTRACT FOR AGENT 3 REVIEW

---

## 1. Architectural Philosophy: The Modular Monolith

FlexPay is an institutional payment orchestration and benefits-first purchasing platform for Ethiopia. To ensure uncompromising reliability, zero operational friction, and fast delivery, we propose a **single-process Modular Monolith**:
- **Runtime:** Node.js (v24 LTS) with Express or Fastify.
- **Client:** React (Vite) single-page application communicating via type-safe REST/JSON.
- **Persistence:** SQLite with Write-Ahead Logging (`WAL` mode) and explicit foreign keys, or PostgreSQL. SQLite gives zero-external-dependency local testing while guaranteeing ACID transactions for financial ledger writes.
- **Rejection of Premature Complexity:** We explicitly reject microservices, distributed message brokers (Kafka/RabbitMQ), and multi-repo architectures for this MVP. All cross-boundary operations execute within local in-memory transactional boundaries.

---

## 2. Invariant 1: Absolute Backend Authority (Zero Browser Trust)

> **CORE LAW:** The browser client is an untrusted presentation surface. It is NEVER permitted to calculate, submit, or dictate financial amounts, benefit coverage splits, or transaction outcomes.

- The frontend submits intent: `{ employeeId, merchantId, orderItems, customerPhone }`.
- The **backend** validates merchant eligibility, retrieves live benefit quotas, enforces employer category rules, executes the split calculation, creates the database reservation, and initiates the payment gateway request.
- If the frontend attempts to pass `employerAmount: 1500` or `employeeCoPay: 500`, the backend ignores those fields and derives all values authoritatively from server-side domain entities.

```
┌──────────────────┐
│  Untrusted Client│ (Submits order intent: employeeId, merchantId, items)
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FLEXPAY AUTHORITATIVE CORE                      │
│                                                                        │
│  ┌───────────────────────┐         ┌────────────────────────────────┐  │
│  │ Merchant Policy Guard │ ──────► │ Benefit Allocation Engine      │  │
│  │ (Validates MCC / KYC) │         │ (Computes ETB 1,500 vs 500)    │  │
│  └───────────────────────┘         └───────────────┬────────────────┘  │
│                                                    │                   │
│                                                    ▼                   │
│  ┌───────────────────────┐         ┌────────────────────────────────┐  │
│  │ M-PESA Safaricom      │ ◄────── │ Double-Entry Ledger Engine     │  │
│  │ Gateway Adapter       │         │ (ACID Journal & Balances)      │  │
│  └───────────────────────┘         └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Breakdown & Interfaces

### 3.1 Domain Interfaces (TypeScript Contract)

```typescript
// --- 1. Order & Merchant Entities ---
export interface OrderItem {
  id: string;
  name: string;
  category: string; // e.g. "GROCERY", "MEAL", "ELECTRONICS"
  unitPriceETB: number;
  quantity: number;
}

export interface OrderIntent {
  employeeId: string;
  merchantId: string;
  customerPhone: string; // E.164 e.g. "251712345678"
  items: OrderItem[];
}

export interface Merchant {
  id: string;
  name: string;
  shortCode: string;
  status: 'ACTIVE' | 'SUSPENDED';
  allowedCategories: string[]; // e.g. ["GROCERY", "MEAL"]
  settlementAccount: string;
}

// --- 2. Benefit Allocation Entities ---
export interface BenefitAccount {
  employeeId: string;
  employerId: string;
  totalAllowanceETB: number;
  usedAllowanceETB: number;
  availableBalanceETB: number; // Invariant: total - used
  expiresAt: string;
}

export interface AllocationSplit {
  orderTotalETB: number;
  benefitCoveredETB: number;
  employeeCoPayETB: number;
  isEligible: boolean;
  rejectionReason?: string;
}

// --- 3. Double-Entry Ledger Entities ---
export type LedgerAccountType = 
  | 'ASSET_MPESA_CLEARING'
  | 'LIABILITY_EMPLOYER_BENEFIT'
  | 'LIABILITY_MERCHANT_PAYABLE'
  | 'REVENUE_PLATFORM_FEE';

export interface LedgerEntry {
  accountId: string;
  accountType: LedgerAccountType;
  debitETB: number;
  creditETB: number;
}

export interface JournalTransaction {
  id: string;
  transactionRef: string;
  timestamp: string;
  entries: LedgerEntry[]; // Invariant: SUM(debits) === SUM(credits)
}

// --- 4. Payment Gateway Orchestration ---
export type PaymentStatus = 
  | 'PENDING_AUTHORIZATION'
  | 'PENDING_MPESA_CALLBACK'
  | 'COMPLETED'
  | 'FAILED_TIMEOUT'
  | 'FAILED_REJECTED'
  | 'REVERSED';

export interface PaymentRecord {
  id: string;
  orderId: string;
  employeeId: string;
  merchantId: string;
  totalETB: number;
  benefitETB: number;
  mpesaETB: number;
  mpesaCheckoutRequestId?: string;
  mpesaReceiptNumber?: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Ledger Accounting Model (Double-Entry Verification)

Every financial movement requires balanced debits and credits:

### Standard Demonstration Flow (ETB 2,000 Purchase)
1. **At Checkout Completion (ETB 1,500 Benefit + ETB 500 M-PESA collected):**
   - `DEBIT:  LIABILITY_EMPLOYER_BENEFIT`   ETB 1,500 (Employer liability decreases)
   - `DEBIT:  ASSET_MPESA_CLEARING`         ETB   500 (FlexPay claims ETB 500 from Safaricom)
   - `CREDIT: LIABILITY_MERCHANT_PAYABLE`   ETB 2,000 (Merchant is owed ETB 2,000 net)
   - *Sum of Debits:* ETB 2,000 | *Sum of Credits:* ETB 2,000 (Balanced)

2. **At Merchant Settlement (Payout):**
   - `DEBIT:  LIABILITY_MERCHANT_PAYABLE`   ETB 2,000
   - `CREDIT: ASSET_MPESA_CLEARING`         ETB 2,000
   - *Sum of Debits:* ETB 2,000 | *Sum of Credits:* ETB 2,000 (Balanced)

3. **At Full Reversal / Cancellation:**
   - `DEBIT:  LIABILITY_MERCHANT_PAYABLE`   ETB 2,000
   - `CREDIT: LIABILITY_EMPLOYER_BENEFIT`   ETB 1,500 (Benefit balance restored)
   - `CREDIT: ASSET_MPESA_CLEARING`         ETB   500 (ETB 500 refunded via M-PESA)
   - *Sum of Debits:* ETB 2,000 | *Sum of Credits:* ETB 2,000 (Balanced)

---

## 5. The Eight Mandatory Demonstration Scenarios

| Scenario | Trigger / Condition | Expected System Behavior & State Transition |
|---|---|---|
| **1. Successful Split** | Order ETB 2,000, Benefit has ETB 1,500+, employee enters PIN. | Benefit debited ETB 1,500; USSD push triggers ETB 500; webhook returns `ResultCode: 0`; Order status transitions `COMPLETED`; Ledger balances verified. |
| **2. Insufficient Benefit** | Order ETB 2,000, Employee benefit has only ETB 1,000. | Split allocates max available (ETB 1,000) or rejects if employer policy forbids partial; prompt shows ETB 1,000 co-pay requirement; transparent user warning. |
| **3. Ineligible Merchant / Category** | Merchant MCC or product category outside employer benefits whitelist (e.g. tobacco/electronics). | Backend policy gate halts execution before ledger or M-PESA calls; returns `422 Unprocessable Entity` with explicit policy reason. |
| **4. Duplicate Callback** | Safaricom network retries webhook delivery with identical `CheckoutRequestID`. | Idempotency engine detects existing processed transaction; returns immediate `200 OK`; suppresses duplicate ledger postings. |
| **5. User Timeout** | Customer fails to enter M-PESA PIN within 60s timeout window. | Webhook receives `ResultCode: 1037` or backend query marks timeout; provisional benefit lock is released; order transitions to `FAILED_TIMEOUT`. |
| **6. Failed / Cancelled Payment** | Customer declines USSD push prompt on phone (`ResultCode: 1032`). | Transaction marked `FAILED_REJECTED`; benefit reservation released; clean error presented to user with retry option. |
| **7. Partial / Complete Refund** | Merchant cannot deliver goods; refund initiated. | FlexPay calls M-PESA Reversal API for ETB 500; re-credits ETB 1,500 to employee benefit ledger; order marked `REVERSED`. |
| **8. End-of-Day Reconciliation** | Admin triggers reconciliation audit. | System reconciles: `SUM(M-PESA callbacks) === M-PESA clearing balance`; `SUM(benefit debits) === Employer billable total`. Audit report generated. |

---

## 6. Proposed Invariants for Agent 3 (Opus) Review

1. **Transaction Isolation:** Benefit reservation and order creation must occur within a single database transaction.
2. **Idempotency Keys:** Every external call to Safaricom must generate and persist a deterministic UUID `MerchantRequestID`.
3. **Simulated vs. Live Gateway:** The M-PESA adapter must support a seamless mock mode (`SAFARICOM_ENV=mock`) to allow full automated Playwright testing without live network calls, while sharing 100% of the payload serialization logic with the live sandbox adapter.
4. **Audit Trail:** Every status change must record timestamps, raw webhook payloads, and previous states.
