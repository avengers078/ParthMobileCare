import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  Button,
  PrimaryButton,
  Input,
  SearchInput,
  FilterChip,
  ModalCard,
  EmptyState,
  ExcelImportModal,
  AppIcon,
} from '../components';
import { MobilePriceItem } from '../types';
import { StorageService } from '../services/storageService';
import { formatCurrency, formatDate } from '../utils/format';
import { BRANDS } from '../constants';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';

export const PriceListScreen: React.FC = () => {
  const { currentUser, isAdmin, isManager } = useAuth();
  const { colors, isDark } = useTheme();

  const [priceList, setPriceList] = useState<MobilePriceItem[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [excelModalVisible, setExcelModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MobilePriceItem | null>(null);

  // Form state for adding/editing a model
  const [brand, setBrand] = useState('Vivo');
  const [model, setModel] = useState('');
  const [ram, setRam] = useState('8GB');
  const [storage, setStorage] = useState('128GB');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  const loadPriceList = async () => {
    const list = await StorageService.getPriceList();
    setPriceList(list);
  };

  useEffect(() => {
    loadPriceList();
  }, []);

  const handleSaveModel = async () => {
    if (!model.trim()) {
      Alert.alert('Validation Error', 'Model name is required.');
      return;
    }
    const buyPrice = parseFloat(purchasePrice) || 0;
    const sellPrice = parseFloat(sellingPrice) || 0;

    if (buyPrice <= 0 || sellPrice <= 0) {
      Alert.alert('Validation Error', 'Please enter valid purchase and selling prices.');
      return;
    }

    const newItem: MobilePriceItem = {
      id: selectedItem?.id || `price_${Date.now()}`,
      brand,
      model: model.trim(),
      ram,
      storage,
      purchasePrice: buyPrice,
      sellingPrice: sellPrice,
      inStock: true,
      updatedAt: new Date().toISOString(),
      priceHistory: selectedItem
        ? [
            {
              date: new Date().toISOString().split('T')[0],
              purchasePrice: selectedItem.purchasePrice,
              sellingPrice: selectedItem.sellingPrice,
              updatedBy: currentUser?.name || 'Staff',
            },
            ...(selectedItem.priceHistory || []),
          ]
        : [],
    };

    await StorageService.savePriceItem(newItem);
    Alert.alert('Success', `Model ${newItem.brand} ${newItem.model} saved successfully!`);
    setAddModalVisible(false);
    resetForm();
    loadPriceList();
  };

  const handleDeleteModel = async (id: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this model from price list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await StorageService.deletePriceItem(id);
          loadPriceList();
        },
      },
    ]);
  };

  const resetForm = () => {
    setSelectedItem(null);
    setBrand('Vivo');
    setModel('');
    setRam('8GB');
    setStorage('128GB');
    setPurchasePrice('');
    setSellingPrice('');
  };

  const filteredItems = priceList.filter(item => {
    const matchesBrand = selectedBrand === 'All' || item.brand.toLowerCase() === selectedBrand.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      item.brand.toLowerCase().includes(query) ||
      item.model.toLowerCase().includes(query) ||
      (item.ram && item.ram.toLowerCase().includes(query)) ||
      (item.storage && item.storage.toLowerCase().includes(query));
    return matchesBrand && matchesQuery;
  });

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Price List"
        subtitle="Catalog & Margins"
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {(isAdmin || isManager) && (
              <TouchableOpacity
                style={[styles.excelBtn, { backgroundColor: colors.accent }]}
                onPress={() => setExcelModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={styles.excelButtonContent}>
                  <AppIcon name="file" size={15} color="#FFFFFF" />
                  <Text style={styles.excelBtnText}>Excel</Text>
                </View>
              </TouchableOpacity>
            )}
            <Button
              title="+ Add"
              onPress={() => {
                resetForm();
                setAddModalVisible(true);
              }}
              size="small"
            />
          </View>
        }
      />

      <View style={styles.topFilterSection}>
        {/* Sticky LeadIQ Search Bar */}
        <SearchInput
          placeholder="Search mobile model (e.g. V50, Reno 14, iPhone)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />

        {/* Brand Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandTabsContainer}
        >
          {BRANDS.map(b => (
            <FilterChip
              key={b}
              label={b}
              active={selectedBrand === b}
              onPress={() => setSelectedBrand(b)}
              count={
                b === 'All'
                  ? priceList.length
                  : priceList.filter(item => item.brand.toLowerCase() === b.toLowerCase()).length
              }
            />
          ))}
        </ScrollView>
      </View>

      {/* Summary Row */}
      <View style={styles.countSummaryRow}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          Showing {filteredItems.length} models for {selectedBrand}
        </Text>
        {(isAdmin || isManager) && (
          <StatusBadge label="ADMIN EDIT ENABLED" variant="primary" size="small" />
        )}
      </View>

      {/* Mobile Price List Cards */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const margin = item.sellingPrice - item.purchasePrice;
          const marginPercent =
            item.purchasePrice > 0
              ? Math.round((margin / item.purchasePrice) * 1000) / 10
              : 0;

          return (
            <AppCard
              style={styles.priceCard}
              onPress={() => {
                if (item.priceHistory && item.priceHistory.length > 0) {
                  setSelectedItem(item);
                  setHistoryModalVisible(true);
                } else if (isAdmin || isManager) {
                  setSelectedItem(item);
                  setBrand(item.brand);
                  setModel(item.model);
                  setRam(item.ram || '8GB');
                  setStorage(item.storage || '128GB');
                  setPurchasePrice(item.purchasePrice.toString());
                  setSellingPrice(item.sellingPrice.toString());
                  setAddModalVisible(true);
                }
              }}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <StatusBadge label={item.brand.toUpperCase()} variant="primary" size="small" />
                    <Text style={[styles.modelName, { color: colors.text }]}>
                      {item.model}
                    </Text>
                  </View>
                  <Text style={[styles.variantText, { color: colors.textSecondary }]}>
                    RAM: {item.ram || 'Standard'} • Storage: {item.storage || 'Standard'}
                  </Text>
                </View>

                {item.priceHistory && item.priceHistory.length > 0 && (
                  <TouchableOpacity
                    style={[styles.historyBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
                    onPress={() => {
                      setSelectedItem(item);
                      setHistoryModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.historyBtnText, { color: colors.info }]}>
                      History ({item.priceHistory.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Price Details Box */}
              <View
                style={[
                  styles.priceBox,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.priceCol}>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                    Selling Price
                  </Text>
                  <Text style={[styles.sellingValue, { color: colors.accent }]}>
                    {formatCurrency(item.sellingPrice)}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {(isAdmin || isManager) ? (
                  <>
                    <View style={styles.priceCol}>
                      <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                        Purchase Cost
                      </Text>
                      <Text style={[styles.costValue, { color: colors.text }]}>
                        {formatCurrency(item.purchasePrice)}
                      </Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.priceCol}>
                      <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                        Margin Profit
                      </Text>
                      <Text style={[styles.marginValue, { color: colors.primary }]}>
                        +{formatCurrency(margin)} ({marginPercent}%)
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.priceCol}>
                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                      Availability
                    </Text>
                    <Text style={[styles.marginValue, { color: colors.accent }]}>
                      ✓ In Stock
                    </Text>
                  </View>
                )}
              </View>

              {/* Admin Actions */}
              {(isAdmin || isManager) && (
                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
                    onPress={() => {
                      setSelectedItem(item);
                      setBrand(item.brand);
                      setModel(item.model);
                      setRam(item.ram || '8GB');
                      setStorage(item.storage || '128GB');
                      setPurchasePrice(item.purchasePrice.toString());
                      setSellingPrice(item.sellingPrice.toString());
                      setAddModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                      Edit Prices
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
                    onPress={() => handleDeleteModel(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.danger }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={<AppIcon name="tag" size={28} color={colors.primary} />}
            title="No Models Found"
            description="No models found for this brand. Upload an Excel price sheet to bulk import!"
            actionTitle="+ Add Model"
            onActionPress={() => {
              resetForm();
              setAddModalVisible(true);
            }}
          />
        }
      />

      {/* Add / Edit Model Modal */}
      <ModalCard
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        title={selectedItem ? 'Edit Model Prices' : 'Add Mobile Model'}
        subtitle="Update inventory catalog and pricing"
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>Brand *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: SPACING.xs }}>
          {BRANDS.filter(b => b !== 'All').map(b => (
            <FilterChip
              key={b}
              label={b}
              active={brand === b}
              onPress={() => setBrand(b)}
            />
          ))}
        </ScrollView>

        <Input label="Model Name *" placeholder="e.g. V50, Reno 14, A56" value={model} onChangeText={setModel} />
        <Input label="RAM Variant" placeholder="e.g. 8GB" value={ram} onChangeText={setRam} />
        <Input label="Storage Variant" placeholder="e.g. 128GB / 256GB" value={storage} onChangeText={setStorage} />
        <Input
          label="Purchase Price (₹) *"
          placeholder="e.g. 18000"
          keyboardType="numeric"
          value={purchasePrice}
          onChangeText={setPurchasePrice}
        />
        <Input
          label="Selling Price (₹) *"
          placeholder="e.g. 21999"
          keyboardType="numeric"
          value={sellingPrice}
          onChangeText={setSellingPrice}
        />

        <PrimaryButton
          title={selectedItem ? 'Update Model Prices' : 'Add to Catalog'}
          onPress={handleSaveModel}
          size="large"
          style={{ marginTop: SPACING.md }}
        />
      </ModalCard>

      {/* Price History Modal */}
      <ModalCard
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        title="Price Revision History"
        subtitle={selectedItem ? `${selectedItem.brand} ${selectedItem.model}` : ''}
      >
        {selectedItem?.priceHistory && selectedItem.priceHistory.length > 0 ? (
          selectedItem.priceHistory.map((h, i) => (
            <View key={i} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.historyDateText, { color: colors.text }]}>
                  {formatDate(h.date)}
                </Text>
                <Text style={[styles.historyUserText, { color: colors.textSecondary }]}>
                  Updated by: {h.updatedBy}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.historySellText, { color: colors.accent }]}>
                  Selling: {formatCurrency(h.sellingPrice)}
                </Text>
                <Text style={[styles.historyCostText, { color: colors.textMuted }]}>
                  Cost: {formatCurrency(h.purchasePrice)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20 }}>
            No past price revisions recorded for this model.
          </Text>
        )}
      </ModalCard>

      {/* Excel Import Modal */}
      <ExcelImportModal
        visible={excelModalVisible}
        onClose={() => setExcelModalVisible(false)}
        existingItems={priceList}
        onImportComplete={() => {
          setExcelModalVisible(false);
          loadPriceList();
        }}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  excelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  excelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  excelBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  topFilterSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  brandTabsContainer: {
    paddingBottom: SPACING.sm,
  },
  countSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginVertical: SPACING.xs,
  },
  countText: {
    ...TYPOGRAPHY.captionSmall,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  priceCard: {
    marginVertical: SPACING.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  modelName: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
  },
  variantText: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  historyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  historyBtnText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '600',
  },
  priceBox: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  priceCol: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: '100%',
  },
  priceLabel: {
    ...TYPOGRAPHY.captionSmall,
    marginBottom: 2,
  },
  sellingValue: {
    ...TYPOGRAPHY.bodyBold,
    fontWeight: '800',
  },
  costValue: {
    ...TYPOGRAPHY.bodyBold,
  },
  marginValue: {
    ...TYPOGRAPHY.bodyBold,
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
  },
  label: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  historyDateText: {
    ...TYPOGRAPHY.bodyBold,
  },
  historyUserText: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 2,
  },
  historySellText: {
    ...TYPOGRAPHY.bodyBold,
  },
  historyCostText: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 2,
  },
});
