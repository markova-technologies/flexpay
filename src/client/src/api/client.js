/**
 * FlexPay API Client
 * ==================
 * Single authoritative client consumed by all React components.
 * Automatically attaches Authorization Bearer token from localStorage.
 */

const TOKEN_KEY = 'flexpay_auth_token';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function _fetch(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {}

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw json.error ?? { code: 'HTTP_ERROR', message: `HTTP ${res.status}` };
  }
  return res.json();
}

export const api = {
  // Authentication
  login:            (body)          => _fetch('POST', '/auth/login', body),
  logout:           ()              => _fetch('POST', '/auth/logout'),
  getMe:            ()              => _fetch('GET', '/auth/me'),
  getDemoUsers:     ()              => _fetch('GET', '/auth/demo-users'),

  // Employee
  getEmployee:      (id)            => _fetch('GET', `/employees/${id}`),
  getBenefitAccount:(id)            => _fetch('GET', `/employees/${id}/benefit-account`),
  getBenefitWallets:(id)            => _fetch('GET', `/employees/${id}/benefit-wallets`),

  // Employer Portal
  getEmployerOrg:       (orgId)     => _fetch('GET', `/employer/org${orgId ? `?orgId=${orgId}` : ''}`),
  getEmployerPolicies:  (orgId)     => _fetch('GET', `/employer/policies${orgId ? `?orgId=${orgId}` : ''}`),
  updateEmployerPolicy: (id, body)  => _fetch('PUT', `/employer/policies/${id}`, body),
  getEmployerEmployees: (orgId)     => _fetch('GET', `/employer/employees${orgId ? `?orgId=${orgId}` : ''}`),
  getEmployerAnalytics: (orgId)     => _fetch('GET', `/employer/analytics${orgId ? `?orgId=${orgId}` : ''}`),

  // Merchants & POS
  getMerchants:             ()              => _fetch('GET', '/merchants'),
  getMerchant:              (id)            => _fetch('GET', `/merchants/${id}`),
  getMerchantTransactions:  (merchantId)    => _fetch('GET', `/merchants/${merchantId}/transactions`),
  verifyCustomer:           (body)          => _fetch('POST', '/merchants/terminal/verify-customer', body),

  // Checkout & STK Push
  checkout:         (body)          => _fetch('POST', '/checkout', body),
  authorize:        (orderId, body) => _fetch('POST', `/checkout/${orderId}/authorize`, body),
  getPaymentStatus: (paymentId)     => _fetch('GET', `/payments/${paymentId}/status`),

  // Transactions & Ledger
  getTransactions:      (params)    => _fetch('GET', `/transactions?${new URLSearchParams(params || {})}`),
  getTransactionDetail: (id)        => _fetch('GET', `/transactions/${id}`),
  requestRefund:        (id, body)  => _fetch('POST', `/transactions/${id}/refund`, body),

  // Operations & Reconciliation
  getOpsSummary:    ()              => _fetch('GET', '/ops/summary'),
  reconcile:        ()              => _fetch('POST', '/ops/reconcile'),
};
