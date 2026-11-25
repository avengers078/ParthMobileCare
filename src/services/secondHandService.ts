import { SecondHandPurchase, SecondHandSale, User } from '../types';
import { StorageService } from './storageService';
import { getCurrentTimeString, getTodayDateString, generateInvoiceNumber } from '../utils/format';
import { MESSAGE_TEMPLATES, sendWhatsAppMessage } from '../utils/whatsapp';

export class SecondHandService {
  /**
   * Register a new Second-Hand Mobile Purchase
   */
  static async recordPurchase(
    data: Omit<
      SecondHandPurchase,
      'id' | 'purchaseDate' | 'purchaseTime' | 'purchasedByStaffId' | 'purchasedByStaffName' | 'status'
    >,
    currentUser: User
  ): Promise<SecondHandPurchase> {
    const existing = await StorageService.getPurchases();
    const duplicateInStock = existing.find(
      p => p.imei === data.imei && p.status === 'in_stock'
    );
    if (duplicateInStock) {
      throw new Error(`Device with IMEI ${data.imei} is already in store stock (${duplicateInStock.brand} ${duplicateInStock.model}).`);
    }

    const purchaseDate = getTodayDateString();
    const purchaseTime = getCurrentTimeString();

    const rawAadhaar = data.aadhaarNumber || '';
    const cleanDigits = rawAadhaar.replace(/[^0-9]/g, '');
    const maskedAadhaar = cleanDigits.length >= 4 ? `XXXX-XXXX-${cleanDigits.slice(-4)}` : (rawAadhaar.startsWith('XXXX') ? rawAadhaar : 'XXXX-XXXX-XXXX');

    const newPurchase: SecondHandPurchase = {
      ...data,
      id: `pur_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      aadhaarNumber: maskedAadhaar,
      rawAadhaarNumber: rawAadhaar,
      purchaseDate,
      purchaseTime,
      purchasedByStaffId: currentUser.id,
      purchasedByStaffName: currentUser.name,
      status: 'in_stock',
    };

    await StorageService.savePurchase(newPurchase);

    await StorageService.addNotification({
      userId: currentUser.id,
      title: 'Second-Hand Mobile Purchased',
      body: `${newPurchase.brand} ${newPurchase.model} (IMEI: ${newPurchase.imei}) bought for ₹${newPurchase.purchaseAmount}`,
      type: 'purchase',
      relatedId: newPurchase.id,
    });

    return newPurchase;
  }

  /**
   * Register a Second-Hand Mobile Sale
   * Automatically calculates Profit Amount and Margin Percentage
   * Updates original purchase record to 'sold'
   * Generates Invoice Number
   */
  static async recordSale(
    data: Omit<
      SecondHandSale,
      'id' | 'saleDate' | 'saleTime' | 'soldByStaffId' | 'soldByStaffName' | 'profitAmount' | 'marginPercent' | 'invoiceNumber'
    >,
    currentUser: User
  ): Promise<SecondHandSale> {
    const saleDate = getTodayDateString();
    const saleTime = getCurrentTimeString();
    const invoiceNumber = generateInvoiceNumber('PMC-INV');

    const profitAmount = data.sellingAmount - data.purchaseAmount;
    const marginPercent =
      data.purchaseAmount > 0
        ? Math.round((profitAmount / data.purchaseAmount) * 1000) / 10
        : 0;

    const rawAadhaar = data.aadhaarNumber || '';
    const cleanDigits = rawAadhaar.replace(/[^0-9]/g, '');
    const maskedAadhaar = cleanDigits.length >= 4 ? `XXXX-XXXX-${cleanDigits.slice(-4)}` : (rawAadhaar.startsWith('XXXX') ? rawAadhaar : (rawAadhaar || 'XXXX-XXXX-XXXX'));

    const newSale: SecondHandSale = {
      ...data,
      id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      aadhaarNumber: maskedAadhaar,
      rawAadhaarNumber: rawAadhaar,
      profitAmount,
      marginPercent,
      invoiceNumber,
      saleDate,
      saleTime,
      soldByStaffId: currentUser.id,
      soldByStaffName: currentUser.name,
    };

    await StorageService.saveSale(newSale);

    await StorageService.addNotification({
      userId: currentUser.id,
      title: 'Second-Hand Mobile Sold',
      body: `${newSale.brand} ${newSale.model} sold for ₹${newSale.sellingAmount} (Profit: ₹${profitAmount})`,
      type: 'sale',
      relatedId: newSale.id,
    });

    // Automated WhatsApp thank you message on purchase completed
    if (newSale.phone) {
      sendWhatsAppMessage(newSale.phone, MESSAGE_TEMPLATES.PURCHASE_COMPLETED).catch(err =>
        console.log('Automated sales thank-you message handled:', err)
      );
    }

    return newSale;
  }

  /**
   * Search and verify an IMEI across purchase and sales history
   * Provides full lifecycle verification of any device
   */
  static async verifyIMEI(imei: string) {
    const cleanImei = imei.trim();
    const purchases = await StorageService.getPurchases();
    const sales = await StorageService.getSales();

    const matchingPurchases = purchases.filter(p => p.imei.toLowerCase() === cleanImei.toLowerCase());
    const matchingSales = sales.filter(s => s.imei.toLowerCase() === cleanImei.toLowerCase());

    const isCurrentlyInStock = matchingPurchases.some(p => p.status === 'in_stock');

    return {
      imei: cleanImei,
      isKnown: matchingPurchases.length > 0 || matchingSales.length > 0,
      isCurrentlyInStock,
      purchaseRecords: matchingPurchases,
      salesRecords: matchingSales,
    };
  }

  /**
   * Get in-stock second-hand devices ready for sale
   */
  static async getAvailableStock(): Promise<SecondHandPurchase[]> {
    const purchases = await StorageService.getPurchases();
    return purchases.filter(p => p.status === 'in_stock');
  }

  /**
   * Get overall Buy & Sell report statistics
   */
  static async getBuySellStats() {
    const purchases = await StorageService.getPurchases();
    const sales = await StorageService.getSales();

    const totalPurchasedAmount = purchases.reduce((sum, p) => sum + (p.purchaseAmount || 0), 0);
    const totalSalesAmount = sales.reduce((sum, s) => sum + (s.sellingAmount || 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + (s.profitAmount || 0), 0);
    const inStockCount = purchases.filter(p => p.status === 'in_stock').length;
    const soldCount = sales.length;

    return {
      totalPurchasedUnits: purchases.length,
      inStockCount,
      soldCount,
      totalPurchasedAmount,
      totalSalesAmount,
      totalProfit,
      averageMargin:
        sales.length > 0
          ? Math.round((totalProfit / (totalSalesAmount - totalProfit || 1)) * 1000) / 10
          : 0,
    };
  }
}
