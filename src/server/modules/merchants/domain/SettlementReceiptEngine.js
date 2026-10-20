const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('node:crypto');

/**
 * Generates an authoritative FlexPay PDF corporate settlement payout receipt.
 * Enforces 100% high-contrast typography, zero washed-out colors, and Safaricom M-PESA styling.
 * Returns Promise<Buffer>.
 */
async function generateSettlementReceipt(receipt) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [380, 620], margin: 20 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const amount = Number(receipt.amount || 0);
      const isCompleted = (receipt.status || 'COMPLETED') === 'COMPLETED';
      const mpesaReceipt = receipt.mpesaReceipt || `MP_B2C_${(receipt.id || '').slice(0, 8).toUpperCase()}`;
      const settlementId = receipt.settlementId || 'STL-BATCH';
      const orgName = receipt.organization?.name || receipt.organizationName || 'Corporate Employer';
      const orgShortcode = receipt.organization?.shortcode || receipt.organizationShortcode || '251700';
      const merchantName = receipt.merchant?.businessName || receipt.merchantBusinessName || 'Partner Merchant';
      const merchantTill = receipt.merchant?.mpesaNumber || receipt.recipientMpesaNumber || 'N/A';
      const merchantCat = receipt.merchant?.category || receipt.merchantCategory || 'RETAIL';
      const periodStart = receipt.periodStart || 'N/A';
      const periodEnd = receipt.periodEnd || 'N/A';
      const completedAt = receipt.completedAt ? new Date(receipt.completedAt) : new Date();

      // Deterministic Audit Hash
      const auditPayload = `${receipt.id || ''}:${mpesaReceipt}:${amount}:${settlementId}:${orgShortcode}`;
      const auditHash = crypto.createHash('sha256').update(auditPayload).digest('hex').substring(0, 24).toUpperCase();

      // 1. Top Emerald Accent Bar
      doc.rect(0, 0, 380, 6).fill('#059669');

      // 2. Header Brand Block
      doc.y = 18;
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#0F172A').text('FlexPay', 22, doc.y, { continued: true });
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#059669').text(' • M-PESA B2C');

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('CORPORATE PAYROLL SETTLEMENT VOUCHER', 22, doc.y + 3);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text('Direct Merchant Wire Disbursement & Clearing Record', 22, doc.y + 1);

      // 3. Status Badge (Top Right)
      const badgeY = 20;
      const badgeWidth = 110;
      const badgeHeight = 22;
      const badgeX = 380 - 22 - badgeWidth;

      if (isCompleted) {
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 11).fillAndStroke('#ECFDF5', '#10B981');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#065F46')
           .text('✓  WIRED & SETTLED', badgeX, badgeY + 6, { width: badgeWidth, align: 'center' });
      } else {
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 11).fillAndStroke('#FFFBEB', '#F59E0B');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#92400E')
           .text(String(receipt.status || 'PENDING'), badgeX, badgeY + 6, { width: badgeWidth, align: 'center' });
      }

      // Divider
      doc.y = 66;
      doc.dash(3, { space: 3 }).moveTo(22, doc.y).lineTo(358, doc.y).stroke('#CBD5E1').undash();

      // 4. Hero Settlement Payout Card
      const heroY = 74;
      doc.roundedRect(22, heroY, 336, 60, 8).fillAndStroke('#F8FAFC', '#E2E8F0');

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B')
         .text('SETTLEMENT PAYOUT RECEIVED (ETB)', 36, heroY + 11);
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#059669')
         .text(`ETB ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 36, heroY + 24);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0F172A')
         .text('Safaricom Ethiopia B2C Wire', 190, heroY + 14, { width: 154, align: 'right' });
      doc.font('Helvetica').fontSize(7).fillColor('#64748B')
         .text('Auto-Disbursed to Merchant Till', 190, heroY + 28, { width: 154, align: 'right' });

      // 5. Section: Wire & Receipt Reference
      let curY = 146;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#059669')
         .text('M-PESA WIRE CONFIRMATION', 22, curY);
      curY += 13;
      doc.moveTo(22, curY).lineTo(358, curY).stroke('#E2E8F0');
      curY += 8;

      const renderRow = (label, val, isMonospace = false, valColor = '#0F172A') => {
        doc.font('Helvetica').fontSize(8).fillColor('#475569').text(label, 22, curY);
        if (isMonospace) {
          doc.font('Courier-Bold').fontSize(8).fillColor(valColor).text(String(val || 'N/A'), 140, curY, { width: 218, align: 'right' });
        } else {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(valColor).text(String(val || 'N/A'), 140, curY, { width: 218, align: 'right' });
        }
        curY += 16;
      };

      renderRow('M-PESA Receipt Number', mpesaReceipt, true, '#059669');
      renderRow('Settlement Batch ID', settlementId, true, '#0F172A');
      renderRow('Settlement Period', `${periodStart} to ${periodEnd}`);
      renderRow('Wire Execution Time', completedAt.toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium', timeStyle: 'short' }) + ' EAT');

      // 6. Section: Paying Employer & Beneficiary Merchant
      curY += 6;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#059669')
         .text('SETTLEMENT PARTIES & RECIPIENT TILL', 22, curY);
      curY += 13;
      doc.moveTo(22, curY).lineTo(358, curY).stroke('#E2E8F0');
      curY += 8;

      renderRow('Paying Employer', orgName);
      renderRow('Employer Shortcode', orgShortcode, true);
      renderRow('Beneficiary Merchant', merchantName);
      renderRow('Merchant Till / Phone', merchantTill, true, '#059669');
      renderRow('Merchant Category', merchantCat);

      // 7. Section: Double-Entry Ledger Clearing Verification
      curY += 6;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#059669')
         .text('DOUBLE-ENTRY LEDGER AUDIT SEAL', 22, curY);
      curY += 13;
      doc.moveTo(22, curY).lineTo(358, curY).stroke('#E2E8F0');
      curY += 8;

      renderRow('Ledger Entry Rule', 'Corporate Clearing Acct -> Merchant Till');
      renderRow('Audit Verification Hash', auditHash, true, '#475569');
      renderRow('Disbursement Rail', 'M-PESA B2C (BusinessPayment)');

      // 8. QR Code Box
      const qrData = JSON.stringify({
        receipt: mpesaReceipt,
        batch: settlementId,
        org: orgName,
        merchant: merchantName,
        amount,
        audit: auditHash,
      });

      const qrPngBuffer = await QRCode.toBuffer(qrData, {
        width: 72,
        margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });

      const qrY = curY + 10;
      doc.image(qrPngBuffer, 22, qrY, { width: 68 });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0F172A')
         .text('Authorized Electronic Settlement Receipt', 100, qrY + 8);
      doc.font('Helvetica').fontSize(7).fillColor('#64748B')
         .text('This digital voucher certifies that all pre-salary credit purchases for the indicated period have been fully settled and paid to the merchant by the corporate employer via Safaricom Ethiopia M-PESA B2C rails.', 100, qrY + 22, { width: 250, lineGap: 1.5 });

      // 9. Footer
      doc.y = 590;
      doc.dash(2, { space: 2 }).moveTo(22, doc.y).lineTo(358, doc.y).stroke('#CBD5E1').undash();
      doc.font('Helvetica').fontSize(6.5).fillColor('#94A3B8')
         .text('FlexPay Platform • Safaricom Ethiopia Daraja B2C Direct Settlement • Zero Discrepancy Ledger', 22, doc.y + 6, { align: 'center', width: 336 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateSettlementReceipt };
