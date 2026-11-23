jest.mock('../src/services/storageService', () => ({
  StorageService: { saveBulkPriceItems: jest.fn() },
}));

import { ExcelService } from '../src/services/excelService';
import { MobilePriceItem } from '../src/types';

describe('Excel & CSV Smart Price Processing', () => {
  const existingList: MobilePriceItem[] = [
    {
      id: 'p1',
      brand: 'Vivo',
      model: 'V50',
      ram: '8GB',
      storage: '128GB',
      purchasePrice: 22000,
      sellingPrice: 24999,
      updatedAt: '2026-09-01T00:00:00Z',
      priceHistory: [],
    },
  ];

  test('auto-detects columns, updates existing prices, and records price history', async () => {
    // New prices for Vivo V50, and brand new OnePlus model
    const csv = `Brand,Model,RAM,Storage,Purchase Price,Selling Price
Vivo,V50,8GB,128GB,21500,24499
OnePlus,Nord 4,8GB,256GB,28000,32999`;

    const result = await ExcelService.parseCSVString(csv, existingList);

    expect(result.totalRowsProcessed).toBe(2);
    expect(result.updatedCount).toBe(1);
    expect(result.newCount).toBe(1);
    expect(result.errorRows.length).toBe(0);

    // Verify existing item updated prices and stored old price in history
    const updatedVivo = result.validItems.find(i => i.model === 'V50');
    expect(updatedVivo).toBeDefined();
    expect(updatedVivo?.purchasePrice).toBe(21500);
    expect(updatedVivo?.sellingPrice).toBe(24499);
    expect(updatedVivo?.priceHistory.length).toBe(1);
    expect(updatedVivo?.priceHistory[0].purchasePrice).toBe(22000);
    expect(updatedVivo?.priceHistory[0].sellingPrice).toBe(24999);

    // Verify new item created
    const newOnePlus = result.validItems.find(i => i.model === 'Nord 4');
    expect(newOnePlus).toBeDefined();
    expect(newOnePlus?.brand).toBe('OnePlus');
    expect(newOnePlus?.purchasePrice).toBe(28000);
    expect(newOnePlus?.sellingPrice).toBe(32999);
  });

  test('validates errors and invalid price rows', async () => {
    const invalidCsv = `Brand,Model,RAM,Storage,Purchase Price,Selling Price
,NoBrandModel,8GB,128GB,15000,18000
Samsung,A15,4GB,64GB,-500,12000`;

    const result = await ExcelService.parseCSVString(invalidCsv, []);
    expect(result.errorRows.length).toBe(2);
    expect(result.validItems.length).toBe(0);
  });

  test('consolidates duplicate variants with inconsistent spacing and keeps the latest row', async () => {
    const csv = `Brand,Model,RAM,Storage,Purchase Price,Selling Price
Vivo,V50,8GB,128GB,22000,24999
Vivo,V50,8 GB,128 GB,21800,24499`;

    const result = await ExcelService.parseCSVString(csv, []);

    expect(result.totalRowsProcessed).toBe(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.validItems).toHaveLength(1);
    expect(result.validItems[0].ram).toBe('8GB');
    expect(result.validItems[0].storage).toBe('128GB');
    expect(result.validItems[0].purchasePrice).toBe(21800);
    expect(result.validItems[0].sellingPrice).toBe(24499);
  });

  test('successfully parses distributor sheets with DP and MOP headers and auto-infers brand from model', async () => {
    // Typical Indian mobile dealer sheet: Model, DP, MOP (no separate Brand column)
    const distributorCsv = `Model,RAM,Storage,DP,MOP
Vivo V50,8GB,128GB,22000,24999
Galaxy A56,8GB,128GB,25000,27999
iPhone 16,8GB,128GB,72000,79900`;

    const result = await ExcelService.parseCSVString(distributorCsv, []);

    expect(result.totalRowsProcessed).toBe(3);
    expect(result.errorRows.length).toBe(0);
    expect(result.validItems).toHaveLength(3);

    const vivo = result.validItems.find(i => i.brand === 'Vivo');
    expect(vivo).toBeDefined();
    expect(vivo?.purchasePrice).toBe(22000);
    expect(vivo?.sellingPrice).toBe(24999);

    const samsung = result.validItems.find(i => i.brand === 'Samsung');
    expect(samsung).toBeDefined();

    const apple = result.validItems.find(i => i.brand === 'Apple');
    expect(apple).toBeDefined();
  });

  test('extracts RAM and Storage from model string variant pattern when columns are missing', async () => {
    const csv = `Model,Rate
Oppo Reno 14 (8GB/256GB),29999
Realme 14 Pro+ 12/256,28999`;

    const result = await ExcelService.parseCSVString(csv, []);

    expect(result.totalRowsProcessed).toBe(2);
    expect(result.validItems).toHaveLength(2);

    const oppo = result.validItems.find(i => i.brand === 'Oppo');
    expect(oppo).toBeDefined();
    expect(oppo?.ram).toBe('8GB');
    expect(oppo?.storage).toBe('256GB');
    expect(oppo?.sellingPrice).toBe(29999);
    expect(oppo?.purchasePrice).toBe(29999); // Mirrored single price
  });

  test('successfully parses Inventory sheet exported from Parth Mobile Care Business Report without false price errors', async () => {
    // Exact columns from user screenshot: S.No, Purchase ID, Brand, Model, RAM / Storage, IMEI, Purchase Cost (₹), Purchase Date, Status, Supplier / Source, Quality Tested
    const businessReportInventoryCsv = `S.No,Purchase ID,Brand,Model,RAM / Storage,IMEI,Purchase Cost (₹),Purchase Date,Status,Supplier / Source,Quality Tested
1,pur_1729864200000,Samsung,Galaxy A56,8GB / 128GB,354892019283741,25000,2026-10-25,IN_STOCK,Customer Walk-in,10/10`;

    const result = await ExcelService.parseCSVString(businessReportInventoryCsv, []);

    expect(result.totalRowsProcessed).toBe(1);
    expect(result.errorRows.length).toBe(0);
    expect(result.validItems).toHaveLength(1);

    const item = result.validItems[0];
    expect(item.brand).toBe('Samsung');
    expect(item.model).toBe('Galaxy A56');
    expect(item.ram).toBe('8GB');
    expect(item.storage).toBe('128GB');
    expect(item.purchasePrice).toBe(25000);
    expect(item.sellingPrice).toBe(25000);
  });
});
