import React from 'react';
import { formatETB } from '../../utils/format.js';
import './LedgerTable.css';

/**
 * LedgerTable: Displays double-entry accounting entries for a payment record.
 * Demonstrates financial ledger invariants (Sum of Debits == Sum of Credits).
 */
export default function LedgerTable({ entries = [] }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="ledger-table__empty">
        <p>No ledger entries recorded for this transaction status.</p>
      </div>
    );
  }

  const totalDebits = entries.reduce((acc, curr) => acc + (curr.debitETB || 0), 0);
  const totalCredits = entries.reduce((acc, curr) => acc + (curr.creditETB || 0), 0);
  const isBalanced = totalDebits === totalCredits;

  return (
    <div className="ledger-table-wrap">
      <div className="ledger-table-header">
        <div>
          <h4 className="ledger-table-title">Double-Entry Audit Ledger</h4>
          <p className="ledger-table-desc">
            Immutable accounting record verifying split allocations and zero-discrepancy balancing.
          </p>
        </div>
        <div className={`ledger-table-balance-pill ${isBalanced ? 'ledger-table-balance-pill--balanced' : 'ledger-table-balance-pill--unbalanced'}`}>
          <span className="ledger-table-balance-dot" />
          <span>{isBalanced ? 'Balanced (Debits = Credits)' : 'Discrepancy Detected'}</span>
        </div>
      </div>

      <div className="ledger-table-container">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Account Type</th>
              <th>Description / Label</th>
              <th className="text-right">Debit (ETB)</th>
              <th className="text-right">Credit (ETB)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr key={idx}>
                <td>
                  <code className="ledger-account-code">{entry.accountType}</code>
                </td>
                <td className="ledger-account-label">{entry.label}</td>
                <td className="text-right mono">
                  {entry.debitETB > 0 ? (
                    <span className="ledger-debit">{formatETB(entry.debitETB)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="text-right mono">
                  {entry.creditETB > 0 ? (
                    <span className="ledger-credit">{formatETB(entry.creditETB)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="ledger-table__totals">
              <td colSpan={2}>
                <strong>Total Settlement Allocation</strong>
              </td>
              <td className="text-right mono font-semibold">
                {formatETB(totalDebits)}
              </td>
              <td className="text-right mono font-semibold">
                {formatETB(totalCredits)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
