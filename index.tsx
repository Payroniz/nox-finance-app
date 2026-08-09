import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, FlatList
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { PaymentCard } from '../../src/components/PaymentCard';
import {
  getMonthlyStats, getUpcomingPayments, updatePaymentStatus, deletePayment, getAllSettings
} from '../../src/db/database';
import { formatCurrency, getGreeting } from '../../src/utils/helpers';
import { Payment } from '../../src/constants/types';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [upcomingPayments, setUpcomingPayments] = useState<Payment[]>([]);
  const [userName, setUserName] = useState('Kullanıcı');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const greeting = getGreeting();

  const loadData = async () => {
    try {
      const [monthlyStats, upcoming, settings] = await Promise.all([
        getMonthlyStats(today.getFullYear(), today.getMonth() + 1),
        getUpcomingPayments(3),
        getAllSettings(),
      ]);
      setStats(monthlyStats);
      setUpcomingPayments(upcoming);
      setUserName(settings.userName);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMarkPaid = async (id: number) => {
    await updatePaymentStatus(id, 'paid');
    await loadData();
  };

  const handleDeletePayment = async (id: number) => {
    await deletePayment(id);
    await loadData();
  };

  const StatCard = ({ icon, label, value, color }: any) => (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );

  const WeeklyChart = () => {
    if (!stats?.weeklyData) return null;
    const maxVal = Math.max(...stats.weeklyData.map((d: any) => d.amount), 1);

    return (
      <View style={styles.chartContainer}>
        {stats.weeklyData.map((d: any, i: number) => (
          <View key={i} style={styles.barWrapper}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max((d.amount / maxVal) * 100, 5)}%` }
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{d.day}</Text>
          </View>
        ))}
      </View>
    );
  };

  const CategoryChart = () => {
    if (!stats?.categoryBreakdown?.length) return (
      <Text style={styles.emptyText}>Bu ay veri yok</Text>
    );

    return (
      <View style={styles.categoryList}>
        {stats.categoryBreakdown.slice(0, 5).map((cat: any, i: number) => {
          const pct = stats.totalExpense > 0 ? (cat.amount / stats.totalExpense) * 100 : 0;
          return (
            <View key={i} style={styles.categoryRow}>
              <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
              <Text style={styles.categoryName} numberOfLines={1}>{cat.category}</Text>
              <View style={styles.categoryBarTrack}>
                <View style={[styles.categoryBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
              </View>
              <Text style={[styles.categoryPct, { color: cat.color }]}>{Math.round(pct)}%</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {userName} 👋</Text>
            <Text style={styles.date}>
              {today.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Total expense card */}
        <Card style={styles.totalCard} variant="elevated">
          <Text style={styles.totalLabel}>Bu Ay Toplam Harcama</Text>
          <Text style={styles.totalAmount}>
            {stats ? formatCurrency(stats.totalExpense, 'TRY') : '—'}
          </Text>
          <View style={styles.totalSubRow}>
            <View style={styles.totalSubItem}>
              <MaterialCommunityIcons name="trending-up" size={14} color={Colors.success} />
              <Text style={[styles.totalSubText, { color: Colors.success }]}>
                {stats?.paidCount ?? 0} ödendi
              </Text>
            </View>
            <View style={styles.totalSubItem}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={Colors.primary} />
              <Text style={[styles.totalSubText, { color: Colors.primary }]}>
                {stats?.pendingCount ?? 0} bekliyor
              </Text>
            </View>
            <View style={styles.totalSubItem}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={Colors.danger} />
              <Text style={[styles.totalSubText, { color: Colors.danger }]}>
                {stats?.overdueCount ?? 0} gecikti
              </Text>
            </View>
          </View>
        </Card>

        {/* Stat mini cards */}
        <View style={styles.statRow}>
          <StatCard icon="check-circle" label="Ödendi" value={stats?.paidCount ?? 0} color={Colors.success} />
          <StatCard icon="clock-outline" label="Bekliyor" value={stats?.pendingCount ?? 0} color={Colors.primary} />
          <StatCard icon="alert-circle" label="Gecikti" value={stats?.overdueCount ?? 0} color={Colors.danger} />
        </View>

        {/* Weekly chart */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Haftalık Harcama</Text>
          <WeeklyChart />
        </Card>

        {/* Category breakdown */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Kategori Dağılımı</Text>
          <CategoryChart />
        </Card>

        {/* Upcoming payments */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yaklaşan Ödemeler</Text>
          <TouchableOpacity onPress={() => router.push('/payments')}>
            <Text style={styles.seeAll}>Tümünü Gör</Text>
          </TouchableOpacity>
        </View>

        {upcomingPayments.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons name="calendar-check" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Yaklaşan ödeme yok</Text>
            <Text style={styles.emptySubtitle}>Harika! Tüm ödemeleriniz güncel.</Text>
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

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: Colors.primary }]}
            onPress={() => { Haptics.impactAsync(); router.push('/payment/add'); }}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={styles.quickBtnText}>Ödeme Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder }]}
            onPress={() => { Haptics.impactAsync(); router.push('/debt/add'); }}
          >
            <MaterialCommunityIcons name="plus" size={20} color={Colors.primary} />
            <Text style={[styles.quickBtnText, { color: Colors.primary }]}>Borç Ekle</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
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
  totalCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primary,
    ...Shadow.primary,
  },
  totalLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  totalAmount: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 32,
    color: '#fff',
    marginBottom: Spacing.md,
  },
  totalSubRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  totalSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  totalSubText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.xs,
    color: '#fff',
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 4,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xxl,
  },
  statLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  seeAll: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  // Weekly chart
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 120,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    gap: 4,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    minHeight: 4,
  },
  barLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  // Category
  categoryList: { gap: 10 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  categoryName: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    width: 70,
  },
  categoryBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  categoryPct: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.xs,
    width: 32,
    textAlign: 'right',
  },
  emptyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
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
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
  quickBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: '#fff',
  },
});
