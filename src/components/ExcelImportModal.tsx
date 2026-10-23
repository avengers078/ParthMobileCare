import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Keyboard,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ExcelService, ImportValidationResult } from '../services/excelService';
import { MobilePriceItem } from '../types';
import { Button } from './Button';
import { formatCurrency } from '../utils/format';
import { AppIcon } from './AppIcon';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { FileSystem } from 'react-native-file-access';

interface ExcelImportModalProps {
  visible: boolean;
  onClose: () => void;
  existingItems: MobilePriceItem[];
  onImportComplete: (count: number) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  visible,
  onClose,
  existingItems,
  onImportComplete,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [csvInput, setCsvInput] = useState<string>('');
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [screenHeight, setScreenHeight] = useState<number>(Dimensions.get('window').height);
  const [isPickingFile, setIsPickingFile] = useState<boolean>(false);
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const scrollViewRef = useRef<any>(null);
  const textInputRef = useRef<any>(null);

  useEffect(() => {
    const onDimensionsChange = ({ window }: { window: { height: number } }) => {
      setScreenHeight(window.height);
    };
    const dimSub = Dimensions.addEventListener('change', onDimensionsChange);

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      dimSub?.remove();
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLoadSample = () => {
    setCsvInput(ExcelService.getSampleData());
    setSourceFileName('');
    setValidationResult(null);
  };

  const handlePickFile = async () => {
    setIsPickingFile(true);
    try {
      const [picked] = await pick({
        type: [types.xlsx, types.xls, types.csv],
        allowMultiSelection: false,
        allowVirtualFiles: true,
        mode: 'import',
      });
      const fileName = picked.name || 'spreadsheet';
      if (picked.size && picked.size > 20 * 1024 * 1024) {
        throw new Error('This spreadsheet is larger than 20 MB. Please choose a smaller file.');
      }
      const namedExtension = fileName.split('.').pop()?.toLowerCase();
      const extension = ['xlsx', 'xls', 'csv'].includes(namedExtension || '')
        ? namedExtension
        : picked.type?.toLowerCase().includes('csv')
          ? 'csv'
          : picked.type?.toLowerCase().includes('excel') || picked.type?.toLowerCase().includes('spreadsheet')
            ? 'xlsx'
            : namedExtension;
      if (!picked.hasRequestedType && !['xlsx', 'xls', 'csv'].includes(extension || '')) {
        throw new Error('Choose an Excel (.xlsx or .xls) or CSV (.csv) file.');
      }

      const copy = await keepLocalCopy({
        destination: 'cachesDirectory',
        files: [{
          uri: picked.uri,
          fileName,
          ...(picked.isVirtual && picked.convertibleToMimeTypes?.[0]?.mimeType
            ? { convertVirtualFileToType: picked.convertibleToMimeTypes[0].mimeType }
            : {}),
        }],
      });
      if (copy[0]?.status !== 'success') {
        throw new Error(copy[0]?.copyError || 'Could not read the selected file.');
      }

      // Document providers may return an encoded local URI (for example, spaces as %20).
      const localPath = decodeURIComponent(copy[0].localUri.replace(/^file:\/\//, ''));
      let result: ImportValidationResult;
      if (extension === 'csv') {
        const csv = await FileSystem.readFile(localPath, 'utf8');
        setCsvInput(csv);
        result = await ExcelService.parseCSVString(csv, existingItems);
      } else {
        const base64 = await FileSystem.readFile(localPath, 'base64');
        setCsvInput('');
        result = await ExcelService.parseXLSXBase64(base64, existingItems);
      }
      setSourceFileName(fileName);
      setValidationResult(result);
    } catch (error: any) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Could not read spreadsheet', error?.message || 'Select a valid Excel or CSV file and try again.');
    } finally {
      setIsPickingFile(false);
    }
  };

  const handleValidate = async () => {
    Keyboard.dismiss();
    if (!csvInput.trim()) {
      Alert.alert('Empty Data', 'Please paste CSV/Excel content or load the sample template.');
      return;
    }
    setIsValidating(true);
    try {
      const res = await ExcelService.parseCSVString(csvInput, existingItems);
      setValidationResult(res);
      setSourceFileName('Pasted CSV data');
    } catch (e: any) {
      Alert.alert('Parsing Error', e.message || 'Failed to parse file content.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!validationResult || validationResult.validItems.length === 0) {
      Alert.alert('No valid items', 'There are no valid rows to import.');
      return;
    }
    setIsImporting(true);
    try {
      const count = await ExcelService.commitBulkImport(
        validationResult.validItems,
        existingItems
      );
      Alert.alert(
        'Import Successful!',
        `Successfully imported and updated ${count} mobile models with price history.`,
        [
          {
            text: 'Done',
            onPress: () => {
              onImportComplete(count);
              onClose();
              setValidationResult(null);
              setCsvInput('');
              setSourceFileName('');
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'Error updating price list.');
    } finally {
      setIsImporting(false);
    }
  };

  const isKeyboardActive = keyboardHeight > 0;
  const dynamicMaxHeight = isKeyboardActive
    ? Math.max(260, screenHeight - keyboardHeight - (Platform.OS === 'android' ? 36 : 50))
    : '92%';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={isKeyboardActive ? Keyboard.dismiss : onClose}
        />
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              maxHeight: dynamicMaxHeight as any,
              marginBottom: isKeyboardActive ? keyboardHeight : 0,
              paddingBottom: isKeyboardActive ? 12 : Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                Smart Excel / CSV Import
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Import Excel and CSV price sheets with automatic column detection
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close import modal"
              accessibilityRole="button"
            >
              <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.body}
            contentContainerStyle={{
              paddingBottom: isKeyboardActive
                ? 16
                : Math.max(insets.bottom, 24) + 20,
            }}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* Choose a spreadsheet or use paste/sample input */}
            <View style={styles.sampleRow}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Excel Sheet Content (CSV / XLSX)
              </Text>
              <View style={styles.fileActions}>
                <TouchableOpacity
                  onPress={handleLoadSample}
                  style={[styles.sampleBtn, { borderColor: colors.primary }]}
                >
                  <Text style={[styles.sampleBtnText, { color: colors.primary }]}>Load Sample Sheet (PDF Example)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePickFile}
                  disabled={isPickingFile}
                  style={[styles.sampleBtn, styles.chooseFileBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: isPickingFile ? 0.65 : 1 }]}
                >
                  <Text style={[styles.sampleBtnText, { color: '#FFFFFF' }]}>
                    {isPickingFile ? 'Reading…' : 'Choose Excel / CSV'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>Reads .xlsx, .xls, and .csv on this device. Headers can appear below a title row.</Text>

            <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 8, marginTop: 12 }]}>Or paste CSV data</Text>

            {/* Input area */}
            <TextInput
              ref={textInputRef}
              multiline
              numberOfLines={6}
              value={csvInput}
              onChangeText={text => {
                setCsvInput(text);
                setValidationResult(null);
              }}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }, 100);
              }}
              placeholder={`Paste CSV data or upload:\nBrand,Model,RAM,Storage,Purchase Price,Selling Price\nVivo,V50,8GB,128GB,22000,24999\nOppo,Reno 14,8GB,256GB,28000,31999`}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                  borderColor: colors.border,
                  color: colors.text,
                  maxHeight: isKeyboardActive ? 150 : 220,
                },
              ]}
              scrollEnabled={true}
              textAlignVertical="top"
            />

            <View style={styles.validateRow}>
              <Button
                title={isValidating ? 'Validating Data...' : 'Validate & Detect Data'}
                icon={<AppIcon name="search" size={16} color="#FFFFFF" />}
                onPress={handleValidate}
                loading={isValidating}
                variant="primary"
                style={{ flex: 1 }}
              />
            </View>

            {/* Validation Results & Preview */}
            {validationResult ? (
              <View style={styles.resultsContainer}>
                {!!sourceFileName && (
                  <Text style={[styles.sourceLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    Source: {sourceFileName}{validationResult.sheetName ? ` · Sheet: ${validationResult.sheetName}` : ''}
                  </Text>
                )}
                <Text style={[styles.resultTitle, { color: colors.text }]}>
                  Clean import preview
                </Text>
                <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Headers detected on row {validationResult.headerRowNumber}: {validationResult.detectedColumns.join(' · ')}
                </Text>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View
                    style={[
                      styles.statBox,
                      { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF' },
                    ]}
                  >
                    <Text style={[styles.statNum, { color: colors.primary }]}>
                      {validationResult.totalRowsProcessed}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Processed
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statBox,
                      { backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ECFDF5' },
                    ]}
                  >
                    <Text style={[styles.statNum, { color: colors.accent }]}>
                      {validationResult.newCount}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      New Models
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statBox,
                      { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB' },
                    ]}
                  >
                    <Text style={[styles.statNum, { color: colors.warning }]}>
                      {validationResult.updatedCount}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Price Updates
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor:
                          validationResult.errorRows.length > 0
                            ? isDark
                              ? 'rgba(239,68,68,0.1)'
                              : '#FEF2F2'
                            : isDark
                            ? 'rgba(255,255,255,0.03)'
                            : '#F8FAFC',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statNum,
                        {
                          color:
                            validationResult.errorRows.length > 0
                              ? colors.danger
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {validationResult.errorRows.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Invalid Rows
                    </Text>
                  </View>
                </View>

                {/* Detected Models Preview */}
                <Text style={[styles.previewHeading, { color: colors.text }]}>
                  Detected Models Preview ({validationResult.validItems.length})
                </Text>

                {validationResult.validItems.slice(0, 5).map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.previewItem,
                      { borderColor: colors.border, backgroundColor: colors.card },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewItemName, { color: colors.text }]}>
                        {item.brand} {item.model}
                      </Text>
                      <Text style={[styles.previewItemVariant, { color: colors.textSecondary }]}>
                        {item.ram} / {item.storage}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.previewItemPrice, { color: colors.accent }]}>
                        Sell: {formatCurrency(item.sellingPrice)}
                      </Text>
                      <Text style={[styles.previewItemCost, { color: colors.textMuted }]}>
                        Buy: {formatCurrency(item.purchasePrice)}
                      </Text>
                    </View>
                  </View>
                ))}

                {validationResult.validItems.length > 5 && (
                  <Text style={[styles.moreText, { color: colors.textMuted }]}>
                    + {validationResult.validItems.length - 5} more models ready to import
                  </Text>
                )}

                {/* Error Rows Report */}
                {validationResult.errorRows.length > 0 && (
                  <View style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2' }]}>
                    <Text style={[styles.errorTitle, { color: colors.danger }]}>
                      ⚠️ Invalid Rows Detected:
                    </Text>
                    {validationResult.errorRows.map((err, eIdx) => (
                      <Text key={eIdx} style={[styles.errorText, { color: colors.danger }]}>
                        Row {err.rowNumber}: {err.reason}
                      </Text>
                    ))}
                  </View>
                )}

                {/* One Click Update Button */}
                <Button
                  title={
                    isImporting
                      ? 'Updating Price List...'
                      : `⚡ One-Click Update (${validationResult.validItems.length} Models)`
                  }
                  onPress={handleCommit}
                  loading={isImporting}
                  variant="success"
                  size="large"
                  style={{ marginTop: 16 }}
                />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...(StyleSheet.absoluteFill as any),
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  body: {
    padding: 16,
  },
  sampleRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 8,
  },
  fileActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  chooseFileBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  helperText: { fontSize: 12, lineHeight: 17 },
  sourceLabel: { fontSize: 12, marginBottom: 4 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sampleBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sampleBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  validateRow: {
    marginTop: 10,
  },
  resultsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  statNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  previewHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  previewItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewItemVariant: {
    fontSize: 12,
    marginTop: 1,
  },
  previewItemPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewItemCost: {
    fontSize: 11,
  },
  moreText: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 4,
  },
  errorContainer: {
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
  },
});
