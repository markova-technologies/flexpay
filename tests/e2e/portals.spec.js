const { test, expect } = require('@playwright/test');

test.describe('FlexPay Multi-Portal Auth & Navigation', () => {
  test('Auth Hub displays all 3 portals and navigates correctly', async ({ page }) => {
    await page.goto('/auth');

    // 1. Verify 3 Portal Cards
    await expect(page.getByText('Choose Your FlexPay Portal')).toBeVisible();
    await expect(page.getByText('Organization / Employer')).toBeVisible();
    await expect(page.getByText('Merchant Partner')).toBeVisible();
    await expect(page.getByText('Employee Portal')).toBeVisible();

    // 2. Click Organization Portal
    await page.getByText('Organization Portal').click();
    await expect(page).toHaveURL(/.*\/auth\/organization/);
    await expect(page.getByText('Organization Sign In')).toBeVisible();

    // 3. Navigate back to Auth Hub
    await page.getByText('Back to Portals').click();
    await expect(page).toHaveURL(/.*\/auth/);

    // 4. Click Merchant Portal
    await page.getByText('Merchant Portal').click();
    await expect(page).toHaveURL(/.*\/auth\/merchant/);
    await expect(page.getByText('Merchant Sign In')).toBeVisible();

    // 5. Navigate back to Auth Hub
    await page.getByText('Back to Portals').click();
    await expect(page).toHaveURL(/.*\/auth/);

    // 6. Click Employee Portal
    await page.getByText('Employee Login').click();
    await expect(page).toHaveURL(/.*\/auth\/employee/);
    await expect(page.getByText('Employee Sign In')).toBeVisible();
    await expect(page.getByText('Employees cannot self-register')).toBeVisible();

    // 7. Verify Forgot Password Workflow modal
    const forgotBtn = page.getByText('Forgot / Lost Password?');
    await expect(forgotBtn).toBeVisible();
    await forgotBtn.click();
    await expect(page.getByText('Request Password Reset')).toBeVisible();
    await expect(page.getByText('Corporate Approval Workflow')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
  });
});
