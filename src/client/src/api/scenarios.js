/**
 * Demo scenario selector — a module-level singleton.
 * The DemoPanel component reads and writes DEMO_SCENARIO.current.
 * The mock adapter reads it to decide which code path to execute.
 */
export const DEMO_SCENARIO = {
  current: 'SUCCESS',
  // Valid values:
  // 'SUCCESS'             → M-PESA authorized, ResultCode 0
  // 'USER_CANCELLED'      → Customer cancels USSD prompt, ResultCode 1032
  // 'TIMEOUT'             → 60s timeout, ResultCode 1037
  // 'INSUFFICIENT_BENEFIT'→ Benefit balance too low
  // 'INELIGIBLE_MERCHANT' → Merchant category blocked
};

// Convenience references used across the mock adapter (not exported separately)
export const DEMO_EMPLOYEES = ['emp-001', 'emp-002'];
export const DEMO_MERCHANTS = ['mer-001', 'mer-002', 'mer-003'];
