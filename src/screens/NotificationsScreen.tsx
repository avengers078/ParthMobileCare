import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Bell,
  CheckCheck,
  Clock,
  MapPin,
  ShoppingCart,
  Tag,
  Trash2,
  Users,
  Wallet,
  Sparkles,
  AlertTriangle,
  Zap,
  Info,
  Calendar,
  X,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  FilterChip,
  EmptyState,
  Badge,
  ModalCard,
  Button,
} from '../components';
import { AppNotification } from '../types';
import { StorageService } from '../services/storageService';
import { FirestoreSyncService } from '../services/firestoreSync';
import { formatDate } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';

interface NotificationsScreenProps {
  navigation: any;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AppNotification | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const list = await StorageService.getNotifications();
      setNotifications(list);
    } catch (err) {
      if (__DEV__) console.warn('[NotificationsScreen] Load error:', err);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await FirestoreSyncService.pullAllCloudToLocal();
      await loadNotifications();
    } catch (e) {
      if (__DEV__) console.warn('[NotificationsScreen] Refresh sync error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await StorageService.markAllNotificationsRead();
      await loadNotifications();
    } catch (e) {
      if (__DEV__) console.warn('[NotificationsScreen] Mark all read error:', e);
    }
  };

  const handleNotificationPress = async (item: AppNotification) => {
    if (!item.read) {
      await StorageService.markNotificationRead(item.id);
      setNotifications(prev =>
        prev.map(n => (n.id === item.id ? { ...n, read: true } : n))
      );
    }

    if (item.type === 'announcement') {
      setSelectedAnnouncement(item);
      return;
    }

    // Contextual navigation based on notification type
    switch (item.type) {
      case 'follow_up':
      case 'lead':
        navigation.navigate('MainTabs', { screen: 'LeadsTab' });
        break;
      case 'attendance':
        navigation.navigate('Attendance');
        break;
      case 'purchase':
      case 'sale':
        navigation.navigate('BuySell');
        break;
      default:
        break;
    }
  };

  const isExpired = (item: AppNotification): boolean => {
    if (!item.expiryDate) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return item.expiryDate < todayStr;
  };

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      // Announcement lifecycle checks for staff UI
      if (n.type === 'announcement') {
        if (n.status === 'draft' || n.status === 'archived') return false;
        const todayStr = new Date().toISOString().split('T')[0];
        if (n.startDate && n.startDate > todayStr) return false;
      }
      if (filterType === 'all') return true;
      if (filterType === 'unread') return !n.read;
      return n.type === filterType;
    });
  }, [notifications, filterType]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const announcementCount = useMemo(() => notifications.filter(n => n.type === 'announcement').length, [notifications]);

  const getNotificationIcon = (type: AppNotification['type'], priority?: string) => {
    if (type === 'announcement') {
      if (priority === 'urgent') return <AlertTriangle size={18} color={colors.danger} />;
      if (priority === 'high') return <Zap size={18} color={colors.warning} />;
      return <Sparkles size={18} color={colors.primary} />;
    }
    switch (type) {
      case 'follow_up':
        return <Clock size={18} color={colors.warning} />;
      case 'attendance':
        return <MapPin size={18} color={colors.info} />;
      case 'lead':
        return <Users size={18} color={colors.primary} />;
      case 'purchase':
        return <ShoppingCart size={18} color={colors.warning} />;
      case 'sale':
        return <Wallet size={18} color={colors.success} />;
      case 'target':
        return <Tag size={18} color="#8B5CF6" />;
      default:
        return <Bell size={18} color={colors.textSecondary} />;
    }
  };

  const renderPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge label="Urgent" variant="danger" size="small" />;
      case 'high':
        return <Badge label="High Priority" variant="warning" size="small" />;
      default:
        return null;
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Notifications"
        subtitle={`${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              style={[styles.headerActionBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
              onPress={handleMarkAllRead}
              activeOpacity={0.7}
            >
              <CheckCheck size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.headerActionText, { color: colors.primary }]}>
                Mark All Read
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Filter Chips */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', 'unread', 'announcement', 'follow_up', 'attendance', 'lead', 'sale', 'purchase']}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item }) => (
            <FilterChip
              label={
                item === 'all'
                  ? 'All Alerts'
                  : item === 'unread'
                  ? `Unread (${unreadCount})`
                  : item === 'announcement'
                  ? `Announcements (${announcementCount})`
                  : item === 'follow_up'
                  ? 'Follow-Ups'
                  : item.charAt(0).toUpperCase() + item.slice(1)
              }
              active={filterType === item}
              onPress={() => setFilterType(item)}
            />
          )}
        />
      </View>

      {/* Notifications List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const isUnread = !item.read;
          const isAnnouncement = item.type === 'announcement';
          const expired = isExpired(item);

          return (
            <TouchableOpacity
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.8}
            >
              <AppCard
                style={[
                  styles.notifCard,
                  isUnread && {
                    borderColor: isAnnouncement ? colors.warning : colors.primary,
                    borderWidth: 1.5,
                    backgroundColor: isDark
                      ? (isAnnouncement ? 'rgba(245, 158, 11, 0.08)' : 'rgba(37, 99, 235, 0.08)')
                      : (isAnnouncement ? '#FFFDF5' : '#F0F7FF'),
                  },
                ]}
              >
                <View style={styles.cardRow}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : '#F1F5F9',
                      },
                    ]}
                  >
                    {getNotificationIcon(item.type, item.priority)}
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
                      <View style={styles.titleWithBadges}>
                        <Text
                          style={[
                            styles.notifTitle,
                            { color: colors.text },
                            isUnread && { fontWeight: '800' },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                      </View>
                      <View style={styles.badgeCluster}>
                        {renderPriorityBadge(item.priority)}
                        {expired && <Badge label="Expired" variant="neutral" size="small" />}
                        {isUnread && <View style={[styles.unreadDot, { backgroundColor: isAnnouncement ? colors.warning : colors.primary }]} />}
                      </View>
                    </View>

                    <Text
                      style={[styles.notifBody, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {item.body}
                    </Text>

                    <View style={styles.metadataRow}>
                      <Text style={[styles.notifTime, { color: colors.textMuted }]}>
                        {formatDate(item.timestamp)}
                      </Text>
                      {item.authorName && (
                        <Text style={[styles.authorTag, { color: colors.textMuted }]}>
                          • Store Broadcast
                        </Text>
                      )}
                      {item.expiryDate && !expired && (
                        <Text style={[styles.expiryTag, { color: colors.warning }]}>
                          • Valid till {item.expiryDate}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </AppCard>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={<Bell size={32} color={colors.textMuted} />}
            title="No Notifications"
            description="You are all caught up! New alerts and store announcements will appear here."
          />
        }
      />

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <ModalCard
          visible={Boolean(selectedAnnouncement)}
          onClose={() => setSelectedAnnouncement(null)}
          title={selectedAnnouncement.title}
          subtitle={`Store Announcement • ${formatDate(selectedAnnouncement.timestamp)}`}
        >
          <View style={styles.modalBodyContainer}>
            {/* Metadata Tags */}
            <View style={styles.modalMetaRow}>
              {selectedAnnouncement.priority && (
                <View style={styles.modalMetaItem}>
                  <Text style={[styles.modalMetaLabel, { color: colors.textMuted }]}>PRIORITY</Text>
                  {renderPriorityBadge(selectedAnnouncement.priority) || (
                    <Badge label="Standard" variant="neutral" size="small" />
                  )}
                </View>
              )}
              <View style={styles.modalMetaItem}>
                <Text style={[styles.modalMetaLabel, { color: colors.textMuted }]}>AUDIENCE</Text>
                <Badge
                  label={selectedAnnouncement.targetAudience === 'specific_staff' ? 'Targeted Team' : 'All Staff'}
                  variant="info"
                  size="small"
                />
              </View>
              {selectedAnnouncement.expiryDate && (
                <View style={styles.modalMetaItem}>
                  <Text style={[styles.modalMetaLabel, { color: colors.textMuted }]}>EXPIRATION</Text>
                  <Text style={[styles.modalMetaValue, { color: colors.textSecondary }]}>
                    {selectedAnnouncement.expiryDate}
                  </Text>
                </View>
              )}
            </View>

            {/* Announcement Message */}
            <View style={[styles.announcementContentBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.announcementContentText, { color: colors.text }]}>
                {selectedAnnouncement.body}
              </Text>
            </View>

            <View style={styles.modalFooterRow}>
              <Button
                title="Got It"
                variant="primary"
                onPress={() => setSelectedAnnouncement(null)}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </ModalCard>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  filterBar: {
    paddingVertical: SPACING.xs,
  },
  filterScroll: {
    paddingHorizontal: SPACING.lg,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  headerActionText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
  },
  notifCard: {
    marginBottom: SPACING.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleWithBadges: {
    flex: 1,
    marginRight: 6,
  },
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notifTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  notifBody: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  notifTime: {
    ...TYPOGRAPHY.captionSmall,
  },
  authorTag: {
    ...TYPOGRAPHY.captionSmall,
  },
  expiryTag: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '600',
  },
  modalBodyContainer: {
    paddingTop: SPACING.xs,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalMetaItem: {
    marginRight: SPACING.sm,
  },
  modalMetaLabel: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  modalMetaValue: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '600',
  },
  announcementContentBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  announcementContentText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    lineHeight: 22,
  },
  modalFooterRow: {
    marginTop: SPACING.xs,
  },
});
