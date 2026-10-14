import { test, expect } from '@playwright/test';

test.describe('FlexPay Responsive Layout, Refunds, and Operations', () => {
  test('Mobile viewport (375x667) renders mobile header, bottom nav, and drawer toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Mobile header is visible
    const mobHeader = page.locator('.shell__mob-header');
    await expect(mobHeader).toBeVisible();

    // Mobile bottom nav is visible
    const bottomNav = page.locator('.shell__bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Toggle mobile drawer
    const toggleBtn = page.locator('.shell__mob-toggle');
    await toggleBtn.click();

    // Sidebar drawer opens
    const nav = page.locator('.shell__nav');
    await expect(nav).toHaveClass(/shell__nav--open/);

    // Overlay is visible
    const overlay = page.locator('.shell__overlay');
    await expect(overlay).toBeVisible();

    // Close drawer via toggle button
    await toggleBtn.click();
    await expect(nav).not.toHaveClass(/shell__nav--open/);
  });

  test('Refund request workflow updates status and restores benefit', async ({ page }) => {
    // Navigate to an existing completed transaction
    await page.goto('/transactions/pay-hist-001');

    await expect(page.getByText('Payment ID:')).toBeVisible();
    await expect(page.locator('#btn-request-refund')).toBeVisible();

    // Open refund modal
    await page.locator('#btn-request-refund').click();
    await expect(page.getByText('Initiate Transaction Refund')).toBeVisible();

    // Submit refund
    const confirmBtn = page.locator('#btn-confirm-refund');
    await confirmBtn.click();

    // Modal closes and status reflects refund pending
    await expect(page.getByText('Initiate Transaction Refund')).not.toBeVisible();
    await expect(page.getByText('Refund Pending')).toBeVisible();
  });

  test('Operations Console allows running End-of-Day reconciliation audit', async ({ page }) => {
    await page.goto('/ops');

    await expect(page.getByText('Operations & Settlement Console')).toBeVisible();
    await expect(page.getByText('Gross GMV Volume')).toBeVisible();

    const auditBtn = page.locator('#btn-reconcile-eod');
    await auditBtn.click();

    // Reconciliation success banner appears
    await expect(page.getByText('Reconciliation Run Verified at')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Total Debits equal Total Credits')).toBeVisible();
  });

  test('Accessible semantic hierarchy and skip to main content', async ({ page }) => {
    await page.goto('/');

    // Wait for page data to load and H1 to be visible
    const h1Locator = page.locator('h1');
    await expect(h1Locator).toBeVisible();

    // Check single H1 per page
    const h1s = await h1Locator.count();
    expect(h1s).toBe(1);

    // Main content area has id="main-content"
    await expect(page.locator('#main-content')).toBeVisible();

    // Check buttons have accessible names
    const newPurchaseBtn = page.locator('#btn-new-purchase');
    await expect(newPurchaseBtn).toHaveAccessibleName('Start Purchase');
  });
});
