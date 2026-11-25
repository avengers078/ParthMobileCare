import React, { useEffect, useState, useMemo } from 'react';
import {
  Smartphone,
  Plus,
  Search,
  Eye,
  ShoppingBag,
  TrendingUp,
  Shield,
  FileText,
  User,
  Calendar,
  DollarSign,
  Download,
  RotateCcw,
  Lock,
  Printer,
  CheckCircle2,
  Camera,
  ExternalLink,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { CloudinaryService } from '../services/cloudinaryService';
import { useToast } from '../context/ToastContext';
import {
  Modal,
  Badge,
  EmptyState,
  Button,
  ActionButton,
  Input,
  Select,
  Card,
  ExportDropdown,
  TablePagination,
} from '../components/common';
import { useAuth } from '../context/AuthContext';
import { generateSaleInvoicePdf, numberToWordsIndian } from '../utils/exportUtils';
import { SecondHandPurchase, SecondHandSale, ShopConfig, SecondHandKycRecord, SecondHandSaleKycRecord } from '../types';
import { NavigationParams } from '../utils/notificationRouter';

interface SecondHandPageProps {
  initialParams?: NavigationParams | null;
  onClearParams?: () => void;
}

export const SecondHandPage: React.FC<SecondHandPageProps> = ({ initialParams, onClearParams }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>('purchases');
  const [purchases, setPurchases] = useState<SecondHandPurchase[]>([]);
  const [sales, setSales] = useState<SecondHandSale[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Pagination
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [addPurchaseModal, setAddPurchaseModalOpen] = useState(false);
  const [addSaleModal, setAddSaleModalOpen] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<SecondHandPurchase | null>(null);
  const [viewPurchaseKyc, setViewPurchaseKyc] = useState<SecondHandKycRecord | null>(null);
  const [viewSale, setViewSale] = useState<SecondHandSale | null>(null);
  const [viewSaleKyc, setViewSaleKyc] = useState<SecondHandSaleKycRecord | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; publicId?: string } | null>(null);

  const handleOpenPurchaseDetails = async (p: SecondHandPurchase) => {
    setViewPurchase(p);
    setViewPurchaseKyc(null);
    try {
      const kyc = await ApiService.getSecondHandPurchaseKyc(p.id);
      setViewPurchaseKyc(kyc);
    } catch (e) {
      console.warn('Could not load KYC for purchase:', e);
    }
  };

  const handleOpenSaleDetails = async (s: SecondHandSale) => {
    setViewSale(s);
    setViewSaleKyc(null);
    try {
      const kyc = await ApiService.getSecondHandSaleKyc(s.id);
      setViewSaleKyc(kyc);
    } catch (e) {
      console.warn('Could not load KYC for sale:', e);
    }
  };

  // Form states - Purchase
  const [purchaseForm, setPurchaseForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    aadhaarNumber: '',
    brand: 'Apple',
    model: 'iPhone 13',
    ram: '4GB',
    storage: '128GB',
    imei: '',
    condition: 'Good',
    purchaseAmount: 28000,
  });

  // Form states - Sale
  const [saleForm, setSaleForm] = useState({
    purchaseRecordId: '',
    buyerName: '',
    phone: '',
    address: '',
    aadhaarNumber: '',
    brand: 'Apple',
    model: 'iPhone 13',
    imei: '',
    purchaseAmount: 28000,
    sellingAmount: 32999,
    paymentMethod: 'UPI' as const,
    warrantyMonths: 3,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [purchaseFrontFile, setPurchaseFrontFile] = useState<File | null>(null);
  const [purchaseBackFile, setPurchaseBackFile] = useState<File | null>(null);
  const [saleAadhaarFile, setSaleAadhaarFile] = useState<File | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, s, cfg] = await Promise.all([
        ApiService.getSecondHandPurchases(),
        ApiService.getSecondHandSales(),
        ApiService.getShopConfig(),
      ]);
      setPurchases(p);
      setSales(s);
      setShopConfig(cfg);
    } catch (err) {
      console.warn('Second hand load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!initialParams || loading) return;

    const targetId = initialParams.recordId;
    const subTab = initialParams.subTab || initialParams.type;

    if (subTab === 'sales' || initialParams.type === 'sale') {
      setActiveTab('sales');
      if (targetId) {
        const target = sales.find(s => s.id === targetId || s.invoiceNumber === targetId);
        if (target) {
          handleOpenSaleDetails(target);
          onClearParams?.();
        } else if (sales.length > 0) {
          showError(new Error('Record unavailable'), 'This record is no longer available.');
          onClearParams?.();
        }
      } else {
        onClearParams?.();
      }
    } else if (subTab === 'purchases' || initialParams.type === 'purchase') {
      setActiveTab('purchases');
      if (targetId) {
        const target = purchases.find(p => p.id === targetId || p.imei === targetId);
        if (target) {
          handleOpenPurchaseDetails(target);
          onClearParams?.();
        } else if (purchases.length > 0) {
          showError(new Error('Record unavailable'), 'This record is no longer available.');
          onClearParams?.();
        }
      } else {
        onClearParams?.();
      }
    }
  }, [initialParams, sales, purchases, loading]);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.customerName.trim() || !purchaseForm.model.trim() || !purchaseForm.imei.trim()) {
      setErrorMsg('Customer name, model, and IMEI are required.');
      return;
    }

    const cleanImei = purchaseForm.imei.trim().toLowerCase();
    const duplicate = purchases.find(
      p => p.imei.trim().toLowerCase() === cleanImei && p.status === 'in_stock'
    );
    if (duplicate) {
      setErrorMsg(
        `Device with IMEI "${purchaseForm.imei}" is already registered in active inventory (ID: ${duplicate.id}). Duplicate in-stock purchases are prevented.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const id = `purchase_${Date.now()}`;

      let aadhaarFrontUri: string | undefined = undefined;
      let aadhaarBackUri: string | undefined = undefined;
      let aadhaarFrontPublicId: string | undefined = undefined;
      let aadhaarBackPublicId: string | undefined = undefined;

      if (purchaseFrontFile) {
        try {
          const res = await CloudinaryService.uploadKycDocument(purchaseFrontFile, {
            folder: 'kyc',
            tags: ['pmc_kyc', 'aadhaar_front', purchaseForm.brand],
          });
          if (res.success && res.secureUrl) {
            aadhaarFrontUri = res.secureUrl;
            aadhaarFrontPublicId = res.publicId;
          }
        } catch (err) {
          console.warn('[Admin] Front Aadhaar upload error:', err);
        }
      }

      if (purchaseBackFile) {
        try {
          const res = await CloudinaryService.uploadKycDocument(purchaseBackFile, {
            folder: 'kyc',
            tags: ['pmc_kyc', 'aadhaar_back', purchaseForm.brand],
          });
          if (res.success && res.secureUrl) {
            aadhaarBackUri = res.secureUrl;
            aadhaarBackPublicId = res.publicId;
          }
        } catch (err) {
          console.warn('[Admin] Back Aadhaar upload error:', err);
        }
      }

      const payload: SecondHandPurchase = {
        id,
        customerName: purchaseForm.customerName.trim(),
        phone: purchaseForm.phone.trim(),
        address: purchaseForm.address.trim(),
        aadhaarNumber: purchaseForm.aadhaarNumber.trim(),
        rawAadhaarNumber: purchaseForm.aadhaarNumber.trim(),
        aadhaarFrontUri,
        aadhaarBackUri,
        aadhaarFrontPublicId,
        aadhaarBackPublicId,
        brand: purchaseForm.brand,
        model: purchaseForm.model.trim(),
        ram: purchaseForm.ram,
        storage: purchaseForm.storage,
        imei: purchaseForm.imei.trim(),
        condition: purchaseForm.condition,
        purchaseAmount: Number(purchaseForm.purchaseAmount),
        digitalSignatureUri: 'signature_stored_securely',
        purchaseDate: now.toISOString().slice(0, 10),
        purchaseTime: now.toTimeString().slice(0, 8),
        purchasedByStaffId: currentUser?.id || 'admin',
        purchasedByStaffName: currentUser?.name || 'Administrator',
        status: 'in_stock',
      };

      await ApiService.saveSecondHandPurchase(payload);
      showSuccess(`Recorded purchase of ${purchaseForm.brand} ${purchaseForm.model} into inventory.`);
      setPurchaseFrontFile(null);
      setPurchaseBackFile(null);
      setAddPurchaseModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record purchase.');
      showError(err, 'Failed to record purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.buyerName.trim() || !saleForm.model.trim() || !saleForm.imei.trim()) {
      setErrorMsg('Buyer name, model, and IMEI are required.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const id = `sale_${Date.now()}`;
      const profit = Number(saleForm.sellingAmount) - Number(saleForm.purchaseAmount);
      const margin =
        Number(saleForm.purchaseAmount) > 0
          ? Math.round((profit / Number(saleForm.purchaseAmount)) * 100)
          : 0;

      // Identify linked purchase record
      const inStockMatch = purchases.find(
        p => p.imei.trim().toLowerCase() === saleForm.imei.trim().toLowerCase() && p.status === 'in_stock'
      );
      const purchaseRecordId = saleForm.purchaseRecordId || inStockMatch?.id;

      let aadhaarPhotoUri: string | undefined = undefined;
      let aadhaarPhotoPublicId: string | undefined = undefined;

      if (saleAadhaarFile) {
        try {
          const res = await CloudinaryService.uploadKycDocument(saleAadhaarFile, {
            folder: 'kyc',
            tags: ['pmc_kyc', 'buyer_aadhaar', saleForm.brand],
          });
          if (res.success && res.secureUrl) {
            aadhaarPhotoUri = res.secureUrl;
            aadhaarPhotoPublicId = res.publicId;
          }
        } catch (err) {
          console.warn('[Admin] Buyer Aadhaar upload error:', err);
        }
      }

      const payload: SecondHandSale = {
        id,
        purchaseRecordId,
        buyerName: saleForm.buyerName.trim(),
        phone: saleForm.phone.trim(),
        address: saleForm.address.trim(),
        aadhaarNumber: saleForm.aadhaarNumber.trim(),
        rawAadhaarNumber: saleForm.aadhaarNumber.trim(),
        aadhaarPhotoUri,
        aadhaarPhotoPublicId,
        brand: saleForm.brand,
        model: saleForm.model.trim(),
        imei: saleForm.imei.trim(),
        purchaseAmount: Number(saleForm.purchaseAmount),
        sellingAmount: Number(saleForm.sellingAmount),
        profitAmount: profit,
        marginPercent: margin,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        digitalSignatureUri: 'signature_stored_securely',
        saleDate: now.toISOString().slice(0, 10),
        saleTime: now.toTimeString().slice(0, 8),
        soldByStaffId: currentUser?.id || 'admin',
        soldByStaffName: currentUser?.name || 'Administrator',
        paymentMethod: saleForm.paymentMethod,
        warrantyMonths: Number(saleForm.warrantyMonths),
      };

      await ApiService.saveSecondHandSale(payload);
      setSaleAadhaarFile(null);

      // If matched with in_stock purchase, update status to sold
      const matchedPurchase = purchases.find(p => p.imei === saleForm.imei && p.status === 'in_stock');
      if (matchedPurchase) {
        await ApiService.saveSecondHandPurchase({
          ...matchedPurchase,
          status: 'sold',
        });
      }

      showSuccess(`Recorded sale for ${saleForm.brand} ${saleForm.model}. Tax invoice created.`);
      setAddSaleModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record sale.');
      showError(err, 'Failed to record sale.');
    } finally {
      setSubmitting(false);
    }
  };

  const maskAadhaar = (num?: string) => {
    if (!num) return '—';
    const clean = num.replace(/\D/g, '');
    if (clean.length < 4) return '••••';
    return `•••• •••• ${clean.slice(-4)}`;
  };

  const filteredPurchases = useMemo(() => {
    const q = search.toLowerCase().trim();
    return purchases.filter(
      p =>
        !q ||
        p.customerName?.toLowerCase().includes(q) ||
        (p as any).sellerName?.toLowerCase().includes(q) ||
        (p as any).name?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.imei?.includes(q) ||
        p.phone?.includes(q)
    );
  }, [purchases, search]);

  const filteredSales = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sales.filter(
      s =>
        !q ||
        s.buyerName?.toLowerCase().includes(q) ||
        s.model?.toLowerCase().includes(q) ||
        s.imei?.includes(q) ||
        s.invoiceNumber?.toLowerCase().includes(q)
    );
  }, [sales, search]);

  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, currentPage, pageSize]);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  // Prepared Export Data
  const purchaseExportData = useMemo(() => {
    return filteredPurchases.map(p => ({
      Customer_Name: p.customerName || (p as any).sellerName || (p.hasSensitiveKyc ? 'Verified Seller (KYC)' : 'Name unavailable'),
      Phone: p.phone || (p as any).sellerPhone || '—',
      Brand: p.brand,
      Model: p.model,
      Variant: `${p.ram}/${p.storage}`,
      IMEI: p.imei,
      Condition: p.condition || 'Good',
      Purchase_Amount: p.purchaseAmount,
      Purchase_Date: p.purchaseDate,
      Masked_Aadhaar: maskAadhaar(p.aadhaarNumber),
      Status: p.status === 'in_stock' ? 'IN_STOCK' : 'SOLD',
    }));
  }, [filteredPurchases]);

  const saleExportData = useMemo(() => {
    return filteredSales.map(s => ({
      Invoice_Number: s.invoiceNumber,
      Buyer_Name: s.buyerName,
      Phone: s.phone,
      Brand: s.brand,
      Model: s.model,
      IMEI: s.imei,
      Cost_Price: s.purchaseAmount,
      Selling_Price: s.sellingAmount,
      Profit_Amount: s.profitAmount,
      Margin_Percent: `${s.marginPercent}%`,
      Payment_Method: s.paymentMethod,
      Warranty_Months: s.warrantyMonths,
      Sale_Date: s.saleDate,
      Staff_Name: s.soldByStaffName,
    }));
  }, [filteredSales]);

  const handleDownloadInvoice = (sale: SecondHandSale) => {
    generateSaleInvoicePdf(sale, shopConfig);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Card */}
      <Card noPadding>
        {/* Navigation Tabs */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('purchases');
              setCurrentPage(1);
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'purchases'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>In-Stock & Purchase Records</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'purchases'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {purchases.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('sales');
              setCurrentPage(1);
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'sales'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Sale Invoices & Tax Receipts</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'sales'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {sales.length}
            </span>
          </button>
        </div>

        {/* Filter & Action Row */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search IMEI, customer name, model..."
              icon={Search}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              onClear={() => setSearch('')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ExportDropdown
              data={activeTab === 'purchases' ? purchaseExportData : saleExportData}
              filename={activeTab === 'purchases' ? 'SecondHand_Purchases' : 'SecondHand_Sales'}
              sheetName={activeTab === 'purchases' ? 'Purchases' : 'Sales'}
              disabled={
                (activeTab === 'purchases' ? filteredPurchases.length : filteredSales.length) === 0
              }
            />

            {activeTab === 'purchases' ? (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setErrorMsg('');
                  setAddPurchaseModalOpen(true);
                }}
              >
                Record Purchase
              </Button>
            ) : (
              <Button
                variant="success"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setErrorMsg('');
                  setAddSaleModalOpen(true);
                }}
              >
                Record Sale
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={loadData}
              loading={loading}
              title="Refresh Data"
              className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
            />
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading second-hand records...</div>
        ) : activeTab === 'purchases' ? (
          filteredPurchases.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No Purchase Records Found"
                description="No pre-owned phone purchases recorded yet."
                icon={Smartphone}
                actionText="Record First Purchase"
                onAction={() => setAddPurchaseModalOpen(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs min-w-[880px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800 select-none">
                  <tr>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Device Model</th>
                    <th className="py-3 px-4">Device IMEI</th>
                    <th className="py-3 px-4">Purchase Cost</th>
                    <th className="py-3 px-4">Purchase Date</th>
                    <th className="py-3 px-4">Condition</th>
                    <th className="py-3 px-4">Inventory Status</th>
                    <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-800/95 z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedPurchases.map(p => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white leading-tight block">
                          {p.customerName || (p as any).sellerName || (p as any).name || (p.hasSensitiveKyc ? 'Verified Seller (KYC)' : 'Name unavailable')}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {p.phone || (p as any).sellerPhone || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {p.brand} {p.model}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {p.imei}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                        ₹{p.purchaseAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {p.purchaseDate}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {p.condition || 'Good'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={p.status === 'in_stock' ? 'primary' : 'neutral'}
                          size="xs"
                          dot
                        >
                          {p.status === 'in_stock' ? 'In Stock' : 'Sold'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                        <div className="inline-flex items-center justify-end">
                          <ActionButton
                            icon={Eye}
                            label="View Device & KYC Details"
                            onClick={() => handleOpenPurchaseDetails(p)}
                            variant="ghost"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredSales.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Sale Invoices Found"
              description="No second-hand sales have been finalized yet."
              icon={ShoppingBag}
              actionText="Record First Sale"
              onAction={() => setAddSaleModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Buyer Name</th>
                  <th className="py-3 px-4">Device & IMEI</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Gross Margin</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Sale Date</th>
                  <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-800/95 z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedSales.map(s => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-extrabold text-brand-600 dark:text-blue-400">
                      {s.invoiceNumber || s.id.slice(-8)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 dark:text-white leading-tight">
                        {s.buyerName}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{s.phone}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {s.brand} {s.model}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        IMEI: {s.imei}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                      ₹{s.sellingAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          +₹{s.profitAmount.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {s.marginPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="neutral" size="xs">
                        {s.paymentMethod}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {s.saleDate}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                      <div className="inline-flex items-center justify-end gap-1">
                        <ActionButton
                          icon={Download}
                          label="Download Tax Invoice PDF"
                          onClick={() => handleDownloadInvoice(s)}
                          variant="ghost"
                        />
                        <ActionButton
                          icon={Eye}
                          label="View Sale & KYC Details"
                          onClick={() => handleOpenSaleDetails(s)}
                          variant="ghost"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(activeTab === 'purchases' ? filteredPurchases.length : filteredSales.length) > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalItems={activeTab === 'purchases' ? filteredPurchases.length : filteredSales.length}
            pageSize={pageSize}
            onPageChange={page => setCurrentPage(page)}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      {/* Record Purchase Modal */}
      <Modal
        isOpen={addPurchaseModal}
        onClose={() => setAddPurchaseModalOpen(false)}
        title="Record Second-Hand Mobile Purchase"
        subtitle="Intake customer device into pre-owned inventory"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Seller / Customer Name"
              required
              value={purchaseForm.customerName}
              onChange={e => setPurchaseForm({ ...purchaseForm, customerName: e.target.value })}
              placeholder="e.g. Rahul Patel"
            />
            <Input
              label="Contact Number"
              value={purchaseForm.phone}
              onChange={e => setPurchaseForm({ ...purchaseForm, phone: e.target.value })}
              placeholder="10-digit mobile"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Brand"
              value={purchaseForm.brand}
              onChange={e => setPurchaseForm({ ...purchaseForm, brand: e.target.value })}
            >
              {['Apple', 'Samsung', 'OnePlus', 'Vivo', 'Oppo', 'Xiaomi', 'Realme', 'Other'].map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>

            <div className="sm:col-span-2">
              <Input
                label="Model Name"
                required
                value={purchaseForm.model}
                onChange={e => setPurchaseForm({ ...purchaseForm, model: e.target.value })}
                placeholder="e.g. iPhone 13 128GB Midnight"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Device IMEI"
              required
              value={purchaseForm.imei}
              onChange={e => setPurchaseForm({ ...purchaseForm, imei: e.target.value })}
              placeholder="15-digit IMEI number"
            />
            <Input
              label="Purchase Cost (₹)"
              type="number"
              required
              value={purchaseForm.purchaseAmount}
              onChange={e => setPurchaseForm({ ...purchaseForm, purchaseAmount: Number(e.target.value) })}
            />
            <Select
              label="Physical Condition"
              value={purchaseForm.condition}
              onChange={e => setPurchaseForm({ ...purchaseForm, condition: e.target.value })}
            >
              <option value="Like New (Mint)">Like New (Mint)</option>
              <option value="Good (Minor Scratches)">Good (Minor Scratches)</option>
              <option value="Fair (Visible Wear)">Fair (Visible Wear)</option>
              <option value="Screen Replaced">Screen Replaced</option>
            </Select>
          </div>

          <Input
            label="Aadhaar / Gov ID Number (Admin Encrypted)"
            value={purchaseForm.aadhaarNumber}
            onChange={e => setPurchaseForm({ ...purchaseForm, aadhaarNumber: e.target.value })}
            placeholder="12-digit Aadhaar number for KYC records"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Aadhaar Front Photo (Cloudinary)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setPurchaseFrontFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Aadhaar Back Photo (Cloudinary)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setPurchaseBackFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAddPurchaseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={submitting}
            >
              Record Purchase
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Sale Modal */}
      <Modal
        isOpen={addSaleModal}
        onClose={() => setAddSaleModalOpen(false)}
        title="Record Second-Hand Mobile Sale"
        subtitle="Generate sale receipt and mark in-stock phone as sold"
      >
        <form onSubmit={handleCreateSale} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Quick Select from Active Stock */}
          <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900">
            <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 mb-1.5">
              Select Device from Current In-Stock Inventory
            </label>
            <select
              value={saleForm.purchaseRecordId}
              onChange={e => {
                const selectedId = e.target.value;
                const matched = purchases.find(p => p.id === selectedId);
                if (matched) {
                  setSaleForm(prev => ({
                    ...prev,
                    purchaseRecordId: matched.id,
                    brand: matched.brand,
                    model: matched.model,
                    imei: matched.imei,
                    purchaseAmount: matched.purchaseAmount,
                    sellingAmount: Math.round(matched.purchaseAmount * 1.15),
                  }));
                } else {
                  setSaleForm(prev => ({ ...prev, purchaseRecordId: '' }));
                }
              }}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-xl text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">— Choose In-Stock Phone or Enter Manually Below —</option>
              {purchases
                .filter(p => p.status === 'in_stock')
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.brand} {p.model} ({p.storage || '128GB'}) • IMEI: {p.imei} • Cost: ₹
                    {p.purchaseAmount.toLocaleString('en-IN')}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Buyer / Customer Name"
              required
              value={saleForm.buyerName}
              onChange={e => setSaleForm({ ...saleForm, buyerName: e.target.value })}
              placeholder="e.g. Vikram Mehta"
            />
            <Input
              label="Buyer Mobile Number"
              value={saleForm.phone}
              onChange={e => setSaleForm({ ...saleForm, phone: e.target.value })}
              placeholder="10-digit mobile"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Brand"
              value={saleForm.brand}
              onChange={e => setSaleForm({ ...saleForm, brand: e.target.value })}
            />
            <div className="sm:col-span-2">
              <Input
                label="Model Name"
                required
                value={saleForm.model}
                onChange={e => setSaleForm({ ...saleForm, model: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Device IMEI"
              required
              value={saleForm.imei}
              onChange={e => setSaleForm({ ...saleForm, imei: e.target.value })}
            />
            <Input
              label="Cost Price (₹)"
              type="number"
              value={saleForm.purchaseAmount}
              onChange={e => setSaleForm({ ...saleForm, purchaseAmount: Number(e.target.value) })}
            />
            <Input
              label="Selling Price (₹)"
              type="number"
              required
              value={saleForm.sellingAmount}
              onChange={e => setSaleForm({ ...saleForm, sellingAmount: Number(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Payment Method"
              value={saleForm.paymentMethod}
              onChange={e => setSaleForm({ ...saleForm, paymentMethod: e.target.value as any })}
            >
              <option value="UPI">UPI / QR Code</option>
              <option value="Cash">Cash</option>
              <option value="Card">Debit / Credit Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </Select>

            <Input
              label="Store Warranty (Months)"
              type="number"
              value={saleForm.warrantyMonths}
              onChange={e => setSaleForm({ ...saleForm, warrantyMonths: Number(e.target.value) })}
            />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Buyer Aadhaar Card Photo (Cloudinary)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setSaleAadhaarFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAddSaleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
              loading={submitting}
            >
              Finalize Sale Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Purchase Modal */}
      <Modal
        isOpen={Boolean(viewPurchase)}
        onClose={() => {
          setViewPurchase(null);
          setViewPurchaseKyc(null);
        }}
        title="Purchase Record & KYC Verification"
        subtitle={viewPurchase && <span>Purchase ID: {viewPurchase.id}</span>}
      >
        {viewPurchase && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">Seller Details</span>
                <p className="font-bold text-xs mt-0.5">
                  {viewPurchaseKyc?.customerName || viewPurchase.customerName || 'Verified Customer'}
                </p>
                <p className="text-slate-500 text-xs">{viewPurchaseKyc?.phone || viewPurchase.phone || 'N/A'}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">Device Model</span>
                <p className="font-bold text-xs mt-0.5">
                  {viewPurchase.brand} {viewPurchase.model}
                </p>
                <p className="font-mono text-[10px] text-slate-500">IMEI: {viewPurchase.imei}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">Purchase Amount</span>
                <p className="text-base font-extrabold text-brand-600 dark:text-blue-400 mt-0.5">
                  ₹{viewPurchase.purchaseAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                  <Shield className="w-3 h-3 text-blue-600" />
                  <span>Aadhaar Card Number</span>
                </span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="font-mono text-xs font-extrabold text-slate-900 dark:text-white tracking-wide">
                    {viewPurchaseKyc?.rawAadhaarNumber || viewPurchaseKyc?.aadhaarNumber || viewPurchase.rawAadhaarNumber || viewPurchase.aadhaarNumber || 'Not Provided'}
                  </p>
                  {(viewPurchaseKyc?.rawAadhaarNumber || viewPurchaseKyc?.aadhaarNumber || viewPurchase.rawAadhaarNumber || viewPurchase.aadhaarNumber) && (
                    <button
                      type="button"
                      onClick={() => {
                        const raw = (viewPurchaseKyc?.rawAadhaarNumber || viewPurchaseKyc?.aadhaarNumber || viewPurchase.rawAadhaarNumber || viewPurchase.aadhaarNumber || '').replace(/\s+/g, '');
                        navigator.clipboard.writeText(raw);
                        showSuccess('Aadhaar number copied to clipboard');
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200"
                      title="Copy Aadhaar Number"
                    >
                      Copy
                    </button>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-emerald-600">
                  Verified Seller KYC • Cloudinary Stored
                </span>
              </div>
            </div>

            {/* Customer Aadhaar Card Photos (Front & Back) */}
            {(() => {
              const frontUri = viewPurchaseKyc?.aadhaarFrontUri || viewPurchase.aadhaarFrontUri || (viewPurchaseKyc as any)?.aadhaarPhotoFront || (viewPurchase as any)?.aadhaarPhotoFront || (viewPurchaseKyc as any)?.aadhaarCardPhotoUri || (viewPurchase as any)?.aadhaarCardPhotoUri;
              const backUri = viewPurchaseKyc?.aadhaarBackUri || viewPurchase.aadhaarBackUri || (viewPurchaseKyc as any)?.aadhaarPhotoBack || (viewPurchase as any)?.aadhaarPhotoBack;
              const frontPublicId = viewPurchaseKyc?.aadhaarFrontPublicId || viewPurchase.aadhaarFrontPublicId;
              const backPublicId = viewPurchaseKyc?.aadhaarBackPublicId || viewPurchase.aadhaarBackPublicId;

              return (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      Customer Aadhaar Card Photos (Front & Back)
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                      Cloudinary CDN & Firebase ID
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Front Photo */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Aadhaar Front Side</span>
                        {frontPublicId && (
                          <span className="text-[9px] font-mono text-slate-400 truncate max-w-[130px]" title={frontPublicId}>
                            ID: {frontPublicId.split('/').pop()}
                          </span>
                        )}
                      </div>
                      {frontUri ? (
                        <div
                          onClick={() => setPreviewPhoto({ url: frontUri, title: `${viewPurchase.customerName || 'Customer'} - Aadhaar Front Side`, publicId: frontPublicId })}
                          className="group relative aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 cursor-pointer hover:border-blue-500 transition-all shadow-sm"
                        >
                          <img
                            src={frontUri}
                            alt="Aadhaar Front Side"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                            <Eye className="w-4 h-4" />
                            <span>Inspect Full Photo</span>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-[16/10] rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center bg-white dark:bg-slate-800/40">
                          <Shield className="w-5 h-5 mb-1 text-slate-300 dark:text-slate-600" />
                          <span>Front photo not recorded</span>
                        </div>
                      )}
                    </div>

                    {/* Back Photo */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Aadhaar Back Side</span>
                        {backPublicId && (
                          <span className="text-[9px] font-mono text-slate-400 truncate max-w-[130px]" title={backPublicId}>
                            ID: {backPublicId.split('/').pop()}
                          </span>
                        )}
                      </div>
                      {backUri ? (
                        <div
                          onClick={() => setPreviewPhoto({ url: backUri, title: `${viewPurchase.customerName || 'Customer'} - Aadhaar Back Side`, publicId: backPublicId })}
                          className="group relative aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 cursor-pointer hover:border-blue-500 transition-all shadow-sm"
                        >
                          <img
                            src={backUri}
                            alt="Aadhaar Back Side"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                            <Eye className="w-4 h-4" />
                            <span>Inspect Full Photo</span>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-[16/10] rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center bg-white dark:bg-slate-800/40">
                          <Shield className="w-5 h-5 mb-1 text-slate-300 dark:text-slate-600" />
                          <span>Back photo not recorded</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Device Inspection Photos Gallery */}
            {(() => {
              let inspectionPhotos = (viewPurchase.deviceInspectionPhotos || viewPurchase.devicePhotos) || [];
              if (inspectionPhotos.length === 0 && viewPurchaseKyc?.customerPhotoUri) {
                try {
                  if (viewPurchaseKyc.customerPhotoUri.startsWith('[')) {
                    inspectionPhotos = JSON.parse(viewPurchaseKyc.customerPhotoUri);
                  } else if (viewPurchaseKyc.customerPhotoUri.startsWith('http')) {
                    inspectionPhotos = [viewPurchaseKyc.customerPhotoUri];
                  }
                } catch {}
              }
              const billUri = viewPurchase.billImageUri || viewPurchaseKyc?.billImageUri;

              return (
                <>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-brand-600" />
                        Device Inspection Photos ({inspectionPhotos.length})
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                        Cloudinary CDN
                      </span>
                    </div>

                    {inspectionPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {inspectionPhotos.map((imgUrl, idx) => (
                          <a
                            key={idx}
                            href={imgUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:opacity-90 transition-opacity"
                          >
                            <img
                              src={CloudinaryService.getDeviceThumbnailUrl(imgUrl)}
                              alt={`Inspection #${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                              View Full
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No inspection photos attached to this device.</p>
                    )}
                  </div>

                  {/* Bill Image if attached */}
                  {billUri && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                        <FileText className="w-3.5 h-3.5 text-brand-600" />
                        Original Purchase Bill
                      </span>
                      <a
                        href={billUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-brand-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Original Bill on CDN
                      </a>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* View Sale Modal / Interactive Tax Invoice Preview */}
      <Modal
        isOpen={Boolean(viewSale)}
        onClose={() => {
          setViewSale(null);
          setViewSaleKyc(null);
        }}
        title="Tax Invoice / Sales Receipt"
        subtitle={viewSale && <span>Invoice No: {viewSale.invoiceNumber}</span>}
        size="3xl"
      >
        {viewSale && (
          <div className="space-y-4">
            {/* Modal Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  Official Retail Receipt
                </Badge>
                <Badge variant="success" size="sm">
                  PAID • {viewSale.paymentMethod?.toUpperCase()}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Printer}
                  onClick={() => window.print()}
                  title="Print this invoice directly"
                >
                  Print
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={() => handleDownloadInvoice(viewSale)}
                  title="Download Official Tax Invoice PDF"
                >
                  Download PDF
                </Button>
              </div>
            </div>

            {/* Buyer KYC & Aadhaar Verification Section for Admin */}
            {(() => {
              const buyerAadhaarNum = viewSaleKyc?.rawAadhaarNumber || viewSaleKyc?.aadhaarNumber || viewSale.rawAadhaarNumber || viewSale.aadhaarNumber;
              const buyerAadhaarPhoto = viewSaleKyc?.aadhaarPhotoUri || viewSale.aadhaarPhotoUri;
              const buyerPhoto = viewSaleKyc?.buyerPhotoUri || viewSale.buyerPhotoUri;
              const buyerAadhaarPublicId = viewSaleKyc?.aadhaarPhotoPublicId || viewSale.aadhaarPhotoPublicId;

              return (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      Buyer KYC & Aadhaar Verification
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Cloudinary Stored • Firebase Indexed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Buyer Aadhaar Number</span>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className="font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                          {buyerAadhaarNum || 'Verified by Store'}
                        </p>
                        {buyerAadhaarNum && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(buyerAadhaarNum.replace(/\s+/g, ''));
                              showSuccess('Buyer Aadhaar copied');
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800"
                            title="Copy Aadhaar"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">Full Unmasked Identity Proof</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Buyer Aadhaar Photo & Identification
                      </span>
                      <div className="flex items-center gap-3">
                        {buyerAadhaarPhoto ? (
                          <div
                            onClick={() => setPreviewPhoto({ url: buyerAadhaarPhoto, title: `${viewSale.buyerName} - Buyer Aadhaar Card`, publicId: buyerAadhaarPublicId })}
                            className="group relative h-16 aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-100 dark:bg-slate-800 hover:border-emerald-500 transition-all shrink-0"
                          >
                            <img src={buyerAadhaarPhoto} alt="Buyer Aadhaar" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                              Inspect
                            </div>
                          </div>
                        ) : (
                          <div className="h-16 aspect-[16/10] rounded-lg border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 text-[10px] p-2 text-center bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                            <Shield className="w-4 h-4 mb-0.5 text-slate-300 dark:text-slate-600" />
                            <span>No photo</span>
                          </div>
                        )}

                        {buyerPhoto && (
                          <div
                            onClick={() => setPreviewPhoto({ url: buyerPhoto, title: `${viewSale.buyerName} - Customer Photo` })}
                            className="group relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-100 dark:bg-slate-800 hover:border-emerald-500 transition-all shrink-0"
                          >
                            <img src={buyerPhoto} alt="Buyer Photo" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                              Photo
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-slate-500 space-y-0.5 min-w-0">
                          {buyerAadhaarPublicId ? (
                            <p className="font-mono text-[10px] text-slate-400 truncate max-w-[200px]" title={buyerAadhaarPublicId}>
                              Cloudinary ID: {buyerAadhaarPublicId}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400">
                              Cloudinary: {buyerAadhaarPhoto ? 'Uploaded' : 'Pending'}
                            </p>
                          )}
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Accessible to Admin for statutory verification
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Printable Standard Retail Invoice Container (White Surface) */}
            <div className="bg-white rounded-xl border border-slate-200 text-slate-800 overflow-hidden shadow-sm print:border-none print:shadow-none">
              <div className="p-6 sm:p-8 space-y-5">
                {/* 1. Standard Invoice Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-300">
                  {/* Left: Store Information */}
                  <div className="space-y-1 max-w-sm">
                    <h2 className="text-xl font-bold text-[#194D9C] tracking-tight uppercase">
                      {shopConfig?.shopName || 'Parth Mobile Care'}
                    </h2>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {shopConfig?.shopAddress ||
                        '4, Jay Jagnath Complex, Opp. New Laxmi Dairy, Virat Nagar Road, Odhav, Ahmedabad, Gujarat 382415'}
                    </p>
                    <div className="text-xs text-slate-500 pt-0.5 space-x-2">
                      <span>Phone: {shopConfig?.phone || '+91 98765 43210'}</span>
                      <span>| Email: {shopConfig?.email || 'parthmobilecare07@gmail.com'}</span>
                    </div>
                    {shopConfig?.gstNumber &&
                      shopConfig.gstNumber.trim().length >= 8 &&
                      !shopConfig.gstNumber.toUpperCase().includes('ABCDE') && (
                        <p className="text-xs font-semibold text-slate-700">
                          GSTIN: {shopConfig.gstNumber.trim()}
                        </p>
                      )}
                  </div>

                  {/* Right: Tax Invoice / Cash Memo Meta */}
                  <div className="text-left sm:text-right space-y-1 shrink-0">
                    <h3 className="text-base font-bold text-[#194D9C] tracking-tight">
                      TAX INVOICE / CASH MEMO
                    </h3>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <p>
                        Invoice No:{' '}
                        <span className="font-bold text-slate-900 font-mono">
                          {viewSale.invoiceNumber}
                        </span>
                      </p>
                      <p>
                        Invoice Date:{' '}
                        <span className="text-slate-800 font-medium">{viewSale.saleDate}</span>
                      </p>
                      {viewSale.saleTime && (
                        <p>
                          Invoice Time:{' '}
                          <span className="text-slate-800 font-medium">{viewSale.saleTime}</span>
                        </p>
                      )}
                      <p>
                        Payment Status:{' '}
                        <span className="font-semibold text-emerald-700">
                          Paid ({viewSale.paymentMethod || 'Cash'})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Customer and Seller Information (Clean 2-Column Layout, No Decorative Boxes) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-3 border-b border-slate-200">
                  {/* Left: BILL TO */}
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-[#194D9C] uppercase tracking-wider text-[11px]">
                      BILL TO
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {viewSale.buyerName || 'Valued Customer'}
                    </p>
                    <p className="text-slate-700">
                      Mobile: <span className="font-medium text-slate-900">{viewSale.phone || '—'}</span>
                    </p>
                    <p className="text-slate-500 leading-snug">
                      Address: {viewSale.address || 'In-Store Counter Purchase / Walk-In'}
                    </p>
                  </div>

                  {/* Right: SOLD BY */}
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-[#194D9C] uppercase tracking-wider text-[11px]">
                      SOLD BY
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {viewSale.soldByStaffName || 'Store Executive'}
                    </p>
                    <p className="text-slate-700 font-mono">
                      Staff ID:{' '}
                      <span className="font-sans font-medium text-slate-900">
                        {viewSale.soldByStaffId && viewSale.soldByStaffId.length > 15
                          ? `PMC-STF-${viewSale.soldByStaffId.slice(-4).toUpperCase()}`
                          : (viewSale.soldByStaffId || 'admin')}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      Store: {shopConfig?.shopName || 'Parth Mobile Care'}
                    </p>
                  </div>
                </div>

                {/* 3. Product Details Table */}
                <div className="border border-slate-300 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[520px]">
                    <thead className="bg-[#F5F8FC] border-b border-slate-300 text-slate-800 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-14 text-center border-r border-slate-200">Sr. No.</th>
                        <th className="py-2.5 px-4 border-r border-slate-200">Product Description</th>
                        <th className="py-2.5 px-4 border-r border-slate-200">IMEI / Serial No.</th>
                        <th className="py-2.5 px-3 w-14 text-center border-r border-slate-200">Qty</th>
                        <th className="py-2.5 px-3 w-24 text-right border-r border-slate-200">Rate</th>
                        <th className="py-2.5 px-4 w-28 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-3 px-3 text-center text-slate-700 border-r border-slate-200">1</td>
                        <td className="py-3 px-4 border-r border-slate-200">
                          <p className="font-bold text-slate-900">
                            {viewSale.brand} {viewSale.model}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {viewSale.ram ? `${viewSale.ram} / ` : ''}
                            {viewSale.storage || ''}
                            {viewSale.warrantyMonths ? ` • Warranty: ${viewSale.warrantyMonths} Months` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-800 border-r border-slate-200">
                          {viewSale.imei || '—'}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-800 border-r border-slate-200">1</td>
                        <td className="py-3 px-3 text-right text-slate-800 border-r border-slate-200">
                          {Number(viewSale.sellingAmount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {Number(viewSale.sellingAmount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. Invoice Calculation Summary & Amount in Words */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-1 items-start">
                  {/* Left: Amount in Words */}
                  <div className="md:col-span-7 space-y-1 text-xs">
                    <p className="font-bold text-slate-700">Amount in Words:</p>
                    <p className="text-slate-600 italic leading-relaxed">
                      {numberToWordsIndian(viewSale.sellingAmount)}
                    </p>
                  </div>

                  {/* Right: Calculations */}
                  <div className="md:col-span-5 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-slate-900">
                        INR {Number(viewSale.sellingAmount).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable Value / GST:</span>
                      <span className="text-slate-700">Inclusive (Margin Scheme)</span>
                    </div>

                    <div className="pt-2 border-t border-b border-slate-300 py-1.5 flex justify-between items-center">
                      <span className="font-bold text-sm text-[#194D9C]">TOTAL AMOUNT:</span>
                      <span className="text-base font-extrabold text-[#194D9C]">
                        INR {Number(viewSale.sellingAmount).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 text-right">
                      Payment Method: {viewSale.paymentMethod || 'Cash'} (Completed)
                    </p>
                  </div>
                </div>

                {/* 5. Terms & Signatory */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-6 items-end">
                  {/* Left: Terms and Conditions */}
                  <div className="sm:col-span-8 space-y-1 text-[11px]">
                    <p className="font-bold text-slate-700">Terms & Conditions:</p>
                    <ol className="text-slate-500 space-y-0.5 list-decimal list-inside leading-snug">
                      <li>Warranty covers internal hardware defects only for the specified period from sale date.</li>
                      <li>Physical damage, screen breakage, liquid logging, and unauthorized repair void warranty.</li>
                      <li>Original tax invoice must be presented for any warranty evaluation or servicing.</li>
                      <li>Goods once sold will not be returned or exchanged.</li>
                    </ol>
                  </div>

                  {/* Right: Authorized Signatory */}
                  <div className="sm:col-span-4 text-center sm:text-right space-y-6">
                    <p className="text-xs font-bold text-slate-800">
                      For {shopConfig?.shopName || 'Parth Mobile Care'}
                    </p>
                    <div>
                      <div className="w-36 ml-auto border-b border-slate-400 pb-1" />
                      <p className="text-[11px] text-slate-600 mt-1">Authorized Signatory</p>
                    </div>
                  </div>
                </div>

                {/* 6. Bottom Computer-Generated Notice */}
                <div className="pt-2 text-center text-[10px] text-slate-400 border-t border-slate-100 flex justify-between">
                  <span>This is a computer-generated tax invoice issued by Parth Mobile Care.</span>
                  <span>Page 1 of 1</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* High-Resolution Document Inspection Modal */}
      {previewPhoto && (
        <Modal
          isOpen={Boolean(previewPhoto)}
          onClose={() => setPreviewPhoto(null)}
          title={previewPhoto.title}
          subtitle={previewPhoto.publicId ? `Cloudinary Public ID: ${previewPhoto.publicId}` : 'High-Resolution KYC Inspection'}
          size="2xl"
        >
          <div className="space-y-3">
            <div className="max-h-[70vh] overflow-auto rounded-xl bg-slate-950 flex items-center justify-center p-2 border border-slate-800">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[65vh] w-auto object-contain rounded"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="font-mono text-slate-400 text-[11px] truncate max-w-md">
                {previewPhoto.url}
              </span>
              <a
                href={previewPhoto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-semibold text-xs border border-blue-200 dark:border-blue-900"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Full Size in New Tab
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
