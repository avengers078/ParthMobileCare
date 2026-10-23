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
  detectedColumns: string[];
  headerRowNumber: number;
  sheetName?: string;
}

type HeaderField = 'brand' | 'model' | 'ram' | 'storage' | 'purchasePrice' | 'sellingPrice';
type GridResult = { rows: any[]; headerRowNumber: number; detectedColumns: string[] };

const HEADER_ALIASES: Record<HeaderField, string[]> = {
  brand: ['brand', 'make', 'manufacturer', 'company'],
  model: ['model', 'modelname', 'devicename', 'productname', 'phone', 'mobile', 'handset'],
  ram: ['ram', 'memory', 'randomaccessmemory'],
  storage: ['storage', 'rom', 'capacity', 'internalstorage'],
  purchasePrice: ['purchaseprice', 'buyingprice', 'buyprice', 'costprice', 'cost', 'purchase', 'buying', 'buy'],
  sellingPrice: ['sellingprice', 'saleprice', 'retailprice', 'mrp', 'selling', 'sale', 'retail', 'price', 'amount'],
};

export class ExcelService {
  static getSampleData(): string {
    return `Brand,Model,RAM,Storage,Purchase Price,Selling Price\nVivo,V50,8GB,128GB,22000,24999\nOppo,Reno 14,8GB,256GB,28000,31999\nSamsung,A56,8GB,128GB,25000,27999\nApple,iPhone 16,8GB,128GB,72000,79900\nOnePlus,13R,16GB,256GB,38000,42999\nRealme,14 Pro+,12GB,256GB,26000,29999\nXiaomi,14T Pro,12GB,512GB,45000,49999`;
  }

  private static compactHeader(value: any): string {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private static detectField(header: any): HeaderField | undefined {
    const compact = this.compactHeader(header);
    if (!compact) return undefined;
    const matches = (Object.keys(HEADER_ALIASES) as HeaderField[])
      .filter(field => HEADER_ALIASES[field].includes(compact));
    // Generic "price" means selling price only when no explicit price mapping exists.
    if (matches.length === 1) return matches[0];
    if (compact.includes('purchase') || compact.includes('buy') || compact.includes('cost')) return 'purchasePrice';
    if (compact.includes('sell') || compact.includes('sale') || compact.includes('mrp') || compact.includes('retail')) return 'sellingPrice';
    if (compact.includes('brand') || compact.includes('make') || compact.includes('manufacturer')) return 'brand';
    if (compact.includes('model') || compact.includes('device') || compact.includes('product') || compact.includes('phone')) return 'model';
    if (compact === 'ram' || compact.includes('memory')) return 'ram';
    if (compact.includes('storage') || compact === 'rom' || compact.includes('capacity')) return 'storage';
    if (compact === 'price' || compact === 'amount') return 'sellingPrice';
    return undefined;
  }

  private static findHeader(grid: any[][]): GridResult {
    let bestIndex = -1;
    let bestScore = 0;
    let bestFields: Array<HeaderField | undefined> = [];
    const scanLimit = Math.min(grid.length, 30);

    for (let rowIndex = 0; rowIndex < scanLimit; rowIndex++) {
      const row = grid[rowIndex] || [];
      const fields = row.map(cell => this.detectField(cell));
      const unique = new Set(fields.filter(Boolean));
      let score = unique.size;
      if (unique.has('brand') && unique.has('model')) score += 3;
      if (unique.has('sellingPrice')) score += 1;
      if (unique.has('purchasePrice')) score += 1;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = rowIndex;
        bestFields = fields;
      }
    }

    const found = new Set(bestFields.filter(Boolean));
    if (bestIndex < 0 || !found.has('brand') || !found.has('model')) {
      throw new Error('Could not detect Brand and Model columns. Add a header row such as Brand, Model, RAM, Storage, Purchase Price, Selling Price.');
    }
    if (!found.has('purchasePrice') || !found.has('sellingPrice')) {
      throw new Error('Brand and Model were detected, but the sheet also needs Purchase Price and Selling Price columns.');
    }

    const headers = (grid[bestIndex] || []).map((header, column) => {
      const field = bestFields[column];
      return field ? this.displayField(field) : String(header ?? '').trim();
    });
    const rows = grid.slice(bestIndex + 1)
      .map((row, dataIndex) => ({ row, dataIndex }))
      .filter(entry => entry.row && entry.row.some(cell => String(cell ?? '').trim() !== ''))
      .map(({ row, dataIndex }) => {
        const values: Record<string, any> = {};
        headers.forEach((header, column) => { if (header) values[header] = row[column]; });
        values.__sourceRowNumber = bestIndex + 2 + dataIndex;
        return values;
      });

    return { rows, headerRowNumber: bestIndex + 1, detectedColumns: headers.filter(Boolean) };
  }

  private static displayField(field: HeaderField): string {
    const labels: Record<HeaderField, string> = {
      brand: 'Brand', model: 'Model', ram: 'RAM', storage: 'Storage',
      purchasePrice: 'Purchase Price', sellingPrice: 'Selling Price',
    };
    return labels[field];
  }

  private static parsePrice(value: any): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined || String(value).trim() === '') return 0;
    let text = String(value).trim().toLowerCase();
    const negative = /^\(.*\)$/.test(text) || text.startsWith('-');
    const multiplier = /(?:lakh|lac|l)$/.test(text) ? 100000
      : /(?:crore|cr)$/.test(text) ? 10000000
      : /k$/.test(text) ? 1000 : 1;
    text = text.replace(/[₹$€£,\s]/g, '').replace(/[()]/g, '').replace(/(?:lakh|lac|crore|cr|k|l)$/g, '');
    const numeric = Number(text);
    return Number.isFinite(numeric) ? Math.abs(numeric) * multiplier * (negative ? -1 : 1) : 0;
  }

  private static normalizeValue(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private static async processGrid(grid: any[][], existingList: MobilePriceItem[], sheetName?: string): Promise<ImportValidationResult> {
    const detected = this.findHeader(grid);
    const result = await this.processRawRows(detected.rows, existingList);
    return { ...result, headerRowNumber: detected.headerRowNumber, detectedColumns: detected.detectedColumns, sheetName };
  }

  static async processRawRows(rows: any[], existingList: MobilePriceItem[]): Promise<ImportValidationResult> {
    const validByKey = new Map<string, MobilePriceItem>();
    const errorRows: ImportValidationResult['errorRows'] = [];
    let duplicateCount = 0;
    let updatedCount = 0;
    let newCount = 0;
    const existingMap = new Map<string, MobilePriceItem>();
    existingList.forEach(item => existingMap.set(this.itemKey(item), item));
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const normalized: Partial<Record<HeaderField, any>> = {};
      Object.keys(row).forEach(key => {
        const field = this.detectField(key);
        if (field && (normalized[field] === undefined || normalized[field] === '')) normalized[field] = row[key];
      });

      const brand = this.normalizeValue(normalized.brand);
      const model = this.normalizeValue(normalized.model);
      const ram = this.normalizeValue(normalized.ram);
      const storage = this.normalizeValue(normalized.storage);
      const purchasePrice = this.parsePrice(normalized.purchasePrice);
      const sellingPrice = this.parsePrice(normalized.sellingPrice);
      const rowNumber = Number(row.__sourceRowNumber) || i + 2;

      if (!brand || !model) {
        errorRows.push({ rowNumber, reason: 'Brand and Model are required.', rawData: row });
        continue;
      }
      if (purchasePrice <= 0 || sellingPrice <= 0) {
        errorRows.push({ rowNumber, reason: 'Purchase and Selling prices must be positive numbers.', rawData: row });
        continue;
      }

      const key = this.itemKey({ brand, model, ram, storage } as MobilePriceItem);
      if (seenInBatch.has(key)) duplicateCount++;
      seenInBatch.add(key);
      const existing = existingMap.get(key);
      if (existing) {
        const history: PriceHistoryItem[] = [...(existing.priceHistory || [])];
        if (existing.purchasePrice !== purchasePrice || existing.sellingPrice !== sellingPrice) {
          history.unshift({
            date: new Date().toISOString().split('T')[0],
            purchasePrice: existing.purchasePrice,
            sellingPrice: existing.sellingPrice,
            updatedBy: 'Bulk Excel Import',
          });
        }
        validByKey.set(key, {
          ...existing, brand, model, ram, storage, purchasePrice, sellingPrice,
          updatedAt: new Date().toISOString(), priceHistory: history,
        });
      } else {
        validByKey.set(key, {
          id: `price_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          brand, model, ram, storage, purchasePrice, sellingPrice,
          inStock: true, updatedAt: new Date().toISOString(), priceHistory: [],
        });
      }
    }

    const validItems = Array.from(validByKey.values());
    validItems.forEach(item => existingMap.has(this.itemKey(item)) ? updatedCount++ : newCount++);
    return {
      validItems, duplicateCount, updatedCount, newCount, errorRows,
      totalRowsProcessed: rows.length, detectedColumns: [], headerRowNumber: 1,
    };
  }

  private static itemKey(item: Pick<MobilePriceItem, 'brand' | 'model' | 'ram' | 'storage'>): string {
    return [item.brand, item.model, item.ram || '', item.storage || '']
      .map(value => this.normalizeValue(value).toLowerCase()).join('|');
  }

  static async parseCSVString(csvContent: string, existingList: MobilePriceItem[]): Promise<ImportValidationResult> {
    const parsed = Papa.parse<string[]>(csvContent, { header: false, skipEmptyLines: 'greedy', dynamicTyping: false });
    if (parsed.errors.length && !parsed.data.length) throw new Error('This CSV file could not be read. Check its delimiter and encoding.');
    return this.processGrid(parsed.data as any[][], existingList);
  }

  static async parseXLSXBase64(base64Data: string, existingList: MobilePriceItem[]): Promise<ImportValidationResult> {
    const workbook = XLSX.read(base64Data, { type: 'base64', cellDates: false });
    let best: { grid: any[][]; sheetName: string; score: number } | undefined;
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const grid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false });
      try {
        const detected = this.findHeader(grid);
        const score = detected.detectedColumns.length;
        if (!best || score > best.score) best = { grid, sheetName: name, score };
      } catch { /* Skip sheets without a recognizable table. */ }
    }
    if (!best) throw new Error('No sheet contains recognizable Brand and Model columns.');
    return this.processGrid(best.grid, existingList, best.sheetName);
  }

  static async commitBulkImport(importedItems: MobilePriceItem[], existingItems: MobilePriceItem[]): Promise<number> {
    const map = new Map<string, MobilePriceItem>();
    existingItems.forEach(item => map.set(this.itemKey(item), item));
    importedItems.forEach(item => map.set(this.itemKey(item), item));
    const mergedList = Array.from(map.values());
    await StorageService.saveBulkPriceItems(mergedList);
    return mergedList.length;
  }
}
