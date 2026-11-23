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

type HeaderField = 'brand' | 'model' | 'ram' | 'storage' | 'ramStorage' | 'purchasePrice' | 'sellingPrice';
type GridResult = { rows: any[]; headerRowNumber: number; detectedColumns: string[] };

const HEADER_ALIASES: Record<HeaderField, string[]> = {
  brand: [
    'brand', 'make', 'manufacturer', 'company', 'companyname', 'oem', 'brandname', 'mfg',
  ],
  model: [
    'model', 'modelname', 'devicename', 'productname', 'product', 'itemname', 'item',
    'description', 'particulars', 'phone', 'mobile', 'handset', 'device', 'name',
    'itemdescription', 'productdescription', 'modelno', 'modelnum', 'modelnumber',
    'brandmodel', 'modelinterested',
  ],
  ram: [
    'ram', 'memory', 'randomaccessmemory',
  ],
  storage: [
    'storage', 'rom', 'capacity', 'internalstorage', 'internal', 'disk',
  ],
  ramStorage: [
    'ramstorage', 'ramrom', 'ramandstorage', 'ramstorages', 'configuration', 'config', 'variant', 'specs',
  ],
  purchasePrice: [
    'purchaseprice', 'buyingprice', 'buyprice', 'costprice', 'cost', 'purchase', 'buying',
    'buy', 'dp', 'ndp', 'dealerrate', 'dealerprice', 'netdealerrate', 'landing',
    'landingprice', 'purchaserate', 'cp', 'netrate', 'inwardprice', 'dprate', 'purchasecost',
  ],
  sellingPrice: [
    'sellingprice', 'saleprice', 'retailprice', 'mrp', 'selling', 'sale', 'retail',
    'price', 'amount', 'mop', 'marketoperatingprice', 'sp', 'salesrate', 'customerrate',
    'customerprice', 'rate', 'offerprice', 'finalprice', 'moprate', 'outwardprice',
  ],
};

const KNOWN_BRANDS = [
  'Samsung', 'Apple', 'Vivo', 'Oppo', 'OnePlus', 'Realme', 'Xiaomi',
  'Redmi', 'Poco', 'Motorola', 'Moto', 'Google', 'Nothing', 'Tecno',
  'Infinix', 'iQOO', 'IQOO', 'Lava', 'Nokia', 'Honor',
];

export class ExcelService {
  static getSampleData(): string {
    return `Brand,Model,RAM,Storage,Purchase Price,Selling Price\nVivo,V50,8GB,128GB,22000,24999\nOppo,Reno 14,8GB,256GB,28000,31999\nSamsung,A56,8GB,128GB,25000,27999\nApple,iPhone 16,8GB,128GB,72000,79900\nOnePlus,13R,16GB,256GB,38000,42999\nRealme,14 Pro+,12GB,256GB,26000,29999\nXiaomi,14T Pro,12GB,512GB,45000,49999`;
  }

  private static compactHeader(value: any): string {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private static isIdOrDateColumn(compact: string): boolean {
    return (
      compact.includes('date') ||
      compact.includes('time') ||
      compact.includes('id') ||
      compact.includes('invoice') ||
      compact.includes('billno') ||
      compact.includes('voucher') ||
      compact.includes('order') ||
      compact.includes('status') ||
      compact.includes('imei') ||
      compact.includes('serial') ||
      compact.includes('supplier') ||
      compact.includes('seller') ||
      compact.includes('vendor') ||
      compact.includes('customer') ||
      compact.includes('buyer') ||
      compact.includes('tested') ||
      compact.includes('score') ||
      compact.includes('quality') ||
      compact.includes('by')
    );
  }

  private static detectField(header: any): HeaderField | undefined {
    const compact = this.compactHeader(header);
    if (!compact) return undefined;

    // 1. RAM / Storage combined column check
    if (
      (compact.includes('ram') && (compact.includes('storage') || compact.includes('rom'))) ||
      compact === 'config' ||
      compact === 'configuration' ||
      compact === 'specs'
    ) {
      return 'ramStorage';
    }

    // 2. Reject ID, date, status, or person columns from being treated as price
    const isExcludedFromPrice = this.isIdOrDateColumn(compact);

    // 3. Direct alias check
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[HeaderField, string[]]>) {
      if (aliases.includes(compact)) {
        if ((field === 'purchasePrice' || field === 'sellingPrice') && isExcludedFromPrice) {
          continue;
        }
        return field;
      }
    }

    // 4. Price checks (only if not an excluded ID/date/person column)
    if (!isExcludedFromPrice) {
      if (
        compact === 'dp' ||
        compact.startsWith('dp') ||
        compact.endsWith('dp') ||
        compact === 'ndp' ||
        compact.includes('ndp') ||
        compact === 'cp' ||
        compact.includes('purchase') ||
        compact.includes('buy') ||
        compact.includes('cost') ||
        compact.includes('landing')
      ) {
        return 'purchasePrice';
      }

      if (
        compact === 'mop' ||
        compact.startsWith('mop') ||
        compact.endsWith('mop') ||
        compact.includes('mrp') ||
        compact.includes('sell') ||
        compact.includes('sale') ||
        compact.includes('retail') ||
        compact.includes('offer') ||
        compact === 'sp' ||
        compact === 'price' ||
        compact === 'amount' ||
        compact === 'rate'
      ) {
        return 'sellingPrice';
      }
    }

    // 5. Model keywords
    if (
      compact.includes('model') ||
      compact.includes('product') ||
      compact.includes('item') ||
      compact.includes('particular') ||
      compact.includes('desc') ||
      compact.includes('phone') ||
      compact.includes('handset') ||
      compact.includes('device')
    ) {
      return 'model';
    }

    // 6. Brand keywords
    if (
      compact.includes('brand') ||
      compact.includes('make') ||
      compact.includes('company') ||
      compact.includes('mfg') ||
      compact.includes('oem')
    ) {
      return 'brand';
    }

    // 7. RAM keywords
    if (compact === 'ram' || compact.includes('memory')) {
      return 'ram';
    }

    // 8. Storage keywords
    if (compact.includes('storage') || compact === 'rom' || compact.includes('capacity')) {
      return 'storage';
    }

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
      if (unique.has('model')) score += 3;
      if (unique.has('brand')) score += 2;
      if (unique.has('sellingPrice')) score += 2;
      if (unique.has('purchasePrice')) score += 2;
      if (unique.has('ramStorage') || unique.has('ram')) score += 1;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = rowIndex;
        bestFields = fields;
      }
    }

    const found = new Set(bestFields.filter(Boolean));

    // Must have at least a Model or Brand column
    if (bestIndex < 0 || (!found.has('model') && !found.has('brand'))) {
      throw new Error(
        'Could not detect Model or Product column in this sheet. Ensure the sheet has a column such as Model, Item Name, or Product.'
      );
    }

    // Must have at least ONE price column (sellingPrice OR purchasePrice)
    if (!found.has('purchasePrice') && !found.has('sellingPrice')) {
      throw new Error(
        'Detected model column, but no price column was found. Add a price column such as DP, MOP, Price, MRP, Cost, or Rate.'
      );
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
      ramStorage: 'RAM / Storage',
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

  private static normalizeVariant(value: any): string {
    return this.normalizeValue(value).replace(/\s+/g, '').toUpperCase();
  }

  private static inferBrandAndModel(rawBrand: any, rawModel: any): { brand: string; model: string } {
    let brand = this.normalizeValue(rawBrand);
    let model = this.normalizeValue(rawModel);

    // If brand is empty, try to detect it from the model string
    if (!brand && model) {
      for (const b of KNOWN_BRANDS) {
        const regex = new RegExp(`^${b}\\b`, 'i');
        if (regex.test(model)) {
          brand = b === 'Moto' ? 'Motorola' : b === 'IQOO' ? 'iQOO' : b;
          model = model.replace(regex, '').trim();
          break;
        }
      }
      if (!brand) {
        for (const b of KNOWN_BRANDS) {
          const regex = new RegExp(`\\b${b}\\b`, 'i');
          if (regex.test(model)) {
            brand = b === 'Moto' ? 'Motorola' : b === 'IQOO' ? 'iQOO' : b;
            model = model.replace(regex, '').trim();
            break;
          }
        }
      }
      if (!brand) {
        if (/^iphone|^ipad/i.test(model)) {
          brand = 'Apple';
        } else if (/^galaxy/i.test(model)) {
          brand = 'Samsung';
        } else if (/^pixel/i.test(model)) {
          brand = 'Google';
        } else if (/^nord/i.test(model)) {
          brand = 'OnePlus';
        } else {
          const parts = model.split(/\s+/);
          if (parts.length > 1) {
            brand = parts[0];
            model = parts.slice(1).join(' ');
          } else {
            brand = 'Others';
          }
        }
      }
    }

    // If model is empty but brand has full name (e.g. "Vivo V50")
    if (!model && brand) {
      const parts = brand.split(/\s+/);
      if (parts.length > 1) {
        brand = parts[0];
        model = parts.slice(1).join(' ');
      } else {
        model = brand;
      }
    }

    return { brand: brand || 'Others', model: model || 'Unknown Model' };
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
        if (field && (normalized[field] === undefined || normalized[field] === '')) {
          normalized[field] = row[key];
        }
      });

      // Price extraction with fallback mirroring for sheets with only one price column
      let purchasePrice = this.parsePrice(normalized.purchasePrice);
      let sellingPrice = this.parsePrice(normalized.sellingPrice);

      if (normalized.purchasePrice === undefined && sellingPrice > 0) {
        purchasePrice = sellingPrice;
      } else if (normalized.sellingPrice === undefined && purchasePrice > 0) {
        sellingPrice = purchasePrice;
      }

      // Brand & Model resolution
      let brand = this.normalizeValue(normalized.brand);
      let model = this.normalizeValue(normalized.model);

      // If the sheet did not have a separate Brand column (or it wasn't defined), infer from model
      if (!brand && normalized.brand === undefined) {
        const inferred = this.inferBrandAndModel('', model);
        brand = inferred.brand;
        model = inferred.model;
      }

      let ram = this.normalizeVariant(normalized.ram);
      let storage = this.normalizeVariant(normalized.storage);

      // Check ramStorage combined column (e.g. "8GB / 128GB" or "8/128")
      if (normalized.ramStorage) {
        const rawRS = String(normalized.ramStorage).trim();
        const parts = rawRS.split(/[\/+\s,]+/);
        if (parts.length >= 2) {
          if (!ram) ram = this.normalizeVariant(parts[0]);
          if (!storage) storage = this.normalizeVariant(parts[1]);
        }
      }

      // Auto-extract RAM/Storage from model name (e.g. "8/128" or "8+128") if missing
      if (!ram || !storage) {
        const variantMatch = model.match(/\b(\d+)\s*(?:gb)?\s*[\/+\s]\s*(\d+)\s*(?:gb)?\b/i);
        if (variantMatch) {
          if (!ram) ram = `${variantMatch[1]}GB`;
          if (!storage) storage = `${variantMatch[2]}GB`;
          model = model.replace(/\s*\(\s*\d+\s*(?:gb)?\s*[\/+\s]\s*\d+\s*(?:gb)?\s*\)/i, '').trim();
        }
      }

      // Add 'GB' suffix if purely numeric (e.g. '8' -> '8GB')
      if (ram && /^\d+$/.test(ram)) ram = `${ram}GB`;
      if (storage && /^\d+$/.test(storage)) storage = `${storage}GB`;

      if (!ram) ram = '8GB';
      if (!storage) storage = '128GB';

      const rowNumber = Number(row.__sourceRowNumber) || i + 2;

      if (!brand || !model || model === 'Unknown Model') {
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
    return [
      this.normalizeValue(item.brand).toLowerCase(),
      this.normalizeValue(item.model).toLowerCase(),
      this.normalizeVariant(item.ram).toLowerCase(),
      this.normalizeVariant(item.storage).toLowerCase(),
    ].join('|');
  }

  static async parseCSVString(csvContent: string, existingList: MobilePriceItem[]): Promise<ImportValidationResult> {
    const parsed = Papa.parse<string[]>(csvContent, { header: false, skipEmptyLines: 'greedy', dynamicTyping: false });
    if (parsed.errors.length && !parsed.data.length) throw new Error('This CSV file could not be read. Check its delimiter and encoding.');
    return this.processGrid(parsed.data as any[][], existingList);
  }

  static async parseXLSXBase64(base64Data: string, existingList: MobilePriceItem[]): Promise<ImportValidationResult> {
    const workbook = XLSX.read(base64Data, { type: 'base64', cellDates: false });
    let best: { grid: any[][]; sheetName: string; score: number } | undefined;
    const errors: string[] = [];

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const grid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false });
      if (!grid || grid.length === 0) continue;
      try {
        const detected = this.findHeader(grid);
        let score = detected.detectedColumns.length * 10;
        const lowerName = name.toLowerCase();
        if (lowerName.includes('price')) score += 50;
        if (lowerName.includes('catalog')) score += 40;
        if (lowerName.includes('inventory') || lowerName.includes('stock')) score += 30;
        if (lowerName.includes('mobile')) score += 20;
        if (lowerName.includes('sale')) score += 10;

        if (!best || score > best.score) {
          best = { grid, sheetName: name, score };
        }
      } catch (err: any) {
        errors.push(`Sheet [${name}]: ${err.message}`);
      }
    }

    if (!best) {
      const reason = errors.length > 0 ? errors[0] : 'Please ensure your sheet contains columns for Model/Product and Price/DP/MOP.';
      throw new Error(reason);
    }

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
