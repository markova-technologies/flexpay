import api from '../services/api';

/**
 * Downloads a receipt PDF and triggers a browser file-save.
 * Zero browser alert/confirm dialogs — errors are thrown to the caller to show Toast notifications.
 */
export async function downloadReceipt(transactionId, filename = 'receipt.pdf') {
  const response = await api.get(`/transactions/${transactionId}/receipt`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadSettlementReceipt(lineId, filename = 'settlement-receipt.pdf') {
  const response = await api.get(`/merchant/settlements/${lineId}/receipt`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default { downloadReceipt, downloadSettlementReceipt };
