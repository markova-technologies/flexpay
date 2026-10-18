const PDFDocument = require('pdfkit');

/**
 * Generates a branded FlexPay PDF Statement for an Organization's Merchant transactions.
 * Returns a Promise<Buffer>.
 */
async function generateStatement({ merchant, summary, transactions, byEmployee }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(22).fillColor('#00c896').text('FlexPay', { continued: true });
    doc.fontSize(12).fillColor('#8b8b9a').text('  |  Merchant Credit Settlement Statement', { align: 'right' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#2a2a3a');
    doc.moveDown(1);

    // Merchant & Statement Info
    doc.fontSize(10).fillColor('#8b8b9a').text('Merchant Partner:', { continued: true });
    doc.fillColor('#f0f0f5').text(`  ${merchant.business_name || merchant.businessName || 'Merchant'}`);
    doc.fontSize(10).fillColor('#8b8b9a').text('Category:', { continued: true });
    doc.fillColor('#f0f0f5').text(`  ${merchant.category || 'RETAIL'}`);
    doc.fontSize(10).fillColor('#8b8b9a').text('M-PESA Payout Till / Phone:', { continued: true });
    doc.fillColor('#f0f0f5').text(`  ${merchant.mpesa_phone_number || merchant.mpesaPhoneNumber || 'N/A'}`);
    doc.fontSize(10).fillColor('#8b8b9a').text('Statement Date:', { continued: true });
    doc.fillColor('#f0f0f5').text(`  ${new Date().toLocaleDateString('en-ET')}`);
    doc.moveDown(1);

    // Summary Box
    doc.rect(40, doc.y, 515, 60).fill('#12121a').stroke('#2a2a3a');
    const boxY = doc.y + 15;
    doc.fillColor('#8b8b9a').fontSize(9).text('TOTAL CREDIT USED', 60, boxY);
    doc.fillColor('#00c896').fontSize(16).text(`ETB ${Number(summary.totalCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 60, boxY + 16);

    doc.fillColor('#8b8b9a').fontSize(9).text('EMPLOYEE COUNT', 250, boxY);
    doc.fillColor('#f0f0f5').fontSize(16).text(String(summary.employeeCount || 0), 250, boxY + 16);

    doc.fillColor('#8b8b9a').fontSize(9).text('TRANSACTIONS', 420, boxY);
    doc.fillColor('#f0f0f5').fontSize(16).text(String(summary.transactionCount || 0), 420, boxY + 16);

    doc.y = boxY + 60;
    doc.moveDown(1.5);

    // Employee Breakdown Header
    doc.fillColor('#00c896').fontSize(12).text('Spending Breakdown by Employee');
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#2a2a3a');
    doc.moveDown(0.5);

    doc.fontSize(8).fillColor('#8b8b9a');
    doc.text('FP-ID', 45, doc.y, { width: 120, continued: true });
    doc.text('Employee Name', 165, doc.y, { width: 160, continued: true });
    doc.text('Total Spent', 325, doc.y, { width: 100, align: 'right', continued: true });
    doc.text('Last Visit', 435, doc.y, { width: 100, align: 'right' });
    doc.moveDown(0.5);

    (byEmployee || []).slice(0, 15).forEach((emp) => {
      doc.fontSize(8).fillColor('#f0f0f5');
      doc.text(emp.fp_employee_id || emp.employee_id || 'N/A', 45, doc.y, { width: 120, continued: true });
      doc.text(emp.full_name || 'N/A', 165, doc.y, { width: 160, continued: true });
      doc.text(`ETB ${Number(emp.total_spent || 0).toFixed(2)}`, 325, doc.y, { width: 100, align: 'right', continued: true });
      doc.text(emp.last_visit ? new Date(emp.last_visit).toLocaleDateString() : 'N/A', 435, doc.y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    });

    doc.moveDown(1);

    // Recent Transactions Header
    doc.fillColor('#00c896').fontSize(12).text('Recent Transactions');
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#2a2a3a');
    doc.moveDown(0.5);

    doc.fontSize(8).fillColor('#8b8b9a');
    doc.text('Date', 45, doc.y, { width: 80, continued: true });
    doc.text('Reference', 125, doc.y, { width: 130, continued: true });
    doc.text('Employee', 255, doc.y, { width: 120, continued: true });
    doc.text('Credit Portion', 375, doc.y, { width: 80, align: 'right', continued: true });
    doc.text('Total', 465, doc.y, { width: 80, align: 'right' });
    doc.moveDown(0.5);

    (transactions || []).slice(0, 20).forEach((txn) => {
      doc.fontSize(8).fillColor('#f0f0f5');
      doc.text(new Date(txn.created_at).toLocaleDateString(), 45, doc.y, { width: 80, continued: true });
      doc.text(txn.fp_transaction_ref || txn.id.slice(0, 8), 125, doc.y, { width: 130, continued: true });
      doc.text(txn.employee_name_snapshot || 'N/A', 255, doc.y, { width: 120, continued: true });
      doc.text(`ETB ${Number(txn.credit_portion || 0).toFixed(2)}`, 375, doc.y, { width: 80, align: 'right', continued: true });
      doc.text(`ETB ${Number(txn.total_amount || 0).toFixed(2)}`, 465, doc.y, { width: 80, align: 'right' });
      doc.moveDown(0.3);
    });

    // Footer
    doc.moveDown(2);
    doc.fontSize(7).fillColor('#8b8b9a').text('FlexPay v3.0 — Earned Wage Access & Pre-Salary Credit Platform — Addis Ababa, Ethiopia', { align: 'center' });

    doc.end();
  });
}

module.exports = { generateStatement };
