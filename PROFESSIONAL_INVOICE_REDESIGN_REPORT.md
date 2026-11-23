# Parth Mobile Care — Professional Retail Tax Invoice Redesign Report

**Date:** November 5, 2026  
**Project:** Parth Mobile Care (`parthmobilecare-a474d`)  
**Scope:** Admin Web Dashboard (`admin-dashboard/`) — Second-Hand Device Sales Invoices  
**Brand Blue Anchor:** `#194D9C` (100% Preserved)  
**Verification:** Vitest (23/23 passed), Jest (300/300 passed), Production Build (0 errors in 2.16s)

---

## 1. Executive Summary & Problem Resolution

### Observed Issues in Previous Invoice
1. **Severe Text Collision & Overlap:** Staff details (`Sold By Staff: Chetan Luhar (ID: pLQ1C2qPcnbkr6NWJeB2LMHmtCy2)`) and Customer details (`Address: Farm House`) shared the exact same vertical coordinate ($y = 78\text{ mm}$), causing long staff UIDs to collide directly into customer address lines.
2. **Oversized Unstyled Banner:** Top of the page was dominated by an unstyled solid blue block with small unformatted text.
3. **Hardcoded Placeholder Data:** Previously printed dummy GST numbers (`24ABCDE1234F1Z5`), violating retail compliance.
4. **Weak Table Hierarchy:** Missing quantity column, uneven column widths, no clear borders, and awkward empty vertical gaps.
5. **Awkward Financial Total:** Total amount was housed in a plain box with excessive whitespace.

### Implemented Solutions
1. **Two-Column Separated Structural Cards:**
   - Left Card: **BILL TO / CUSTOMER DETAILS** ($x = 15\text{ mm}$ to $101\text{ mm}$, width $86\text{ mm}$).
   - Right Card: **SOLD BY / STAFF DETAILS** ($x = 109\text{ mm}$ to $195\text{ mm}$, width $86\text{ mm}$).
   - Dynamic text wrapping using `doc.splitTextToSize` with strict horizontal boundaries.
   - Long staff names and 28-character Firebase UIDs are placed on dedicated lines and wrap cleanly.
   - **Zero possibility of text overlap or collision.**
2. **Premium Retail Corporate Header:**
   - Left: Store name in `#194D9C` (16pt bold), store subtitle, store address, contact number.
   - Right: "TAX INVOICE", "ORIGINAL RETAIL SALES RECEIPT", prominent invoice number badge, date/time, and green payment status badge (`PAID • CARD`).
   - Only displays verified, genuine GSTIN when configured; never invents dummy GST numbers.
3. **Structured Product Details Table:**
   - Columns: `ITEM DESCRIPTION` (71mm), `IMEI NUMBER` (50mm), `WARRANTY` (22mm), `QTY` (13mm), `AMOUNT (INR)` (24mm, right-aligned).
   - Alternating header background (`#F5F8FC`), subtle borders (`#E2E8F0`), bold and legible typography.
4. **Visually Prominent Payment Summary & Terms:**
   - Left: 5 retail terms and conditions (certified quality, warranty scope, exclusions, verification, sales finality).
   - Right: Subtotal, Inclusive GST note, Prominent brand blue `#194D9C` Total Amount Payable box, and Indian currency words conversion (`numberToWordsIndian`, e.g. "Rupees Ninety Six Thousand Only").
5. **Signatory & Footer:**
   - Dedicated customer signature line and authorized store signatory line ("For Parth Mobile Care").
   - Authentic computer-generated sales invoice disclaimer and page numbering.
6. **Responsive Invoice Preview Modal in Dashboard:**
   - In `SecondHandPage.tsx`, clicking "View" on any sale record opens a 3XL high-fidelity corporate invoice preview.
   - Provides direct "Download PDF" and "Print" actions matching the PDF output 100%.

---

## 2. Technical Architecture & Files Changed

### Changed Files
1. `admin-dashboard/src/utils/exportUtils.ts`:
   - Added `numberToWordsIndian(num: number): string` converter for Indian currency formatting.
   - Replaced legacy `generateSaleInvoicePdf` with `buildSaleInvoicePdfDoc` and modular `generateSaleInvoicePdf`.
   - Programmed precise geometric bounding boxes, dynamic card height calculation, and text wrapping.
2. `admin-dashboard/src/pages/SecondHandPage.tsx`:
   - Upgraded the "Sale Invoice Details" modal into an interactive, full-fidelity Invoice Preview modal (`size="3xl"`).
   - Added direct Print and PDF download triggers.
3. `admin-dashboard/src/__tests__/adminDashboard.test.ts`:
   - Added 10 automated test suites covering all edge cases specified in Requirement #11.

---

## 3. PDF Layout & Geometry Specifications (A4 Portrait)

```
+-----------------------------------------------------------------------------+
| Top Brand Blue Accent Strip (#194D9C, Height: 3.5mm)                        |
|                                                                             |
| Parth Mobile Care (16pt Bold #194D9C)            TAX INVOICE (14pt Bold)    |
| Certified Pre-Owned Sales (8pt Slate)     Original Retail Sales Receipt     |
| Store Address (Wrapped to 95mm)           [ Invoice: PMC-INV-202611-5939 ]  |
| Phone: +91 98765 43210                    Date: 2026-11-05 • 21:40:46       |
| GSTIN: Configured Only                    [ PAID • CARD (Green Pill) ]      |
+-----------------------------------------------------------------------------+
| Horizontal Divider Line (#E2E8F0)                                           |
+-----------------------------------------------------------------------------+
| [ BILL TO / CUSTOMER DETAILS ]           [ SOLD BY / STAFF DETAILS ]        |
| Vivek Oberoi                             Chetan Luhar                       |
| Phone: 9632587412                        Staff ID: pLQ1C2qPcnbkr6NW...      |
| Address: Farm House, SG Highway...       Store: Parth Mobile Care           |
| (Card Width: 86mm, Strict Box)           (Card Width: 86mm, Strict Box)     |
+-----------------------------------------------------------------------------+
| PRODUCT DETAILS TABLE                                                       |
| ITEM DESCRIPTION       | IMEI NUMBER       | WARRANTY | QTY | AMOUNT (INR)  |
| Samsung S24 Ultra      | 646946191816491   | 3 Months |  1  | INR 96,000    |
| 12GB / 512GB • Certified Pre-Owned                                          |
+-----------------------------------------------------------------------------+
| TERMS & CONDITIONS                       FINANCIAL BREAKDOWN                |
| 1. Multi-point hardware verified.        Subtotal:           INR 96,000     |
| 2. Covers internal functional defects.   Tax / GST: Inclusive (Margin)      |
| 3. Drops & liquid damage void warranty.  +--------------------------------+ |
| 4. Original invoice required.            | TOTAL AMOUNT:    ₹ 96,000      | |
| 5. Certified pre-owned sales final.      | Paid in Full via Card          | |
|                                          +--------------------------------+ |
|                                          Rupees Ninety Six Thousand Only    |
+-----------------------------------------------------------------------------+
|                                                                             |
| ____________________                     ___________________________        |
| Customer Signature                       Authorized Store Signatory         |
|                                          For Parth Mobile Care              |
|                                                                             |
| This is an authenticated, computer-generated sales tax invoice.   Page 1 of 1|
+-----------------------------------------------------------------------------+
```

---

## 4. Requirement #11 Test Verification Results

| # | Test Scenario | Verified Behavior | Status |
| :--- | :--- | :--- | :--- |
| 1 | Single-device sale invoice | Clean vector rendering on 1 page | **PASS** |
| 2 | Long customer name | Wrapped inside customer card without overflow | **PASS** |
| 3 | Long multi-line customer address | Wrapped to 78mm width, zero collision | **PASS** |
| 4 | Long staff name and 28-char UID | Dedicated line, wrapped to 78mm width | **PASS** |
| 5 | Different payment methods | Formatted cleanly for Cash, UPI, Card, Bank Transfer | **PASS** |
| 6 | Indian currency words conversion | Accurate conversion for 96K, 80K, 600K, 14.5K, 0 | **PASS** |
| 7 | Missing optional customer address | Clean fallback to "In-Store Counter Delivery" | **PASS** |
| 8 | Missing/unconfigured GSTIN | Omitted cleanly; never prints placeholder GST | **PASS** |
| 9 | KYC privacy protection | Customer Aadhaar number is never output in PDF | **PASS** |
| 10 | File download trigger | File saved as `Invoice_PMC-INV-202611-5939.pdf` | **PASS** |

### Complete Test Suites Summary
- **Admin Dashboard Vitest:** 23 passed (100%)
- **Mobile App Jest:** 300 passed across 28 suites (100%)
- **Vite & TypeScript Build:** 0 errors, built in 2.16s

---

## 5. Security & Spark Tier Compliance
- **100% Client-side vector generation:** Generates native PDF binaries directly in memory using `jsPDF`.
- **Zero Cloud Functions or Cloud Storage:** $0 Firebase Spark tier preserved.
- **Zero Firestore Security Rules changes:** Full backward compatibility maintained.
- **Privacy Guaranteed:** Aadhaar numbers and KYC photos are strictly excluded from generated invoices.

