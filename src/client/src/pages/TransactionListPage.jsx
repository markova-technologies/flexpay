import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Receipt, Funnel } from '@phosphor-icons/react';
import { api } from '../api/client.js';
import { formatETB, formatDate } from '../utils/format.js';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Button from '../components/ui/Button.jsx';
import './TransactionListPage.css';

const FILTER_TABS = [
  { id: 'ALL', label: 'All Transactions' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'REVERSED', label: 'Refunded / Reversed' },
  { id: 'FAILED', label: 'Failed' },
];

export default function TransactionListPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTxs() {
      try {
        setLoading(true);
        const res = await api.getTransactions();
        setTransactions(res.transactions || []);
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTxs();
  }, []);

  const filtered = transactions.filter((tx) => {
    // Status filter
    if (filter === 'COMPLETED' && tx.status !== 'COMPLETED') return false;
    if (filter === 'PENDING' && !tx.status.startsWith('PENDING')) return false;
    if (filter === 'REVERSED' && tx.status !== 'REVERSED' && tx.status !== 'REFUND_PENDING') return false;
    if (filter === 'FAILED' && !tx.status.startsWith('FAILED')) return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchMerchant = tx.merchantName?.toLowerCase().includes(q);
      const matchOrder = tx.orderId?.toLowerCase().includes(q);
      const matchId = tx.id?.toLowerCase().includes(q);
      if (!matchMerchant && !matchOrder && !matchId) return false;
    }
    return true;
  });

  return (
    <div className="fp-page-enter tx-list-page">
      <div className="tx-list-header">
        <div>
          <h1>Transaction History</h1>
          <p>Complete ledger of benefit allocations, employee co-pays, and settlement statuses.</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="tx-list-controls">
        <div className="tx-list-tabs" role="tablist">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={filter === tab.id}
              className={`tx-list-tab ${filter === tab.id ? 'tx-list-tab--active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tx-list-search-wrap">
          <MagnifyingGlass size={16} className="tx-list-search-icon" />
          <input
            type="text"
            className="tx-list-search-input"
            placeholder="Search merchant, order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="tx-list-table-card">
        {loading ? (
          <div className="tx-list-loading">
            <div className="fp-skeleton" style={{ height: '48px', marginBottom: '8px' }} />
            <div className="fp-skeleton" style={{ height: '48px', marginBottom: '8px' }} />
            <div className="fp-skeleton" style={{ height: '48px', marginBottom: '8px' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="fp-empty">
            <Receipt className="fp-empty__icon" />
            <div className="fp-empty__title">No transactions found</div>
            <div className="fp-empty__body">
              {search ? 'Try clearing your search query.' : 'Transactions will appear here after checkout.'}
            </div>
          </div>
        ) : (
          <div className="tx-list-table-scroll">
            <table className="tx-list-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Merchant</th>
                  <th>Order ID</th>
                  <th className="text-right">Employer Benefit</th>
                  <th className="text-right">M-PESA Co-Pay</th>
                  <th className="text-right">Total Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    className="tx-list-table-row fp-pressable"
                    onClick={() => navigate(`/transactions/${tx.id}`)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/transactions/${tx.id}`)}
                  >
                    <td className="tx-col-date">{formatDate(tx.createdAt)}</td>
                    <td className="tx-col-merchant">
                      <strong>{tx.merchantName}</strong>
                      <span className="tx-col-category">{tx.merchantCategory}</span>
                    </td>
                    <td className="tx-col-order">
                      <code className="mono">{tx.orderId}</code>
                    </td>
                    <td className="text-right mono tx-col-benefit">
                      {formatETB(tx.benefitETB)}
                    </td>
                    <td className="text-right mono tx-col-mpesa">
                      {formatETB(tx.mpesaETB)}
                    </td>
                    <td className="text-right mono tx-col-total">
                      {formatETB(tx.totalETB)}
                    </td>
                    <td>
                      <StatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
