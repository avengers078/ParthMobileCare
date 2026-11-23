import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  XCircle,
} from 'lucide-react-native';
import { User, DeviceChangeRequest } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { DeviceBindingService, DeviceBindingCheckResult } from '../services/deviceBindingService';
import { DeviceSecurityService } from '../services/deviceSecurityService';
import { ModalCard } from './ModalCard';
import { Input } from './Input';

interface DeviceBindingModalProps {
  visible: boolean;
  currentUser: User;
  onClose: () => void;
  onUpdated?: () => void;
}

export type DeviceModalState =
  | 'INITIALIZING'
  | 'APPROVED'
  | 'PENDING_APPROVAL'
  | 'DEVICE_MISMATCH'
  | 'REJECTED'
  | 'UNREGISTERED'
  | 'ERROR';

export const DeviceBindingModal: React.FC<DeviceBindingModalProps> = ({
  visible,
  currentUser,
  onClose,
  onUpdated,
}) => {
  const { colors, isDark } = useTheme();
  const { showSuccess, showError, showWarning } = useAlert();

  const [modalState, setModalState] = useState<DeviceModalState>('INITIALIZING');
  const [submitting, setSubmitting] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceBindingCheckResult | null>(null);
  const [pendingRequest, setPendingRequest] = useState<DeviceChangeRequest | null>(null);
  const [deviceModel, setDeviceModel] = useState('');
  const [installationId, setInstallationId] = useState('');
  const [isHardwareBacked, setIsHardwareBacked] = useState(false);
  const [reason, setReason] = useState('');
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [showPhoneDetails, setShowPhoneDetails] = useState(false);

  const requestIdRef = useRef(0);
  const currentUserId = currentUser?.id;

  const loadDeviceInfo = async () => {
    const currentReq = ++requestIdRef.current;
    setModalState('INITIALIZING');

    try {
      const info = await DeviceSecurityService.getDeviceInfo(true);
      if (currentReq !== requestIdRef.current) return;

      setDeviceModel(info.model);
      setInstallationId(info.installationId);
      setIsHardwareBacked(info.isHardwareBacked);

      const status = await DeviceBindingService.checkDeviceStatus(currentUser);
      if (currentReq !== requestIdRef.current) return;
      setDeviceStatus(status);

      const req = await DeviceBindingService.getPendingDeviceChangeRequest(currentUser.id);
      if (currentReq !== requestIdRef.current) return;
      setPendingRequest(req);

      if (req && req.status === 'pending') {
        setModalState('PENDING_APPROVAL');
      } else if (status.status === 'APPROVED') {
        setModalState('APPROVED');
      } else if (status.status === 'DEVICE_MISMATCH') {
        setModalState('DEVICE_MISMATCH');
      } else if (status.status === 'REJECTED') {
        setModalState('REJECTED');
      } else if (status.status === 'UNREGISTERED') {
        setModalState('UNREGISTERED');
      } else {
        setModalState('DEVICE_MISMATCH');
      }
    } catch (e: any) {
      if (currentReq === requestIdRef.current) {
        console.warn('[DeviceBindingModal] Error loading info:', e);
        setModalState('ERROR');
      }
    }
  };

  useEffect(() => {
    if (visible) {
      setReason('');
      setShowChangeForm(false);
      setShowPhoneDetails(false);
      loadDeviceInfo();
    }
    // Only reload when modal becomes visible or user ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentUserId]);

  const handleRegisterDevice = async () => {
    setSubmitting(true);
    try {
      const res = await DeviceBindingService.registerDevice(currentUser);
      if (res.success) {
        showSuccess('Registration Submitted', res.message);
        await loadDeviceInfo();
        onUpdated?.();
      } else {
        showError('Registration Failed', res.message);
      }
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to register device.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitChangeRequest = async () => {
    if (!reason.trim() || reason.trim().length < 5) {
      showWarning('Reason Required', 'Please explain why you need to use this phone (minimum 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await DeviceBindingService.submitDeviceChangeRequest(currentUser, reason.trim());
      if (res.success) {
        showSuccess('Request Sent', 'Your device change request has been sent for administrator approval.');
        setShowChangeForm(false);
        await loadDeviceInfo();
        onUpdated?.();
      } else {
        showError('Request Failed', res.message);
      }
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to submit device change request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequest) return;
    setSubmitting(true);
    try {
      const ok = await DeviceBindingService.cancelDeviceChangeRequest(pendingRequest.id, currentUser.id);
      if (ok) {
        showSuccess('Cancelled', 'Your device change request has been cancelled.');
        await loadDeviceInfo();
        onUpdated?.();
      }
    } catch (e: any) {
      showError('Error', e?.message || 'Could not cancel request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalCard
      visible={visible}
      onClose={onClose}
      title="Phone Authorization"
      subtitle="Attendance Device Verification"
    >
      {modalState === 'INITIALIZING' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Checking your phone's security...
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          {/* Main Status View */}
          {modalState === 'APPROVED' && (
            <View style={[styles.statusCard, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
              <View style={styles.statusHeaderRow}>
                <View style={[styles.statusIconWrap, { backgroundColor: '#C8E6C9' }]}>
                  <ShieldCheck size={22} color="#2E7D32" />
                </View>
                <View style={styles.statusTextCol}>
                  <Text style={[styles.statusTitle, { color: '#2E7D32' }]}>Phone Approved</Text>
                  <Text style={[styles.statusBadge, { color: '#2E7D32', backgroundColor: '#DCEDC8' }]}>
                    Ready for Attendance
                  </Text>
                </View>
              </View>
              <Text style={[styles.statusDesc, { color: '#1B5E20' }]}>
                This phone is verified and authorized for your attendance punch in and punch out.
              </Text>
            </View>
          )}

          {modalState === 'PENDING_APPROVAL' && (
            <View style={[styles.statusCard, { backgroundColor: '#FFF8E1', borderColor: '#FFB300' }]}>
              <View style={styles.statusHeaderRow}>
                <View style={[styles.statusIconWrap, { backgroundColor: '#FFE082' }]}>
                  <Clock size={22} color="#E65100" />
                </View>
                <View style={styles.statusTextCol}>
                  <Text style={[styles.statusTitle, { color: '#E65100' }]}>Approval Pending</Text>
                  <Text style={[styles.statusBadge, { color: '#E65100', backgroundColor: '#FFE0B2' }]}>
                    Awaiting Admin Approval
                  </Text>
                </View>
              </View>
              <Text style={[styles.statusDesc, { color: '#795548' }]}>
                Your request to use this phone has been sent. You can start punching in once your administrator approves it.
              </Text>
              {pendingRequest && (
                <View style={[styles.pendingMetaBox, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}>
                  <Text style={styles.pendingMetaText}>
                    <Text style={{ fontWeight: '700' }}>Reason: </Text>
                    "{pendingRequest.reason}"
                  </Text>
                  <TouchableOpacity
                    style={styles.cancelReqBtn}
                    onPress={handleCancelRequest}
                    disabled={submitting}
                  >
                    <Text style={styles.cancelReqBtnText}>Cancel Request</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {modalState === 'DEVICE_MISMATCH' && (
            <View style={[styles.statusCard, { backgroundColor: '#FFEBEE', borderColor: '#EF5350' }]}>
              <View style={styles.statusHeaderRow}>
                <View style={[styles.statusIconWrap, { backgroundColor: '#FFCDD2' }]}>
                  <ShieldAlert size={22} color="#C62828" />
                </View>
                <View style={styles.statusTextCol}>
                  <Text style={[styles.statusTitle, { color: '#C62828' }]}>Unrecognized Phone</Text>
                  <Text style={[styles.statusBadge, { color: '#C62828', backgroundColor: '#FFCDD2' }]}>
                    Not Authorized
                  </Text>
                </View>
              </View>
              <Text style={[styles.statusDesc, { color: '#B71C1C' }]}>
                This phone is not approved for your attendance. To use this phone, please send a device change request to your administrator.
              </Text>
            </View>
          )}

          {modalState === 'REJECTED' && (
            <View style={[styles.statusCard, { backgroundColor: '#FFEBEE', borderColor: '#EF5350' }]}>
              <View style={styles.statusHeaderRow}>
                <View style={[styles.statusIconWrap, { backgroundColor: '#FFCDD2' }]}>
                  <XCircle size={22} color="#C62828" />
                </View>
                <View style={styles.statusTextCol}>
                  <Text style={[styles.statusTitle, { color: '#C62828' }]}>Request Rejected</Text>
                  <Text style={[styles.statusBadge, { color: '#C62828', backgroundColor: '#FFCDD2' }]}>
                    Approval Denied
                  </Text>
                </View>
              </View>
              <Text style={[styles.statusDesc, { color: '#B71C1C' }]}>
                {deviceStatus?.rejectionReason
                  ? `Reason: ${deviceStatus.rejectionReason}`
                  : 'Your administrator rejected the previous request. You may submit a new request if needed.'}
              </Text>
            </View>
          )}

          {modalState === 'UNREGISTERED' && (
            <View style={[styles.statusCard, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
              <View style={styles.statusHeaderRow}>
                <View style={[styles.statusIconWrap, { backgroundColor: '#BBDEFB' }]}>
                  <Smartphone size={22} color="#1565C0" />
                </View>
                <View style={styles.statusTextCol}>
                  <Text style={[styles.statusTitle, { color: '#1565C0' }]}>Register This Phone</Text>
                  <Text style={[styles.statusBadge, { color: '#1565C0', backgroundColor: '#BBDEFB' }]}>
                    First-Time Setup
                  </Text>
                </View>
              </View>
              <Text style={[styles.statusDesc, { color: '#0D47A1' }]}>
                No phone has been registered for your attendance account yet. Register this phone to get started.
              </Text>
            </View>
          )}

          {modalState === 'ERROR' && (
            <View style={[styles.statusCard, { backgroundColor: '#FFF3E0', borderColor: '#FFB74D' }]}>
              <Text style={[styles.statusTitle, { color: '#E65100' }]}>Verification Issue</Text>
              <Text style={[styles.statusDesc, { color: '#795548' }]}>
                We couldn't verify this phone right now. Please tap retry or ask your administrator.
              </Text>
              <TouchableOpacity
                style={[styles.cancelReqBtn, { marginTop: 8 }]}
                onPress={loadDeviceInfo}
              >
                <Text style={styles.cancelReqBtnText}>Retry Check</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action Button: Register Device */}
          {modalState === 'UNREGISTERED' && (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              onPress={handleRegisterDevice}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Smartphone size={16} color="#fff" />
                  <Text style={styles.primaryActionText}>Register This Phone</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Action Button: Open Change Request Form */}
          {(modalState === 'DEVICE_MISMATCH' || modalState === 'REJECTED') &&
            !pendingRequest &&
            !showChangeForm && (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowChangeForm(true)}
              >
                <RotateCcw size={16} color="#fff" />
                <Text style={styles.primaryActionText}>Request Authorization for this Phone</Text>
              </TouchableOpacity>
            )}

          {/* Device Change Request Form */}
          {showChangeForm && (
            <View style={[styles.changeForm, { borderColor: colors.border }]}>
              <Text style={[styles.formTitle, { color: colors.text }]}>
                Request Phone Approval
              </Text>
              <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
                Please describe briefly why you are switching to this phone (e.g. bought a new phone, screen repair, reinstalled app).
              </Text>

              <Input
                label="Reason for Request *"
                placeholder="e.g. Got a new phone / reinstalled app"
                multiline={true}
                numberOfLines={3}
                value={reason}
                onChangeText={setReason}
              />

              <View style={styles.formActionRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => setShowChangeForm(false)}
                  disabled={submitting}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor:
                        reason.trim().length >= 5 ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={handleSubmitChangeRequest}
                  disabled={submitting || reason.trim().length < 5}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Send Request to Admin</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Collapsible Technical Phone Details Accordion */}
          <View
            style={[
              styles.accordionContainer,
              { backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => setShowPhoneDetails(prev => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[styles.accordionTitle, { color: colors.textSecondary }]}>
                Phone Information
              </Text>
              {showPhoneDetails ? (
                <ChevronUp size={16} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={16} color={colors.textSecondary} />
              )}
            </TouchableOpacity>

            {showPhoneDetails && (
              <View style={styles.accordionContent}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Phone Model</Text>
                  <Text style={[styles.infoVal, { color: colors.text }]}>
                    {deviceModel || 'Unknown'}
                  </Text>
                </View>

                {deviceStatus?.registeredModel && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Approved Phone</Text>
                    <Text style={[styles.infoVal, { color: colors.text }]}>
                      {deviceStatus.registeredModel}
                    </Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Security Level</Text>
                  <Text style={[styles.infoVal, { color: isHardwareBacked ? '#2E7D32' : colors.primary }]}>
                    {isHardwareBacked ? 'Hardware Protected' : 'Standard Security'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>App Device ID</Text>
                  <Text style={[styles.infoValMono, { color: colors.textSecondary }]}>
                    {installationId ? `${installationId.substring(0, 18)}...` : '--'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </ModalCard>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  body: {
    padding: 18,
    gap: 14,
  },
  statusCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextCol: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  statusDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  pendingMetaBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 2,
  },
  pendingMetaText: {
    fontSize: 12,
    color: '#795548',
  },
  cancelReqBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFE0B2',
    borderRadius: 6,
  },
  cancelReqBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E65100',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  changeForm: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 10,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  formSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  formActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  accordionContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  accordionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  accordionContent: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValMono: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
