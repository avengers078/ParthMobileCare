import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { SecondHandSale, SecondHandPurchase, ShopConfig } from '../types';

export function exportToExcel(data: Record<string, any>[], filename: string, sheetName = 'Data') {
  if (!data || data.length === 0) {
    console.warn('No data available to export.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportToCsv(data: Record<string, any>[], filename: string) {
  if (!data || data.length === 0) {
    console.warn('No data available to export.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  if (typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Converts a positive numeric amount into Indian Currency Words.
 * Example: 96000 -> "Rupees Ninety-Six Thousand Only"
 */
export function numberToWordsIndian(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Rupees Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwo(n: number): string {
    if (n < 10) return singleDigits[n];
    if (n >= 10 && n < 20) return twoDigits[n - 10];
    const unit = n % 10;
    return `${tens[Math.floor(n / 10)]}${unit ? ' ' + singleDigits[unit] : ''}`;
  }

  function convertThree(n: number): string {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let res = '';
    if (hundred > 0) {
      res += `${singleDigits[hundred]} Hundred`;
      if (remainder > 0) res += ' ';
    }
    if (remainder > 0) {
      res += convertTwo(remainder);
    }
    return res;
  }

  let integerPart = Math.floor(num);
  const crore = Math.floor(integerPart / 10000000);
  integerPart %= 10000000;
  const lakh = Math.floor(integerPart / 100000);
  integerPart %= 100000;
  const thousand = Math.floor(integerPart / 1000);
  integerPart %= 1000;
  const remaining = Math.floor(integerPart);

  const parts: string[] = [];
  if (crore > 0) parts.push(`${convertTwo(crore)} Crore`);
  if (lakh > 0) parts.push(`${convertTwo(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${convertTwo(thousand)} Thousand`);
  if (remaining > 0) parts.push(convertThree(remaining));

  return `Rupees ${parts.join(' ')} Only`;
}

/**
 * Builds a standard, clean, professional mobile retail shop TAX INVOICE / CASH MEMO.
 * Designed specifically for Indian mobile retail stores (e.g. Vyapar / Tally style):
 * - Simple, professional white background with clean dark typography (#172033)
 * - Brand Blue #194D9C used only for store name, section titles, and total amount
 * - Clean two-column BILL TO and SOLD BY layout without decorative cards
 * - Standard retail product table: Sr. No. | Product Description | IMEI / Serial No. | Qty | Rate | Amount
 * - Supports single product and multiple products seamlessly with auto-page breaks
 * - Clean calculation summary with subtotal, discount, tax treatment, and bold total
 * - Dynamic Indian currency words generation
 * - Standard retail terms & conditions and simple Authorized Signatory line
 * - Zero decorative cards, zero marketing claims, zero fake diagnostic badges
 * - Safe: No Aadhaar or sensitive KYC exposure; Never invents dummy GST numbers
 */
export function buildSaleInvoicePdfDoc(
  sale: SecondHandSale,
  shopConfig: ShopConfig | null
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Tokens - Minimal, Professional Retail Bill Palette
  const COLOR_BRAND = [25, 77, 156]; // #194D9C Primary Brand Blue
  const COLOR_DARK = [23, 32, 51]; // #172033 Primary Dark Text
  const COLOR_MUTED = [100, 116, 139]; // #64748B Secondary Text
  const COLOR_LINE = [203, 213, 225]; // #CBD5E1 Subtle Border & Dividers
  const COLOR_HEADER_BG = [245, 248, 252]; // #F5F8FC Clean Table Header

  const storeName = shopConfig?.shopName || 'PARTH MOBILE CARE';
  const storeAddress =
    shopConfig?.shopAddress ||
    '4, Jay Jagnath Complex, Opp. New Laxmi Dairy, Virat Nagar Road, Odhav, Ahmedabad, Gujarat - 382415';
  const storePhone = shopConfig?.phone || '+91 98765 43210';
  const storeEmail = shopConfig?.email || 'parthmobilecare07@gmail.com';

  // Only display GSTIN if genuinely configured and valid (Never invent dummy GST numbers)
  const configuredGst = shopConfig?.gstNumber?.trim();
  const hasValidGst = Boolean(
    configuredGst &&
      configuredGst.length >= 10 &&
      !configuredGst.toUpperCase().includes('ABCDE')
  );

  // 1. Standard Invoice Header (Top Margin: 15mm)
  // Left Side: Store Identity
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(COLOR_BRAND[0], COLOR_BRAND[1], COLOR_BRAND[2]);
  doc.text(storeName.toUpperCase(), 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  const storeAddrLines = doc.splitTextToSize(storeAddress, 95);
  doc.text(storeAddrLines, 15, 25);

  let curLeftY = 25 + storeAddrLines.length * 3.6;
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text(`Phone: ${storePhone}  |  Email: ${storeEmail}`, 15, curLeftY);
  curLeftY += 3.8;

  if (hasValidGst) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(`GSTIN: ${configuredGst}`, 15, curLeftY);
    curLeftY += 3.8;
  }

  // Right Side: Standard Tax Invoice / Cash Memo Meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COLOR_BRAND[0], COLOR_BRAND[1], COLOR_BRAND[2]);
  doc.text('TAX INVOICE / CASH MEMO', 195, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text('Invoice No:', 140, 25);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text(sale.invoiceNumber, 195, 25, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text('Invoice Date:', 140, 29);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text(sale.saleDate, 195, 29, { align: 'right' });

  let metaY = 33;
  if (sale.saleTime) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Invoice Time:', 140, metaY);
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(sale.saleTime, 195, metaY, { align: 'right' });
    metaY += 4;
  }

  const payMethod = sale.paymentMethod || 'Cash';
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text('Payment Status:', 140, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text(`Paid (${payMethod})`, 195, metaY, { align: 'right' });

  const headerBottomY = Math.max(curLeftY, metaY + 4);

  // Simple Horizontal Divider Below Header
  doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
  doc.setLineWidth(0.4);
  doc.line(15, headerBottomY, 195, headerBottomY);

  // 2. Customer and Seller Information (Clean 2-Column Layout, No Decorative Boxes)
  const infoTopY = headerBottomY + 4.5;
  const buyerName = sale.buyerName?.trim() || 'Valued Customer';
  const buyerPhone = sale.phone?.trim() || '—';
  const buyerAddress = sale.address?.trim() || 'In-Store Counter Purchase / Walk-In';

  const staffName = sale.soldByStaffName?.trim() || 'Store Executive';
  const staffIdText =
    sale.soldByStaffId && sale.soldByStaffId.length > 15
      ? `Staff ID: PMC-STF-${sale.soldByStaffId.slice(-4).toUpperCase()}`
      : `Staff ID: ${sale.soldByStaffId || 'admin'}`;

  // Left Column: BILL TO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_BRAND[0], COLOR_BRAND[1], COLOR_BRAND[2]);
  doc.text('BILL TO', 15, infoTopY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  const buyerNameLines = doc.splitTextToSize(buyerName, 85);
  doc.text(buyerNameLines, 15, infoTopY + 4.5);
  let curBuyerY = infoTopY + 4.5 + buyerNameLines.length * 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text(`Mobile: ${buyerPhone}`, 15, curBuyerY);
  curBuyerY += 3.8;

  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  const buyerAddrLines = doc.splitTextToSize(`Address: ${buyerAddress}`, 85);
  doc.text(buyerAddrLines, 15, curBuyerY);
  curBuyerY += buyerAddrLines.length * 3.6;

  // Right Column: SOLD BY
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_BRAND[0], COLOR_BRAND[1], COLOR_BRAND[2]);
  doc.text('SOLD BY', 115, infoTopY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  const staffNameLines = doc.splitTextToSize(staffName, 75);
  doc.text(staffNameLines, 115, infoTopY + 4.5);
  let curStaffY = infoTopY + 4.5 + staffNameLines.length * 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text(staffIdText, 115, curStaffY);
  curStaffY += 3.8;

  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text(`Store: ${storeName}`, 115, curStaffY);
  curStaffY += 3.8;

  const infoBottomY = Math.max(curBuyerY, curStaffY) + 2;

  // Subtle separator line before table
  doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
  doc.setLineWidth(0.3);
  doc.line(15, infoBottomY, 195, infoBottomY);

  // 3. Product Details Table (Sr. No. | Product Description | IMEI / Serial No. | Qty | Rate | Amount)
  // Prepare items list (Supports single product and multiple products seamlessly)
  const items: Array<{
    srNo: number;
    description: string;
    subDetails?: string;
    imei: string;
    qty: number;
    rate: number;
    amount: number;
  }> = [];

  if ((sale as any).items && Array.isArray((sale as any).items) && (sale as any).items.length > 0) {
    (sale as any).items.forEach((it: any, idx: number) => {
      const desc = it.description || `${it.brand || ''} ${it.model || ''}`.trim() || 'Handset / Accessory';
      const variant = `${it.ram ? it.ram + ' / ' : ''}${it.storage || ''}${it.warrantyMonths ? ` • Warranty: ${it.warrantyMonths} Months` : ''}`.trim();
      const qty = Number(it.qty) || 1;
      const rate = Number(it.rate ?? it.sellingAmount ?? 0);
      const amount = Number(it.amount ?? (qty * rate));
      items.push({
        srNo: idx + 1,
        description: desc,
        subDetails: variant || undefined,
        imei: it.imei || '—',
        qty,
        rate,
        amount,
      });
    });
  } else {
    const variant = `${sale.ram ? sale.ram + ' / ' : ''}${sale.storage || ''}${sale.warrantyMonths ? ` • Warranty: ${sale.warrantyMonths} Months` : ''}`.trim();
    items.push({
      srNo: 1,
      description: `${sale.brand} ${sale.model}`.trim(),
      subDetails: variant || undefined,
      imei: sale.imei || '—',
      qty: 1,
      rate: Number(sale.sellingAmount) || 0,
      amount: Number(sale.sellingAmount) || 0,
    });
  }

  // Column Boundaries (x = 15 to 195, width = 180mm)
  // Sr. No.: 12mm (15 -> 27)
  // Product Description: 68mm (27 -> 95)
  // IMEI / Serial No.: 47mm (95 -> 142)
  // Qty: 14mm (142 -> 156)
  // Rate: 19mm (156 -> 175)
  // Amount: 20mm (175 -> 195)
  const renderTableHeader = (yPos: number) => {
    doc.setFillColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2]);
    doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    doc.setLineWidth(0.3);
    doc.rect(15, yPos, 180, 7.5, 'FD');

    // Column Dividers
    doc.line(27, yPos, 27, yPos + 7.5);
    doc.line(95, yPos, 95, yPos + 7.5);
    doc.line(142, yPos, 142, yPos + 7.5);
    doc.line(156, yPos, 156, yPos + 7.5);
    doc.line(175, yPos, 175, yPos + 7.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);

    doc.text('Sr. No.', 21, yPos + 5, { align: 'center' });
    doc.text('Product Description', 29, yPos + 5);
    doc.text('IMEI / Serial No.', 97, yPos + 5);
    doc.text('Qty', 149, yPos + 5, { align: 'center' });
    doc.text('Rate', 173, yPos + 5, { align: 'right' });
    doc.text('Amount', 193, yPos + 5, { align: 'right' });
  };

  let tableHeaderY = infoBottomY + 4;
  renderTableHeader(tableHeaderY);
  let currentY = tableHeaderY + 7.5;

  for (const item of items) {
    const descLines = doc.splitTextToSize(item.description, 64);
    const subLines = item.subDetails ? doc.splitTextToSize(item.subDetails, 64) : [];
    const imeiLines = doc.splitTextToSize(item.imei, 44);

    const textLinesCount = Math.max(descLines.length + subLines.length, imeiLines.length);
    const rowHeight = Math.max(8.5, 4.5 + textLinesCount * 3.5);

    // Auto page break if table exceeds printable area
    if (currentY + rowHeight > 240) {
      doc.addPage();
      currentY = 20;
      renderTableHeader(currentY);
      currentY += 7.5;
    }

    doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    doc.setLineWidth(0.2);
    doc.rect(15, currentY, 180, rowHeight, 'D');

    // Vertical column grid lines
    doc.line(27, currentY, 27, currentY + rowHeight);
    doc.line(95, currentY, 95, currentY + rowHeight);
    doc.line(142, currentY, 142, currentY + rowHeight);
    doc.line(156, currentY, 156, currentY + rowHeight);
    doc.line(175, currentY, 175, currentY + rowHeight);

    // Sr. No.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(String(item.srNo), 21, currentY + 5, { align: 'center' });

    // Product Description
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(descLines, 29, currentY + 4.5);

    if (subLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
      doc.text(subLines, 29, currentY + 4.5 + descLines.length * 3.5);
    }

    // IMEI / Serial No.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(imeiLines, 97, currentY + 4.5);

    // Qty
    doc.setFontSize(8);
    doc.text(String(item.qty), 149, currentY + 5, { align: 'center' });

    // Rate
    doc.text(Number(item.rate).toLocaleString('en-IN'), 173, currentY + 5, { align: 'right' });

    // Amount
    doc.setFont('helvetica', 'bold');
    doc.text(Number(item.amount).toLocaleString('en-IN'), 193, currentY + 5, { align: 'right' });

    currentY += rowHeight;
  }

  // 4. Invoice Calculation Summary & Amount in Words
  const summaryY = currentY + 4;
  const subtotal = items.reduce((acc, it) => acc + it.amount, 0);
  const discount = Number((sale as any).discountAmount ?? 0);
  const totalAmount = Number(sale.sellingAmount) || (subtotal - discount);

  // Left Side: Amount in Words
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text('Amount in Words:', 15, summaryY + 4);

  const amountWords = numberToWordsIndian(totalAmount);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  const wordsLines = doc.splitTextToSize(amountWords, 90);
  doc.text(wordsLines, 15, summaryY + 8.5);

  // Right Side: Standard Retail Calculation Summary
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);

  doc.text('Subtotal:', 125, summaryY + 4);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text(`INR ${subtotal.toLocaleString('en-IN')}`, 193, summaryY + 4, { align: 'right' });

  let curSumY = summaryY + 8.5;
  if (discount > 0) {
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
    doc.text('Discount:', 125, curSumY);
    doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
    doc.text(`INR ${discount.toLocaleString('en-IN')}`, 193, curSumY, { align: 'right' });
    curSumY += 4.5;
  }

  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text('Taxable Value / GST:', 125, curSumY);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text('Inclusive (Margin Scheme)', 193, curSumY, { align: 'right' });
  curSumY += 5;

  // Thin separator line above Total Amount
  doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
  doc.setLineWidth(0.4);
  doc.line(125, curSumY, 195, curSumY);
  curSumY += 5;

  // Highlight only the final payable amount using brand blue
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR_BRAND[0], COLOR_BRAND[1], COLOR_BRAND[2]);
  doc.text('TOTAL AMOUNT:', 125, curSumY);
  doc.text(`INR ${totalAmount.toLocaleString('en-IN')}`, 193, curSumY, { align: 'right' });
  curSumY += 2;

  // Thin separator line below Total Amount
  doc.line(125, curSumY, 195, curSumY);
  curSumY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text(`Payment Method: ${payMethod} (Completed)`, 125, curSumY);

  // 5. Terms & Conditions and Authorized Signatory
  const bottomY = Math.max(summaryY + 28, curSumY + 8);

  doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
  doc.setLineWidth(0.3);
  doc.line(15, bottomY, 195, bottomY);

  // Left: Terms & Conditions (Small, clean, authentic retail policies)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text('Terms & Conditions:', 15, bottomY + 5);

  const standardTerms = [
    '1. Warranty covers internal hardware defects only for the specified period from sale date.',
    '2. Physical damage, screen breakage, liquid logging, and unauthorized repair void warranty.',
    '3. Original tax invoice must be presented for any warranty evaluation or servicing.',
    '4. Goods once sold will not be returned or exchanged.',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);

  let termY = bottomY + 9;
  for (const t of standardTerms) {
    doc.text(t, 15, termY);
    termY += 3.6;
  }

  // Right: Authorized Signatory (Simple signature line)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2]);
  doc.text(`For ${storeName}`, 195, bottomY + 5, { align: 'right' });

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(145, bottomY + 20, 195, bottomY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text('Authorized Signatory', 170, bottomY + 24, { align: 'center' });

  // 6. Subtle Page Footer (At the very bottom of A4: 285mm)
  doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
  doc.setLineWidth(0.2);
  doc.line(15, 282, 195, 282);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2]);
  doc.text('This is a computer-generated tax invoice issued by Parth Mobile Care.', 15, 286);
  doc.text('Page 1 of 1', 195, 286, { align: 'right' });

  return doc;
}

export function generateSaleInvoicePdf(
  sale: SecondHandSale,
  shopConfig: ShopConfig | null
): void {
  const doc = buildSaleInvoicePdfDoc(sale, shopConfig);
  doc.save(`Invoice_${sale.invoiceNumber}.pdf`);
}

export async function parseExcelFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

