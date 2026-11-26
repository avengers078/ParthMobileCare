import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus, Check, ArrowUpRight, Pencil, Trash2, Camera, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  PrimaryButton,
  Input,
  SearchInput,
  FilterChip,
  ModalCard,
  SectionHeader,
  EmptyState,
  AppIcon,
  DocumentCapture,
} from '../components';
import { CustomerLead, LeadStatus } from '../types';
import { StorageService } from '../services/storageService';
import { LeadService } from '../services/leadService';
import { CloudinaryService } from '../services/cloudinaryService';
import { FirestoreSyncService, FIRESTORE_COLLECTIONS } from '../services/firestoreSync';
import {
  formatCurrency,
  formatDate,
  toDisplayDate,
  toStorageDate,
  getTodayDisplayDate,
  formatTime,
} from '../utils/format';
import { sendWhatsAppMessage, makePhoneCall, MESSAGE_TEMPLATES } from '../utils/whatsapp';
import { BRANDS } from '../constants';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';
import {
  getMobileNumberError,
  sanitizeMobileNumber,
  validateMobileNumber,
} from '../utils/validation';

const parseTimeToMinutes = (timeStr: string): number => {
  const isPM = /pm/i.test(timeStr);
  const isAM = /am/i.test(timeStr);
  const clean = timeStr.replace(/[^0-9:]/g, '');
  const parts = clean.split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
};

const isDateToday = (displayDate: string): boolean => {
  return displayDate === getTodayDisplayDate();
};

const isTimePastForToday = (displayDate: string, timeStr: string): boolean => {
  if (!isDateToday(displayDate)) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const chosenMinutes = parseTimeToMinutes(timeStr);
  return chosenMinutes < currentMinutes;
};

const getStatusVariant = (s: LeadStatus): 'primary' | 'warning' | 'info' | 'success' | 'danger' | 'dark' => {
  switch (s) {
    case 'new':
      return 'primary';
    case 'follow_up':
      return 'warning';
    case 'interested':
      return 'info';
    case 'purchased':
      return 'success';
    case 'lost':
      return 'danger';
    default:
      return 'dark';
  }
};

export const LeadListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { currentUser, isAdmin } = useAuth();
  const { colors, isDark } = useTheme();
  const { showSuccess, showError, showWarning, showConfirm } = useAlert();
  // Since LeadListScreen is rendered inside Tab.Navigator, the screen ends right at the top
  // of the bottom tab bar. A clean 16dp margin positions the FAB naturally above the tab bar.
  const fabBottom = SPACING.lg;

  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CustomerLead | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [altPhoneError, setAltPhoneError] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('Vivo');
  const [model, setModel] = useState('');
  const [budget, setBudget] = useState('');
  const [remarks, setRemarks] = useState('');
  const [inquiryPhotos, setInquiryPhotos] = useState<string[]>([]);
  const [isUploadingInquiryPhoto, setIsUploadingInquiryPhoto] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(getTodayDisplayDate());
  const [followUpDateError, setFollowUpDateError] = useState('');
  const [followUpTime, setFollowUpTime] = useState('05:00 PM');
  const [followUpTimeError, setFollowUpTimeError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field refs for error autofocus
  const nameInputRef = useRef<any>(null);
  const phoneInputRef = useRef<any>(null);
  const altPhoneInputRef = useRef<any>(null);
  const followUpDateInputRef = useRef<any>(null);
  const followUpTimeInputRef = useRef<any>(null);

  // Edit Form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneError, setEditPhoneError] = useState('');
  const [editAltPhone, setEditAltPhone] = useState('');
  const [editAltPhoneError, setEditAltPhoneError] = useState('');
  const [editBrand, setEditBrand] = useState('Vivo');
  const [editModel, setEditModel] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editInquiryPhotos, setEditInquiryPhotos] = useState<string[]>([]);
  const [isUploadingEditInquiryPhoto, setIsUploadingEditInquiryPhoto] = useState(false);
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [editFollowUpDateError, setEditFollowUpDateError] = useState('');
  const [editFollowUpTime, setEditFollowUpTime] = useState('05:00 PM');
  const [editFollowUpTimeError, setEditFollowUpTimeError] = useState('');

  const isFirstLoadRef = useRef(true);

  const loadLeads = useCallback(async () => {
    if (!currentUser) return;
    const list = await LeadService.getLeadsForUser(currentUser);
    setLeads(list);
  }, [currentUser]);

  // Reload leads on initial mount and whenever this screen regains focus
  useEffect(() => {
    loadLeads();
    const unsubscribeFocus = navigation?.addListener?.('focus', () => {
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        return; // Prevent redundant double load on initial mount
      }
      loadLeads();
    });
    return unsubscribeFocus;
  }, [navigation, loadLeads]);

  // Real-time synchronization with Cloud Firestore
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribeSnapshot = FirestoreSyncService.subscribeToLeads(
      currentUser,
      async (remoteLeads) => {
        if (remoteLeads && remoteLeads.length > 0) {
          await StorageService.mergeCloudCollection(FIRESTORE_COLLECTIONS.LEADS, remoteLeads);
          const list = await LeadService.getLeadsForUser(currentUser);
          setLeads(list);
        }
      },
      (err) => {
        if (__DEV__) console.warn('[LeadListScreen] Cloud leads subscription error:', err);
      }
    );
    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [currentUser]);

  const handleCreateLead = async () => {
    if (!name.trim()) {
      nameInputRef.current?.focus();
      showWarning('Validation Error', 'Customer name is required.');
      return;
    }
    const phoneErr = getMobileNumberError(phone, true);
    if (phoneErr) {
      setPhoneError(phoneErr);
      phoneInputRef.current?.focus();
      showWarning('Validation Error', phoneErr);
      return;
    }
    setPhoneError('');

    const altErr = getMobileNumberError(altPhone, false);
    if (altErr) {
      setAltPhoneError(altErr);
      altPhoneInputRef.current?.focus();
      showWarning('Validation Error', altErr);
      return;
    }
    setAltPhoneError('');

    let finalStorageDate: string | undefined = undefined;
    if (followUpDate.trim()) {
      if (!/^\d{2}-\d{2}-\d{4}$/.test(followUpDate.trim())) {
        setFollowUpDateError('Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
        followUpDateInputRef.current?.focus();
        showWarning('Validation Error', 'Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
        return;
      }
      setFollowUpDateError('');
      finalStorageDate = toStorageDate(followUpDate.trim());
    }

    if (followUpDate.trim() && isTimePastForToday(followUpDate.trim(), followUpTime)) {
      setFollowUpTimeError('Reminder time cannot be in the past for today.');
      followUpTimeInputRef.current?.focus();
      showWarning('Invalid Time', 'Reminder time cannot be in the past for today.');
      return;
    }
    setFollowUpTimeError('');

    if (!currentUser) return;

    setIsSubmitting(true);
    try {
      await LeadService.createLead(
        {
          name: name.trim(),
          phone: phone.trim(),
          alternatePhone: altPhone.trim() || undefined,
          interestedBrand: selectedBrand,
          interestedModel: model.trim() || 'General Inquiry',
          budget: parseFloat(budget) || 0,
          remarks: remarks.trim(),
          inquiryPhotos: inquiryPhotos.length > 0 ? inquiryPhotos : undefined,
          repairPhotos: inquiryPhotos.length > 0 ? inquiryPhotos : undefined,
          followUpDate: finalStorageDate,
          followUpTime: followUpTime || undefined,
          createdBy: currentUser.id,
          createdByName: currentUser.name,
        },
        currentUser,
        'new',
        false // Do not disrupt form workflow with external app intent redirects
      );

      // Immediately refresh leads in local state so the new lead is visible right away
      await loadLeads();

      // Dismiss modal and reset form
      setAddModalVisible(false);
      resetForm();

      showSuccess(
        'Lead Created!',
        'Customer lead registered and automated follow-up reminder scheduled.'
      );
    } catch (e: any) {
      showError('Error', e.message || 'Failed to save lead.');
      // Form fields and modal remain open so data is preserved for retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: LeadStatus) => {
    if (!selectedLead || !currentUser) return;
    try {
      const updated = await LeadService.updateLeadStatus(
        selectedLead.id,
        newStatus,
        `Status updated to ${newStatus.toUpperCase()}`,
        currentUser
      );
      if (updated) {
        setSelectedLead(updated);
        loadLeads();
        showSuccess('Status Updated', `Lead status is now ${newStatus.toUpperCase()}`);
      }
    } catch (e: any) {
      showError('Update Failed', e);
    }
  };

  const handleOpenEdit = (lead: CustomerLead) => {
    setSelectedLead(lead);
    setEditName(lead.name);
    setEditPhone(lead.phone);
    setEditPhoneError('');
    setEditAltPhone(lead.alternatePhone || '');
    setEditAltPhoneError('');
    setEditBrand(lead.interestedBrand);
    setEditModel(lead.interestedModel);
    setEditBudget(lead.budget.toString());
    setEditRemarks(lead.remarks);
    setEditInquiryPhotos(lead.inquiryPhotos || lead.repairPhotos || []);
    setIsUploadingEditInquiryPhoto(false);
    setEditFollowUpDate(lead.followUpDate ? toDisplayDate(lead.followUpDate) : '');
    setEditFollowUpDateError('');
    setEditFollowUpTime(lead.followUpTime ? formatTime(lead.followUpTime) : '05:00 PM');
    setEditFollowUpTimeError('');
    setDetailModalVisible(false);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedLead || !currentUser) return;
    if (!editName.trim()) {
      showWarning('Validation Error', 'Customer name is required.');
      return;
    }
    const phoneErr = getMobileNumberError(editPhone, true);
    if (phoneErr) {
      setEditPhoneError(phoneErr);
      showWarning('Validation Error', phoneErr);
      return;
    }
    setEditPhoneError('');

    const altErr = getMobileNumberError(editAltPhone, false);
    if (altErr) {
      setEditAltPhoneError(altErr);
      showWarning('Validation Error', altErr);
      return;
    }
    setEditAltPhoneError('');

    let finalStorageDate: string | undefined = undefined;
    if (editFollowUpDate.trim()) {
      if (!/^\d{2}-\d{2}-\d{4}$/.test(editFollowUpDate.trim())) {
        setEditFollowUpDateError('Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
        showWarning('Validation Error', 'Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
        return;
      }
      setEditFollowUpDateError('');
      finalStorageDate = toStorageDate(editFollowUpDate.trim());
    }

    if (editFollowUpDate.trim() && isTimePastForToday(editFollowUpDate.trim(), editFollowUpTime)) {
      setEditFollowUpTimeError('Reminder time cannot be in the past for today.');
      showWarning('Invalid Time', 'Reminder time cannot be in the past for today.');
      return;
    }
    setEditFollowUpTimeError('');

    try {
      const updated = await LeadService.updateLeadDetails(
        selectedLead.id,
        {
          name: editName.trim(),
          phone: editPhone.trim(),
          alternatePhone: editAltPhone.trim() || undefined,
          interestedBrand: editBrand,
          interestedModel: editModel.trim() || 'General Inquiry',
          budget: parseFloat(editBudget) || 0,
          remarks: editRemarks.trim(),
          inquiryPhotos: editInquiryPhotos,
          repairPhotos: editInquiryPhotos,
          followUpDate: finalStorageDate,
          followUpTime: editFollowUpTime || undefined,
        },
        currentUser
      );

      if (updated) {
        setSelectedLead(updated);
        showSuccess('Lead Updated', 'Customer lead information saved successfully.');
        setEditModalVisible(false);
        loadLeads();
      }
    } catch (e: any) {
      showError('Update Failed', e);
    }
  };

  const handleDeleteLead = (lead: CustomerLead) => {
    showConfirm({
      title: 'Delete Lead',
      message: `Are you sure you want to delete lead for ${lead.name}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        try {
          await LeadService.deleteLead(lead.id);
          setDetailModalVisible(false);
          setSelectedLead(null);
          loadLeads();
          showSuccess('Deleted', 'Lead was deleted successfully.');
        } catch (e: any) {
          showError('Error', e);
        }
      },
    });
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setPhoneError('');
    setAltPhone('');
    setAltPhoneError('');
    setSelectedBrand('Vivo');
    setModel('');
    setBudget('');
    setRemarks('');
    setInquiryPhotos([]);
    setIsUploadingInquiryPhoto(false);
    setFollowUpDate(getTodayDisplayDate());
    setFollowUpDateError('');
    setFollowUpTime('05:00 PM');
    setFollowUpTimeError('');
  };

  const filteredLeads = useMemo(() => {
    const isAll = filterStatus === 'All';
    const targetStatus = filterStatus.toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    return leads.filter(l => {
      const matchesFilter = isAll || l.status === targetStatus;
      if (!matchesFilter) return false;
      if (!query) return true;
      return (
        l.name.toLowerCase().includes(query) ||
        l.phone.includes(query) ||
        l.interestedBrand.toLowerCase().includes(query) ||
        l.interestedModel.toLowerCase().includes(query)
      );
    });
  }, [leads, filterStatus, searchQuery]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: leads.length,
      new: 0,
      follow_up: 0,
      interested: 0,
      purchased: 0,
      lost: 0,
    };
    for (let i = 0; i < leads.length; i++) {
      const st = leads[i].status;
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    }
    return counts;
  }, [leads]);

  const keyExtractor = useCallback((item: CustomerLead) => item.id, []);

  const renderLeadItem = useCallback(
    ({ item }: { item: CustomerLead }) => (
      <AppCard
        style={styles.leadCard}
        onPress={() => {
          setSelectedLead(item);
          setDetailModalVisible(true);
        }}
      >
        {/* Card Top: Avatar, Name, Company/Device, and Arrow Up-Right ↗ */}
        <View style={styles.leadHeader}>
          <View style={[styles.avatarCircle, { backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {item.name ? item.name.charAt(0).toUpperCase() : 'C'}
            </Text>
          </View>

          <View style={styles.leadHeaderInfo}>
            <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.deviceSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.interestedBrand} • {item.interestedModel}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.arrowButton, { backgroundColor: colors.borderLight }]}
            onPress={() => {
              setSelectedLead(item);
              setDetailModalVisible(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowUpRight size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sub Details: Phone and Follow-Up Date */}
        <View style={styles.metaRow}>
          <Text style={[styles.metaItem, { color: colors.textSecondary }]}>
            {item.phone}
          </Text>
          {item.followUpDate ? (
            <Text style={[styles.metaItem, { color: colors.warning }]}>
              {formatDate(item.followUpDate)}
            </Text>
          ) : (
            <Text style={[styles.metaItem, { color: colors.textMuted }]}>
              {formatDate(item.createdAt)}
            </Text>
          )}
        </View>

        {item.remarks ? (
          <Text style={[styles.remarksText, { color: colors.textMuted }]} numberOfLines={1}>
            "{item.remarks}"
          </Text>
        ) : null}

        {/* Card Bottom: Status Pill Badge and Budget */}
        <View style={styles.leadFooter}>
          <StatusBadge
            label={item.status.replace('_', ' ').toUpperCase()}
            variant={getStatusVariant(item.status)}
            size="small"
          />

          <Text
            style={[styles.budgetText, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatCurrency(item.budget)}
          </Text>
        </View>

        {/* Quick Action Footer: Call, WhatsApp, View Details */}
        <View style={[styles.actionsFooter, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
            onPress={() => makePhoneCall(item.phone)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.actionBtnText, { color: colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Call
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: '#25D366', borderColor: '#25D366' }]}
            onPress={() =>
              sendWhatsAppMessage(
                item.phone,
                item.status === 'purchased'
                  ? MESSAGE_TEMPLATES.PURCHASE_COMPLETED
                  : MESSAGE_TEMPLATES.FOLLOW_UP_REMINDER(
                      `${item.interestedBrand} ${item.interestedModel}`
                    )
              )
            }
            activeOpacity={0.7}
          >
            <Text
              style={[styles.actionBtnText, { color: '#FFFFFF' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              WhatsApp
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickActionBtn,
              {
                borderColor: colors.primary,
                backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
            onPress={() => {
              setSelectedLead(item);
              setDetailModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.actionBtnText, { color: colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Details
            </Text>
            <ArrowUpRight size={13} color={colors.primary} style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>
      </AppCard>
    ),
    [colors, isDark]
  );

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Leads"
        subtitle="Customer inquiries & sales"
      />

      <View style={styles.topFilterSection}>
        {/* Sticky LeadIQ Search Bar */}
        <SearchInput
          placeholder="Search by name, phone or model..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />

        {/* Filter by stage heading */}
        <Text style={[styles.filterHeading, { color: colors.textSecondary }]}>
          Filter by stage
        </Text>

        {/* LeadIQ CRM Pill Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {['All', 'New', 'Follow_Up', 'Interested', 'Purchased', 'Lost'].map(f => (
            <FilterChip
              key={f}
              label={f.replace('_', ' ')}
              active={filterStatus === f}
              onPress={() => setFilterStatus(f)}
              count={
                f === 'All'
                  ? stageCounts.all
                  : (stageCounts[f.toLowerCase()] || 0)
              }
            />
          ))}
        </ScrollView>
      </View>

      {/* Leads List */}
      <FlatList
        data={filteredLeads}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={renderLeadItem}
        ListEmptyComponent={
          <EmptyState
            icon={<AppIcon name="users" size={28} color={colors.primary} />}
            title="No Leads Found"
            description="No customer leads match your current search or filter."
            actionTitle="+ Add New Lead"
            onActionPress={() => setAddModalVisible(true)}
          />
        }
      />

      {/* Floating Action Button (FAB) for Add Lead */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: fabBottom,
          },
        ]}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add Lead"
      >
        <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
        <Text style={styles.fabText} numberOfLines={1}>
          Add Lead
        </Text>
      </TouchableOpacity>

      {/* Add Lead Modal */}
      {addModalVisible && (
        <ModalCard
          visible={addModalVisible}
          onClose={() => setAddModalVisible(false)}
          title="Add Customer"
          subtitle="Save customer details & follow-up"
        >
        <Input
          ref={nameInputRef}
          label="Customer Name *"
          placeholder="e.g. Rajesh Kumar"
          autoCapitalize="words"
          returnKeyType="next"
          value={name}
          onChangeText={setName}
        />
        <Input
          ref={phoneInputRef}
          label="Mobile Number *"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setPhone(clean);
            setPhoneError(validateMobileNumber(clean, true, true, val));
          }}
          onBlur={() => {
            setPhoneError(getMobileNumberError(phone, true));
          }}
          error={phoneError}
        />
        <Input
          ref={altPhoneInputRef}
          label="Alternate Mobile (Optional)"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={altPhone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setAltPhone(clean);
            setAltPhoneError(validateMobileNumber(clean, false, false, val));
          }}
          onBlur={() => {
            setAltPhoneError(getMobileNumberError(altPhone, false));
          }}
          error={altPhoneError}
        />

        {/* Brand Selector Chips */}
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
          Interested Brand *
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: SPACING.xs }}>
          {BRANDS.filter(b => b !== 'All').map(b => (
            <FilterChip
              key={b}
              label={b}
              active={selectedBrand === b}
              onPress={() => setSelectedBrand(b)}
            />
          ))}
        </ScrollView>

        <Input
          label="Model / Variant"
          placeholder="e.g. Vivo V50 128GB"
          value={model}
          onChangeText={setModel}
        />
        <Input
          label="Budget (₹)"
          placeholder="25000"
          keyboardType="numeric"
          value={budget}
          onChangeText={setBudget}
        />
        <Input
          ref={followUpDateInputRef}
          label="Next Follow-up Date"
          placeholder="DD-MM-YYYY (e.g. 09-10-2026)"
          keyboardType="numeric"
          maxLength={10}
          value={followUpDate}
          onChangeText={(val) => {
            setFollowUpDate(val);
            if (!val.trim()) {
              setFollowUpDateError('');
            } else if (!/^\d{2}-\d{2}-\d{4}$/.test(val.trim())) {
              setFollowUpDateError('Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
            } else {
              setFollowUpDateError('');
            }
          }}
          error={followUpDateError}
        />

        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
          Next Follow-up Time *
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: SPACING.xs }}>
          {['10:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM', '07:30 PM'].map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={followUpTime === t}
              onPress={() => {
                setFollowUpTime(t);
                if (followUpDate.trim() && isTimePastForToday(followUpDate.trim(), t)) {
                  setFollowUpTimeError('Reminder time cannot be in the past for today.');
                } else {
                  setFollowUpTimeError('');
                }
              }}
            />
          ))}
        </ScrollView>
        <Input
          placeholder="e.g. 05:00 PM"
          value={followUpTime}
          onChangeText={(val) => {
            setFollowUpTime(val);
            if (followUpDate.trim() && isTimePastForToday(followUpDate.trim(), val)) {
              setFollowUpTimeError('Reminder time cannot be in the past for today.');
            } else {
              setFollowUpTimeError('');
            }
          }}
          error={followUpTimeError}
        />
        <Input
          label="Notes / Remarks"
          placeholder="Customer requirements, exchange offer..."
          multiline
          numberOfLines={3}
          value={remarks}
          onChangeText={setRemarks}
        />

        {/* Device Repair / Issue Photos */}
        <View style={{ marginTop: SPACING.sm, marginBottom: SPACING.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
              Device Issue / Repair Photos ({inquiryPhotos.length}/3)
            </Text>
            {isUploadingInquiryPhoto && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.primary }}>Uploading to CDN...</Text>
              </View>
            )}
          </View>

          {inquiryPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {inquiryPhotos.map((url, idx) => (
                <View key={idx} style={{ position: 'relative', marginRight: 8 }}>
                  <Image
                    source={{ uri: CloudinaryService.getDeviceThumbnailUrl(url) }}
                    style={{ width: 68, height: 68, borderRadius: 8, backgroundColor: '#E2E8F0' }}
                  />
                  <TouchableOpacity
                    onPress={() => setInquiryPhotos(prev => prev.filter((_, i) => i !== idx))}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: 10,
                      width: 20,
                      height: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {inquiryPhotos.length < 3 && (
            <DocumentCapture
              label="Add Device Photo (Damage / Screen / Issue)"
              hint={
                CloudinaryService.isConfigured()
                  ? "Uploads repair photo to secure Cloud CDN"
                  : "Cloud photo upload is paused until storage is connected"
              }
              maxSelection={3 - inquiryPhotos.length}
              onCaptureMany={async (uris) => {
                if (!CloudinaryService.isConfigured()) return;
                setIsUploadingInquiryPhoto(true);
                try {
                  const uploaded: string[] = [];
                  for (const uri of uris.slice(0, 3 - inquiryPhotos.length)) {
                    const result = await CloudinaryService.uploadImage(uri, {
                      folder: 'leads',
                      tags: ['repair_inquiry', selectedBrand],
                    });
                    if (result.success && result.secureUrl) uploaded.push(result.secureUrl);
                    else showError('Upload Failed', result.error || 'Could not upload one of the selected photos.');
                  }
                  setInquiryPhotos(prev => [...prev, ...uploaded].slice(0, 3));
                } catch (err: any) {
                  showError('Upload Error', err?.message || 'Network error.');
                } finally {
                  setIsUploadingInquiryPhoto(false);
                }
              }}
              onCapture={async (uri) => {
                if (!uri) return;
                if (!CloudinaryService.isConfigured()) {
                  showError(
                    'Cloud Storage Disconnected',
                    'Cloud image upload is temporarily paused until a new storage provider is connected. Lead can still be saved normally.'
                  );
                  return;
                }
                setIsUploadingInquiryPhoto(true);
                try {
                  const uploadRes = await CloudinaryService.uploadImage(uri, {
                    folder: 'leads',
                    tags: ['repair_inquiry', selectedBrand],
                  });
                  if (uploadRes.success && uploadRes.secureUrl) {
                    setInquiryPhotos(prev => [...prev, uploadRes.secureUrl!]);
                  } else {
                    showError('Upload Failed', uploadRes.error || 'Could not upload photo.');
                  }
                } catch (err: any) {
                  showError('Upload Error', err?.message || 'Network error.');
                } finally {
                  setIsUploadingInquiryPhoto(false);
                }
              }}
            />
          )}
        </View>

        <PrimaryButton
          title={isSubmitting ? 'Saving...' : 'Save Customer'}
          icon={!isSubmitting ? <Check size={18} color="#FFFFFF" strokeWidth={2.5} /> : undefined}
          onPress={handleCreateLead}
          loading={isSubmitting}
          size="large"
          style={{ marginTop: SPACING.lg }}
        />
      </ModalCard>
      )}

      {/* Lead Details Modal (Matching 3rd Phone in LeadIQ reference!) */}
      {detailModalVisible && selectedLead && (
        <ModalCard
          visible={detailModalVisible}
          onClose={() => setDetailModalVisible(false)}
          title="Lead Details"
          subtitle={`Added on ${formatDate(selectedLead.createdAt)} by ${selectedLead.createdByName}`}
        >
          <View>
            {/* Top Profile Header */}
            <View style={styles.detailHeroSection}>
              <View style={[styles.detailHeroAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.detailHeroAvatarText}>
                  {selectedLead.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <Text style={[styles.detailHeroName, { color: colors.text }]}>
                {selectedLead.name}
              </Text>
              <Text style={[styles.detailHeroSub, { color: colors.textSecondary }]}>
                {selectedLead.interestedBrand} • {selectedLead.interestedModel}
              </Text>

              <Text style={[styles.detailHeroBudget, { color: colors.primary }]}>
                {formatCurrency(selectedLead.budget)}
              </Text>

              {/* Call and WhatsApp Circular Icon Buttons */}
              <View style={styles.detailHeroActions}>
                <TouchableOpacity
                  style={[styles.heroActionCircle, { backgroundColor: colors.primary }]}
                  onPress={() => makePhoneCall(selectedLead.phone)}
                >
                  <AppIcon name="phone" size={18} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.heroActionCircle, { backgroundColor: '#22C55E' }]}
                  onPress={() =>
                    sendWhatsAppMessage(
                      selectedLead.phone,
                      MESSAGE_TEMPLATES.FOLLOW_UP_REMINDER(
                        `${selectedLead.interestedBrand} ${selectedLead.interestedModel}`
                      )
                    )
                  }
                >
                  <AppIcon name="message" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Contact Information Cards */}
            <SectionHeader title="Contact Information" />

            <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOWS.subtle]}>
              <AppIcon name="file" size={18} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.contactVal, { color: colors.text }]}>
                  {selectedLead.phone}
                </Text>
                <Text style={[styles.contactLbl, { color: colors.textSecondary }]}>
                  Primary Phone
                </Text>
              </View>
            </View>

            {selectedLead.alternatePhone ? (
              <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOWS.subtle]}>
                <AppIcon name="smartphone" size={18} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.contactVal, { color: colors.text }]}>
                    {selectedLead.alternatePhone}
                  </Text>
                  <Text style={[styles.contactLbl, { color: colors.textSecondary }]}>
                    Alternate Contact
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOWS.subtle]}>
              <AppIcon name="clock" size={18} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.contactVal, { color: colors.warning }]}>
                  {selectedLead.followUpDate
                    ? `${toDisplayDate(selectedLead.followUpDate)}${selectedLead.followUpTime ? ` at ${formatTime(selectedLead.followUpTime)}` : ''}`
                    : 'No follow-up set'}
                </Text>
                <Text style={[styles.contactLbl, { color: colors.textSecondary }]}>
                  Scheduled Follow-Up
                </Text>
              </View>
            </View>

            {/* Notes Section */}
            {selectedLead.remarks ? (
              <>
                <SectionHeader title="Notes & Requirements" />
                <View
                  style={[
                    styles.notesBox,
                    {
                      backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF',
                      borderColor: isDark ? 'rgba(37,99,235,0.3)' : '#BFDBFE',
                    },
                  ]}
                >
                  <Text style={[styles.notesText, { color: colors.text }]}>
                    {selectedLead.remarks}
                  </Text>
                </View>
              </>
            ) : null}

            {/* Device Damage / Repair Photos */}
            {((selectedLead.inquiryPhotos && selectedLead.inquiryPhotos.length > 0) || (selectedLead.repairPhotos && selectedLead.repairPhotos.length > 0)) && (
              <>
                <SectionHeader title="Device Issue / Repair Photos" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {((selectedLead.inquiryPhotos || selectedLead.repairPhotos) || []).map((imgUrl, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: CloudinaryService.getDeviceThumbnailUrl(imgUrl) }}
                      style={{ width: 75, height: 75, borderRadius: 8, marginRight: 8, backgroundColor: '#E2E8F0' }}
                    />
                  ))}
                </ScrollView>
              </>
            )}

            {/* Status Pipeline Switcher */}
            <SectionHeader title="Update Stage / Status" />

            <View style={styles.statusChipsContainer}>
              {(['new', 'follow_up', 'interested', 'purchased', 'lost'] as LeadStatus[]).map(st => (
                <FilterChip
                  key={st}
                  label={st.replace('_', ' ').toUpperCase()}
                  active={selectedLead.status === st}
                  onPress={() => handleUpdateStatus(st)}
                  style={{ marginBottom: 6 }}
                />
              ))}
            </View>

            {/* Timeline History */}
            <SectionHeader title="Recent Activity" />

            {selectedLead.history && selectedLead.history.length > 0 ? (
              selectedLead.history.map((item, idx) => (
                <View key={idx} style={[styles.timelineItem, { borderLeftColor: colors.primary }]}>
                  <Text style={[styles.timelineDate, { color: colors.textSecondary }]}>
                    {formatDate(item.timestamp)}
                  </Text>
                  <Text style={[styles.timelineNote, { color: colors.text }]}>
                    {item.notes} ({item.status.toUpperCase()})
                  </Text>
                  <Text style={[styles.timelineAuthor, { color: colors.textMuted }]}>
                    By {item.updatedBy}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 8 }}>
                No past timeline logs recorded.
              </Text>
            )}

            {/* Lead Management Action Buttons */}
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <TouchableOpacity
                style={[
                  styles.quickActionBtn,
                  {
                    height: 44,
                    borderColor: colors.primary,
                    backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  },
                ]}
                onPress={() => handleOpenEdit(selectedLead)}
                activeOpacity={0.7}
              >
                <Pencil size={15} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary, fontSize: 13 }]}>
                  Edit Lead Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickActionBtn,
                  {
                    height: 44,
                    borderColor: colors.danger,
                    backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  },
                ]}
                onPress={() => handleDeleteLead(selectedLead)}
                activeOpacity={0.7}
              >
                <Trash2 size={15} color={colors.danger} />
                <Text style={[styles.actionBtnText, { color: colors.danger, fontSize: 13 }]}>
                  Delete Lead
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ModalCard>
      )}

      {/* Edit Lead Modal */}
      {editModalVisible && selectedLead && (
        <ModalCard
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          title="Edit Customer"
          subtitle={`Editing details for ${selectedLead.name}`}
        >
        <Input
          label="Customer Name *"
          placeholder="e.g. Rajesh Kumar"
          autoCapitalize="words"
          returnKeyType="next"
          value={editName}
          onChangeText={setEditName}
        />
        <Input
          label="Mobile Number *"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={editPhone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setEditPhone(clean);
            setEditPhoneError(validateMobileNumber(clean, true, true, val));
          }}
          onBlur={() => {
            setEditPhoneError(getMobileNumberError(editPhone, true));
          }}
          error={editPhoneError}
        />
        <Input
          label="Alternate Mobile (Optional)"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={editAltPhone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setEditAltPhone(clean);
            setEditAltPhoneError(validateMobileNumber(clean, false, false, val));
          }}
          onBlur={() => {
            setEditAltPhoneError(getMobileNumberError(editAltPhone, false));
          }}
          error={editAltPhoneError}
        />

        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
          Interested Brand *
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: SPACING.xs }}>
          {BRANDS.filter(b => b !== 'All').map(b => (
            <FilterChip
              key={b}
              label={b}
              active={editBrand === b}
              onPress={() => setEditBrand(b)}
            />
          ))}
        </ScrollView>

        <Input
          label="Model / Variant"
          placeholder="e.g. Vivo V50 128GB"
          value={editModel}
          onChangeText={setEditModel}
        />
        <Input
          label="Budget (₹)"
          placeholder="25000"
          keyboardType="numeric"
          value={editBudget}
          onChangeText={setEditBudget}
        />
        <Input
          label="Next Follow-up Date"
          placeholder="DD-MM-YYYY (e.g. 09-10-2026)"
          keyboardType="numeric"
          maxLength={10}
          value={editFollowUpDate}
          onChangeText={(val) => {
            setEditFollowUpDate(val);
            if (!val.trim()) {
              setEditFollowUpDateError('');
            } else if (!/^\d{2}-\d{2}-\d{4}$/.test(val.trim())) {
              setEditFollowUpDateError('Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
            } else {
              setEditFollowUpDateError('');
            }
          }}
          error={editFollowUpDateError}
        />

        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
          Next Follow-up Time *
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: SPACING.xs }}>
          {['10:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM', '07:30 PM'].map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={editFollowUpTime === t}
              onPress={() => {
                setEditFollowUpTime(t);
                if (editFollowUpDate.trim() && isTimePastForToday(editFollowUpDate.trim(), t)) {
                  setEditFollowUpTimeError('Reminder time cannot be in the past for today.');
                } else {
                  setEditFollowUpTimeError('');
                }
              }}
            />
          ))}
        </ScrollView>
        <Input
          placeholder="e.g. 05:00 PM"
          value={editFollowUpTime}
          onChangeText={(val) => {
            setEditFollowUpTime(val);
            if (editFollowUpDate.trim() && isTimePastForToday(editFollowUpDate.trim(), val)) {
              setEditFollowUpTimeError('Reminder time cannot be in the past for today.');
            } else {
              setEditFollowUpTimeError('');
            }
          }}
          error={editFollowUpTimeError}
        />
        <Input
          label="Notes / Remarks"
          placeholder="Customer requirements, exchange offer..."
          multiline
          numberOfLines={3}
          value={editRemarks}
          onChangeText={setEditRemarks}
        />

        {/* Device Repair / Issue Photos */}
        <View style={{ marginTop: SPACING.sm, marginBottom: SPACING.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
              Device Issue / Repair Photos ({editInquiryPhotos.length}/3)
            </Text>
            {isUploadingEditInquiryPhoto && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.primary }}>Uploading to CDN...</Text>
              </View>
            )}
          </View>

          {editInquiryPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {editInquiryPhotos.map((url, idx) => (
                <View key={idx} style={{ position: 'relative', marginRight: 8 }}>
                  <Image
                    source={{ uri: CloudinaryService.getDeviceThumbnailUrl(url) }}
                    style={{ width: 68, height: 68, borderRadius: 8, backgroundColor: '#E2E8F0' }}
                  />
                  <TouchableOpacity
                    onPress={() => setEditInquiryPhotos(prev => prev.filter((_, i) => i !== idx))}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: 10,
                      width: 20,
                      height: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {editInquiryPhotos.length < 3 && (
            <DocumentCapture
              label="Add Device Photo (Damage / Screen / Issue)"
              hint={
                CloudinaryService.isConfigured()
                  ? "Uploads repair photo to secure Cloud CDN"
                  : "Cloud photo upload is paused until storage is connected"
              }
              maxSelection={3 - editInquiryPhotos.length}
              onCaptureMany={async (uris) => {
                if (!CloudinaryService.isConfigured()) return;
                setIsUploadingEditInquiryPhoto(true);
                try {
                  const uploaded: string[] = [];
                  for (const uri of uris.slice(0, 3 - editInquiryPhotos.length)) {
                    const result = await CloudinaryService.uploadImage(uri, {
                      folder: 'leads',
                      tags: ['repair_inquiry', editBrand],
                    });
                    if (result.success && result.secureUrl) uploaded.push(result.secureUrl);
                    else showError('Upload Failed', result.error || 'Could not upload one of the selected photos.');
                  }
                  setEditInquiryPhotos(prev => [...prev, ...uploaded].slice(0, 3));
                } catch (err: any) {
                  showError('Upload Error', err?.message || 'Network error.');
                } finally {
                  setIsUploadingEditInquiryPhoto(false);
                }
              }}
              onCapture={async (uri) => {
                if (!uri) return;
                if (!CloudinaryService.isConfigured()) {
                  showError(
                    'Cloud Storage Disconnected',
                    'Cloud image upload is temporarily paused until a new storage provider is connected.'
                  );
                  return;
                }
                setIsUploadingEditInquiryPhoto(true);
                try {
                  const uploadRes = await CloudinaryService.uploadImage(uri, {
                    folder: 'leads',
                    tags: ['repair_inquiry', editBrand],
                  });
                  if (uploadRes.success && uploadRes.secureUrl) {
                    setEditInquiryPhotos(prev => [...prev, uploadRes.secureUrl!]);
                  } else {
                    showError('Upload Failed', uploadRes.error || 'Could not upload photo.');
                  }
                } catch (err: any) {
                  showError('Upload Error', err?.message || 'Network error.');
                } finally {
                  setIsUploadingEditInquiryPhoto(false);
                }
              }}
            />
          )}
        </View>

        <PrimaryButton
          title="Update Customer"
          onPress={handleSaveEdit}
          size="large"
          style={{ marginTop: SPACING.lg }}
        />
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
  filterHeading: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
    paddingRight: SPACING.xxl,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 90,
  },
  leadCard: {
    marginVertical: SPACING.xs,
  },
  leadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  leadHeaderInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  customerName: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
  },
  deviceSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  arrowText: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  metaItem: {
    ...TYPOGRAPHY.caption,
  },
  remarksText: {
    ...TYPOGRAPHY.captionSmall,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  leadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  budgetText: {
    ...TYPOGRAPHY.h3,
    fontWeight: '800',
  },
  actionsFooter: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  quickActionBtn: {
    flex: 1,
    minWidth: 0,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionBtnText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
    textAlign: 'center',
  },
  formLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  detailHeroSection: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  detailHeroAvatar: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  detailHeroAvatarText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
  },
  detailHeroName: {
    ...TYPOGRAPHY.h2,
    fontWeight: '800',
  },
  detailHeroSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  detailHeroBudget: {
    ...TYPOGRAPHY.h1,
    fontSize: 24,
    marginVertical: SPACING.xs,
  },
  detailHeroActions: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.sm,
  },
  heroActionCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  contactIcon: {
    fontSize: 18,
  },
  contactVal: {
    ...TYPOGRAPHY.bodyBold,
  },
  contactLbl: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 1,
  },
  notesBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  notesText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    lineHeight: 20,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  timelineItem: {
    borderLeftWidth: 2,
    paddingLeft: SPACING.md,
    marginBottom: SPACING.md,
  },
  timelineDate: {
    ...TYPOGRAPHY.captionSmall,
  },
  timelineNote: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: 2,
  },
  timelineAuthor: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    ...SHADOWS.floating,
    elevation: 8,
    zIndex: 99,
  },
  fabText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
    flexShrink: 0,
  },
});
