import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  DollarSign,
  Lightbulb,
  MapPin,
  Moon,
  Plus,
  ShoppingCart,
  Sun,
  Tag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useShopConfig } from "../context/ShopConfigContext";
import {
  ScreenContainer,
  AppCard,
  AnimatedCard,
  StatCard,
  SectionHeader,
  StatusBadge,
} from "../components";
import { RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme";
import { formatCurrency, formatDate, getTodayDateString } from "../utils/format";
import { StorageService } from "../services/storageService";
import { LeadService } from "../services/leadService";
import { CustomerLead } from "../types";

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { currentUser, isAdmin, isManager } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { config } = useShopConfig();

  const [refreshing, setRefreshing] = useState(false);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [todayLeadsCount, setTodayLeadsCount] = useState(0);
  const [monthLeadsCount, setMonthLeadsCount] = useState(0);
  const [closedMonthLeadsCount, setClosedMonthLeadsCount] = useState(0);
  const [pendingLeadsCount, setPendingLeadsCount] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [dueFollowUps, setDueFollowUps] = useState<CustomerLead[]>([]);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [attendanceStatus, setAttendanceStatus] = useState<"Punched In" | "Not Punched">("Not Punched");

  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    type: "lead" | "sale" | "purchase";
    title: string;
    subtitle: string;
    amount?: number;
    badgeLabel: string;
    badgeVariant: "primary" | "success" | "warning" | "info";
    phone?: string;
    date: string;
  }>>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      const todayStr = getTodayDateString();
      const currentMonthPrefix = todayStr.substring(0, 7);

      const leads = await StorageService.getLeads();
      const sales = await StorageService.getSales();
      setTotalLeadsCount(leads.length);
      const todayLeads = leads.filter(l => l.createdAt && l.createdAt.startsWith(todayStr));
      setTodayLeadsCount(todayLeads.length);

      // Respect role-based visibility: regular staff sees own leads
      const userLeads = (!isAdmin && !isManager && currentUser?.id)
        ? leads.filter(l => l.createdBy === currentUser.id)
        : leads;

      // 1. Total Leads This Month (created during current calendar month)
      const thisMonthLeads = userLeads.filter(l => l.createdAt && l.createdAt.startsWith(currentMonthPrefix));
      const mLeadsCount = thisMonthLeads.length;
      setMonthLeadsCount(mLeadsCount);

      // 2. Closed Leads This Month (unique leads successfully converted into sales during current calendar month)
      const currentMonthSales = sales.filter(s => s.saleDate && s.saleDate.startsWith(currentMonthPrefix));
      const monthSalePhones = new Set(
        currentMonthSales
          .map(s => (s.phone ? s.phone.replace(/\D/g, '').slice(-10) : ''))
          .filter(Boolean)
      );

      const closedLeadIds = new Set<string>();
      userLeads.forEach(l => {
        const cleanLeadPhone = l.phone ? l.phone.replace(/\D/g, '').slice(-10) : '';
        const hasMatchingMonthSale = cleanLeadPhone && monthSalePhones.has(cleanLeadPhone);

        const hasPurchasedHistoryThisMonth = l.history?.some(
          h => h.status === 'purchased' && h.timestamp && h.timestamp.startsWith(currentMonthPrefix)
        );
        const isPurchasedThisMonth = l.status === 'purchased' && (
          hasPurchasedHistoryThisMonth ||
          (l.updatedAt && l.updatedAt.startsWith(currentMonthPrefix)) ||
          (l.createdAt && l.createdAt.startsWith(currentMonthPrefix)) ||
          hasMatchingMonthSale
        );

        if (isPurchasedThisMonth || hasMatchingMonthSale) {
          closedLeadIds.add(l.id);
        }
      });
      const mClosedCount = closedLeadIds.size;
      setClosedMonthLeadsCount(mClosedCount);

      // 3. Pending Leads (still open / awaiting conversion, excluding closed and lost)
      const pendingList = userLeads.filter(l => l.status !== 'purchased' && l.status !== 'lost');
      const mPendingCount = pendingList.length;
      setPendingLeadsCount(mPendingCount);

      // 4. Lead Conversion Rate = (Closed Leads ÷ Total Eligible Leads) × 100
      const totalEligible = mLeadsCount > 0
        ? mLeadsCount
        : (mClosedCount + userLeads.filter(l => l.status === 'lost').length);
      const rate = totalEligible > 0 ? Math.round((mClosedCount / totalEligible) * 100) : 0;
      setConversionRate(rate);

      const due = await LeadService.getDueFollowUps();
      setDueFollowUps(due);

      const todaySales = sales.filter(s => s.saleDate === todayStr);
      const totalSalesAmt = todaySales.reduce((acc, s) => acc + (s.sellingAmount || 0), 0);
      setTodaySalesTotal(totalSalesAmt > 0 ? totalSalesAmt : sales.reduce((acc, s) => acc + (s.sellingAmount || 0), 0));

      const purchases = await StorageService.getPurchases();

      if (currentUser) {
        const attRecords = await StorageService.getAttendanceRecords(currentUser.id);
        const todayAtt = attRecords.find(r => r.date === todayStr);
        setAttendanceStatus(todayAtt && todayAtt.punchInTime ? "Punched In" : "Not Punched");
      }

      const list: Array<{
        id: string;
        type: "lead" | "sale" | "purchase";
        title: string;
        subtitle: string;
        amount?: number;
        badgeLabel: string;
        badgeVariant: "primary" | "success" | "warning" | "info";
        phone?: string;
        date: string;
      }> = [];

      leads.slice(0, 3).forEach(l => {
        list.push({
          id: "lead_" + l.id,
          type: "lead",
          title: l.name,
          subtitle: "Interested: " + l.interestedBrand + " " + l.interestedModel,
          amount: l.budget,
          badgeLabel: l.status.toUpperCase().replace("_", " "),
          badgeVariant: l.status === "purchased" ? "success" : l.status === "interested" ? "primary" : "warning",
          phone: l.phone,
          date: l.createdAt || todayStr,
        });
      });

      sales.slice(0, 3).forEach(s => {
        list.push({
          id: "sale_" + s.id,
          type: "sale",
          title: s.brand + " " + s.model,
          subtitle: "Sold to " + s.buyerName,
          amount: s.sellingAmount,
          badgeLabel: "SOLD",
          badgeVariant: "success",
          phone: s.phone,
          date: s.saleDate,
        });
      });

      purchases.slice(0, 3).forEach(p => {
        list.push({
          id: "pur_" + p.id,
          type: "purchase",
          title: p.brand + " " + p.model,
          subtitle: "Bought from " + p.customerName,
          amount: p.purchaseAmount,
          badgeLabel: p.status === "in_stock" ? "IN STOCK" : "PURCHASED",
          badgeVariant: "info",
          phone: p.phone,
          date: p.purchaseDate,
        });
      });

      list.sort((a, b) => b.date.localeCompare(a.date));
      setRecentActivities(list.slice(0, 5));
    } catch (e) {
      console.warn("Dashboard load error:", e);
    }
  }, [currentUser, isAdmin, isManager]);

  useEffect(() => {
    loadDashboardData();
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadDashboardData();
    });
    return unsubscribe;
  }, [loadDashboardData, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* LeadIQ Style Top Bar */}
      <View style={[styles.headerContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.headerProfileArea}
          onPress={() => navigation.navigate("ProfileTab")}
          activeOpacity={0.8}
        >
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "P"}
            </Text>
          </View>
          <View style={{ marginLeft: SPACING.md }}>
            <Text style={[styles.greetingSub, { color: colors.textSecondary }]}>
              Welcome back,
            </Text>
            <Text style={[styles.userName, { color: colors.text }]}>
              {currentUser?.name || "Staff Member"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {isDark ? <Sun size={17} color={colors.text} /> : <Moon size={17} color={colors.text} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerIconBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.7}
          >
            <Bell size={17} color={colors.text} />
            {dueFollowUps.length > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* LeadIQ CRM Headline & Focus Banner */}
        <View style={styles.headlineContainer}>
          <Text style={[styles.greetingHeadline, { color: colors.text }]}>
            Ready to <Text style={{ fontStyle: "italic", color: colors.primary }}>Close Some Deals</Text>
          </Text>
          <Text style={[styles.headlineSub, { color: colors.textSecondary }]}>
            {config.shopName || "Parth Mobile Care"} • {formatDate(getTodayDateString())}
          </Text>
        </View>

        {/* LeadIQ Insight Card */}
        <AnimatedCard
          onPress={() => navigation.navigate("LeadsTab")}
          style={[
            styles.insightCard,
            {
              backgroundColor: isDark ? "rgba(37,99,235,0.12)" : "#EFF6FF",
              borderColor: isDark ? "rgba(37,99,235,0.3)" : "#BFDBFE",
            },
          ]}
          noPadding
        >
          <View style={styles.insightCardInner}>
            <View style={{ flex: 1 }}>
              <View style={styles.insightBadgeRow}>
                <StatusBadge label="DAILY INSIGHT" variant="primary" size="small" />
              </View>
              <Text style={[styles.insightTitle, { color: colors.text }]}>
                {dueFollowUps.length > 0
                  ? `${dueFollowUps.length} follow-up calls due today`
                  : "All follow-ups completed for today!"}
              </Text>
              <Text style={[styles.insightDesc, { color: colors.textSecondary }]}>
                {dueFollowUps.length > 0
                  ? "Contact interested leads promptly to maximize closing conversion rate."
                  : "Great job! Check incoming inquiries and recent store sales."}
              </Text>
            </View>
            <View style={styles.insightEmojiContainer}>
              <Lightbulb size={30} color={colors.primary} strokeWidth={1.8} />
            </View>
          </View>
        </AnimatedCard>

        {/* Summary Stat Cards Row (Horizontal Scroll) */}
        <SectionHeader title="Performance Overview" subtitle="Live store stats" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryCardsScroll}
        >
          {/* 1. Staff Attendance (First Position) */}
          <StatCard
            label="Staff Attendance"
            value={attendanceStatus}
            icon={
              <MapPin
                size={18}
                color={
                  attendanceStatus === "Punched In"
                    ? colors.success
                    : colors.danger
                }
              />
            }
            badgeText={
              attendanceStatus === "Punched In"
                ? "PUNCHED IN"
                : "PENDING"
            }
            badgeVariant={
              attendanceStatus === "Punched In"
                ? "success"
                : "danger"
            }
            valueColor={
              attendanceStatus === "Punched In"
                ? colors.success
                : colors.danger
            }
            onPress={() => navigation.navigate("Attendance")}
          />

          {/* 2. Today Leads */}
          <StatCard
            label="Today Leads"
            value={todayLeadsCount > 0 ? todayLeadsCount : totalLeadsCount}
            icon={<Users size={18} color={colors.primary} />}
            badgeText="LEADS"
            badgeVariant="primary"
            onPress={() => navigation.navigate("LeadsTab")}
          />

          {/* 3. Pending Follow-Ups */}
          <StatCard
            label="Pending Follow-Ups"
            value={dueFollowUps.length}
            icon={<Clock3 size={18} color={colors.warning} />}
            badgeText={dueFollowUps.length > 0 ? `${dueFollowUps.length} DUE` : "ALL DONE"}
            badgeVariant="warning"
            valueColor={colors.warning}
            onPress={() => navigation.navigate("LeadsTab")}
          />

          {/* 4. Sales Volume */}
          <StatCard
            label="Sales Volume"
            value={formatCurrency(todaySalesTotal)}
            icon={<Wallet size={18} color={colors.success} />}
            badgeText="SALES"
            badgeVariant="success"
            valueColor={colors.success}
            onPress={() => navigation.navigate("ReportsTab")}
          />

          {/* 5. Monthly Leads */}
          <StatCard
            label="Monthly Leads"
            value={monthLeadsCount}
            icon={<TrendingUp size={18} color={colors.primary} />}
            badgeText="THIS MONTH"
            badgeVariant="info"
            onPress={() => navigation.navigate("LeadsTab")}
          />

          {/* 6. Closed Leads */}
          <StatCard
            label="Closed Leads"
            value={closedMonthLeadsCount}
            icon={<CheckCircle2 size={18} color={colors.success} />}
            badgeText="CONVERTED"
            badgeVariant="success"
            valueColor={colors.success}
            onPress={() => navigation.navigate("LeadsTab")}
          />
        </ScrollView>

        {/* Quick Actions (Row 1: 2 Cards, Row 2: 3 Cards) */}
        <SectionHeader title="Quick Actions" />

        <View style={styles.quickActionsContainer}>
          {/* Top Row: 2 Primary Cards (Add Lead & Sell Mobile) */}
          <View style={styles.topTwoCardsRow}>
            <AnimatedCard
              style={styles.topCard}
              onPress={() => navigation.navigate("LeadsTab")}
              noPadding
            >
              <View style={styles.topCardInner}>
                <View style={styles.actionCardTop}>
                  <View style={[styles.actionIconBox, { backgroundColor: isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF" }]}>
                    <Plus size={20} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <ArrowUpRight size={18} color={colors.textMuted} />
                </View>
                <Text style={[styles.actionTitle, { color: colors.text }]} numberOfLines={1}>Add Lead</Text>
                <Text style={[styles.actionSub, { color: colors.textSecondary }]}>
                  New customer inquiry
                </Text>
              </View>
            </AnimatedCard>

            <AnimatedCard
              style={styles.topCard}
              onPress={() => navigation.navigate("BuySell")}
              noPadding
            >
              <View style={styles.topCardInner}>
                <View style={styles.actionCardTop}>
                  <View style={[styles.actionIconBox, { backgroundColor: isDark ? "rgba(34,197,94,0.2)" : "#F0FDF4" }]}>
                    <DollarSign size={20} color={colors.success} strokeWidth={2.5} />
                  </View>
                  <ArrowUpRight size={18} color={colors.textMuted} />
                </View>
                <Text style={[styles.actionTitle, { color: colors.text }]} numberOfLines={1}>Sell Mobile</Text>
                <Text style={[styles.actionSub, { color: colors.textSecondary }]}>
                  Sell mobile
                </Text>
              </View>
            </AnimatedCard>
          </View>

          {/* Bottom Row: 3 Compact Cards (Add Purchase, View Prices, Staff & Roles) */}
          <View style={styles.bottomThreeCardsRow}>
            <AnimatedCard
              style={styles.bottomCard}
              onPress={() => navigation.navigate("BuySell")}
              noPadding
            >
              <View style={styles.bottomCardInner}>
                <View style={styles.bottomCardTop}>
                  <View style={[styles.bottomIconBox, { backgroundColor: isDark ? "rgba(245,158,11,0.2)" : "#FFFBEB" }]}>
                    <ShoppingCart size={17} color={colors.warning} strokeWidth={2.2} />
                  </View>
                  <ArrowUpRight size={15} color={colors.textMuted} />
                </View>
                <Text style={[styles.bottomCardTitle, { color: colors.text }]} numberOfLines={1}>
                  Add Purchase
                </Text>
                <Text style={[styles.bottomCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  Buy 2nd hand
                </Text>
              </View>
            </AnimatedCard>

            <AnimatedCard
              style={styles.bottomCard}
              onPress={() => navigation.navigate("PriceListTab")}
              noPadding
            >
              <View style={styles.bottomCardInner}>
                <View style={styles.bottomCardTop}>
                  <View style={[styles.bottomIconBox, { backgroundColor: isDark ? "rgba(139,92,246,0.2)" : "#F5F3FF" }]}>
                    <Tag size={17} color="#8B5CF6" strokeWidth={2.2} />
                  </View>
                  <ArrowUpRight size={15} color={colors.textMuted} />
                </View>
                <Text style={[styles.bottomCardTitle, { color: colors.text }]} numberOfLines={1}>
                  View Prices
                </Text>
                <Text style={[styles.bottomCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  Price catalog
                </Text>
              </View>
            </AnimatedCard>

            {(isAdmin || isManager) ? (
              <AnimatedCard
                style={styles.bottomCard}
                onPress={() => navigation.navigate("StaffManagement")}
                noPadding
              >
                <View style={styles.bottomCardInner}>
                  <View style={styles.bottomCardTop}>
                    <View style={[styles.bottomIconBox, { backgroundColor: isDark ? "rgba(14,165,233,0.2)" : "#F0F9FF" }]}>
                      <Users size={17} color="#0EA5E9" strokeWidth={2.2} />
                    </View>
                    <ArrowUpRight size={15} color={colors.textMuted} />
                  </View>
                  <Text style={[styles.bottomCardTitle, { color: colors.text }]} numberOfLines={1}>
                    Staff & Roles
                  </Text>
                  <Text style={[styles.bottomCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    Admin team
                  </Text>
                </View>
              </AnimatedCard>
            ) : (
              <AnimatedCard
                style={styles.bottomCard}
                onPress={() => navigation.navigate("Attendance")}
                noPadding
              >
                <View style={styles.bottomCardInner}>
                  <View style={styles.bottomCardTop}>
                    <View style={[styles.bottomIconBox, { backgroundColor: isDark ? "rgba(14,165,233,0.2)" : "#F0F9FF" }]}>
                      <Clock3 size={17} color="#0EA5E9" strokeWidth={2.2} />
                    </View>
                    <ArrowUpRight size={15} color={colors.textMuted} />
                  </View>
                  <Text style={[styles.bottomCardTitle, { color: colors.text }]} numberOfLines={1}>
                    Attendance
                  </Text>
                  <Text style={[styles.bottomCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    Punch logs
                  </Text>
                </View>
              </AnimatedCard>
            )}
          </View>
        </View>

        {/* Recent Activity Section */}
        <SectionHeader
          title="Recent Activity"
          actionText="View All →"
          onActionPress={() => navigation.navigate("ReportsTab")}
        />

        <AppCard noPadding>
          {recentActivities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ClipboardList size={28} color={colors.textMuted} strokeWidth={1.8} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No recent activity recorded yet.
              </Text>
            </View>
          ) : (
            recentActivities.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.activityRow,
                  {
                    borderTopColor: colors.border,
                    borderTopWidth: idx > 0 ? 1 : 0,
                  },
                ]}
              >
                <View
                  style={[
                    styles.activityIconCircle,
                    {
                      backgroundColor:
                        item.type === "sale"
                          ? isDark ? "rgba(34,197,94,0.15)" : "#F0FDF4"
                          : item.type === "purchase"
                          ? isDark ? "rgba(245,158,11,0.15)" : "#FFFBEB"
                          : isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
                    },
                  ]}
                >
                  {item.type === "sale" ? (
                    <Wallet size={17} color={colors.success} />
                  ) : item.type === "purchase" ? (
                    <ShoppingCart size={17} color={colors.warning} />
                  ) : (
                    <Users size={17} color={colors.primary} />
                  )}
                </View>

                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.activitySub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end", marginLeft: SPACING.sm }}>
                  {item.amount !== undefined && (
                    <Text
                      style={[
                        styles.activityAmount,
                        { color: item.type === "sale" ? colors.success : colors.text },
                      ]}
                    >
                      {formatCurrency(item.amount)}
                    </Text>
                  )}
                  <StatusBadge label={item.badgeLabel} variant={item.badgeVariant} size="small" />
                </View>
              </View>
            ))
          )}
        </AppCard>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerProfileArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  greetingSub: {
    ...TYPOGRAPHY.captionSmall,
  },
  userName: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  headlineContainer: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  greetingHeadline: {
    ...TYPOGRAPHY.h1,
    fontSize: 26,
    lineHeight: 32,
  },
  headlineSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 4,
  },
  insightCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  insightCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
  },
  insightBadgeRow: {
    marginBottom: SPACING.xs,
  },
  insightTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  insightDesc: {
    ...TYPOGRAPHY.caption,
    lineHeight: 18,
  },
  insightEmojiContainer: {
    marginLeft: SPACING.md,
  },
  summaryCardsScroll: {
    paddingVertical: 2,
  },
  quickActionsContainer: {
    gap: SPACING.md,
    width: "100%",
  },
  topTwoCardsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    width: "100%",
  },
  topCard: {
    flex: 1,
    marginVertical: 0,
    borderRadius: RADIUS.lg,
  },
  topCardInner: {
    padding: SPACING.lg,
    minHeight: 122,
    justifyContent: "space-between",
  },
  actionCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  actionTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
    marginBottom: 2,
  },
  actionSub: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 12,
  },
  bottomThreeCardsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
  },
  bottomCard: {
    flex: 1,
    marginVertical: 0,
    borderRadius: RADIUS.lg,
  },
  bottomCardInner: {
    paddingVertical: SPACING.md,
    paddingHorizontal: 10,
    minHeight: 110,
    justifyContent: "space-between",
  },
  bottomCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  bottomIconBox: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm + 2,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomCardTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 12.5,
    marginBottom: 2,
  },
  bottomCardSub: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 10.5,
  },
  emptyContainer: {
    padding: SPACING.xxxl,
    alignItems: "center",
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
  },
  activityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
  },
  activityTitle: {
    ...TYPOGRAPHY.bodyBold,
  },
  activitySub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  activityAmount: {
    ...TYPOGRAPHY.bodyBold,
    marginBottom: 4,
  },
});
