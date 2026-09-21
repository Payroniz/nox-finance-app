import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BorderRadius, Colors, FontSize, Shadow, Spacing } from '../../src/constants/theme';
import { Debt, Payment, Subscription } from '../../src/constants/types';
import { getAllSettings, getDebts, getPayments, getSubscriptions } from '../../src/db/database';
import { formatCurrency, parseLocalDate } from '../../src/utils/helpers';
import { getMonthlySubscriptionTotals, getSubscriptionOccurrences } from '../../src/utils/subscriptions';
import { CurrencySelector } from '../../src/components/CurrencySelector';

type FlowItem = {
  id: string;
  entityId: number;
  kind: 'payment' | 'debt' | 'receivable' | 'subscription';
  title: string;
  date: Date;
  amount: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
};

const HORIZONS = [7, 30, 90] as const;

export default function PlannerScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(30);
  const [currency, setCurrency] = useState<'TRY' | 'USD' | 'EUR' | 'GBP'>('TRY');

  useFocusEffect(useCallback(() => {
    Promise.all([getPayments(), getDebts(), getAllSettings(), getSubscriptions()]).then(([paymentRows, debtRows, settings, subscriptionRows]) => {
      setPayments(paymentRows);
      setDebts(debtRows);
      setCurrency(settings.defaultCurrency);
      setSubscriptions(subscriptionRows);
    });
  }, []));

  const flow = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + horizon);
    const items: FlowItem[] = [];

    getSubscriptionOccurrences(subscriptions, start, end).forEach(({ id, date, subscription }) => {
      items.push({ id, entityId: subscription.id, kind: 'subscription', title: subscription.name,
        date: parseLocalDate(date)!, amount: subscription.amount, currency: subscription.currency });
    });

    payments.filter(item => item.status !== 'paid').forEach(item => {
      const date = parseLocalDate(item.due_date);
      if (date && date <= end) items.push({ id: `p-${item.id}`, entityId: item.id, kind: 'payment', title: item.name, date, amount: item.amount, currency: item.currency });
    });
    debts.filter(item => item.due_date && item.total_amount > item.paid_amount).forEach(item => {
      const date = parseLocalDate(item.due_date);
      if (date && date <= end) items.push({
        id: `d-${item.id}`, entityId: item.id,
        kind: item.debt_direction === 'owed' ? 'receivable' : 'debt',
        title: item.person_name, date,
        amount: item.total_amount - item.paid_amount, currency: item.currency,
      });
    });
    return items.filter(item => item.currency === currency).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [payments, debts, subscriptions, horizon, currency]);

  const outgoing = flow.filter(item => item.kind !== 'receivable').reduce((sum, item) => sum + item.amount, 0);
  const incoming = flow.filter(item => item.kind === 'receivable').reduce((sum, item) => sum + item.amount, 0);
  const net = incoming - outgoing;
  const overdue = flow.filter(item => item.date.getTime() < new Date().setHours(0, 0, 0, 0));
  const health = Math.max(0, Math.min(100, Math.round(100 - (overdue.length * 12) - (outgoing > 0 ? Math.max(0, (outgoing - incoming) / outgoing) * 28 : 0))));
  const recurring = payments.filter(item => item.currency === currency && item.status !== 'paid' && item.recurrence !== 'once')
    .reduce((sum, item) => sum + (item.recurrence === 'yearly' ? item.amount / 12 : item.recurrence === 'weekly' ? item.amount * 52 / 12 : item.amount), 0)
    + (getMonthlySubscriptionTotals(subscriptions)[currency] ?? 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>AKILLI NAKİT AKIŞI</Text>
            <Text style={styles.title}>Finans Planı</Text>
          </View>
          <View style={[styles.score, { borderColor: health >= 70 ? Colors.success : Colors.warning }]}>
            <Text style={styles.scoreValue}>{health}</Text>
            <Text style={styles.scoreLabel}>puan</Text>
          </View>
        </View>

        <CurrencySelector value={currency} onChange={setCurrency} />
        <View style={styles.horizonRow}>
          {HORIZONS.map(days => (
            <TouchableOpacity key={days} style={[styles.horizon, horizon === days && styles.horizonActive]} onPress={() => setHorizon(days)}>
              <Text style={[styles.horizonText, horizon === days && styles.horizonTextActive]}>{days} gün</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroLabel}>{horizon} günlük tahmini net akış</Text>
          <Text style={[styles.heroAmount, { color: net >= 0 ? Colors.success : '#fff' }]}>{net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net), currency)}</Text>
          <View style={styles.flowSummary}>
            <View style={styles.flowSummaryItem}>
              <MaterialCommunityIcons name="arrow-down-left" size={18} color={Colors.success} />
              <View><Text style={styles.flowCaption}>Beklenen giriş</Text><Text style={styles.flowValue}>{formatCurrency(incoming, currency)}</Text></View>
            </View>
            <View style={styles.flowDivider} />
            <View style={styles.flowSummaryItem}>
              <MaterialCommunityIcons name="arrow-up-right" size={18} color={Colors.danger} />
              <View><Text style={styles.flowCaption}>Planlı çıkış</Text><Text style={styles.flowValue}>{formatCurrency(outgoing, currency)}</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.insightRow}>
          <View style={styles.insightCard}>
            <MaterialCommunityIcons name="refresh-auto" size={22} color={Colors.primaryLight} />
            <Text style={styles.insightValue}>{formatCurrency(recurring, currency)}</Text>
            <Text style={styles.insightLabel}>Aylık düzenli yük (tahmini)</Text>
          </View>
          <View style={[styles.insightCard, overdue.length > 0 && { borderColor: `${Colors.danger}80` }]}>
            <MaterialCommunityIcons name="alert-decagram-outline" size={22} color={overdue.length ? Colors.danger : Colors.success} />
            <Text style={styles.insightValue}>{overdue.length}</Text>
            <Text style={styles.insightLabel}>Riskli kayıt</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Yaklaşan Akış</Text><Text style={styles.sectionSubtitle}>Ödeme, abonelik, borç ve alacak bir arada</Text></View>
          <MaterialCommunityIcons name="timeline-clock-outline" size={24} color={Colors.primary} />
        </View>

        {flow.length ? flow.slice(0, 14).map((item, index) => {
          const positive = item.kind === 'receivable';
          const late = item.date.getTime() < new Date().setHours(0, 0, 0, 0);
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.timelineItem}
              activeOpacity={0.8}
              onPress={() => item.kind === 'subscription' ? router.push({ pathname: '/(tabs)/subscriptions', params: { edit: item.entityId } })
                : item.kind === 'payment' ? router.push(`/payment/${item.entityId}`) : router.push(`/debt/${item.entityId}`)}
            >
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, { backgroundColor: late ? Colors.danger : positive ? Colors.success : Colors.primary }]} />
                {index < Math.min(flow.length, 14) - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineContent}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>{item.title}{item.kind === 'subscription' ? ' • Abonelik' : ''}</Text>
                  <Text style={[styles.timelineDate, late && { color: Colors.danger }]}>{late ? 'Gecikti • ' : ''}{item.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' })}</Text>
                </View>
                <Text style={[styles.timelineAmount, { color: positive ? Colors.success : Colors.textPrimary }]}>{positive ? '+' : '−'}{formatCurrency(item.amount, item.currency)}</Text>
              </View>
            </TouchableOpacity>
          );
        }) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="weather-sunny" size={48} color={Colors.success} />
            <Text style={styles.emptyTitle}>Ufuk temiz görünüyor</Text>
            <Text style={styles.emptyText}>Seçilen dönemde planlanmış para hareketi yok.</Text>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  eyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: Colors.primaryLight },
  title: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.xxl, color: Colors.textPrimary, marginTop: 2 },
  score: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  scoreValue: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.lg, color: Colors.textPrimary, lineHeight: 20 },
  scoreLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9, color: Colors.textMuted },
  horizonRow: { flexDirection: 'row', padding: 4, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  horizon: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: BorderRadius.md },
  horizonActive: { backgroundColor: Colors.primary },
  horizonText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, color: Colors.textMuted },
  horizonTextActive: { color: '#fff' },
  hero: { overflow: 'hidden', padding: Spacing.xl, borderRadius: BorderRadius.xxl, backgroundColor: '#312D72', marginBottom: Spacing.md, ...Shadow.primary },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: `${Colors.primaryLight}30`, right: -60, top: -100 },
  heroLabel: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.sm, color: 'rgba(255,255,255,0.72)' },
  heroAmount: { fontFamily: 'Poppins_800ExtraBold', fontSize: 31, marginTop: 3, marginBottom: Spacing.xl },
  flowSummary: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  flowSummaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flowDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: Spacing.sm },
  flowCaption: { fontFamily: 'Poppins_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.6)' },
  flowValue: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: '#fff' },
  insightRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  insightCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.md },
  insightValue: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.md, color: Colors.textPrimary, marginTop: Spacing.sm },
  insightLabel: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.lg, color: Colors.textPrimary },
  sectionSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted },
  timelineItem: { minHeight: 72, flexDirection: 'row' },
  timelineRail: { width: 26, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 18, borderWidth: 3, borderColor: Colors.background },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.surfaceBorder },
  timelineContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.surfaceBorder },
  timelineTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: Colors.textPrimary },
  timelineDate: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  timelineAmount: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.sm },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.lg, color: Colors.textPrimary },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
