import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { getMonthlyStats, getDebts, getPayments } from '../../src/db/database';
import { formatCurrency } from '../../src/utils/helpers';

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

export default function StatsScreen() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [stats, setStats] = useState<any>(null);
  const [previousStats, setPreviousStats] = useState<any>(null);
  const [debtStats, setDebtStats] = useState({ totalOwe: 0, totalOwed: 0 });
  const [paymentStats, setPaymentStats] = useState({ totalPaid: 0, totalPending: 0, paidCount: 0, pendingCount: 0 });

  useFocusEffect(useCallback(() => {
    loadStats();
  }, [selectedYear, selectedMonth]));

  const loadStats = async () => {
    const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const previousYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const [monthly, previous, oweDebts, owedDebts, allPayments] = await Promise.all([
      getMonthlyStats(selectedYear, selectedMonth),
      getMonthlyStats(previousYear, previousMonth),
      getDebts('owe'),
      getDebts('owed'),
      getPayments(),
    ]);
    setStats(monthly);
    setPreviousStats(previous);
    setDebtStats({
      totalOwe: oweDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0),
      totalOwed: owedDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0),
    });
    const paid = allPayments.filter(p => p.status === 'paid');
    const pending = allPayments.filter(p => p.status !== 'paid');
    setPaymentStats({
      totalPaid: paid.reduce((s, p) => s + p.amount, 0),
      totalPending: pending.reduce((s, p) => s + p.amount, 0),
      paidCount: paid.length,
      pendingCount: pending.length,
    });
  };

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const maxBar = stats?.categoryBreakdown?.length
    ? Math.max(...stats.categoryBreakdown.map((c: any) => c.amount), 1)
    : 1;

  const maxWeekly = stats?.weeklyData ? Math.max(...stats.weeklyData.map((d: any) => d.amount), 1) : 1;
  const recordCount = (stats?.paidCount ?? 0) + (stats?.pendingCount ?? 0) + (stats?.overdueCount ?? 0);
  const averagePayment = recordCount ? (stats?.totalExpense ?? 0) / recordCount : 0;
  const topCategory = [...(stats?.categoryBreakdown ?? [])].sort((a: any, b: any) => b.amount - a.amount)[0];
  const monthDelta = previousStats?.totalExpense > 0
    ? ((stats?.totalExpense - previousStats.totalExpense) / previousStats.totalExpense) * 100
    : null;
  const paymentHealth = recordCount ? Math.round(((stats?.paidCount ?? 0) / recordCount) * 100) : 100;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>FİNANSAL ZEKA MERKEZİ</Text>
            <Text style={styles.headerTitle}>İstatistikler</Text>
          </View>
          <View style={[styles.healthBadge, { borderColor: paymentHealth >= 70 ? Colors.success : Colors.warning }]}>
            <Text style={styles.healthValue}>{paymentHealth}</Text>
            <Text style={styles.healthLabel}>skor</Text>
          </View>
        </View>

        {/* Month selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[selectedMonth - 1]} {selectedYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Total summary */}
        <Card style={[styles.totalCard, { backgroundColor: Colors.primary }]}>
          <Text style={styles.totalLabel}>Toplam Harcama</Text>
          <Text style={styles.totalAmount}>{formatCurrency(stats?.totalExpense ?? 0, 'TRY')}</Text>
          {monthDelta !== null ? (
            <View style={styles.deltaPill}>
              <MaterialCommunityIcons name={monthDelta > 0 ? 'trending-up' : 'trending-down'} size={14} color={monthDelta > 0 ? Colors.warning : Colors.success} />
              <Text style={[styles.deltaText, { color: monthDelta > 0 ? Colors.warning : Colors.success }]}>
                Önceki aya göre %{Math.abs(monthDelta).toFixed(1)} {monthDelta > 0 ? 'daha yüksek' : 'daha düşük'}
              </Text>
            </View>
          ) : null}
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.statusText}>Ödendi: {stats?.paidCount ?? 0}</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#fff' }]} />
              <Text style={styles.statusText}>Bekliyor: {stats?.pendingCount ?? 0}</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: Colors.danger }]} />
              <Text style={styles.statusText}>Gecikti: {stats?.overdueCount ?? 0}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: `${Colors.info}18` }]}><MaterialCommunityIcons name="calculator-variant-outline" size={20} color={Colors.info} /></View>
            <Text style={styles.metricLabel}>Ortalama ödeme</Text>
            <Text style={styles.metricValue}>{formatCurrency(averagePayment, 'TRY')}</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: `${Colors.primary}18` }]}><MaterialCommunityIcons name="crown-outline" size={20} color={Colors.primaryLight} /></View>
            <Text style={styles.metricLabel}>Lider kategori</Text>
            <Text style={styles.metricValue} numberOfLines={1}>{topCategory?.category ?? '—'}</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: `${Colors.success}18` }]}><MaterialCommunityIcons name="check-decagram-outline" size={20} color={Colors.success} /></View>
            <Text style={styles.metricLabel}>Tamamlama</Text>
            <Text style={styles.metricValue}>%{paymentHealth}</Text>
          </View>
        </View>

        {/* Weekly trend */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Haftalık Trend</Text>
          <View style={styles.weeklyChart}>
            {(stats?.weeklyData ?? []).map((d: any, i: number) => (
              <View key={i} style={styles.weekBarCol}>
                <Text style={styles.weekAmount}>
                  {d.amount > 0 ? `${Math.round(d.amount / 1000)}K` : ''}
                </Text>
                <View style={styles.weekBarTrack}>
                  <View style={[
                    styles.weekBar,
                    { height: `${Math.max((d.amount / maxWeekly) * 100, 3)}%` }
                  ]} />
                </View>
                <Text style={styles.weekDay}>{d.day}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Category breakdown - horizontal bar */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Kategori Dağılımı</Text>
          {!stats?.categoryBreakdown?.length ? (
            <Text style={styles.noData}>Bu ay veri yok</Text>
          ) : (
            stats.categoryBreakdown.map((cat: any, i: number) => (
              <View key={i} style={styles.catRow}>
                <View style={styles.catLabelRow}>
                  <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.catName} numberOfLines={1}>{cat.category}</Text>
                  <Text style={[styles.catAmt, { color: cat.color }]}>
                    {formatCurrency(cat.amount, 'TRY')}
                  </Text>
                </View>
                <View style={styles.catBarTrack}>
                  <View style={[
                    styles.catBarFill,
                    { width: `${(cat.amount / maxBar) * 100}%`, backgroundColor: cat.color }
                  ]} />
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Debt comparison */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Borç / Alacak Karşılaştırması</Text>
          <View style={styles.debtCompare}>
            <View style={styles.debtItem}>
              <MaterialCommunityIcons name="arrow-up-circle" size={32} color={Colors.danger} />
              <Text style={styles.debtLabel}>Borcum</Text>
              <Text style={[styles.debtAmount, { color: Colors.danger }]}>
                {formatCurrency(debtStats.totalOwe, 'TRY')}
              </Text>
            </View>
            <View style={styles.debtDivider} />
            <View style={styles.debtItem}>
              <MaterialCommunityIcons name="arrow-down-circle" size={32} color={Colors.success} />
              <Text style={styles.debtLabel}>Alacağım</Text>
              <Text style={[styles.debtAmount, { color: Colors.success }]}>
                {formatCurrency(debtStats.totalOwed, 'TRY')}
              </Text>
            </View>
          </View>

          {/* Net */}
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net Durum:</Text>
            <Text style={[styles.netAmount, {
              color: debtStats.totalOwed - debtStats.totalOwe >= 0 ? Colors.success : Colors.danger
            }]}>
              {formatCurrency(Math.abs(debtStats.totalOwed - debtStats.totalOwe), 'TRY')}
              {debtStats.totalOwed - debtStats.totalOwe >= 0 ? ' alacaklı' : ' borçlu'}
            </Text>
          </View>
        </Card>

        {/* Toplam Ödemeler */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Toplam Ödemeler</Text>
          <View style={styles.debtCompare}>
            <View style={styles.debtItem}>
              <MaterialCommunityIcons name="check-circle" size={32} color={Colors.success} />
              <Text style={styles.debtLabel}>Ödenen</Text>
              <Text style={[styles.debtAmount, { color: Colors.success }]}>
                {formatCurrency(paymentStats.totalPaid, 'TRY')}
              </Text>
              <Text style={styles.debtSubLabel}>{paymentStats.paidCount} ödeme</Text>
            </View>
            <View style={styles.debtDivider} />
            <View style={styles.debtItem}>
              <MaterialCommunityIcons name="clock-outline" size={32} color={Colors.primary} />
              <Text style={styles.debtLabel}>Bekleyen</Text>
              <Text style={[styles.debtAmount, { color: Colors.primary }]}>
                {formatCurrency(paymentStats.totalPending, 'TRY')}
              </Text>
              <Text style={styles.debtSubLabel}>{paymentStats.pendingCount} ödeme</Text>
            </View>
          </View>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net Durum:</Text>
            <Text style={[styles.netAmount, {
              color: paymentStats.totalPaid >= paymentStats.totalPending ? Colors.success : Colors.primary
            }]}>
              {formatCurrency(paymentStats.totalPaid + paymentStats.totalPending, 'TRY')} toplam
            </Text>
          </View>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  header: {
    paddingTop: Spacing.xxxl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
  },
  headerEyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 1.4, color: Colors.primaryLight },
  healthBadge: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  healthValue: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.lg, lineHeight: 19, color: Colors.textPrimary },
  healthLabel: { fontFamily: 'Poppins_400Regular', fontSize: 8, color: Colors.textMuted },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  arrowBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
  },
  monthTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  totalCard: {
    marginBottom: Spacing.lg,
  },
  totalLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  totalAmount: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 28,
    color: '#fff',
    marginBottom: Spacing.md,
  },
  deltaPill: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full, marginBottom: Spacing.md },
  deltaText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.xs },
  metricGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  metricCard: { flex: 1, minHeight: 112, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.surfaceBorder },
  metricIcon: { width: 34, height: 34, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  metricLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9, color: Colors.textMuted },
  metricValue: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 3 },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.9)',
  },
  sectionCard: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  noData: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  weeklyChart: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    gap: 6,
  },
  weekBarCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  weekAmount: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 9,
    color: Colors.textMuted,
    minHeight: 12,
  },
  weekBarTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBar: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    minHeight: 4,
  },
  weekDay: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: Colors.textMuted,
  },
  catRow: { marginBottom: Spacing.md },
  catLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  catName: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  catAmt: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
  },
  catBarTrack: {
    height: 8,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    minWidth: 4,
  },
  debtCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  debtItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  debtDivider: {
    width: 1,
    height: 80,
    backgroundColor: Colors.surfaceBorder,
  },
  debtLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  debtAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    paddingTop: Spacing.md,
  },
  netLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  netAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.md,
  },
  debtSubLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
