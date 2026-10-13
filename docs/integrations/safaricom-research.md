# Safaricom Ethiopia M-PESA Technical Integration Research

**Date:** 2026-10-13  
**Auditor:** Agent 1 (Research & Tooling Engineer, Team Nova)  
**Target Systems:** Safaricom Ethiopia Developer Portal & Bunaye Cafe Educational Reference  
**Documentation Link:** [https://developer.safaricom.et/documentation](https://developer.safaricom.et/documentation)  
**Educational Reference:** [https://github.com/yenettacode-dev/Bunaye-Cafe](https://github.com/yenettacode-dev/Bunaye-Cafe)

---

## 1. Scope, Purpose, and Regulatory Guardrails

FlexPay is a benefits-first purchasing and payment orchestration platform for Ethiopia.
- **Core Demonstration Target:**
  - Total purchase: **ETB 2,000** at an eligible merchant.
  - Employer-funded benefit covers: **ETB 1,500** (recorded via internal benefits ledger).
  - Explicitly authorized employee salary-linked balance covers: **ETB 500**.
  - FlexPay tracks transaction status, multi-ledger allocation, idempotency, webhook processing, and reversal/refund flows.
- **Regulatory & Technical Disclaimer:**  
  FlexPay does not assume automatic banking licenses, Safaricom operator partnerships, or unregulated consumer credit. All integrations documented below represent technical API capabilities verified from public documentation and verified educational implementations in Ethiopia.

---

## 2. Research Classification Taxonomy

Findings are categorized under three strict standards:
- **[OFFICIALLY DOCUMENTED]**: Sourced directly from Safaricom Ethiopia's developer portal (`developer.safaricom.et`).
- **[EDUCATIONAL REFERENCE]**: Verified from the active source code of Yenetta Code's `Bunaye-Cafe` repository.
- **[NOT YET VERIFIED]**: Unconfirmed assumptions requiring live sandbox credentials or Safaricom developer operations support.

---

## 3. Environments & Base URLs

| Environment | Base URL | Verification Source |
|---|---|---|
| **Sandbox Gateway** | `https://apisandbox.safaricom.et` | [OFFICIALLY DOCUMENTED] |
| **Production Gateway** | `https://api.safaricom.et` | [OFFICIALLY DOCUMENTED] |

---

## 4. Authentication (OAuth 2.0)

- **Status:** [OFFICIALLY DOCUMENTED] & [EDUCATIONAL REFERENCE]
- **Endpoint:** `GET https://apisandbox.safaricom.et/v1/token/generate?grant_type=client_credentials` (Sandbox)  
  `GET https://api.safaricom.et/v1/token/generate?grant_type=client_credentials` (Production)
- **HTTP Method:** `GET`
- **Request Headers:**
  - `Authorization: Basic <Base64(ConsumerKey:ConsumerSecret)>`
  - `Accept: application/json`
- **Response Format:**
  ```json
  {
    "access_token": "Ag876xYz...",
    "expires_in": "3599"
  }
  ```
- **Lifecycle Invariant:**
  - Tokens expire after 3,599 seconds (~1 hour).
  - The backend token manager must cache active tokens with a 60-second safety margin to prevent redundant round-trips while avoiding mid-flight expiry.

---

## 5. Merchant-Initiated Payment (USSD Push / STK Push)

### 5.1 Endpoint & Authentication
- **Status:** [OFFICIALLY DOCUMENTED] & [EDUCATIONAL REFERENCE]
- **Endpoint:** `POST /mpesa/stkpush/v3/processrequest`
- **Header:** `Authorization: Bearer <access_token>`

### 5.2 Password Generation Algorithm (Ethiopia Specific)
A critical discrepancy between Safaricom Kenya (Daraja 1.0/2.0) and Safaricom Ethiopia was verified:
- **Kenya Daraja:** `Base64(ShortCode + PassKey + Timestamp)`
- **Ethiopia M-PESA [EDUCATIONAL REFERENCE - Bunaye Cafe]:**
  ```javascript
  const concatenatedString = shortCode + passKey + timestamp;
  const sha256Hex = crypto.createHash("sha256").update(concatenatedString).digest("hex");
  const password = Buffer.from(sha256Hex).toString("base64");
  ```
  *Note:* Timestamp format is strict `YYYYMMDDHHmmss` (e.g., `20261013134500`).

### 5.3 Request Payload
```json
{
  "MerchantRequestID": "FlexPay-4f9e2b10-6c9a-4c91-91a1-30ef1d234567",
  "BusinessShortCode": "2005",
  "Password": "<Base64_SHA256_Hash>",
  "Timestamp": "20261013134500",
  "TransactionType": "CustomerPayBillOnline",
  "Amount": 500,
  "PartyA": "2517XXXXXXXX",
  "PartyB": "2005",
  "PhoneNumber": "2517XXXXXXXX",
  "CallBackURL": "https://api.flexpay.et/webhooks/mpesa/stk-callback",
  "AccountReference": "FP-ORDER-1001",
  "TransactionDesc": "FlexPay Benefit Co-Pay",
  "ReferenceData": [
    {
      "Key": "ThirdPartyReference",
      "Value": "FP-REF-1001"
    }
  ]
}
```

### 5.4 Asynchronous Webhook Callback Payload
Upon customer completion (entering PIN) or cancellation on the USSD prompt, Safaricom sends a `POST` request to `CallBackURL`:
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "FlexPay-4f9e2b10-6c9a-4c91-91a1-30ef1d234567",
      "CheckoutRequestID": "ws_CO_13102026134512345678",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 500 },
          { "Name": "MpesaReceiptNumber", "Value": "SD1234ABCD" },
          { "Name": "Balance" },
          { "Name": "TransactionDate", "Value": 20261013134520 },
          { "Name": "PhoneNumber", "Value": 2517XXXXXXXX }
        ]
      }
    }
  }
}
```
*Common Result Codes:*
- `0`: Success.
- `1032`: Cancelled by user.
- `1037`: Timeout (user did not respond to USSD prompt).
- `2001`: Invalid initiator / credential error.

---

## 6. Transaction Status Query

- **Status:** [OFFICIALLY DOCUMENTED] & [EDUCATIONAL REFERENCE]
- **Endpoint:** `POST /mpesa/transactionstatus/v1/query`
- **Method:** `POST`
- **Required Fields:**
  - `Initiator`: Initiator username assigned to the shortcode (e.g. `YellowBusinessInit`).
  - `SecurityCredential`: Asymmetric encrypted initiator password.
  - `CommandID`: `"TransactionStatusQuery"`
  - `TransactionID`: Safaricom M-PESA receipt number (e.g. `SD1234ABCD`).
  - `PartyA`: Organization shortcode (`2005`).
  - `IdentifierType`: `"4"` (Organization Shortcode).
  - `ResultURL`: Webhook URL for asynchronous confirmation.
  - `QueueTimeOutURL`: Webhook URL if the request times out in Safaricom's internal queue.
  - `Remarks` / `Occasion`: Audit strings.
- **Payload Caveats [EDUCATIONAL REFERENCE]:**  
  In Bunaye Cafe's verified code, field `OriginalConcersationID` is passed with a minor typographic spelling as shown in Safaricom Ethiopia templates (`OriginalConcersationID`). This must be supported defensively in our adapter.

---

## 7. Transaction Reversal & Refunds

- **Status:** [OFFICIALLY DOCUMENTED] & [EDUCATIONAL REFERENCE]
- **Endpoint:** `POST /mpesa/reversal/v2/request`
- **Method:** `POST`
- **Required Fields:**
  - `Initiator`: Initiator identifier.
  - `SecurityCredential`: Encrypted credentials using Safaricom's X.509 public key.
  - `CommandID`: `"TransactionReversal"`
  - `TransactionID`: Original M-PESA transaction receipt to be reversed.
  - `Amount`: Numerical string representing the refund amount.
  - `ReceiverParty`: Customer phone number (`2517XXXXXXXX`).
  - `RecieverIdentifierType`: `"11"` (MSISDN).
  - `ResultURL` & `QueueTimeOutURL`: HTTPS webhook endpoints.

---

## 8. Business-to-Customer (B2C) Payouts

- **Status:** [OFFICIALLY DOCUMENTED] & [EDUCATIONAL REFERENCE]
- **Endpoint:** `POST /mpesa/b2c/v2/paymentrequest`
- **CommandID:** `"BusinessPayment"`
- **Relevance to FlexPay:**  
  FlexPay may utilize B2C disbursements when issuing direct refunds to employee M-PESA wallets or merchant daily settlements.

---

## 9. FlexPay Core Demonstration Mapping

In FlexPay's primary ETB 2,000 demonstration:
1. **Purchase Total:** ETB 2,000.
2. **Employer Benefit Allocation (ETB 1,500):**  
   - Deducted entirely within the FlexPay platform ledger against the employer's pre-funded corporate benefit balance.
   - **No external M-PESA call required** for this slice.
3. **Employee Salary-Linked Co-Pay (ETB 500):**  
   - Triggered via `POST /mpesa/stkpush/v3/processrequest`.
   - Prompt sent to employee's mobile device for ETB 500 authorization.
   - Transaction status remains `PENDING_PAYMENT` until webhook arrives or query polls `ResultCode: 0`.
4. **Failure & Reversal Demonstration:**  
   - If the merchant fails to fulfill the goods after ETB 500 is collected, FlexPay triggers `POST /mpesa/reversal/v2/request` for ETB 500 and restores ETB 1,500 to the employer benefit account.

---

## 10. Unverified Assumptions & Technical Risk Matrix

| Risk / Assumption | Verification Status | Mitigation / Strategy for FlexPay |
|---|---|---|
| **Public Key Certificate for SecurityCredential** | [NOT YET VERIFIED] | Safaricom Ethiopia encrypts initiator passwords using a `.cer` public certificate. In local dev/mock mode, provide a mock crypto adapter. |
| **Localhost Webhooks** | [OFFICIALLY DOCUMENTED requirement: Public HTTPS] | Safaricom servers cannot post to `http://localhost`. Local development requires tunneling (ngrok/Cloudflare Tunnel) or a webhook simulator. |
| **Password Hashing (SHA256 vs Plain Base64)** | [EDUCATIONAL REFERENCE confirmed SHA256] | Safaricom Ethiopia documentation should be cross-tested in sandbox with both methods to assert definitive gateway behavior. |
| **Idempotent Webhook Retries** | [NOT YET VERIFIED] | M-PESA may retry webhooks if responses do not return HTTP 200 within 5 seconds. FlexPay backend MUST enforce unique `MerchantRequestID` / `CheckoutRequestID` deduplication. |

---

## 11. Official Links

- Safaricom Ethiopia Developer Portal: [https://developer.safaricom.et/](https://developer.safaricom.et/)
- Safaricom Documentation: [https://developer.safaricom.et/documentation](https://developer.safaricom.et/documentation)
- Bunaye Cafe Reference: [https://github.com/yenettacode-dev/Bunaye-Cafe](https://github.com/yenettacode-dev/Bunaye-Cafe)
- Safaricom Node.js SDK on npm: `@safaricom-et/mpesa-node-js-sdk`
