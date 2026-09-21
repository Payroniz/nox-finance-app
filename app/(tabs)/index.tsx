import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { PaymentCard } from '../../src/components/PaymentCard';
import {
  getMonthlyStats, getUpcomingPayments, updatePaymentStatus,
  deletePayment, getAllSettings, getDebts, getPayments
} from '../../src/db/database';
import {
  formatCurrency,
  formatDate,
  formatLocalDateKey,
  getDueDateLabel,
  getGreeting,
  parseLocalDate,
} from '../../src/utils/helpers';
import { Payment } from '../../src/constants/types';
import { cancelNotification } from '../../src/utils/notifications';

type InAppNotification = {
  id: string;
  entityId: number;
  route: 'payment' | 'debt';
  title: string;
  name: string;
  amount: string;
  detail: string;
  color: string;
  icon: string;
  dueDate: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [prevStats, setPrevStats] = useState<any>(null);
  const [upcomingPayments, setUpcomingPayments] = useState<Payment[]>([]);
  const [overduePayments, setOverduePayments] = useState<Payment[]>([]);
  const [userName, setUserName] = useState('Kullanıcı');
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [debtSummary, setDebtSummary] = useState({ totalOwe: 0, totalOwed: 0, netDebt: 0 });
  const [currency, setCurrency] = useState<'TRY' | 'USD' | 'EUR' | 'GBP'>('TRY');

  const today = new Date();
  const greeting = getGreeting();

  const buildNotifications = async () => {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 7);
    const horizonKey = formatLocalDateKey(horizon);
    const [payments, oweDebts, owedDebts] = await Promise.all([
      getPayments(),
      getDebts('owe'),
      getDebts('owed'),
    ]);
    const notifs: InAppNotification[] = [];

    payments
      .filter(payment => payment.status !== 'paid' && payment.due_date <= horizonKey)
      .forEach(payment => {
        const due = parseLocalDate(payment.due_date);
        if (!due) return;
        const overdue = due.getTime() < new Date().setHours(0, 0, 0, 0);
        notifs.push({
          id: `payment-${payment.id}`,
          entityId: payment.id,
          route: 'payment',
          title: overdue ? 'Gecikmiş ödeme' : 'Ödeme yaklaşıyor',
          name: payment.name,
          amount: formatCurrency(payment.amount, payment.currency),
          detail: `${getDueDateLabel(payment.due_date)} · ${formatDate(payment.due_date, 'dd MMMM')} · ${payment.due_time} · ${payment.category}`,
          color: overdue ? Colors.danger : Colors.primary,
          icon: overdue ? 'alert-circle' : 'clock-alert-outline',
          dueDate: due.getTime(),
        });
      });

    [...oweDebts, ...owedDebts]
      .filter(debt => debt.due_date && debt.total_amount > debt.paid_amount && debt.due_date <= horizonKey)
      .forEach(debt => {
        const due = parseLocalDate(debt.due_date);
        if (!due) return;
        const overdue = due.getTime() < new Date().setHours(0, 0, 0, 0);
        const receivable = debt.debt_direction === 'owed';
        notifs.push({
          id: `debt-${debt.id}`,
          entityId: debt.id,
          route: 'debt',
          title: overdue ? (receivable ? 'Gecikmiş alacak' : 'Gecikmiş borç') : (receivable ? 'Alacak yaklaşıyor' : 'Borç yaklaşıyor'),
          name: debt.person_name,
          amount: formatCurrency(debt.total_amount - debt.paid_amount, debt.currency),
          detail: `${getDueDateLabel(debt.due_date)} · ${formatDate(debt.due_date, 'dd MMMM yyyy')}`,
          color: overdue ? Colors.danger : (receivable ? Colors.success : Colors.warning),
          icon: receivable ? 'arrow-down-circle' : 'arrow-up-circle',
          dueDate: due.getTime(),
        });
      });

    setNotifications(notifs.sort((a, b) => a.dueDate - b.dueDate));
  };

  const loadData = async () => {
    try {
      const now = new Date();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const [monthlyStats, prevMonthStats, upcoming, settings, oweDebts, owedDebts, allPayments] = await Promise.all([
        getMonthlyStats(now.getFullYear(), now.getMonth() + 1),
        getMonthlyStats(prevYear, prevMonth),
        getUpcomingPayments(5),
        getAllSettings(),
        getDebts('owe'),
        getDebts('owed'),
        getPayments(),
      ]);

      setStats(monthlyStats);
      setPrevStats(prevMonthStats);
      setUpcomingPayments(upcoming.filter(p => p.status !== 'overdue').slice(0, 3));
      setOverduePayments(allPayments.filter(p => p.status === 'overdue'));
      setUserName(settings.userName);
      setCurrency(settings.defaultCurrency);

      const totalOwe = oweDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);
      const totalOwed = owedDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);
      setDebtSummary({ totalOwe, totalOwed, netDebt: totalOwed - totalOwe });

      await buildNotifications();
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMarkPaid = async (id: number) => {
    const payment = (await getPayments()).find(item => item.id === id);
    if (payment?.notification_id) await cancelNotification(payment.notification_id);
    await updatePaymentStatus(id, 'paid');
    await loadData();
  };

  const handleDeletePayment = async (id: number) => {
    const payment = (await getPayments()).find(item => item.id === id);
    if (payment?.notification_id) await cancelNotification(payment.notification_id);
    await deletePayment(id);
    await loadData();
  };

  const monthChange = stats && prevStats && prevStats.totalExpense > 0
    ? ((stats.totalExpense - prevStats.totalExpense) / prevStats.totalExpense) * 100
    : null;

  const totalPayments = (stats?.paidCount ?? 0) + (stats?.pendingCount ?? 0) + (stats?.overdueCount ?? 0);
  const completionRate = totalPayments > 0 ? Math.round((stats?.paidCount ?? 0) / totalPayments * 100) : 0;

  const SparkBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <View style={sparkStyles.track}>
      <View style={[sparkStyles.fill, { width: `${Math.max((value / max) * 100, 3)}%`, backgroundColor: color }]} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {userName} 👋</Text>
            <Text style={styles.date}>
              {today.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifPanel(true)}>
            <MaterialCommunityIcons
              name={notifications.length > 0 ? 'bell-badge' : 'bell-outline'}
              size={24}
              color={notifications.length > 0 ? Colors.primary : Colors.textSecondary}
            />
            {notifications.length > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notifications.length > 9 ? '9+' : notifications.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── OVERDUE ALERT BANNER ── */}
        {overduePayments.length > 0 && (
          <TouchableOpacity
            style={styles.overdueBanner}
            onPress={() => router.push('/(tabs)/payments')}
            activeOpacity={0.85}
          >
            <View style={styles.overdueBannerLeft}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
              <Text style={styles.overdueBannerText}>
                {overduePayments.length} gecikmiş ödeme var
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {/* ── HERO CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Bu Ay Toplam Harcama</Text>
            {monthChange !== null && (
              <View style={[styles.changePill, { backgroundColor: monthChange > 0 ? `${Colors.danger}25` : `${Colors.success}25` }]}>
                <MaterialCommunityIcons
                  name={monthChange > 0 ? 'trending-up' : 'trending-down'}
                  size={13}
                  color={monthChange > 0 ? Colors.danger : Colors.success}
                />
                <Text style={[styles.changeText, { color: monthChange > 0 ? Colors.danger : Colors.success }]}>
                  {Math.abs(monthChange).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.heroAmount}>
            {stats ? formatCurrency(stats.totalExpense, currency) : '—'}
          </Text>

          {/* Completion bar */}
          <View style={styles.completionRow}>
            <View style={styles.completionBarTrack}>
              <View style={[styles.completionBarFill, { width: `${completionRate}%` }]} />
            </View>
            <Text style={styles.completionPct}>{completionRate}% ödendi</Text>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <View style={[styles.heroStatDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.heroStatText}>{stats?.paidCount ?? 0} ödendi</Text>
            </View>
            <View style={styles.heroStatItem}>
              <View style={[styles.heroStatDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.heroStatText}>{stats?.pendingCount ?? 0} bekliyor</Text>
            </View>
            <View style={styles.heroStatItem}>
              <View style={[styles.heroStatDot, { backgroundColor: Colors.danger }]} />
              <Text style={styles.heroStatText}>{stats?.overdueCount ?? 0} gecikti</Text>
            </View>
          </View>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: Colors.primary }]}
            onPress={() => { Haptics.impactAsync(); router.push('/payment/add'); }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#fff" />
            <Text style={styles.quickBtnText}>Ödeme Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder }]}
            onPress={() => { Haptics.impactAsync(); router.push('/debt/add'); }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="hand-coin-outline" size={22} color={Colors.primary} />
            <Text style={[styles.quickBtnText, { color: Colors.primary }]}>Borç Ekle</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.plannerBanner} activeOpacity={0.86} onPress={() => router.push('/(tabs)/planner' as any)}>
          <View style={styles.plannerIconWrap}>
            <MaterialCommunityIcons name="timeline-clock-outline" size={27} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.plannerEyebrow}>YENİ • AKILLI FİNANS PLANI</Text>
            <Text style={styles.plannerTitle}>Önündeki 90 günü gör</Text>
            <Text style={styles.plannerText}>Ödeme, borç ve alacakları tek nakit akışında keşfet.</Text>
          </View>
          <MaterialCommunityIcons name="arrow-top-right" size={21} color={Colors.primaryLight} />
        </TouchableOpacity>

        {/* ── NET FINANCIAL SNAPSHOT ── */}
        <Card style={styles.snapshotCard}>
          <View style={styles.snapshotHeader}>
            <Text style={styles.sectionTitle}>Finansal Durum</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/stats')}>
              <Text style={styles.seeAll}>Detaylı →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.snapshotRow}>
            {/* Borcum */}
            <View style={styles.snapshotItem}>
              <View style={[styles.snapshotIcon, { backgroundColor: `${Colors.danger}20` }]}>
                <MaterialCommunityIcons name="arrow-up-circle" size={18} color={Colors.danger} />
              </View>
              <Text style={styles.snapshotLabel}>Borcum</Text>
              <Text style={[styles.snapshotAmount, { color: Colors.danger }]} numberOfLines={1}>
                {formatCurrency(debtSummary.totalOwe, currency)}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.snapshotDivider} />

            {/* Net */}
            <View style={styles.snapshotItem}>
              <View style={[styles.snapshotIcon, { backgroundColor: debtSummary.netDebt >= 0 ? `${Colors.success}20` : `${Colors.danger}20` }]}>
                <MaterialCommunityIcons
                  name={debtSummary.netDebt >= 0 ? 'scale-balance' : 'scale-unbalanced'}
                  size={18}
                  color={debtSummary.netDebt >= 0 ? Colors.success : Colors.danger}
                />
              </View>
              <Text style={styles.snapshotLabel}>Net</Text>
              <Text style={[styles.snapshotAmount, { color: debtSummary.netDebt >= 0 ? Colors.success : Colors.danger }]} numberOfLines={1}>
                {debtSummary.netDebt >= 0 ? '+' : '-'}{formatCurrency(Math.abs(debtSummary.netDebt), currency)}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.snapshotDivider} />

            {/* Alacağım */}
            <View style={styles.snapshotItem}>
              <View style={[styles.snapshotIcon, { backgroundColor: `${Colors.success}20` }]}>
                <MaterialCommunityIcons name="arrow-down-circle" size={18} color={Colors.success} />
              </View>
              <Text style={styles.snapshotLabel}>Alacağım</Text>
              <Text style={[styles.snapshotAmount, { color: Colors.success }]} numberOfLines={1}>
                {formatCurrency(debtSummary.totalOwed, currency)}
              </Text>
            </View>
          </View>
        </Card>

        {/* ── CATEGORY SPENDING BARS ── */}
        {stats?.categoryBreakdown?.length > 0 && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Kategoriler</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/stats')}>
                <Text style={styles.seeAll}>Tümü →</Text>
              </TouchableOpacity>
            </View>
            {stats.categoryBreakdown.slice(0, 4).map((cat: any, i: number) => {
              const pct = stats.totalExpense > 0 ? (cat.amount / stats.totalExpense) * 100 : 0;
              return (
                <View key={i} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.catName} numberOfLines={1}>{cat.category}</Text>
                  <SparkBar value={cat.amount} max={stats.totalExpense} color={cat.color} />
                  <Text style={[styles.catPct, { color: cat.color }]}>{Math.round(pct)}%</Text>
                  <Text style={styles.catAmt} numberOfLines={1}>{formatCurrency(cat.amount, currency)}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* ── UPCOMING PAYMENTS ── */}
        <View style={[styles.sectionHeader, { marginBottom: Spacing.sm }]}>
          <Text style={styles.sectionTitle}>Yaklaşan Ödemeler</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/payments')}>
            <Text style={styles.seeAll}>Tümünü Gör →</Text>
          </TouchableOpacity>
        </View>

        {upcomingPayments.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons name="calendar-check" size={36} color={Colors.success} />
            <Text style={styles.emptyTitle}>Yaklaşan ödeme yok</Text>
            <Text style={styles.emptySubtitle}>Tüm ödemeleriniz güncel 🎉</Text>
          </Card>
        ) : (
          upcomingPayments.map(p => (
            <PaymentCard
              key={p.id}
              payment={p}
              onMarkPaid={handleMarkPaid}
              onDelete={handleDeletePayment}
              onPress={(payment) => router.push(`/payment/${payment.id}`)}
            />
          ))
        )}

        {/* ── WEEKLY SPARKLINE ── */}
        {stats?.weeklyData && (
          <Card style={[styles.sectionCard, { marginTop: Spacing.lg }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bu Hafta</Text>
              <Text style={styles.weekTotal}>
                {formatCurrency(stats.weeklyData.reduce((s: number, d: any) => s + d.amount, 0), currency)}
              </Text>
            </View>
            <View style={styles.weekChart}>
              {(() => {
                const maxVal = Math.max(...stats.weeklyData.map((d: any) => d.amount), 1);
                return stats.weeklyData.map((d: any, i: number) => (
                  <View key={i} style={styles.weekCol}>
                    <View style={styles.weekBarTrack}>
                      <View style={[
                        styles.weekBar,
                        {
                          height: `${Math.max((d.amount / maxVal) * 100, 4)}%`,
                          backgroundColor: d.amount === Math.max(...stats.weeklyData.map((x: any) => x.amount))
                            ? Colors.primary
                            : Colors.surfaceBorder,
                        }
                      ]} />
                    </View>
                    <Text style={styles.weekDay}>{d.day}</Text>
                  </View>
                ));
              })()}
            </View>
          </Card>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── NOTIFICATION PANEL ── */}
      <Modal
        visible={showNotifPanel}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifPanel(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNotifPanel(false)}>
          <View style={styles.notifPanel}>
            <View style={styles.notifPanelHeader}>
              <View>
                <Text style={styles.notifPanelTitle}>Bildirim Merkezi</Text>
                <Text style={styles.notifPanelSubtitle}>{notifications.length} finansal hareket dikkat bekliyor</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotifPanel(false)}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {notifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <MaterialCommunityIcons name="bell-check-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.notifEmptyText}>Bildirim yok</Text>
                <Text style={styles.notifEmptySubText}>Yaklaşan ödeme veya borç bulunamadı</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {notifications.map(n => (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.notifItem, { borderLeftColor: n.color }]}
                    activeOpacity={0.78}
                    onPress={() => {
                      setShowNotifPanel(false);
                      router.push(n.route === 'payment' ? `/payment/${n.entityId}` : `/debt/${n.entityId}`);
                    }}
                  >
                    <View style={[styles.notifItemIcon, { backgroundColor: `${n.color}1F` }]}>
                      <MaterialCommunityIcons name={n.icon as any} size={22} color={n.color} />
                    </View>
                    <View style={styles.notifItemText}>
                      <View style={styles.notifItemTopRow}>
                        <Text style={[styles.notifItemType, { color: n.color }]}>{n.title}</Text>
                        <Text style={styles.notifItemAmount}>{n.amount}</Text>
                      </View>
                      <Text style={styles.notifItemTitle}>{n.name}</Text>
                      <Text style={styles.notifItemBody}>{n.detail}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginHorizontal: Spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    minWidth: 4,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  greeting: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  date: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9,
    color: '#fff',
  },

  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  overdueBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overdueBannerText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: '#fff',
  },

  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadow.primary,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  changeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.xs,
  },
  heroAmount: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 30,
    color: '#fff',
    marginBottom: Spacing.md,
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  completionBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: BorderRadius.full,
    minWidth: 4,
  },
  completionPct: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    minWidth: 60,
    textAlign: 'right',
  },
  heroStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroStatDot: {
    width: 7,
    height: 7,
    borderRadius: BorderRadius.full,
  },
  heroStatText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.85)',
  },

  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
  },
  quickBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: '#fff',
  },
  plannerBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, marginBottom: Spacing.lg, backgroundColor: '#272451', borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: `${Colors.primary}55` },
  plannerIconWrap: { width: 50, height: 50, borderRadius: BorderRadius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.primary },
  plannerEyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 8, letterSpacing: 1, color: Colors.primaryLight },
  plannerTitle: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 1 },
  plannerText: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: Colors.textSecondary, marginTop: 1 },

  snapshotCard: {
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  snapshotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapshotItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  snapshotIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  snapshotLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  snapshotAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  snapshotDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.surfaceBorder,
  },

  sectionCard: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  seeAll: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    marginRight: 6,
  },
  catName: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    width: 68,
  },
  catPct: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.xs,
    width: 30,
    textAlign: 'right',
    marginRight: 6,
  },
  catAmt: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    width: 68,
    textAlign: 'right',
  },

  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  weekChart: {
    flexDirection: 'row',
    height: 100,
    alignItems: 'flex-end',
    gap: 6,
  },
  weekCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    gap: 4,
  },
  weekBarTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBar: {
    width: '100%',
    borderRadius: BorderRadius.sm,
    minHeight: 4,
  },
  weekDay: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  weekTotal: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  notifPanel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '76%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.surfaceBorder,
  },
  notifPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  notifPanelTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  notifPanelSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  notifEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  notifEmptyText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  notifEmptySubText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: 13,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  notifItemIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifItemText: { flex: 1 },
  notifItemTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  notifItemType: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.xs,
  },
  notifItemAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  notifItemTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  notifItemBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
