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
});
