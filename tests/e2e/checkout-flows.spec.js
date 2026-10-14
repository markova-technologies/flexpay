import { test, expect } from '@playwright/test';

test.describe('FlexPay Point-of-Sale Checkout Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/checkout');
    // Ensure default SUCCESS scenario is selected
    const successRadio = page.locator('input[name="scenario"][value="SUCCESS"]');
    if (await successRadio.isVisible()) {
      await successRadio.check();
    }
  });

  test('Core Demo: ETB 2,000 order co-funded by ETB 1,500 benefit and ETB 500 salary-linked M-PESA', async ({ page }) => {
    // 1. Verify merchant and basket items
    await expect(page.locator('#select-merchant')).toHaveValue('mer-001');
    await expect(page.getByText('Total Amount Due')).toBeVisible();
    await expect(page.getByText('ETB 2,000.00').first()).toBeVisible();

    // 2. Verify split preview
    await expect(page.getByText('Ethio Telecom')).toBeVisible();
    await expect(page.getByText('ETB 1,500.00').first()).toBeVisible();
    await expect(page.getByText('ETB 500.00').first()).toBeVisible();

    // 3. Verify salary-link consent checkbox is present and checked
    const consentCheck = page.locator('#checkbox-salary-consent');
    await expect(consentCheck).toBeChecked();

    // 4. Submit order
    const submitBtn = page.locator('#btn-submit-order');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. Verify in-flight USSD prompt screen
    await expect(page.getByText('Awaiting M-PESA USSD Confirmation')).toBeVisible();
    await expect(page.getByText('Status: PENDING_MPESA_CALLBACK')).toBeVisible();

    // 6. Polling resolves to COMPLETED (mock takes ~4s)
    await expect(page.getByText('Payment Confirmed & Settled!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('M-PESA Receipt No:')).toBeVisible();

    // 7. Navigate to audit ledger
    const ledgerBtn = page.locator('#view-ledger-btn');
    await expect(ledgerBtn).toBeVisible();
    await ledgerBtn.click();

    // 8. Verify audit ledger page
    await expect(page.getByText('Double-Entry Audit Ledger')).toBeVisible();
    await expect(page.getByText('Balanced (Debits = Credits)')).toBeVisible();
    await expect(page.getByText('LIABILITY_EMPLOYER_BENEFIT')).toBeVisible();
    await expect(page.getByText('ASSET_MPESA_CLEARING')).toBeVisible();
    await expect(page.getByText('LIABILITY_MERCHANT_PAYABLE')).toBeVisible();
  });

  test('Ineligible merchant policy blocks employer co-funding', async ({ page }) => {
    // Switch to ineligible merchant
    await page.selectOption('#select-merchant', 'mer-002'); // Electronics Paradise

    // Verify rejection warning is rendered
    await expect(page.getByText('Ineligible Allocation')).toBeVisible();
    await expect(page.getByText('Category ELECTRONICS is not permitted')).toBeVisible();

    // Verify submit button is not available
    await expect(page.locator('#btn-submit-order')).not.toBeVisible();
  });

  test('User cancelled M-PESA USSD prompt (ResultCode 1032)', async ({ page }) => {
    // Select USER_CANCELLED scenario
    await page.locator('input[name="scenario"][value="USER_CANCELLED"]').check();

    // Submit order
    await page.locator('#btn-submit-order').click();

    // Verify in-flight waiting state
    await expect(page.getByText('Awaiting M-PESA USSD Confirmation')).toBeVisible();

    // Wait for failure result
    await expect(page.getByText('Payment Failed or Timed Out')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('The subscriber rejected the USSD prompt')).toBeVisible();

    // Verify retry button is available
    await expect(page.locator('#btn-retry-payment')).toBeVisible();
  });

  test('Duplicate click prevention: button enters loading state and disables', async ({ page }) => {
    const submitBtn = page.locator('#btn-submit-order');
    await submitBtn.click();

    // Cannot click again because page moves to in-flight state immediately
    await expect(submitBtn).not.toBeVisible();
    await expect(page.getByText('Awaiting M-PESA USSD Confirmation')).toBeVisible();
  });
});
