import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
  Share,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useShopConfig } from '../context/ShopConfigContext';
import { PdfService } from '../services/pdfService';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  Button,
  PrimaryButton,
  Input,
  FilterChip,
  ModalCard,
  EmptyState,
  DigitalSignaturePad,
  DocumentCapture,
  SectionHeader,
  AppIcon,
} from '../components';
import { SecondHandPurchase, SecondHandSale } from '../types';
import { StorageService } from '../services/storageService';
import { SecondHandService } from '../services/secondHandService';
import { formatCurrency, formatDate } from '../utils/format';
import { sendWhatsAppMessage, MESSAGE_TEMPLATES } from '../utils/whatsapp';
import { BRANDS } from '../constants';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';
import {
  MOBILE_NUMBER_ERROR_MESSAGE,
  getMobileNumberError,
  sanitizeMobileNumber,
  validateMobileNumber,
} from '../utils/validation';

export const SecondHandScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { currentUser, isAdmin, isManager } = useAuth();
  const { colors, isDark } = useTheme();
  const { config } = useShopConfig();

  const [activeTab, setActiveTab] = useState<'purchases' | 'sales' | 'imei_search'>('purchases');
  const [purchases, setPurchases] = useState<SecondHandPurchase[]>([]);
  const [sales, setSales] = useState<SecondHandSale[]>([]);

  // Modals
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SecondHandSale | null>(null);

  // IMEI Search state
  const [searchImeiInput, setSearchImeiInput] = useState('');
  const [imeiSearchError, setImeiSearchError] = useState('');
  const [imeiResult, setImeiResult] = useState<any>(null);

  // Purchase Form fields
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPhoneError, setCustPhoneError] = useState('');
  const [custAltPhone, setCustAltPhone] = useState('');
  const [custAltPhoneError, setCustAltPhoneError] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custPhotoUri, setCustPhotoUri] = useState('');
  const [aadhaarFrontUri, setAadhaarFrontUri] = useState('');
  const [aadhaarBackUri, setAadhaarBackUri] = useState('');
  const [aadhaarFrontError, setAadhaarFrontError] = useState('');
  const [aadhaarBackError, setAadhaarBackError] = useState('');
  const [purBrand, setPurBrand] = useState('Vivo');
  const [purModel, setPurModel] = useState('');
  const [purImei, setPurImei] = useState('');
  const [purImeiError, setPurImeiError] = useState('');
  const [purCondition, setPurCondition] = useState('Good condition');
  const [purAmount, setPurAmount] = useState('');
  const [purBillUri, setPurBillUri] = useState('');
  const [purSignature, setPurSignature] = useState('');

  // Sales Form fields
  const [selectedStockItem, setSelectedStockItem] = useState<SecondHandPurchase | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerPhoneError, setBuyerPhoneError] = useState('');
  const [buyerAltPhone, setBuyerAltPhone] = useState('');
  const [buyerAltPhoneError, setBuyerAltPhoneError] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerAadhaar, setBuyerAadhaar] = useState('');
  const [buyerPhotoUri, setBuyerPhotoUri] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState<'UPI' | 'Cash' | 'Card'>('UPI');
  const [saleSignature, setSaleSignature] = useState('');

  const loadData = async () => {
    const pList = await StorageService.getPurchases();
    const sList = await StorageService.getSales();
    setPurchases(pList);
    setSales(sList);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Purchase Submit ---
  const handleRecordPurchase = async () => {
    let hasValidationError = false;

    if (!custName.trim()) {
      Alert.alert('Validation Error', 'Customer full name is required.');
      return;
    }
    const phoneErr = getMobileNumberError(custPhone, true);
    if (phoneErr) {
      setCustPhoneError(phoneErr);
      Alert.alert('Validation Error', phoneErr);
      return;
    }
    setCustPhoneError('');

    const altErr = getMobileNumberError(custAltPhone, false);
    if (altErr) {
      setCustAltPhoneError(altErr);
      Alert.alert('Validation Error', altErr);
      return;
    }
    setCustAltPhoneError('');
    if (!aadhaarFrontUri) {
      setAadhaarFrontError('Front side photo of Aadhaar card is required.');
      hasValidationError = true;
    } else {
      setAadhaarFrontError('');
    }
    if (!aadhaarBackUri) {
      setAadhaarBackError('Back side photo of Aadhaar card is required.');
      hasValidationError = true;
    } else {
      setAadhaarBackError('');
    }
    if (!purImei.trim()) {
      setPurImeiError('Please enter the IMEI number.');
      hasValidationError = true;
    } else if (!/^\d+$/.test(purImei.trim())) {
      setPurImeiError('IMEI must contain only numeric digits.');
      hasValidationError = true;
    } else if (purImei.trim().length !== 15) {
      setPurImeiError('IMEI must be exactly 15 digits.');
      hasValidationError = true;
    } else {
      setPurImeiError('');
    }

    if (hasValidationError) {
      Alert.alert(
        'Required Documents Missing',
        'Please upload both Front and Back photos of Aadhaar card and enter a valid 15-digit IMEI.'
      );
      return;
    }

    if (!purModel.trim()) {
      Alert.alert('Validation Error', 'Model details are required.');
      return;
    }
    if (!purAmount || parseFloat(purAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid purchase price.');
      return;
    }
    if (!purSignature) {
      Alert.alert('Signature Required', 'Customer digital signature is required for legal compliance.');
      return;
    }
    if (!currentUser) return;

    try {
      await SecondHandService.recordPurchase(
        {
          customerName: custName.trim(),
          phone: custPhone.trim(),
          alternatePhone: custAltPhone.trim() || undefined,
          address: custAddress.trim() || 'Local Customer',
          aadhaarNumber: custAadhaar.trim() || 'Verified on Shop',
          customerPhotoUri: custPhotoUri || undefined,
          aadhaarFrontUri: aadhaarFrontUri,
          aadhaarBackUri: aadhaarBackUri,
          aadhaarPhotoFront: aadhaarFrontUri,
          aadhaarPhotoBack: aadhaarBackUri,
          aadhaarCardPhotoUri: aadhaarFrontUri,
          brand: purBrand,
          model: purModel.trim(),
          imei: purImei.trim(),
          condition: purCondition.trim(),
          purchaseAmount: parseFloat(purAmount),
          billImageUri: purBillUri || undefined,
          digitalSignatureUri: purSignature,
        },
        currentUser
      );

      Alert.alert(
        'Purchase Recorded',
        `Device ${purBrand} ${purModel} (IMEI: ${purImei}) added to store stock with legal digital signature!`,
        [{ text: 'OK', onPress: () => { setPurchaseModalVisible(false); resetPurchaseForm(); loadData(); } }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record purchase.');
    }
  };

  // --- Sale Submit ---
  const handleRecordSale = async () => {
    if (!selectedStockItem) {
      Alert.alert('Selection Error', 'Please select a device from in-stock inventory.');
      return;
    }
    if (!buyerName.trim()) {
      Alert.alert('Validation Error', 'Buyer full name is required.');
      return;
    }
    const phoneErr = getMobileNumberError(buyerPhone, true);
    if (phoneErr) {
      setBuyerPhoneError(phoneErr);
      Alert.alert('Validation Error', phoneErr);
      return;
    }
    setBuyerPhoneError('');

    const altErr = getMobileNumberError(buyerAltPhone, false);
    if (altErr) {
      setBuyerAltPhoneError(altErr);
      Alert.alert('Validation Error', altErr);
      return;
    }
    setBuyerAltPhoneError('');
    if (!saleAmount || parseFloat(saleAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter valid selling amount.');
      return;
    }
    if (!saleSignature) {
      Alert.alert('Signature Required', 'Buyer digital signature is required.');
      return;
    }
    if (!currentUser) return;

    try {
      const recordedSale = await SecondHandService.recordSale(
        {
          purchaseRecordId: selectedStockItem.id,
          buyerName: buyerName.trim(),
          phone: buyerPhone.trim(),
          alternatePhone: buyerAltPhone.trim() || undefined,
          address: buyerAddress.trim() || 'Local Customer',
          aadhaarNumber: buyerAadhaar.trim() || 'Verified by Store',
          buyerPhotoUri: buyerPhotoUri || undefined,
          brand: selectedStockItem.brand,
          model: selectedStockItem.model,
          imei: selectedStockItem.imei,
          purchaseAmount: selectedStockItem.purchaseAmount,
          sellingAmount: parseFloat(saleAmount),
          paymentMethod: salePaymentMethod,
          digitalSignatureUri: saleSignature,
          warrantyMonths: 3,
        },
        currentUser
      );

      Alert.alert(
        'Sale Completed!',
        `Invoice ${recordedSale.invoiceNumber} generated! Profit: ${formatCurrency(recordedSale.profitAmount)}`,
        [
          {
            text: 'View Invoice',
            onPress: () => {
              setSelectedSale(recordedSale);
              setInvoiceModalVisible(true);
            },
          },
          { text: 'Done', style: 'cancel' },
        ]
      );

      setSaleModalVisible(false);
      resetSaleForm();
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record sale.');
    }
  };

  const handleSearchImei = async () => {
    const trimmed = searchImeiInput.trim();
    if (!trimmed) {
      setImeiSearchError('Please enter the IMEI number.');
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setImeiSearchError('IMEI must contain only numeric digits.');
      return;
    }
    if (trimmed.length !== 15) {
      setImeiSearchError('IMEI must be exactly 15 digits.');
      return;
    }
    setImeiSearchError('');
    const result = await SecondHandService.verifyIMEI(trimmed);
    setImeiResult(result);
  };

  const resetPurchaseForm = () => {
    setCustName('');
    setCustPhone('');
    setCustPhoneError('');
    setCustAltPhone('');
    setCustAltPhoneError('');
    setCustAddress('');
    setCustAadhaar('');
    setCustPhotoUri('');
    setAadhaarFrontUri('');
    setAadhaarBackUri('');
    setAadhaarFrontError('');
    setAadhaarBackError('');
    setPurBrand('Vivo');
    setPurModel('');
    setPurImei('');
    setPurImeiError('');
    setPurCondition('Good condition');
    setPurAmount('');
    setPurBillUri('');
    setPurSignature('');
  };

  const resetSaleForm = () => {
    setSelectedStockItem(null);
    setBuyerName('');
    setBuyerPhone('');
    setBuyerPhoneError('');
    setBuyerAltPhone('');
    setBuyerAltPhoneError('');
    setBuyerAddress('');
    setBuyerAadhaar('');
    setBuyerPhotoUri('');
    setSaleAmount('');
    setSaleSignature('');
  };

  const inStockList = purchases.filter(p => p.status === 'in_stock');

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Buy & Sell"
        subtitle="2nd Hand Mobiles"
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          } else {
            navigation?.navigate?.('MainTabs');
          }
        }}
        actionRow={
          <View style={styles.headerActionRow}>
            <Button
              title="+ Buy Device"
              onPress={() => setPurchaseModalVisible(true)}
              size="small"
              style={styles.headerActionButton}
            />
            <Button
              title="+ Sell Device"
              onPress={() => setSaleModalVisible(true)}
              variant="success"
              size="small"
              style={styles.headerActionButton}
            />
          </View>
        }
      />

      {/* Segment Tabs as LeadIQ CRM FilterChips */}
      <View style={styles.tabBarSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabChipsScroll}>
          <FilterChip
            label={`Purchases (${purchases.length})`}
            icon={<AppIcon name="package" size={16} color={activeTab === 'purchases' ? '#FFFFFF' : colors.warning} />}
            active={activeTab === 'purchases'}
            onPress={() => setActiveTab('purchases')}
          />
          <FilterChip
            label={`Sales (${sales.length})`}
            icon={<AppIcon name="wallet" size={16} color={activeTab === 'sales' ? '#FFFFFF' : colors.success} />}
            active={activeTab === 'sales'}
            onPress={() => setActiveTab('sales')}
          />
          <FilterChip
            label="IMEI Search"
            icon={<AppIcon name="search" size={16} color={activeTab === 'imei_search' ? '#FFFFFF' : colors.primary} />}
            active={activeTab === 'imei_search'}
            onPress={() => setActiveTab('imei_search')}
          />
        </ScrollView>
      </View>

      {/* --- Tab 1: Purchases (Stock) --- */}
      {activeTab === 'purchases' && (
        <FlatList
          data={purchases}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AppCard style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modelTitle, { color: colors.text }]}>
                    {item.brand} {item.model}
                  </Text>
                  <Text style={[styles.imeiText, { color: colors.primary }]}>
                    IMEI: {item.imei}
                  </Text>
                </View>
                <StatusBadge
                  label={item.status === 'in_stock' ? 'IN STOCK' : 'SOLD'}
                  variant={item.status === 'in_stock' ? 'success' : 'neutral'}
                />
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Customer: <Text style={{ color: colors.text, fontWeight: '600' }}>{item.customerName}</Text> ({item.phone})
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Address: {item.address} • Aadhaar: {item.aadhaarNumber}
                </Text>
              </View>

              <View
                style={[
                  styles.priceSummaryBox,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
              >
                <View>
                  <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                    Purchase Cost
                  </Text>
                  <Text style={[styles.amountValue, { color: colors.text }]}>
                    {formatCurrency(item.purchaseAmount)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                    Purchased On
                  </Text>
                  <Text style={[styles.dateValue, { color: colors.textSecondary }]}>
                    {formatDate(item.purchaseDate)}
                  </Text>
                </View>
              </View>

              {/* Digital Signature Confirmation Badge */}
              <View style={styles.signatureBadgeRow}>
                <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '600' }}>
                  ✓ Customer Signature & Aadhaar (Front & Back) Verified
                </Text>
              </View>
            </AppCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<AppIcon name="package" size={28} color={colors.warning} />}
              title="No Purchases Recorded"
              description="No second-hand purchase records found. Tap '+ Buy' to record a device!"
              actionTitle="+ Buy Phone"
              onActionPress={() => setPurchaseModalVisible(true)}
            />
          }
        />
      )}

      {/* --- Tab 2: Sales Records --- */}
      {activeTab === 'sales' && (
        <FlatList
          data={sales}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AppCard
              style={styles.recordCard}
              onPress={() => {
                setSelectedSale(item);
                setInvoiceModalVisible(true);
              }}
            >
              <View style={styles.recordHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modelTitle, { color: colors.text }]}>
                    {item.brand} {item.model}
                  </Text>
                  <Text style={[styles.imeiText, { color: colors.primary }]}>
                    IMEI: {item.imei} • Inv: {item.invoiceNumber}
                  </Text>
                </View>
                <StatusBadge label="COMPLETED" variant="success" />
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Buyer: <Text style={{ color: colors.text, fontWeight: '600' }}>{item.buyerName}</Text> ({item.phone})
                </Text>
              </View>

              <View
                style={[
                  styles.priceSummaryBox,
                  {
                    backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4',
                    borderColor: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
                  },
                ]}
              >
                <View>
                  <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                    Selling Price
                  </Text>
                  <Text style={[styles.amountValue, { color: colors.accent }]}>
                    {formatCurrency(item.sellingAmount)}
                  </Text>
                </View>

                {(isAdmin || isManager) && (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                      Net Profit
                    </Text>
                    <Text style={[styles.amountValue, { color: colors.primary }]}>
                      +{formatCurrency(item.profitAmount)} ({item.marginPercent}%)
                    </Text>
                  </View>
                )}

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                    Payment
                  </Text>
                  <Text style={[styles.dateValue, { color: colors.text }]}>
                    {item.paymentMethod}
                  </Text>
                </View>
              </View>

              {/* Invoice button */}
              <View style={styles.invoiceActionRow}>
                <TouchableOpacity
                  style={[styles.invoiceBtn, { borderColor: colors.primary, backgroundColor: colors.borderLight }]}
                  onPress={() => {
                    setSelectedSale(item);
                    setInvoiceModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.invoiceBtnText, { color: colors.primary }]}>
                    View & Share Tax Invoice
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.waInvoiceBtn, { backgroundColor: '#25D366' }]}
                  onPress={() =>
                    sendWhatsAppMessage(
                      item.phone,
                      MESSAGE_TEMPLATES.SALES_RECEIPT(
                        item.buyerName,
                        `${item.brand} ${item.model}`,
                        formatCurrency(item.sellingAmount),
                        item.invoiceNumber
                      )
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.waInvoiceText}>WhatsApp Receipt</Text>
                </TouchableOpacity>
              </View>
            </AppCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<AppIcon name="wallet" size={28} color={colors.success} />}
              title="No Sales Recorded"
              description="No second-hand sales recorded yet. Tap '+ Sell' to sell a phone from stock!"
              actionTitle="+ Sell Phone"
              onActionPress={() => setSaleModalVisible(true)}
            />
          }
        />
      )}

      {/* --- Tab 3: IMEI Search & Verification --- */}
      {activeTab === 'imei_search' && (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <AppCard>
            <Text style={[styles.imeiSearchHeading, { color: colors.text }]}>
              IMEI Verification & Lifecycle Tracking
            </Text>
            <Text style={[styles.imeiSearchSub, { color: colors.textSecondary }]}>
              Search any 15-digit IMEI to verify purchase origin, KYC compliance, and sales records.
            </Text>

            <Input
              placeholder="Enter 15-Digit IMEI Number..."
              keyboardType="numeric"
              maxLength={15}
              value={searchImeiInput}
              onChangeText={(text) => {
                setSearchImeiInput(text);
                if (!text.trim()) {
                  setImeiSearchError('');
                } else if (!/^\d+$/.test(text.trim())) {
                  setImeiSearchError('IMEI must contain only numeric digits.');
                } else if (text.trim().length !== 15) {
                  setImeiSearchError('IMEI must be exactly 15 digits.');
                } else {
                  setImeiSearchError('');
                }
              }}
              error={imeiSearchError}
            />

            <PrimaryButton
              title="Verify IMEI"
              onPress={handleSearchImei}
              disabled={!searchImeiInput.trim() || searchImeiInput.trim().length !== 15 || !/^\d{15}$/.test(searchImeiInput.trim())}
              style={{ marginTop: SPACING.sm }}
            />
          </AppCard>

          {imeiResult && (
            <AppCard style={{ marginTop: SPACING.md }}>
              <View style={styles.imeiResultHeader}>
                <Text style={[styles.modelTitle, { color: colors.text }]}>
                  IMEI: {imeiResult.imei}
                </Text>
                <StatusBadge
                  label={
                    imeiResult.isCurrentlyInStock
                      ? 'IN STORE STOCK'
                      : imeiResult.isKnown
                      ? 'SOLD / HISTORICAL'
                      : 'NOT IN SYSTEM'
                  }
                  variant={
                    imeiResult.isCurrentlyInStock
                      ? 'success'
                      : imeiResult.isKnown
                      ? 'info'
                      : 'danger'
                  }
                />
              </View>

              {imeiResult.isKnown ? (
                <>
                  <SectionHeader title="Purchase Origin" />
                  {imeiResult.purchaseRecords.map((p: any, i: number) => (
                    <View key={i} style={[styles.timelineItem, { borderLeftColor: colors.primary }]}>
                      <Text style={{ fontWeight: '700', color: colors.text }}>
                        Bought from {p.customerName} on {formatDate(p.purchaseDate)}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        Phone: {p.phone} • Aadhaar: {p.aadhaarNumber} • Cost: {formatCurrency(p.purchaseAmount)}
                      </Text>
                    </View>
                  ))}

                  {imeiResult.salesRecords.length > 0 && (
                    <>
                      <SectionHeader title="Sale Record" />
                      {imeiResult.salesRecords.map((s: any, i: number) => (
                        <View key={i} style={[styles.timelineItem, { borderLeftColor: colors.accent }]}>
                          <Text style={{ fontWeight: '700', color: colors.accent }}>
                            Sold to {s.buyerName} on {formatDate(s.saleDate)}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                            Invoice: {s.invoiceNumber} • Selling Price: {formatCurrency(s.sellingAmount)}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
                  No previous records found for this IMEI. You can safely purchase or register this device.
                </Text>
              )}
            </AppCard>
          )}
        </ScrollView>
      )}

      {/* --- Purchase Modal --- */}
      <ModalCard
        visible={purchaseModalVisible}
        onClose={() => setPurchaseModalVisible(false)}
        title="Second-Hand Purchase Entry"
        subtitle="Customer KYC, Device Details & Legal Signature"
      >
        <Text style={[styles.subSectionTitle, { color: colors.primary }]}>
          1. Customer Information
        </Text>
        <Input label="Customer Full Name *" placeholder="e.g. Ramesh Bhai" value={custName} onChangeText={setCustName} />
        <Input
          label="Mobile Number *"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={custPhone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setCustPhone(clean);
            setCustPhoneError(validateMobileNumber(clean, true, true, val));
          }}
          onBlur={() => {
            setCustPhoneError(getMobileNumberError(custPhone, true));
          }}
          error={custPhoneError}
        />
        <Input
          label="Alternative Mobile Number"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={custAltPhone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setCustAltPhone(clean);
            setCustAltPhoneError(validateMobileNumber(clean, false, false, val));
          }}
          onBlur={() => {
            setCustAltPhoneError(getMobileNumberError(custAltPhone, false));
          }}
          error={custAltPhoneError}
        />
        <Input label="Complete Residential Address *" placeholder="Door no, Area, City" value={custAddress} onChangeText={setCustAddress} />
        <Input label="Aadhaar Card Number (12 Digits) *" placeholder="1234 5678 9012" keyboardType="numeric" maxLength={12} value={custAadhaar} onChangeText={setCustAadhaar} />

        <DocumentCapture label="Customer Photo" onCapture={setCustPhotoUri} currentUri={custPhotoUri} />
        <DocumentCapture
          label="Aadhaar Card — Front Side (Required)"
          required
          onCapture={(uri) => {
            setAadhaarFrontUri(uri);
            if (uri) setAadhaarFrontError('');
          }}
          currentUri={aadhaarFrontUri}
          errorMessage={aadhaarFrontError}
        />
        <DocumentCapture
          label="Aadhaar Card — Back Side (Required)"
          required
          onCapture={(uri) => {
            setAadhaarBackUri(uri);
            if (uri) setAadhaarBackError('');
          }}
          currentUri={aadhaarBackUri}
          errorMessage={aadhaarBackError}
        />

        <Text style={[styles.subSectionTitle, { color: colors.primary, marginTop: SPACING.md }]}>
          2. Device Information
        </Text>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Mobile Brand *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: SPACING.xs }}>
          {BRANDS.filter(b => b !== 'All').map(b => (
            <FilterChip
              key={b}
              label={b}
              active={purBrand === b}
              onPress={() => setPurBrand(b)}
            />
          ))}
        </ScrollView>

        <Input label="Model Details *" placeholder="e.g. iPhone 13 128GB" value={purModel} onChangeText={setPurModel} />
        <Input
          label="Mobile IMEI Number (15 Digits) *"
          placeholder="864920048192039"
          keyboardType="numeric"
          maxLength={15}
          value={purImei}
          onChangeText={(val) => {
            setPurImei(val);
            if (!val.trim()) {
              setPurImeiError('');
            } else if (!/^\d+$/.test(val.trim())) {
              setPurImeiError('IMEI must contain only numeric digits.');
            } else if (val.trim().length !== 15) {
              setPurImeiError('IMEI must be exactly 15 digits.');
            } else {
              setPurImeiError('');
            }
          }}
          error={purImeiError}
        />
        <Input label="Device Condition" placeholder="e.g. Excellent, Minor scratch on corner" value={purCondition} onChangeText={setPurCondition} />
        <Input label="Purchase Amount (₹) *" placeholder="e.g. 20000" keyboardType="numeric" value={purAmount} onChangeText={setPurAmount} />

        <DocumentCapture label="Original Bill Upload (Optional)" onCapture={setPurBillUri} currentUri={purBillUri} />

        <Text style={[styles.subSectionTitle, { color: colors.primary, marginTop: SPACING.md }]}>
          3. Customer Legal Declaration & Digital Signature
        </Text>
        <DigitalSignaturePad
          onSave={setPurSignature}
          label="Customer Digital Signature"
          initialSignature={purSignature}
        />

        <PrimaryButton
          title="✓ Record Purchase to Inventory"
          onPress={handleRecordPurchase}
          size="large"
          style={{ marginTop: SPACING.lg }}
        />
      </ModalCard>

      {/* --- Sales Modal --- */}
      <ModalCard
        visible={saleModalVisible}
        onClose={() => setSaleModalVisible(false)}
        title="Second-Hand Sale Entry"
        subtitle="Select Stock Device, Buyer KYC & Billing"
      >
        <Text style={[styles.subSectionTitle, { color: colors.primary }]}>
          1. Select Available Device from Stock ({inStockList.length})
        </Text>
        {inStockList.length === 0 ? (
          <Text style={{ color: colors.danger, paddingVertical: 10 }}>
            ⚠️ No in-stock second-hand devices available. Record a purchase first.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: SPACING.xs }}>
            {inStockList.map(stock => (
              <TouchableOpacity
                key={stock.id}
                style={[
                  styles.stockSelectCard,
                  {
                    borderColor: selectedStockItem?.id === stock.id ? colors.accent : colors.border,
                    backgroundColor: selectedStockItem?.id === stock.id ? (isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4') : colors.card,
                  },
                ]}
                onPress={() => {
                  setSelectedStockItem(stock);
                  const suggested = Math.round(stock.purchaseAmount * 1.2 / 500) * 500;
                  setSaleAmount(suggested.toString());
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>
                  {stock.brand} {stock.model}
                </Text>
                <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2 }}>
                  IMEI: {stock.imei}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  Cost: {formatCurrency(stock.purchaseAmount)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={[styles.subSectionTitle, { color: colors.primary, marginTop: SPACING.md }]}>
          2. Buyer Information
        </Text>
        <Input label="Buyer Full Name *" placeholder="e.g. Anand Patel" value={buyerName} onChangeText={setBuyerName} />
        <Input
          label="Mobile Number *"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={buyerPhone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setBuyerPhone(clean);
            setBuyerPhoneError(validateMobileNumber(clean, true, true, val));
          }}
          onBlur={() => {
            setBuyerPhoneError(getMobileNumberError(buyerPhone, true));
          }}
          error={buyerPhoneError}
        />
        <Input
          label="Alternative Mobile Number"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={buyerAltPhone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setBuyerAltPhone(clean);
            setBuyerAltPhoneError(validateMobileNumber(clean, false, false, val));
          }}
          onBlur={() => {
            setBuyerAltPhoneError(getMobileNumberError(buyerAltPhone, false));
          }}
          error={buyerAltPhoneError}
        />
        <Input label="Address" placeholder="Buyer address" value={buyerAddress} onChangeText={setBuyerAddress} />
        <Input label="Aadhaar Number (12 Digits)" placeholder="Aadhaar number" keyboardType="numeric" maxLength={12} value={buyerAadhaar} onChangeText={setBuyerAadhaar} />

        <DocumentCapture label="Buyer Photo (Optional)" onCapture={setBuyerPhotoUri} currentUri={buyerPhotoUri} />

        <Text style={[styles.subSectionTitle, { color: colors.primary, marginTop: SPACING.md }]}>
          3. Financials & Payment
        </Text>
        <Input
          label="Selling Price (₹) *"
          placeholder="e.g. 24500"
          keyboardType="numeric"
          value={saleAmount}
          onChangeText={setSaleAmount}
        />

        {selectedStockItem && saleAmount ? (
          <View style={[styles.marginPreviewBox, { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4' }]}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
              Projected Profit: {formatCurrency(parseFloat(saleAmount) - selectedStockItem.purchaseAmount)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              Purchase Cost: {formatCurrency(selectedStockItem.purchaseAmount)}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: SPACING.sm }]}>Payment Method</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginVertical: SPACING.xs }}>
          {(['UPI', 'Cash', 'Card'] as const).map(pm => (
            <FilterChip
              key={pm}
              label={pm}
              active={salePaymentMethod === pm}
              onPress={() => setSalePaymentMethod(pm)}
            />
          ))}
        </View>

        <Text style={[styles.subSectionTitle, { color: colors.primary, marginTop: SPACING.md }]}>
          4. Buyer Digital Signature
        </Text>
        <DigitalSignaturePad
          onSave={setSaleSignature}
          label="Buyer Digital Signature"
          initialSignature={saleSignature}
        />

        <PrimaryButton
          title="✓ Complete Sale & Generate Invoice"
          onPress={handleRecordSale}
          size="large"
          style={{ marginTop: SPACING.lg }}
        />
      </ModalCard>

      {/* --- Invoice Modal --- */}
      <ModalCard
        visible={invoiceModalVisible}
        onClose={() => setInvoiceModalVisible(false)}
        title="Tax Invoice"
        subtitle={selectedSale ? `Invoice #${selectedSale.invoiceNumber}` : ''}
      >
        {selectedSale && (
          <View>
            <View style={[styles.invoiceBox, { backgroundColor: colors.card, borderColor: colors.border }, SHADOWS.card]}>
              <Text style={[styles.invoiceShopName, { color: colors.primary }]}>
                PARTH MOBILE CARE
              </Text>
              <Text style={[styles.invoiceAddress, { color: colors.textSecondary }]}>
                Surat, Gujarat • Ph: +91 98765 43210 • GST: 24ABCDE1234F1Z5
              </Text>
              <View style={[styles.invoiceDivider, { backgroundColor: colors.border }]} />

              <View style={styles.invoiceRow}>
                <Text style={[styles.invLabel, { color: colors.textSecondary }]}>Invoice Number:</Text>
                <Text style={[styles.invVal, { color: colors.text }]}>{selectedSale.invoiceNumber}</Text>
              </View>
              <View style={styles.invoiceRow}>
                <Text style={[styles.invLabel, { color: colors.textSecondary }]}>Date & Time:</Text>
                <Text style={[styles.invVal, { color: colors.text }]}>{formatDate(selectedSale.saleDate)} {selectedSale.saleTime}</Text>
              </View>
              <View style={styles.invoiceRow}>
                <Text style={[styles.invLabel, { color: colors.textSecondary }]}>Sold By Staff:</Text>
                <Text style={[styles.invVal, { color: colors.text }]}>{selectedSale.soldByStaffName}</Text>
              </View>

              <View style={[styles.invoiceDivider, { backgroundColor: colors.border }]} />

              <Text style={[styles.invLabel, { fontWeight: '700', marginBottom: 4, color: colors.text }]}>
                Buyer Details:
              </Text>
              <Text style={{ fontSize: 13, color: colors.text }}>{selectedSale.buyerName}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Phone: {selectedSale.phone} • Address: {selectedSale.address}</Text>

              <View style={[styles.invoiceDivider, { backgroundColor: colors.border }]} />

              <Text style={[styles.invLabel, { fontWeight: '700', marginBottom: 4, color: colors.text }]}>
                Device Details:
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {selectedSale.brand} {selectedSale.model}
              </Text>
              <Text style={{ fontSize: 12, color: colors.primary, marginTop: 2 }}>
                IMEI: {selectedSale.imei}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Store Warranty: {selectedSale.warrantyMonths} Months
              </Text>

              <View style={[styles.invoiceDivider, { backgroundColor: colors.border }]} />

              <View style={styles.invoiceRow}>
                <Text style={[styles.invTotalLabel, { color: colors.text }]}>Total Amount Paid:</Text>
                <Text style={[styles.invTotalVal, { color: colors.accent }]}>
                  {formatCurrency(selectedSale.sellingAmount)}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Payment Method: {selectedSale.paymentMethod}
              </Text>

              <View style={styles.stampBox}>
                <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700' }}>
                  ✓ DIGITALLY SIGNED & VERIFIED BY PARTH MOBILE CARE
                </Text>
              </View>
            </View>

            <View style={{ gap: 8, marginTop: SPACING.md }}>
              <PrimaryButton
                title="Download / Print Invoice PDF"
                icon={<AppIcon name="file" size={16} color="#FFFFFF" />}
                onPress={async () => {
                  try {
                    await PdfService.printOrSaveTaxInvoicePdf(selectedSale, config);
                  } catch (e: any) {
                    Alert.alert('PDF Error', e.message || 'Could not generate invoice PDF.');
                  }
                }}
                size="large"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  title="Share Text"
                  icon={<AppIcon name="upload" size={16} color={colors.primary} />}
                  onPress={async () => {
                    await Share.share({
                      title: `Invoice ${selectedSale.invoiceNumber}`,
                      message: `Tax Invoice ${selectedSale.invoiceNumber} from Parth Mobile Care for ${selectedSale.brand} ${selectedSale.model} (IMEI: ${selectedSale.imei}). Amount Paid: ${formatCurrency(selectedSale.sellingAmount)}.`,
                    });
                  }}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <Button
                  title="WhatsApp Receipt"
                  onPress={() =>
                    sendWhatsAppMessage(
                      selectedSale.phone,
                      MESSAGE_TEMPLATES.SALES_RECEIPT(
                        selectedSale.buyerName,
                        `${selectedSale.brand} ${selectedSale.model}`,
                        formatCurrency(selectedSale.sellingAmount),
                        selectedSale.invoiceNumber
                      )
                    )
                  }
                  style={{ flex: 1, backgroundColor: '#25D366' }}
                />
              </View>
            </View>
          </View>
        )}
      </ModalCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabBarSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  tabChipsScroll: {
    paddingBottom: SPACING.xs,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  recordCard: {
    marginVertical: SPACING.xs,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  modelTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
  },
  imeiText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  infoRow: {
    marginBottom: 4,
  },
  infoLabel: {
    ...TYPOGRAPHY.caption,
  },
  priceSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  amountLabel: {
    ...TYPOGRAPHY.captionSmall,
  },
  amountValue: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
    marginTop: 2,
  },
  dateValue: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 2,
  },
  signatureBadgeRow: {
    paddingTop: SPACING.xs,
  },
  invoiceActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  invoiceBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  invoiceBtnText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
  },
  waInvoiceBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  waInvoiceText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  imeiSearchHeading: {
    ...TYPOGRAPHY.h3,
    marginBottom: 4,
  },
  imeiSearchSub: {
    ...TYPOGRAPHY.caption,
    marginBottom: SPACING.md,
  },
  imeiResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  timelineItem: {
    borderLeftWidth: 2,
    paddingLeft: SPACING.md,
    marginBottom: SPACING.sm,
  },
  subSectionTitle: {
    ...TYPOGRAPHY.bodyBold,
    marginBottom: SPACING.xs,
  },
  formLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  stockSelectCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    marginRight: SPACING.sm,
    minWidth: 140,
  },
  marginPreviewBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.sm,
  },
  invoiceBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  invoiceShopName: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  invoiceAddress: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
    marginTop: 2,
  },
  invoiceDivider: {
    height: 1,
    marginVertical: SPACING.md,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  invLabel: {
    ...TYPOGRAPHY.caption,
  },
  invVal: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  invTotalLabel: {
    ...TYPOGRAPHY.bodyBold,
  },
  invTotalVal: {
    ...TYPOGRAPHY.h2,
    fontWeight: '800',
  },
  stampBox: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#22C55E',
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: SPACING.sm,
  },
  headerActionButton: {
    flex: 1,
  },
});
