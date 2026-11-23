import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  SearchInput,
  FilterChip,
  ModalCard,
  EmptyState,
  AppIcon,
} from '../components';
import { MobilePriceItem } from '../types';
import { StorageService } from '../services/storageService';
import { formatCurrency, formatDate } from '../utils/format';
import { BRANDS } from '../constants';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';

export const PriceListScreen: React.FC = () => {
  const { colors, isDark } = useTheme();

  const [priceList, setPriceList] = useState<MobilePriceItem[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MobilePriceItem | null>(null);

  const loadPriceList = async () => {
    const list = await StorageService.getPriceList();
    setPriceList(list);
  };

  useEffect(() => {
    loadPriceList();
  }, []);

  const filteredItems = useMemo(() => {
    const isAll = selectedBrand === 'All';
    const targetBrand = selectedBrand.toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    return priceList.filter(item => {
      const matchesBrand = isAll || item.brand.toLowerCase() === targetBrand;
      if (!matchesBrand) return false;
      if (!query) return true;
      return (
        item.brand.toLowerCase().includes(query) ||
        item.model.toLowerCase().includes(query) ||
        (item.ram && item.ram.toLowerCase().includes(query)) ||
        (item.storage && item.storage.toLowerCase().includes(query))
      );
    });
  }, [priceList, selectedBrand, searchQuery]);

  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = { All: priceList.length };
    for (let i = 0; i < priceList.length; i++) {
      const b = priceList[i].brand;
      counts[b] = (counts[b] || 0) + 1;
    }
    return counts;
  }, [priceList]);

  const keyExtractor = useCallback((item: MobilePriceItem) => item.id, []);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Price List"
        subtitle="Official store phone rates"
      />

      <View style={styles.topFilterSection}>
        {/* Sticky Search Bar */}
        <SearchInput
          placeholder="Search phone model..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />

        {/* Brand Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.brandTabsScroll}
          contentContainerStyle={styles.brandTabsContainer}
        >
          {BRANDS.map(b => (
            <FilterChip
              key={b}
              label={b}
              active={selectedBrand === b}
              onPress={() => setSelectedBrand(b)}
              count={b === 'All' ? brandCounts.All : (brandCounts[b] || 0)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Summary Row */}
      <View style={styles.countSummaryRow}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          Showing {filteredItems.length} models for {selectedBrand}
        </Text>
      </View>

      {/* Mobile Price List Cards */}
      <FlatList
        data={filteredItems}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item }) => (
          <AppCard
            style={styles.priceCard}
            onPress={() => {
              if (item.priceHistory && item.priceHistory.length > 0) {
                setSelectedItem(item);
                setHistoryModalVisible(true);
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

            {/* Price Details Box - Retail Selling Price & Availability */}
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
                <Text
                  style={[styles.priceLabel, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Selling Price (MOP)
                </Text>
                <Text
                  style={[styles.sellingValue, { color: colors.accent }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCurrency(item.sellingPrice)}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.priceCol}>
                <Text
                  style={[styles.priceLabel, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Availability
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} color={colors.accent} />
                  <Text
                    style={[styles.availabilityValue, { color: colors.accent }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    In Stock
                  </Text>
                </View>
              </View>
            </View>
          </AppCard>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<AppIcon name="tag" size={28} color={colors.primary} />}
            title="No Models Found"
            description="No models found matching your search filter."
          />
        }
      />

      {/* Price Revision History Modal (Customer Selling Price Only) */}
      {historyModalVisible && selectedItem && (
        <ModalCard
          visible={historyModalVisible}
          onClose={() => setHistoryModalVisible(false)}
          title="Price Revision History"
          subtitle={`${selectedItem.brand} ${selectedItem.model}`}
        >
          {selectedItem.priceHistory && selectedItem.priceHistory.length > 0 ? (
            selectedItem.priceHistory.map((h, i) => (
              <View key={i} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.historyDateText, { color: colors.text }]}>
                    {formatDate(h.date)}
                  </Text>
                  <Text style={[styles.historyUserText, { color: colors.textSecondary }]}>
                    Verified by: {h.updatedBy || 'Store Admin'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.historySellText, { color: colors.accent }]}>
                    {formatCurrency(h.sellingPrice)}
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
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  topFilterSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  brandTabsScroll: {
    marginHorizontal: -SPACING.lg,
    marginTop: SPACING.xs,
  },
  brandTabsContainer: {
    paddingHorizontal: SPACING.lg,
    paddingRight: SPACING.xxl + 8,
    gap: 8,
  },
  countSummaryRow: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  countText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 90,
  },
  priceCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  modelName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    flexShrink: 1,
  },
  variantText: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  historyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  historyBtnText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  priceCol: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 28,
  },
  priceLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginBottom: 2,
    textAlign: 'center',
  },
  sellingValue: {
    ...TYPOGRAPHY.h3,
    fontSize: 15,
    textAlign: 'center',
  },
  availabilityValue: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    fontSize: 13,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  historyDateText: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
  },
  historyUserText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
  },
  historySellText: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
  },
});
