import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { MobilePriceItem, PriceHistoryItem } from '../types';
import { StorageService } from './storageService';

export interface ImportValidationResult {
  validItems: MobilePriceItem[];
  duplicateCount: number;
  updatedCount: number;
  newCount: number;
  errorRows: Array<{ rowNumber: number; reason: string; rawData: any }>;
  totalRowsProcessed: number;
}

export class ExcelService {
  /**
   * Sample Excel / CSV template data per PDF specifications
   */
  static getSampleData(): string {
    return `Brand,Model,RAM,Storage,Purchase Price,Selling Price
Vivo,V50,8GB,128GB,22000,24999
Oppo,Reno 14,8GB,256GB,28000,31999
Samsung,A56,8GB,128GB,25000,27999
Apple,iPhone 16,8GB,128GB,72000,79900
OnePlus,13R,16GB,256GB,38000,42999
Realme,14 Pro+,12GB,256GB,26000,29999
Xiaomi,14T Pro,12GB,512GB,45000,49999`;
  }

  /**
   * Normalizes header keys to standard names
   */
  private static normalizeHeaderKey(key: string): string {
    const k = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (k.includes('brand') || k === 'make') return 'brand';
    if (k.includes('model') || k === 'name') return 'model';
    if (k === 'ram' || k.includes('memory')) return 'ram';
    if (k === 'storage' || k === 'rom' || k.includes('capacity')) return 'storage';
    if (k.includes('purchase') || k.includes('cost') || k.includes('buy')) return 'purchasePrice';
    if (k.includes('sell') || k.includes('mrp') || k.includes('retail') || k.includes('price')) return 'sellingPrice';
    return key;
  }

  /**
   * Cleans currency/price values (e.g. "₹24,999" -> 24999)
   */
  private static parsePrice(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(/[^0-9.-]/g, '');
    return parseFloat(str) || 0;
  }

  /**
   * Parses raw array of objects from CSV or XLSX and generates valid MobilePriceItem list
   */
  static async processRawRows(
    rows: any[],
    existingList: MobilePriceItem[]
  ): Promise<ImportValidationResult> {
    const validItems: MobilePriceItem[] = [];
    const errorRows: Array<{ rowNumber: number; reason: string; rawData: any }> = [];
    let duplicateCount = 0;
    let updatedCount = 0;
    let newCount = 0;

    // Map existing items by brand + model + variant key for fast matching
    const existingMap = new Map<string, MobilePriceItem>();
    existingList.forEach(item => {
      const key = `${item.brand.toLowerCase()}_${item.model.toLowerCase()}_${(item.ram || '').toLowerCase()}_${(item.storage || '').toLowerCase()}`;
      existingMap.set(key, item);
    });

    const seenInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // considering header as row 1

      // Normalize row keys
      const normalizedRow: Record<string, any> = {};
      Object.keys(row).forEach(k => {
        const normKey = this.normalizeHeaderKey(k);
        normalizedRow[normKey] = row[k];
      });

      const brand = (normalizedRow.brand || '').toString().trim();
      const model = (normalizedRow.model || '').toString().trim();
      const ram = (normalizedRow.ram || '').toString().trim();
      const storage = (normalizedRow.storage || '').toString().trim();
      const purchasePrice = this.parsePrice(normalizedRow.purchasePrice);
      const sellingPrice = this.parsePrice(normalizedRow.sellingPrice);

      // Validation
      if (!brand || !model) {
        errorRows.push({
          rowNumber: rowNum,
          reason: 'Brand and Model name are required',
          rawData: row,
        });
        continue;
      }

      if (purchasePrice <= 0 || sellingPrice <= 0) {
        errorRows.push({
          rowNumber: rowNum,
          reason: 'Purchase Price and Selling Price must be positive numbers',
          rawData: row,
        });
        continue;
      }

      const matchKey = `${brand.toLowerCase()}_${model.toLowerCase()}_${ram.toLowerCase()}_${storage.toLowerCase()}`;

      if (seenInBatch.has(matchKey)) {
        duplicateCount++;
        // Duplicate row inside the imported sheet: update with latest prices
      }
      seenInBatch.add(matchKey);

      const existing = existingMap.get(matchKey);

      if (existing) {
        // Smart update: keep price history
        const priceHistory: PriceHistoryItem[] = [...(existing.priceHistory || [])];
        if (
          existing.purchasePrice !== purchasePrice ||
          existing.sellingPrice !== sellingPrice
        ) {
          priceHistory.unshift({
            date: new Date().toISOString().split('T')[0],
            purchasePrice: existing.purchasePrice,
            sellingPrice: existing.sellingPrice,
            updatedBy: 'Bulk Excel Import',
          });
        }

        validItems.push({
          ...existing,
          brand,
          model,
          ram,
          storage,
          purchasePrice,
          sellingPrice,
          updatedAt: new Date().toISOString(),
          priceHistory,
        });
        updatedCount++;
      } else {
        // Smart add: create new item
        validItems.push({
          id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          brand,
          model,
          ram,
          storage,
          purchasePrice,
          sellingPrice,
          inStock: true,
          updatedAt: new Date().toISOString(),
          priceHistory: [],
        });
        newCount++;
      }
    }

    return {
      validItems,
      duplicateCount,
      updatedCount,
      newCount,
      errorRows,
      totalRowsProcessed: rows.length,
    };
  }

  /**
   * Parse CSV content directly
   */
  static async parseCSVString(
    csvContent: string,
    existingList: MobilePriceItem[]
  ): Promise<ImportValidationResult> {
    const parseResult: any = (Papa as any).parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
    });

    return this.processRawRows(parseResult.data || [], existingList);
  }

  /**
   * Parse Base64 XLSX file content
   */
  static async parseXLSXBase64(
    base64Data: string,
    existingList: MobilePriceItem[]
  ): Promise<ImportValidationResult> {
    const workbook = XLSX.read(base64Data, { type: 'base64' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawJson = XLSX.utils.sheet_to_json(worksheet);

    return this.processRawRows(rawJson, existingList);
  }

  /**
   * Execute bulk merge into persistent storage
   */
  static async commitBulkImport(
    importedItems: MobilePriceItem[],
    existingItems: MobilePriceItem[]
  ): Promise<number> {
    const map = new Map<string, MobilePriceItem>();
    // First fill existing
    existingItems.forEach(item => {
      const key = `${item.brand.toLowerCase()}_${item.model.toLowerCase()}_${(item.ram || '').toLowerCase()}_${(item.storage || '').toLowerCase()}`;
      map.set(key, item);
    });

    // Then overwrite or add imported
    importedItems.forEach(item => {
      const key = `${item.brand.toLowerCase()}_${item.model.toLowerCase()}_${(item.ram || '').toLowerCase()}_${(item.storage || '').toLowerCase()}`;
      map.set(key, item);
    });

    const mergedList = Array.from(map.values());
    await StorageService.saveBulkPriceItems(mergedList);
    return mergedList.length;
  }
}
