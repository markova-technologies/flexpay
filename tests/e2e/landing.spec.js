const { test, expect } = require('@playwright/test');

test.describe('FlexPay Landing Page & Interactive SplitEngine', () => {
  test('Landing page renders hero, headline, and interactive split demo', async ({ page }) => {
    await page.goto('/');

    // 1. Verify Brand and Headline
    await expect(page.getByText('Employee Benefits,')).toBeVisible();
    await expect(page.getByText('Powered by M-PESA')).toBeVisible();

    // 2. Verify Interactive SplitEngine Widget
    await expect(page.getByText('Automated SplitEngine™')).toBeVisible();
    await expect(page.getByText('Purchase Order Total')).toBeVisible();
    await expect(page.getByText('Employer Benefit')).toBeVisible();
    await expect(page.getByText('M-PESA Co-Pay')).toBeVisible();

    // 3. Verify Workflow & Features
    await expect(page.getByText('How FlexPay Works in 3 Steps')).toBeVisible();
    await expect(page.getByText('1. Fund & Allocate')).toBeVisible();
    await expect(page.getByText('2. Instant Split Purchase')).toBeVisible();
    await expect(page.getByText('3. Automated Payroll Settlement')).toBeVisible();

    // 4. Verify CTA navigates to Auth Hub
    const getStartedBtn = page.getByRole('button', { name: 'Get Started' });
    await expect(getStartedBtn).toBeVisible();
    await getStartedBtn.click();
    await expect(page).toHaveURL(/.*\/auth/);
  });
});
