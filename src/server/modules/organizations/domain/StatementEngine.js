const PDFDocument = require('pdfkit');

/**
 * Generates a branded FlexPay PDF Statement for an Organization's Merchant transactions.
 * Enforces crisp high-contrast typography (zero whitish text on white paper).
 * Returns a Promise<Buffer>.
 */
async function generateStatement({ merchant, summary, transactions, byEmployee }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Top Brand Accent Bar
      doc.rect(0, 0, 595.28, 6).fill('#059669');

      // Header
      doc.y = 40;
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#0F172A').text('FlexPay', 40, doc.y, { continued: true });
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#059669').text(' •');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#64748B').text('Merchant Credit Settlement Statement', { align: 'right' });
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#CBD5E1');
      doc.moveDown(0.8);

      // Merchant & Statement Info Box
      const infoY = doc.y;
      doc.roundedRect(40, infoY, 515, 68, 6).fillAndStroke('#F8FAFC', '#E2E8F0');

      const col1X = 56;
      const col2X = 310;
      let rowY = infoY + 12;

      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Merchant Partner:', col1X, rowY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text(merchant.business_name || merchant.businessName || 'Merchant', col1X + 95, rowY);

      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Category:', col2X, rowY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text(merchant.category || 'RETAIL', col2X + 65, rowY);

      rowY += 18;
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('M-PESA Payout:', col1X, rowY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text(merchant.mpesa_phone_number || merchant.mpesaPhoneNumber || merchant.mpesa_number || 'N/A', col1X + 95, rowY);

      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Statement Date:', col2X, rowY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text(new Date().toLocaleDateString('en-ET', { timeZone: 'Africa/Addis_Ababa' }), col2X + 85, rowY);

      doc.y = infoY + 80;

      // Summary KPI Metrics Row
      const kpiY = doc.y;
      const cardW = 165;
      const cardH = 50;

      // KPI 1: Total Credit
      doc.roundedRect(40, kpiY, cardW, cardH, 6).fillAndStroke('#ECFDF5', '#10B981');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#065F46').text('TOTAL BENEFIT CREDIT USED', 50, kpiY + 8);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#047857').text(`ETB ${Number(summary.totalCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 50, kpiY + 22);

      // KPI 2: Employee Count
      doc.roundedRect(215, kpiY, cardW, cardH, 6).fillAndStroke('#F8FAFC', '#CBD5E1');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text('UNIQUE EMPLOYEES', 225, kpiY + 8);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#0F172A').text(String(summary.employeeCount || 0), 225, kpiY + 22);

      // KPI 3: Total Transactions
      doc.roundedRect(390, kpiY, cardW, cardH, 6).fillAndStroke('#F8FAFC', '#CBD5E1');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text('TOTAL TRANSACTIONS', 400, kpiY + 8);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#0F172A').text(String(summary.transactionCount || 0), 400, kpiY + 22);

      doc.y = kpiY + cardH + 16;

      // Table 1: Spending Breakdown by Employee
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0F172A').text('Spending Breakdown by Employee');
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#CBD5E1');
      doc.moveDown(0.4);

      let tableY = doc.y;
      doc.rect(40, tableY, 515, 18).fill('#F1F5F9');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569');
      doc.text('FP-ID', 48, tableY + 5, { width: 130 });
      doc.text('Employee Name', 180, tableY + 5, { width: 160 });
      doc.text('Total Spent (ETB)', 340, tableY + 5, { width: 100, align: 'right' });
      doc.text('Last Visit', 450, tableY + 5, { width: 95, align: 'right' });

      tableY += 20;

      (byEmployee || []).slice(0, 10).forEach((emp, i) => {
        if (i % 2 === 1) {
          doc.rect(40, tableY - 2, 515, 16).fill('#F8FAFC');
        }
        doc.font('Courier-Bold').fontSize(8).fillColor('#059669').text(emp.fp_employee_id || emp.employee_id || 'N/A', 48, tableY, { width: 130 });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text(emp.full_name || 'N/A', 180, tableY, { width: 160 });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text(Number(emp.total_spent || 0).toFixed(2), 340, tableY, { width: 100, align: 'right' });
        doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(emp.last_visit ? new Date(emp.last_visit).toLocaleDateString() : 'N/A', 450, tableY, { width: 95, align: 'right' });
        tableY += 16;
      });

      doc.y = tableY + 12;

      // Table 2: Recent Transactions
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0F172A').text('Recent Benefit Transactions');
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#CBD5E1');
      doc.moveDown(0.4);

      let txnTableY = doc.y;
      doc.rect(40, txnTableY, 515, 18).fill('#F1F5F9');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569');
      doc.text('Date', 48, txnTableY + 5, { width: 75 });
      doc.text('Reference', 125, txnTableY + 5, { width: 140 });
      doc.text('Employee', 270, txnTableY + 5, { width: 130 });
      doc.text('Credit Portion', 400, txnTableY + 5, { width: 75, align: 'right' });
      doc.text('Total Amount', 480, txnTableY + 5, { width: 65, align: 'right' });

      txnTableY += 20;

      (transactions || []).slice(0, 12).forEach((txn, i) => {
        if (i % 2 === 1) {
          doc.rect(40, txnTableY - 2, 515, 16).fill('#F8FAFC');
        }
        doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(new Date(txn.created_at).toLocaleDateString(), 48, txnTableY, { width: 75 });
        doc.font('Courier').fontSize(8).fillColor('#0F172A').text(txn.fp_transaction_ref || (txn.id && txn.id.slice(0, 10)) || 'N/A', 125, txnTableY, { width: 140 });
        doc.font('Helvetica').fontSize(8).fillColor('#0F172A').text(txn.employee_name_snapshot || 'N/A', 270, txnTableY, { width: 130 });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#059669').text(`ETB ${Number(txn.credit_portion || 0).toFixed(2)}`, 400, txnTableY, { width: 75, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text(`ETB ${Number(txn.total_amount || 0).toFixed(2)}`, 480, txnTableY, { width: 65, align: 'right' });
        txnTableY += 16;
      });

      // Footer
      doc.y = Math.max(txnTableY + 16, 750);
      doc.dash(3, { space: 3 }).moveTo(40, doc.y).lineTo(555, doc.y).stroke('#CBD5E1').undash();
      doc.moveDown(0.6);
      doc.font('Helvetica').fontSize(7.5).fillColor('#94A3B8').text(
        'FlexPay v3.0 • Earned Wage Access & Pre-Salary Benefit Platform • Certified Settlement Audit Record',
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateStatement };
