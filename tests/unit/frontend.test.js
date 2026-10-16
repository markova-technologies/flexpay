const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Phase 8: Frontend Implementation & Portal Assets', () => {
  const clientDir = path.resolve(__dirname, '../../src/client');
  const distDir = path.resolve(clientDir, 'dist');

  test('8.1 Production build artifacts exist and index.html is generated', () => {
    assert.ok(fs.existsSync(distDir), 'dist/ directory exists');
    const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('<!DOCTYPE html>'), 'Valid HTML structure');
    assert.ok(indexHtml.includes('/assets/index-'), 'Scripts and styles linked in dist');
  });

  test('8.2 tokens.css contains full dark fintech token system', () => {
    const tokensCss = fs.readFileSync(path.join(clientDir, 'src/styles/tokens.css'), 'utf8');
    assert.ok(tokensCss.includes('--fp-bg:'), 'Base background defined');
    assert.ok(tokensCss.includes('--fp-benefit:'), 'Benefit green accent defined');
    assert.ok(tokensCss.includes('--fp-salary:'), 'Salary amber accent defined');
    assert.ok(tokensCss.includes('--color-bg-base:'), 'Compatibility token defined');
    assert.ok(tokensCss.includes('--fp-font-mono:'), 'Mono font defined for tabular figures');
  });

  test('8.3 All required portal and feature files exist', () => {
    const requiredFiles = [
      'src/stores/authStore.js',
      'src/services/api.js',
      'src/features/landing/LandingPage.jsx',
      'src/features/auth/AuthHub.jsx',
      'src/features/auth/OrgAuthPage.jsx',
      'src/features/auth/MerchantAuthPage.jsx',
      'src/features/auth/EmployeeLoginPage.jsx',
      'src/features/employee/CreditRing.jsx',
      'src/features/employee/QRCodeCard.jsx',
      'src/features/employee/EmployeeDashboard.jsx',
      'src/features/organization/PasswordDisplay.jsx',
      'src/features/organization/AddEmployeeForm.jsx',
      'src/features/organization/PasswordResetRequests.jsx',
      'src/features/organization/PayrollPreview.jsx',
      'src/features/organization/OrgDashboard.jsx',
      'src/features/merchant/MerchantPOS.jsx',
      'src/components/layout/ProtectedRoute.jsx',
      'src/App.jsx',
    ];

    for (const f of requiredFiles) {
      const fullPath = path.join(clientDir, f);
      assert.ok(fs.existsSync(fullPath), `Required component ${f} exists`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.length > 50, `${f} is populated with code`);
    }
  });

  test('8.4 PasswordDisplay component enforces strict security warnings and timer', () => {
    const content = fs.readFileSync(
      path.join(clientDir, 'src/features/organization/PasswordDisplay.jsx'),
      'utf8'
    );
    assert.ok(content.includes('NEVER be displayed again'), 'Includes strict one-time notice');
    assert.ok(content.includes('secondsRemaining'), 'Includes countdown timer state');
    assert.ok(content.includes('handleCopy'), 'Includes copy to clipboard');
  });

  test('8.5 EmployeeLoginPage enforces login-only and routes forgot password to org admin', () => {
    const content = fs.readFileSync(
      path.join(clientDir, 'src/features/auth/EmployeeLoginPage.jsx'),
      'utf8'
    );
    assert.ok(content.includes('handleForgotPassword'), 'Includes forgot password handler');
    assert.ok(content.includes('/auth/employee/forgot-password'), 'Calls forgot password backend route');
    assert.ok(!content.includes('Register New Employee'), 'Does not allow employee self-registration');
  });
});
