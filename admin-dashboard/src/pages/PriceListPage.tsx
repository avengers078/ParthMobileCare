import React, { useEffect, useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  TrendingUp,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Upload,
  FileSpreadsheet,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { ApiService } from '../services/api';
import {
  Modal,
  Badge,
  ConfirmDialog,
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
import { useToast } from '../context/ToastContext';
import { exportToExcel, parseExcelFile } from '../utils/exportUtils';
import { MobilePriceItem } from '../types';

export const PriceListPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [prices, setPrices] = useState<MobilePriceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmPrice, setDeleteConfirmPrice] = useState<MobilePriceItem | null>(null);
  const [historyModalItem, setHistoryModalItem] = useState<MobilePriceItem | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<MobilePriceItem | null>(null);

  // Import Modal states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<MobilePriceItem[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    brand: 'Vivo',
    model: '',
    ram: '8GB',
    storage: '128GB',
    purchasePrice: 20000,
    sellingPrice: 22999,
    inStock: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const BRANDS = ['all', 'Vivo', 'Oppo', 'Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Realme', 'Motorola'];

  const loadPrices = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getMobilePrices();
      setPrices(data);
    } catch (err) {
      console.warn('Price list load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrices();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      brand: 'Vivo',
      model: '',
      ram: '8GB',
      storage: '128GB',
      purchasePrice: 20000,
      sellingPrice: 22999,
      inStock: true,
    });
    setErrorMsg('');
    setAddModalOpen(true);
  };

  const handleSaveNewPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.model.trim()) {
      setErrorMsg('Model name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const newId = `price_${formData.brand.toLowerCase()}_${formData.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

      const payload: MobilePriceItem = {
        id: newId,
        brand: formData.brand,
        model: formData.model.trim(),
        ram: formData.ram.trim(),
        storage: formData.storage.trim(),
        purchasePrice: Number(formData.purchasePrice),
        sellingPrice: Number(formData.sellingPrice),
        inStock: formData.inStock,
        updatedAt: now,
        priceHistory: [
          {
            date: now.slice(0, 10),
            purchasePrice: Number(formData.purchasePrice),
            sellingPrice: Number(formData.sellingPrice),
            updatedBy: currentUser?.name || 'Administrator',
          },
        ],
      };

      await ApiService.saveMobilePrice(payload);
      showSuccess('Price item added to catalog.');
      setAddModalOpen(false);
      await loadPrices();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save price item.');
      showError(err, 'Failed to save price item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (item: MobilePriceItem) => {
    setSelectedPrice(item);
    setFormData({
      brand: item.brand,
      model: item.model,
      ram: item.ram || '8GB',
      storage: item.storage || '128GB',
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      inStock: item.inStock !== false,
    });
    setErrorMsg('');
    setEditModalOpen(true);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrice) return;

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const updatedHistory = [...(selectedPrice.priceHistory || [])];

      if (
        formData.purchasePrice !== selectedPrice.purchasePrice ||
        formData.sellingPrice !== selectedPrice.sellingPrice
      ) {
        updatedHistory.unshift({
          date: now.slice(0, 10),
          purchasePrice: Number(formData.purchasePrice),
          sellingPrice: Number(formData.sellingPrice),
          updatedBy: currentUser?.name || 'Administrator',
        });
      }

      const updatedPayload: MobilePriceItem = {
        ...selectedPrice,
        brand: formData.brand,
        model: formData.model.trim(),
        ram: formData.ram.trim(),
        storage: formData.storage.trim(),
        purchasePrice: Number(formData.purchasePrice),
        sellingPrice: Number(formData.sellingPrice),
        inStock: formData.inStock,
        updatedAt: now,
        priceHistory: updatedHistory.slice(0, 30),
      };

      await ApiService.saveMobilePrice(updatedPayload);
      showSuccess('Price item updated successfully.');
      setEditModalOpen(false);
      await loadPrices();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update price item.');
      showError(err, 'Failed to update price item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrice = async () => {
    if (!deleteConfirmPrice) return;
    setSubmitting(true);
    try {
      await ApiService.deleteMobilePrice(deleteConfirmPrice.id);
      await ApiService.logAdminAction({
        adminId: currentUser?.id || 'admin',
        adminName: currentUser?.name || 'Administrator',
        actionType: 'price_item_deleted',
        targetRecordId: deleteConfirmPrice.id,
        targetRecordTitle: `${deleteConfirmPrice.brand} ${deleteConfirmPrice.model}`,
        details: `Deleted price item with selling price ₹${deleteConfirmPrice.sellingPrice}`,
      });
      showSuccess('Price item removed from catalog.');
      setDeleteConfirmPrice(null);
      await loadPrices();
    } catch (err: any) {
      showError(err, 'Failed to delete price item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportFileName(file.name);
    try {
      const rawRows = await parseExcelFile(file);
      if (rawRows.length === 0) {
        setImportError('The selected spreadsheet contains no data rows.');
        return;
      }

      const now = new Date().toISOString();
      const parsed: MobilePriceItem[] = rawRows
        .map((row, idx) => {
          const brand = row.Brand || row.brand || row.BRAND || 'Vivo';
          const model = row.Model || row.model || row.MODEL || row['Model Name'] || '';
          const ram = String(row.RAM || row.ram || row.Ram || '8GB');
          const storage = String(row.Storage || row.storage || row.STORAGE || '128GB');
          const purchasePrice = Number(row['Purchase Price'] || row.purchasePrice || row.cost || row.Purchase || 0);
          const sellingPrice = Number(row['Selling Price'] || row.sellingPrice || row.mop || row.Price || row.Selling || 0);
          const inStock = String(row.Stock || row.inStock || row['In Stock'] || 'YES').toUpperCase() !== 'NO';

          if (!model) return null;

          return {
            id: `price_${String(brand).toLowerCase()}_${String(model).toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${idx}`,
            brand: String(brand).trim(),
            model: String(model).trim(),
            ram: ram.trim(),
            storage: storage.trim(),
            purchasePrice,
            sellingPrice,
            inStock,
            updatedAt: now,
            priceHistory: [
              {
                date: now.slice(0, 10),
                purchasePrice,
                sellingPrice,
                updatedBy: currentUser?.name || 'Admin',
              },
            ],
          };
        })
        .filter(Boolean) as MobilePriceItem[];

      if (parsed.length === 0) {
        setImportError('Could not find valid rows with "Brand" and "Model" columns.');
        return;
      }

      setImportRows(parsed);
    } catch (err: any) {
      setImportError('Failed to parse spreadsheet: ' + (err?.message || 'Invalid format'));
    }
  };

  const handleExecuteImport = async () => {
    if (importRows.length === 0) return;
    setImportLoading(true);
    setImportError('');
    try {
      for (const item of importRows) {
        await ApiService.saveMobilePrice(item);
      }
      await ApiService.logAdminAction({
        adminId: currentUser?.id || 'admin',
        adminName: currentUser?.name || 'Administrator',
        actionType: 'price_bulk_imported',
        targetRecordId: 'catalog',
        targetRecordTitle: `Imported ${importRows.length} models`,
        details: `Imported from ${importFileName}`,
      });
      setImportModalOpen(false);
      setImportRows([]);
      setImportFileName('');
      await loadPrices();
    } catch (err: any) {
      setImportError('Import failed: ' + (err?.message || 'Error saving items'));
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadSampleTemplate = () => {
    const sampleRows = [
      {
        Brand: 'Vivo',
        Model: 'V50',
        RAM: '8GB',
        Storage: '128GB',
        'Purchase Price': 20000,
        'Selling Price': 22999,
        'In Stock': 'YES',
      },
      {
        Brand: 'Samsung',
        Model: 'Galaxy A35 5G',
        RAM: '8GB',
        Storage: '256GB',
        'Purchase Price': 26000,
        'Selling Price': 28999,
        'In Stock': 'YES',
      },
      {
        Brand: 'Apple',
        Model: 'iPhone 16',
        RAM: '8GB',
        Storage: '128GB',
        'Purchase Price': 71000,
        'Selling Price': 77900,
        'In Stock': 'YES',
      },
    ];
    exportToExcel(sampleRows, 'Mobile_Price_Import_Template', 'Template');
  };

  const filtered = useMemo(() => {
    return prices.filter(p => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.model?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.ram?.toLowerCase().includes(q) ||
        p.storage?.toLowerCase().includes(q);

      const matchBrand = selectedBrand === 'all' || p.brand?.toLowerCase() === selectedBrand.toLowerCase();

      return matchSearch && matchBrand;
    });
  }, [prices, search, selectedBrand]);

  const paginatedPrices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Export prepared data
  const exportData = useMemo(() => {
    return filtered.map(p => ({
      Brand: p.brand,
      Model: p.model,
      RAM: p.ram,
      Storage: p.storage,
      Purchase_Price: p.purchasePrice,
      Selling_Price: p.sellingPrice,
      Margin_Amount: p.sellingPrice - p.purchasePrice,
      Margin_Percent: `${p.purchasePrice > 0 ? Math.round(((p.sellingPrice - p.purchasePrice) / p.purchasePrice) * 100) : 0}%`,
      In_Stock: p.inStock ? 'YES' : 'NO',
      Last_Updated: p.updatedAt ? p.updatedAt.slice(0, 10) : '—',
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Controls Card */}
      <Card noPadding>
        {/* Brand Tabs */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-1.5 overflow-x-auto">
          {BRANDS.map(brand => {
            const count =
              brand === 'all'
                ? prices.length
                : prices.filter(p => p.brand.toLowerCase() === brand.toLowerCase()).length;
            const active = selectedBrand === brand;
            return (
              <button
                key={brand}
                onClick={() => {
                  setSelectedBrand(brand);
                  setCurrentPage(1);
                }}
                className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{brand === 'all' ? 'All Brands' : brand}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search model, RAM, storage..."
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
            <Button
              variant="outline"
              size="sm"
              icon={Upload}
              onClick={() => {
                setImportRows([]);
                setImportFileName('');
                setImportError('');
                setImportModalOpen(true);
              }}
            >
              Import Excel
            </Button>

            <ExportDropdown
              data={exportData}
              filename={`Mobile_Price_Catalog_${selectedBrand}`}
              sheetName="Prices"
              disabled={filtered.length === 0}
            />

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenAdd}
            >
              Add Device Price
            </Button>

            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={loadPrices}
              loading={loading}
              title="Refresh Prices"
              className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
            />
          </div>
        </div>

        {/* Informational Callout */}
        <div className="px-5 py-2.5 bg-blue-50/50 dark:bg-blue-950/20 border-t border-b border-blue-100/60 dark:border-blue-900/40 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-brand-500 shrink-0" />
            <span>
              <strong>MOP (Maximum Offer Price)</strong> is the customer-facing retail price synchronized directly to the staff app. Margin is calculated in real time against purchase cost.
            </span>
          </div>
        </div>

        {/* Prices Table */}
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Device Prices Found"
              description="No mobile models match your selected brand filter or search term."
              actionText="Add New Device"
              onAction={handleOpenAdd}
            />
          </div>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4">Brand & Model</th>
                  <th className="py-3 px-4">Variant (RAM/ROM)</th>
                  <th className="py-3 px-4">Purchase Cost</th>
                  <th className="py-3 px-4">Retail Price (MOP)</th>
                  <th className="py-3 px-4">Profit Margin</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-800/95 z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedPrices.map(item => {
                  const margin = item.sellingPrice - item.purchasePrice;
                  const marginPct =
                    item.purchasePrice > 0 ? Math.round((margin / item.purchasePrice) * 100) : 0;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.brand} {item.model}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Updated: {item.updatedAt?.slice(0, 10) || '—'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                        {item.ram} / {item.storage}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300">
                        ₹{item.purchasePrice.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                        ₹{item.sellingPrice.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            +₹{margin.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {marginPct}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={item.inStock ? 'success' : 'neutral'} size="xs" dot>
                          {item.inStock ? 'In Stock' : 'Out of Stock'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                        <div className="inline-flex items-center justify-end gap-1">
                          {item.priceHistory && item.priceHistory.length > 0 && (
                            <ActionButton
                              icon={History}
                              label="Price Revision History"
                              onClick={() => setHistoryModalItem(item)}
                              variant="ghost"
                            />
                          )}

                          <ActionButton
                            icon={Edit2}
                            label="Edit Price Item"
                            onClick={() => handleOpenEdit(item)}
                            variant="ghost"
                          />

                          <ActionButton
                            icon={Trash2}
                            label="Delete Price Item"
                            onClick={() => setDeleteConfirmPrice(item)}
                            variant="danger"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={page => setCurrentPage(page)}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      {/* Add Price Item Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Device Price to Catalog"
        subtitle="Catalog a new smartphone model with purchase cost and retail MOP"
      >
        <form onSubmit={handleSaveNewPrice} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Brand"
              value={formData.brand}
              onChange={e => setFormData({ ...formData, brand: e.target.value })}
            >
              {['Vivo', 'Oppo', 'Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Realme', 'Motorola', 'Other'].map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>

            <Input
              label="Model Name"
              required
              value={formData.model}
              onChange={e => setFormData({ ...formData, model: e.target.value })}
              placeholder="e.g. V50 Pro 5G"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="RAM"
              value={formData.ram}
              onChange={e => setFormData({ ...formData, ram: e.target.value })}
              placeholder="e.g. 8GB"
            />
            <Input
              label="Storage"
              value={formData.storage}
              onChange={e => setFormData({ ...formData, storage: e.target.value })}
              placeholder="e.g. 256GB"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Purchase Cost (₹)"
              type="number"
              value={formData.purchasePrice}
              onChange={e => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
            />
            <Input
              label="Selling Price / MOP (₹)"
              type="number"
              value={formData.sellingPrice}
              onChange={e => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
            />
          </div>

          {/* Live Margin Calculation Preview */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Estimated Gross Margin:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              ₹{(formData.sellingPrice - formData.purchasePrice).toLocaleString('en-IN')}{' '}
              ({formData.purchasePrice > 0
                ? Math.round(
                    ((formData.sellingPrice - formData.purchasePrice) / formData.purchasePrice) * 100
                  )
                : 0}
              %)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="inStockCheck"
              checked={formData.inStock}
              onChange={e => setFormData({ ...formData, inStock: e.target.checked })}
              className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-slate-300"
            />
            <label htmlFor="inStockCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              In Stock / Available for Sale
            </label>
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={submitting}
            >
              Save Price Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Price Item Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Update Device Price"
        subtitle={selectedPrice && <span>Item ID: {selectedPrice.id}</span>}
      >
        <form onSubmit={handleUpdatePrice} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Brand"
              value={formData.brand}
              onChange={e => setFormData({ ...formData, brand: e.target.value })}
            >
              {['Vivo', 'Oppo', 'Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Realme', 'Motorola', 'Other'].map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>

            <Input
              label="Model Name"
              required
              value={formData.model}
              onChange={e => setFormData({ ...formData, model: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="RAM"
              value={formData.ram}
              onChange={e => setFormData({ ...formData, ram: e.target.value })}
            />
            <Input
              label="Storage"
              value={formData.storage}
              onChange={e => setFormData({ ...formData, storage: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Purchase Cost (₹)"
              type="number"
              value={formData.purchasePrice}
              onChange={e => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
            />
            <Input
              label="Selling Price / MOP (₹)"
              type="number"
              value={formData.sellingPrice}
              onChange={e => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="editInStockCheck"
              checked={formData.inStock}
              onChange={e => setFormData({ ...formData, inStock: e.target.checked })}
              className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-slate-300"
            />
            <label htmlFor="editInStockCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              In Stock / Available for Sale
            </label>
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={submitting}
            >
              Update Price
            </Button>
          </div>
        </form>
      </Modal>

      {/* Price Revision History Modal */}
      <Modal
        isOpen={Boolean(historyModalItem)}
        onClose={() => setHistoryModalItem(null)}
        title="Price Revision History"
        subtitle={historyModalItem && <span>{historyModalItem.brand} {historyModalItem.model} ({historyModalItem.ram}/{historyModalItem.storage})</span>}
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Audit history of past price revisions and updates for this device.
          </p>

          <div className="divide-y divide-slate-100 dark:divide-[#24344D] border border-slate-100 dark:border-[#24344D] rounded-xl overflow-hidden">
            {historyModalItem?.priceHistory?.map((entry, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between text-xs bg-white dark:bg-[#0F192C]">
                <div>
                  <p className="font-bold text-slate-900 dark:text-[#E8EEF8]">
                    ₹{entry.sellingPrice.toLocaleString('en-IN')}{' '}
                    <span className="text-[11px] text-slate-400 font-normal">
                      (Cost: ₹{entry.purchasePrice.toLocaleString('en-IN')})
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Updated by {entry.updatedBy || 'Administrator'}
                  </p>
                </div>
                <Badge variant="neutral" size="xs">
                  {entry.date}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Bulk Excel Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Bulk Import Mobile Prices from Excel"
        subtitle="Upload an Excel file (.xlsx) containing price catalog rows"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between">
            <div>
              <p className="font-bold">Required Columns:</p>
              <p className="text-[11px] mt-0.5">Brand, Model, RAM, Storage, Purchase Price, Selling Price, In Stock</p>
            </div>
            <Button
              variant="outline"
              size="xs"
              icon={Download}
              onClick={handleDownloadSampleTemplate}
            >
              Sample Template
            </Button>
          </div>

          {importError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {importError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Spreadsheet File (.xlsx, .xls)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>

          {importRows.length > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
              <span className="font-bold">✓ Parsed {importRows.length} valid models ready for import.</span>
            </div>
          )}

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={importRows.length === 0}
              loading={importLoading}
              onClick={handleExecuteImport}
            >
              Import {importRows.length} Models
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmPrice)}
        onClose={() => setDeleteConfirmPrice(null)}
        onConfirm={handleDeletePrice}
        title="Delete Mobile Price Item"
        message={
          deleteConfirmPrice && (
            <span>
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 dark:text-white">
                {deleteConfirmPrice.brand} {deleteConfirmPrice.model}
              </strong>{' '}
              from the price catalog?
            </span>
          )
        }
        confirmText="Delete Price Item"
        isDestructive
        loading={submitting}
      />
    </div>
  );
};
