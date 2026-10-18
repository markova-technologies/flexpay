const PDFDocument = require('pdfkit');

/**
 * Generates a branded FlexPay PDF receipt.
 * Returns a Buffer.
 */
async function generateReceipt(txn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A6', margin: 20 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(16).fillColor('#00c896').text('FlexPay', { align: 'center' });
    doc.fontSize(9).fillColor('#8b8b9a').text('Official Transaction Record', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(20, doc.y).lineTo(270, doc.y).stroke('#1a1a26');
    doc.moveDown(0.5);

    const row = (label, value, color = '#f0f0f5') => {
      doc.fontSize(8).fillColor('#8b8b9a').text(label, { continued: true });
      doc.fillColor(color).text(String(value || ''), { align: 'right' });
    };

    row('Reference', txn.fp_transaction_ref || txn.fpTransactionRef || 'N/A');
    row('Date', new Date(txn.created_at || Date.now()).toLocaleString('en-ET', { timeZone: 'Africa/Addis_Ababa' }));
    doc.moveDown(0.3);
    row('Employee', txn.employee_name_snapshot || txn.employeeName || 'N/A');
    row('FP-ID', txn.employee_fp_id_snapshot || txn.fpEmployeeId || 'N/A');
    row('Org', txn.org_name_snapshot || txn.organizationName || 'N/A');
    doc.moveDown(0.3);
    row('Merchant', txn.merchant_name_snapshot || txn.merchantName || 'N/A');
    row('Category', txn.category_snapshot || txn.category || 'N/A');
    row('M-PESA', txn.merchant_mpesa_snapshot || txn.merchantMpesaNumber || 'N/A');
    doc.moveDown(0.3);
    row('Credit Used', 'ETB ' + Number(txn.credit_portion || 0).toFixed(2), '#00c896');
    if (Number(txn.copay_portion || 0) > 0) {
      row('Co-Pay (M-PESA)', 'ETB ' + Number(txn.copay_portion || 0).toFixed(2), '#f59e0b');
      if (txn.mpesa_receipt) row('M-PESA Receipt', txn.mpesa_receipt);
    }
    row('Total', 'ETB ' + Number(txn.total_amount || 0).toFixed(2));
    doc.moveDown(0.3);
    row('Status', txn.status || 'COMPLETED', txn.status === 'COMPLETED' ? '#22c55e' : '#ef4444');

    doc.moveDown(0.5);
    doc.moveTo(20, doc.y).lineTo(270, doc.y).stroke('#1a1a26');
    doc.moveDown(0.3);
    doc.fontSize(7).fillColor('#8b8b9a').text('FlexPay — Benefits-First Payments for Ethiopia', { align: 'center' });

    doc.end();
  });
}

module.exports = { generateReceipt };
