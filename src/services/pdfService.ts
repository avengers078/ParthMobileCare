import { NativeModules, Platform, Share, Alert } from 'react-native';
import { SalarySlip, ShopConfig } from '../types';
import { formatCurrency } from '../utils/format';

const { PdfModule } = NativeModules;

export class PdfService {
  /**
   * Builds an A4-optimized professional letterhead HTML for Parth Mobile Care Salary Slip
   */
  static generateSalarySlipHtml(slip: SalarySlip, shopConfig: ShopConfig): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Salary Statement - ${slip.staffName} (${slip.month})</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      margin: 0;
      padding: 24px;
      background: #FFFFFF;
      font-size: 14px;
      line-height: 1.5;
    }
    .header-box {
      border-bottom: 2px solid #2563EB;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .shop-name {
      font-size: 26px;
      font-weight: 800;
      color: #1E3A8A;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .shop-meta {
      font-size: 12px;
      color: #64748B;
      margin-top: 4px;
    }
    .doc-title-badge {
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      padding: 6px 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      text-align: right;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 16px;
    }
    .meta-item {
      margin-bottom: 6px;
    }
    .meta-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-size: 15px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background: #F1F5F9;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 2px solid #CBD5E1;
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #E2E8F0;
      font-size: 14px;
    }
    .text-right {
      text-align: right;
    }
    .amount-plus {
      color: #16A34A;
      font-weight: 700;
    }
    .amount-minus {
      color: #DC2626;
      font-weight: 700;
    }
    .net-salary-row {
      background: #EFF6FF;
      border-top: 2px solid #2563EB;
      border-bottom: 2px solid #2563EB;
    }
    .net-salary-label {
      font-size: 16px;
      font-weight: 800;
      color: #1E3A8A;
      padding: 16px;
    }
    .net-salary-value {
      font-size: 20px;
      font-weight: 800;
      color: #2563EB;
      padding: 16px;
      text-align: right;
    }
    .footer-section {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px dashed #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .stamp-box {
      border: 1px solid #16A34A;
      background: #F0FDF4;
      color: #15803D;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      display: inline-block;
    }
    .sign-area {
      text-align: right;
      min-width: 200px;
    }
    .sign-line {
      border-top: 1px solid #0F172A;
      margin-top: 48px;
      padding-top: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <h1 class="shop-name">${shopConfig.shopName}</h1>
      <div class="shop-meta">${shopConfig.shopAddress}</div>
      <div class="shop-meta">GSTIN: ${shopConfig.gstNumber} | Phone: ${shopConfig.phone}</div>
    </div>
    <div class="doc-title-badge">
      Official Salary Slip<br>
      <span style="font-size: 16px; font-weight: 800;">${slip.month}</span>
    </div>
  </div>

  <div class="grid-2">
    <div>
      <div class="meta-item">
        <div class="meta-label">Employee Name</div>
        <div class="meta-value">${slip.staffName}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Designation / Role</div>
        <div class="meta-value">${slip.designation}</div>
      </div>
    </div>
    <div>
      <div class="meta-item">
        <div class="meta-label">Attendance & Working Days</div>
        <div class="meta-value">${slip.totalWorkingDays} Days (Present: ${slip.presentDays})</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Monthly Sales Achieved</div>
        <div class="meta-value" style="color: #2563EB;">${formatCurrency(slip.salesAchieved)}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Salary Component / Description</th>
        <th class="text-right">Type</th>
        <th class="text-right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Basic Monthly Salary</strong><br><span style="font-size: 12px; color: #64748B;">Fixed standard remuneration</span></td>
        <td class="text-right" style="color: #64748B;">Earnings</td>
        <td class="text-right"><strong>${formatCurrency(slip.basicSalary)}</strong></td>
      </tr>
      <tr>
        <td><strong>Target Sales Incentive</strong><br><span style="font-size: 12px; color: #64748B;">Volume commission based on sales</span></td>
        <td class="text-right" style="color: #16A34A;">Incentive</td>
        <td class="text-right amount-plus">+${formatCurrency(slip.salesIncentive)}</td>
      </tr>
      <tr>
        <td><strong>Punctuality & Attendance Bonus</strong><br><span style="font-size: 12px; color: #64748B;">On-time shop opening reward</span></td>
        <td class="text-right" style="color: #16A34A;">Bonus</td>
        <td class="text-right amount-plus">+${formatCurrency(slip.attendanceBonus)}</td>
      </tr>
      <tr>
        <td><strong>Absence & Leave Deductions</strong><br><span style="font-size: 12px; color: #64748B;">Unapproved leave deduction</span></td>
        <td class="text-right" style="color: #DC2626;">Deductions</td>
        <td class="text-right amount-minus">-${formatCurrency(slip.deductions)}</td>
      </tr>
      <tr class="net-salary-row">
        <td class="net-salary-label">NET TAKE HOME DISBURSED</td>
        <td class="text-right" style="font-weight: 700; color: #1E3A8A;">Total</td>
        <td class="net-salary-value">${formatCurrency(slip.netSalary)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-section">
    <div>
      <div class="stamp-box">
        ✓ DIGITALLY VERIFIED BY PARTH MOBILE CARE
      </div>
      <div style="font-size: 11px; color: #64748B; margin-top: 8px;">
        Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
    </div>
    <div class="sign-area">
      <div class="sign-line">
        Authorized Signatory / Store Manager
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Triggers native Android PrintManager to print or Save as PDF
   */
  static async printOrSavePdf(slip: SalarySlip, shopConfig: ShopConfig): Promise<boolean> {
    const html = this.generateSalarySlipHtml(slip, shopConfig);
    const cleanMonth = (slip.month || 'Statement').replace(/\s+/g, '_');
    const jobName = `Salary_Slip_${cleanMonth}`;

    if (Platform.OS === 'android' && PdfModule && typeof PdfModule.printHtml === 'function') {
      try {
        await PdfModule.printHtml(html, jobName);
        return true;
      } catch (e: any) {
        console.warn('Native PDF print error:', e);
      }
    }

    // Fallback: Share formatted text
    try {
      await Share.share({
        title: jobName,
        message: `Official Salary Statement for ${slip.staffName} (${slip.month})\nNet Take Home: ${formatCurrency(slip.netSalary)}\nBasic: ${formatCurrency(slip.basicSalary)} | Incentive: +${formatCurrency(slip.salesIncentive)}\nParth Mobile Care`,
      });
      return true;
    } catch (e: any) {
      Alert.alert('Share Error', e.message);
      return false;
    }
  }

  /**
   * Builds an A4-optimized professional Tax Invoice HTML for Parth Mobile Care Second-Hand Sales
   */
  static generateTaxInvoiceHtml(sale: any, shopConfig: ShopConfig): string {
    const signatureHtml = sale.digitalSignatureUri
      ? `<img src="${sale.digitalSignatureUri}" style="max-height: 48px; max-width: 140px; object-fit: contain;" alt="Buyer Signature" />`
      : `<div style="font-size: 13px; font-weight: 700; color: #16A34A;">Digitally Signed & Verified</div>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice - ${sale.invoiceNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      margin: 0;
      padding: 24px;
      background: #FFFFFF;
      font-size: 14px;
      line-height: 1.5;
    }
    .header-box {
      border-bottom: 2px solid #2563EB;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .shop-name {
      font-size: 26px;
      font-weight: 800;
      color: #1E3A8A;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .shop-meta {
      font-size: 12px;
      color: #64748B;
      margin-top: 4px;
    }
    .doc-title-badge {
      background: #F0FDF4;
      color: #15803D;
      border: 1px solid #BBF7D0;
      padding: 6px 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      text-align: right;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 16px;
    }
    .meta-item {
      margin-bottom: 6px;
    }
    .meta-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background: #F1F5F9;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 2px solid #CBD5E1;
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #E2E8F0;
      font-size: 14px;
    }
    .text-right {
      text-align: right;
    }
    .total-row {
      background: #EFF6FF;
      border-top: 2px solid #2563EB;
      border-bottom: 2px solid #2563EB;
    }
    .total-label {
      font-size: 16px;
      font-weight: 800;
      color: #1E3A8A;
      padding: 16px;
    }
    .total-value {
      font-size: 20px;
      font-weight: 800;
      color: #2563EB;
      padding: 16px;
      text-align: right;
    }
    .warranty-card {
      border: 1px solid #BFDBFE;
      background: #EFF6FF;
      color: #1D4ED8;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 13px;
    }
    .footer-section {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px dashed #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .stamp-box {
      border: 1px solid #16A34A;
      background: #F0FDF4;
      color: #15803D;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      display: inline-block;
    }
    .sign-col {
      text-align: center;
      min-width: 160px;
    }
    .sign-line {
      border-top: 1px solid #0F172A;
      margin-top: 32px;
      padding-top: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <h1 class="shop-name">${shopConfig.shopName}</h1>
      <div class="shop-meta">${shopConfig.shopAddress}</div>
      <div class="shop-meta">GSTIN: ${shopConfig.gstNumber} | Mobile: ${shopConfig.phone}</div>
    </div>
    <div class="doc-title-badge">
      TAX INVOICE / BILL<br>
      <span style="font-size: 15px; font-weight: 800;">#${sale.invoiceNumber}</span>
    </div>
  </div>

  <div class="grid-2">
    <div>
      <div class="meta-item">
        <div class="meta-label">Buyer / Customer Details</div>
        <div class="meta-value">${sale.buyerName}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Phone & Alternate</div>
        <div class="meta-value">+91 ${sale.phone}${sale.alternatePhone ? ' / ' + sale.alternatePhone : ''}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Address</div>
        <div class="meta-value">${sale.address || 'Local Customer, Surat'}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Aadhaar / ID Verification</div>
        <div class="meta-value">${sale.aadhaarNumber ? 'XXXX-XXXX-' + sale.aadhaarNumber.slice(-4) : 'Verified in Store'}</div>
      </div>
    </div>
    <div>
      <div class="meta-item">
        <div class="meta-label">Invoice Number</div>
        <div class="meta-value" style="color: #2563EB;">${sale.invoiceNumber}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Sale Date & Time</div>
        <div class="meta-value">${sale.saleDate} ${sale.saleTime || ''}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Sold by Executive</div>
        <div class="meta-value">${sale.soldByStaffName || 'Store Staff'}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Payment Mode</div>
        <div class="meta-value" style="color: #16A34A;">${sale.paymentMethod || 'UPI / Cash'} (Paid in Full)</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item Description & Device Details</th>
        <th>IMEI Number</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Warranty</th>
        <th class="text-right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${sale.brand} ${sale.model}</strong><br>
          <span style="font-size: 12px; color: #64748B;">Second-Hand Certified Mobile • Tested 32 Quality Points</span>
        </td>
        <td>
          <code style="background: #F1F5F9; padding: 4px 6px; border-radius: 4px; font-weight: 700; color: #1E3A8A;">${sale.imei}</code>
        </td>
        <td class="text-right">1</td>
        <td class="text-right"><strong style="color: #16A34A;">${sale.warrantyMonths || 3} Months</strong></td>
        <td class="text-right"><strong>${formatCurrency(sale.sellingAmount)}</strong></td>
      </tr>
      <tr class="total-row">
        <td colspan="4" class="total-label">TOTAL AMOUNT PAID</td>
        <td class="total-value">${formatCurrency(sale.sellingAmount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="warranty-card">
    <strong>🛡️ STORE WARRANTY TERMS:</strong> This mobile is protected under a <strong>${sale.warrantyMonths || 3}-month store testing warranty</strong> covering internal hardware performance. Physical and water damage are exempt. Keep this original invoice for any warranty claims.
  </div>

  <div class="footer-section">
    <div>
      <div class="stamp-box">
        ✓ DIGITALLY VERIFIED BY PARTH MOBILE CARE
      </div>
      <div style="font-size: 11px; color: #64748B; margin-top: 8px;">
        Computer Generated Official Tax Invoice
      </div>
    </div>

    <div style="display: flex; gap: 32px;">
      <div class="sign-col">
        ${signatureHtml}
        <div class="sign-line">Customer / Buyer Signature</div>
      </div>
      <div class="sign-col">
        <div style="font-weight: 700; color: #1E3A8A; font-size: 13px;">Parth Patel</div>
        <div class="sign-line">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Triggers native Android PrintManager to print or Save Tax Invoice as PDF
   */
  static async printOrSaveTaxInvoicePdf(sale: any, shopConfig: ShopConfig): Promise<boolean> {
    const html = this.generateTaxInvoiceHtml(sale, shopConfig);
    const jobName = `Tax_Invoice_${sale.invoiceNumber}_${(sale.buyerName || 'Customer').replace(/\s+/g, '_')}`;

    if (Platform.OS === 'android' && PdfModule && typeof PdfModule.printHtml === 'function') {
      try {
        await PdfModule.printHtml(html, jobName);
        return true;
      } catch (e: any) {
        console.warn('Native PDF print error:', e);
      }
    }

    // Fallback: Share invoice text
    try {
      await Share.share({
        title: jobName,
        message: `Tax Invoice ${sale.invoiceNumber} from Parth Mobile Care for ${sale.brand} ${sale.model} (IMEI: ${sale.imei}). Amount Paid: ${formatCurrency(sale.sellingAmount)}. Buyer: ${sale.buyerName}.`,
      });
      return true;
    } catch (e: any) {
      Alert.alert('Share Error', e.message);
      return false;
    }
  }
}


