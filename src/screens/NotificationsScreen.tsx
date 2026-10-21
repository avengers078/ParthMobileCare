import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
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
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  FilterChip,
  EmptyState,
} from '../components';
import { AppNotification } from '../types';
import { StorageService } from '../services/storageService';
import { formatDate } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';

interface NotificationsScreenProps {
  navigation: any;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterType, setFilterType] = useState<string>('all');

  const loadNotifications = async () => {
    const list = await StorageService.getNotifications();
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      if (!n.read) {
        await StorageService.markNotificationRead(n.id);
      }
    }
    loadNotifications();
  };

  const handleNotificationPress = async (item: AppNotification) => {
    if (!item.read) {
      await StorageService.markNotificationRead(item.id);
      loadNotifications();
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

  const filtered = notifications.filter(n => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !n.read;
    return n.type === filterType;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: AppNotification['type']) => {
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
          data={['all', 'unread', 'follow_up', 'attendance', 'lead', 'sale', 'purchase']}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item }) => (
            <FilterChip
              label={
                item === 'all'
                  ? 'All'
                  : item === 'unread'
                  ? `Unread (${unreadCount})`
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
        renderItem={({ item }) => {
          const isUnread = !item.read;
          return (
            <TouchableOpacity
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.8}
            >
              <AppCard
                style={[
                  styles.notifCard,
                  isUnread && {
                    borderColor: colors.primary,
                    borderWidth: 1.5,
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.08)' : '#F0F7FF',
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
                    {getNotificationIcon(item.type)}
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
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
                      {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                    </View>

                    <Text
                      style={[styles.notifBody, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {item.body}
                    </Text>

                    <Text style={[styles.notifTime, { color: colors.textMuted }]}>
                      {formatDate(item.timestamp)}
                    </Text>
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
            description="You are all caught up! New alerts and follow-up reminders will appear here."
          />
        }
      />
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
  notifTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
    flex: 1,
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
  notifTime: {
    ...TYPOGRAPHY.captionSmall,
  },
});

