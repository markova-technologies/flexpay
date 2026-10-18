import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Drawer } from '../../components/ui/Drawer';
import { SkeletonTable } from '../../components/ui/Skeleton/SkeletonTable';
import { useToast } from '../../contexts/ToastContext';
import { downloadReceipt } from '../../utils/download';
import './MerchantDetailDrawer.css';

export function MerchantDetailDrawer({ merchant, orgId, open, isOpen, onClose }) {
  const visible = open !== undefined ? open : isOpen;
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('transactions');

  useEffect(() => {
    if (!visible || !merchant) return;
    setLoading(true);
    const mId = merchant.id || merchant.merchant_id;
    api
      .get(`/org/merchants/${mId}`)
      .then((r) => setData(r.data))
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load merchant details');
      })
      .finally(() => setLoading(false));
  }, [visible, merchant]);

  const downloadStatement = async () => {
    if (!merchant) return;
    try {
      const mId = merchant.id || merchant.merchant_id;
      const res = await api.get(`/org/merchants/${mId}/statement`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flexpay-statement-${merchant.businessName || merchant.business_name || 'merchant'}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Merchant statement PDF downloaded successfully.');
    } catch (err) {
      toast.error('Failed to download merchant statement PDF.');
    }
  };

  const handleReceiptDownload = async (txnId, fpRef) => {
    try {
      await downloadReceipt(txnId, `flexpay-receipt-${fpRef || txnId}.pdf`);
      toast.success('Receipt downloaded successfully.');
    } catch (err) {
      toast.error('Failed to download transaction receipt.');
    }
  };

  const title = merchant?.businessName || merchant?.business_name || 'Merchant Details';

  return (
    <Drawer open={visible} onClose={onClose} title={title}>
      <div className="merchant-drawer">
        {loading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : data ? (
          <>
            <div className="merchant-drawer__summary">
              <div className="stat-card">
                <span>Total Credit</span>
                <strong>ETB {Number(data.summary?.totalCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="stat-card">
                <span>Employees</span>
                <strong>{data.summary?.employeeCount || 0}</strong>
              </div>
              <div className="stat-card">
                <span>Transactions</span>
                <strong>{data.summary?.transactionCount || 0}</strong>
              </div>
            </div>

            <div className="tab-bar">
              <button
                type="button"
                className={tab === 'transactions' ? 'active' : ''}
                onClick={() => setTab('transactions')}
              >
                Transactions
              </button>
              <button
                type="button"
                className={tab === 'employees' ? 'active' : ''}
                onClick={() => setTab('employees')}
              >
                By Employee
              </button>
            </div>

            {tab === 'transactions' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>FP-ID</th>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions && data.transactions.length > 0 ? (
                    data.transactions.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="mono">{t.employee_fp_id_snapshot || t.employee_id}</td>
                        <td>{t.employee_name_snapshot || 'Employee'}</td>
                        <td className="mono">ETB {Number(t.total_amount).toFixed(2)}</td>
                        <td>
                          {t.receipt_url ? (
                            <a
                              href={t.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn--sm btn--outline"
                              style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '4px', textDecoration: 'none', color: 'var(--fp-benefit)' }}
                            >
                              PDF
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReceiptDownload(t.id, t.fp_transaction_ref)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.8rem',
                                borderRadius: '4px',
                                background: 'transparent',
                                border: '1px solid var(--fp-border)',
                                color: 'var(--fp-benefit)',
                                cursor: 'pointer',
                              }}
                            >
                              PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--fp-text-muted)', padding: '24px' }}>
                        No transactions found for this merchant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'employees' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>FP-ID</th>
                    <th>Name</th>
                    <th>Total Spent</th>
                    <th>Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byEmployee && data.byEmployee.length > 0 ? (
                    data.byEmployee.map((e) => (
                      <tr key={e.employee_id}>
                        <td className="mono">{e.fp_employee_id}</td>
                        <td>{e.full_name}</td>
                        <td className="mono">ETB {Number(e.total_spent).toFixed(2)}</td>
                        <td>{e.last_visit ? new Date(e.last_visit).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--fp-text-muted)', padding: '24px' }}>
                        No employee transaction activity found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            <button
              type="button"
              className="btn--download"
              onClick={downloadStatement}
            >
              Download Statement PDF
            </button>
          </>
        ) : (
          <div style={{ color: 'var(--fp-text-muted)', textAlign: 'center', padding: '32px' }}>
            No data available.
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default MerchantDetailDrawer;
