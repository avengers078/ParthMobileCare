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
  SectionHeader,
  EmptyState,
  AppIcon,
} from '../components';
import { CustomerLead, LeadStatus } from '../types';
import { StorageService } from '../services/storageService';
import { LeadService } from '../services/leadService';
import {
  formatCurrency,
  formatDate,
  getTodayDateString,
  toDisplayDate,
  toStorageDate,
  getTodayDisplayDate,
  formatTime,
} from '../utils/format';
import { sendWhatsAppMessage, makePhoneCall, MESSAGE_TEMPLATES } from '../utils/whatsapp';
import { BRANDS } from '../constants';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';
import {
  MOBILE_NUMBER_ERROR_MESSAGE,
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

export const LeadListScreen: React.FC = () => {
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();

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
  const [followUpDate, setFollowUpDate] = useState(getTodayDisplayDate());
  const [followUpDateError, setFollowUpDateError] = useState('');
  const [followUpTime, setFollowUpTime] = useState('05:00 PM');
  const [followUpTimeError, setFollowUpTimeError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [editFollowUpDateError, setEditFollowUpDateError] = useState('');
  const [editFollowUpTime, setEditFollowUpTime] = useState('05:00 PM');
  const [editFollowUpTimeError, setEditFollowUpTimeError] = useState('');

  const loadLeads = async () => {
    const list = await StorageService.getLeads();
    setLeads(list);
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleCreateLead = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Customer name is required.');
      return;
    }
    const phoneErr = getMobileNumberError(phone, true);
    if (phoneErr) {
      setPhoneError(phoneErr);
      Alert.alert('Validation Error', phoneErr);
      return;
    }
    setPhoneError('');

    const altErr = getMobileNumberError(altPhone, false);
    if (altErr) {
      setAltPhoneError(altErr);
      Alert.alert('Validation Error', altErr);
      return;
    }
    setAltPhoneError('');

    let finalStorageDate: string | undefined = undefined;
    if (followUpDate.trim()) {
      if (!/^\d{2}-\d{2}-\d{4}$/.test(followUpDate.trim())) {
        setFollowUpDateError('Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
        Alert.alert('Validation Error', 'Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
        return;
      }
      setFollowUpDateError('');
      finalStorageDate = toStorageDate(followUpDate.trim());
    }

    if (followUpDate.trim() && isTimePastForToday(followUpDate.trim(), followUpTime)) {
      setFollowUpTimeError('Reminder time cannot be in the past for today.');
      Alert.alert('Invalid Time', 'Reminder time cannot be in the past for today.');
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
          followUpDate: finalStorageDate,
          followUpTime: followUpTime || undefined,
          createdBy: currentUser.id,
          createdByName: currentUser.name,
        },
        currentUser,
        'new',
        true
      );

      Alert.alert(
        'Lead Created!',
        'Customer lead registered and automated follow-up reminder scheduled.',
        [
          {
            text: 'OK',
            onPress: () => {
              setAddModalVisible(false);
              resetForm();
              loadLeads();
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save lead.');
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
        Alert.alert('Status Updated', `Lead status is now ${newStatus.toUpperCase()}`);
      }
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
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
      Alert.alert('Validation Error', 'Customer name is required.');
      return;
    }
    const phoneErr = getMobileNumberError(editPhone, true);
    if (phoneErr) {
      setEditPhoneError(phoneErr);
      Alert.alert('Validation Error', phoneErr);
      return;
    }
    setEditPhoneError('');

    const altErr = getMobileNumberError(editAltPhone, false);
    if (altErr) {
      setEditAltPhoneError(altErr);
      Alert.alert('Validation Error', altErr);
      return;
    }
    setEditAltPhoneError('');

    let finalStorageDate: string | undefined = undefined;
    if (editFollowUpDate.trim()) {
      if (!/^\d{2}-\d{2}-\d{4}$/.test(editFollowUpDate.trim())) {
        setEditFollowUpDateError('Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
        Alert.alert('Validation Error', 'Enter date in DD-MM-YYYY format (e.g. 09-10-2026).');
        return;
      }
      setEditFollowUpDateError('');
      finalStorageDate = toStorageDate(editFollowUpDate.trim());
    }

    if (editFollowUpDate.trim() && isTimePastForToday(editFollowUpDate.trim(), editFollowUpTime)) {
      setEditFollowUpTimeError('Reminder time cannot be in the past for today.');
      Alert.alert('Invalid Time', 'Reminder time cannot be in the past for today.');
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
          followUpDate: finalStorageDate,
          followUpTime: editFollowUpTime || undefined,
        },
        currentUser
      );

      if (updated) {
        setSelectedLead(updated);
        Alert.alert('Lead Updated', 'Customer lead information saved successfully.');
        setEditModalVisible(false);
        loadLeads();
      }
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    }
  };

  const handleDeleteLead = (lead: CustomerLead) => {
    Alert.alert(
      'Delete Lead',
      `Are you sure you want to delete lead for ${lead.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await LeadService.deleteLead(lead.id);
              setDetailModalVisible(false);
              setSelectedLead(null);
              loadLeads();
              Alert.alert('Deleted', 'Lead was deleted successfully.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
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
    setFollowUpDate(getTodayDisplayDate());
    setFollowUpDateError('');
    setFollowUpTime('05:00 PM');
    setFollowUpTimeError('');
  };

  const filteredLeads = leads.filter(l => {
    const matchesFilter = filterStatus === 'All' || l.status === filterStatus.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      l.name.toLowerCase().includes(query) ||
      l.phone.includes(query) ||
      l.interestedBrand.toLowerCase().includes(query) ||
      l.interestedModel.toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });

  const getStatusVariant = (s: LeadStatus) => {
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

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Leads"
        subtitle="Customer Pipeline & Deals"
        rightAction={
          <Button
            title="+ Add Lead"
            onPress={() => setAddModalVisible(true)}
            size="small"
            style={{ marginRight: 4 }}
          />
        }
      />

      <View style={styles.topFilterSection}>
        {/* Sticky LeadIQ Search Bar */}
        <SearchInput
          placeholder="Search leads by customer, phone, model..."
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
                  ? leads.length
                  : leads.filter(l => l.status === f.toLowerCase()).length
              }
            />
          ))}
        </ScrollView>
      </View>

      {/* Leads List */}
      <FlatList
        data={filteredLeads}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
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
                  <Text style={[styles.arrowText, { color: colors.textSecondary }]}>↗</Text>
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

                <Text style={[styles.budgetText, { color: colors.text }]}>
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
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
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
                <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                  WhatsApp
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionBtn, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF' }]}
                onPress={() => {
                  setSelectedLead(item);
                  setDetailModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                  Details ↗
                </Text>
              </TouchableOpacity>
            </View>
          </AppCard>
        )}
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

      {/* Add Lead Modal */}
      <ModalCard
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        title="Add Customer Lead"
        subtitle="Register new inquiry and automated follow-up"
      >
        <Input
          label="Customer Full Name *"
          placeholder="e.g. Rajesh Kumar"
          value={name}
          onChangeText={setName}
        />
        <Input
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
          label="Alternative Mobile Number"
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
          label="Interested Model Details"
          placeholder="e.g. V50 8GB/128GB Blue"
          value={model}
          onChangeText={setModel}
        />
        <Input
          label="Customer Budget (₹)"
          placeholder="25000"
          keyboardType="numeric"
          value={budget}
          onChangeText={setBudget}
        />
        <Input
          label="Follow-Up Date (DD-MM-YYYY)"
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
          Follow-Up Reminder Time (12-Hour AM/PM) *
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
          label="Remarks & Customer Preference"
          placeholder="Wants exchange offer, EMI, etc."
          multiline
          numberOfLines={3}
          value={remarks}
          onChangeText={setRemarks}
        />

        <PrimaryButton
          title={isSubmitting ? 'Saving Lead...' : '✓ Save & Schedule Follow-Up'}
          onPress={handleCreateLead}
          loading={isSubmitting}
          size="large"
          style={{ marginTop: SPACING.md }}
        />
      </ModalCard>

      {/* Lead Details Modal (Matching 3rd Phone in LeadIQ reference!) */}
      <ModalCard
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        title="Lead Details"
        subtitle={selectedLead ? `Added on ${formatDate(selectedLead.createdAt)} by ${selectedLead.createdByName}` : ''}
      >
        {selectedLead && (
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
              <Text style={styles.contactIcon}>⏰</Text>
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
                  },
                ]}
                onPress={() => handleOpenEdit(selectedLead)}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionBtnText, { color: colors.primary, fontSize: 13 }]}>
                  ✎ Edit Lead Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickActionBtn,
                  {
                    height: 44,
                    borderColor: colors.danger,
                    backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
                  },
                ]}
                onPress={() => handleDeleteLead(selectedLead)}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionBtnText, { color: colors.danger, fontSize: 13 }]}>
                  🗑 Delete Lead
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ModalCard>

      {/* Edit Lead Modal */}
      <ModalCard
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title="Edit Customer Lead"
        subtitle={selectedLead ? `Editing lead for ${selectedLead.name}` : ''}
      >
        <Input
          label="Customer Full Name *"
          placeholder="e.g. Rajesh Kumar"
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
          label="Alternative Mobile Number"
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
          label="Interested Model Details"
          placeholder="e.g. V50 8GB/128GB Blue"
          value={editModel}
          onChangeText={setEditModel}
        />
        <Input
          label="Customer Budget (₹)"
          placeholder="25000"
          keyboardType="numeric"
          value={editBudget}
          onChangeText={setEditBudget}
        />
        <Input
          label="Follow-Up Date (DD-MM-YYYY)"
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
          Follow-Up Reminder Time (12-Hour AM/PM) *
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
          label="Remarks & Customer Preference"
          placeholder="Wants exchange offer, EMI, etc."
          multiline
          numberOfLines={3}
          value={editRemarks}
          onChangeText={setEditRemarks}
        />

        <PrimaryButton
          title="Save Changes"
          onPress={handleSaveEdit}
          size="large"
          style={{ marginTop: SPACING.md }}
        />
      </ModalCard>
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
    paddingBottom: SPACING.sm,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
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
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
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
});
