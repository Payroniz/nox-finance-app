import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/theme';
import { Category, Currency, Debt, Payment, Subscription } from '../../src/constants/types';
import { getAllSettings, getCategories, getDebts, getPayments, getSubscriptions, updatePaymentStatus } from '../../src/db/database';
import { CurrencySelector } from '../../src/components/CurrencySelector';
import { useTabBarInset } from '../../src/components/TabBarInset';
import { formatCurrency, formatDate, formatLocalDateKey, getGreeting } from '../../src/utils/helpers';
import { calculateMonthlyStats } from '../../src/utils/expenses';
import { buildDashboardEvents, DashboardEvent, getDashboardSummary } from '../../src/utils/dashboard';
import { getMonthlySubscriptionTotals } from '../../src/utils/subscriptions';
import { cancelNotification } from '../../src/utils/notifications';

type DashboardData = { payments: Payment[]; subscriptions: Subscription[]; debts: Debt[]; categories: Category[] };
const eventColor = (event: DashboardEvent) => event.overdue ? Colors.danger : event.receivable ? Colors.success
  : event.kind === 'subscription' ? '#AAA3FF' : event.kind === 'debt' ? '#E8AA6B' : Colors.info;
const eventIcon = (event: DashboardEvent): keyof typeof MaterialCommunityIcons.glyphMap => event.kind === 'subscription' ? 'repeat'
  : event.kind === 'payment' ? 'credit-card-outline' : event.receivable ? 'arrow-bottom-left' : 'arrow-top-right';
const openEvent = (event: DashboardEvent) => {
  if (event.kind === 'subscription') router.push({ pathname: '/(tabs)/subscriptions', params: { edit: event.entityId } });
  else if (event.kind === 'payment') router.push(`/payment/${event.entityId}`);
  else router.push(`/debt/${event.entityId}`);
};

function EventRow({ event, onPress, onPaid, busy }: { event: DashboardEvent; onPress: () => void; onPaid?: () => void; busy?: boolean }) {
  const color = eventColor(event);
  const today = formatLocalDateKey(new Date());
  return <View style={styles.eventRow}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${event.name}, ${event.label}, ${formatCurrency(event.amount, event.currency)}, ${formatDate(event.date)}`}
      onPress={onPress} style={styles.eventLink}>
      <View style={[styles.eventIcon, { backgroundColor: `${color}15` }]}><MaterialCommunityIcons name={eventIcon(event)} size={22} color={color} /></View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.eventName}>{event.name}</Text>
        <Text style={styles.caption}>{event.label} · <Text style={event.overdue ? { color: Colors.danger } : undefined}>{event.overdue ? 'Gecikti · ' : ''}{event.date === today ? 'Bugün' : formatDate(event.date, 'dd MMM')}</Text></Text>
      </View>
      <Text style={[styles.eventAmount, event.receivable && { color: Colors.success }]}>{event.receivable ? '+' : ''}{formatCurrency(event.amount, event.currency)}</Text>
      {!onPaid && <MaterialCommunityIcons name="chevron-right" size={17} color={Colors.textMuted} />}
    </TouchableOpacity>
    {onPaid && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${event.name} ödendi olarak işaretle`} disabled={busy} onPress={onPaid} style={styles.paidButton}>
      {busy ? <ActivityIndicator size="small" color={Colors.success} /> : <MaterialCommunityIcons name="check-circle-outline" size={24} color={Colors.success} />}
    </TouchableOpacity>}
  </View>;
}

export default function Dashboard() {
  const tabBarInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DashboardData>({ payments: [], subscriptions: [], debts: [], categories: [] });
  const [userName, setUserName] = useState('Kullanıcı');
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('TRY');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [eventFilter, setEventFilter] = useState<'upcoming' | 'overdue'>('upcoming');
  const [busyPayment, setBusyPayment] = useState<number | null>(null);
  const busyRef = useRef(false);
  const requestRef = useRef(0);
  const currency = selectedCurrency ?? defaultCurrency;

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const [payments, subscriptions, owe, owed, categories, settings] = await Promise.all([
        getPayments(), getSubscriptions(), getDebts('owe'), getDebts('owed'), getCategories(), getAllSettings(),
      ]);
      if (request !== requestRef.current) return;
      setData({ payments, subscriptions, debts: [...owe, ...owed], categories });
      setUserName(settings.userName); setDefaultCurrency(settings.defaultCurrency); setError('');
    } catch { if (request === requestRef.current) setError('Bilgiler yüklenemedi. Yeniden denemek için dokun.'); }
    finally { if (request === requestRef.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { requestRef.current++; }; }, [load]));
  const markPaid = async (event: DashboardEvent) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusyPayment(event.entityId);
    try {
      const payment = data.payments.find(item => item.id === event.entityId);
      if (payment?.notification_id) await cancelNotification(payment.notification_id);
      await updatePaymentStatus(event.entityId, 'paid'); await load();
    } catch { setError('Ödeme güncellenemedi. Yeniden deneyin.'); }
    finally { busyRef.current = false; setBusyPayment(null); }
  };

  const now = new Date();
  const stats = calculateMonthlyStats(data.payments, data.subscriptions, data.categories, now.getFullYear(), now.getMonth() + 1, currency);
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previous = calculateMonthlyStats(data.payments, data.subscriptions, data.categories, previousDate.getFullYear(), previousDate.getMonth() + 1, currency);
  const summary = getDashboardSummary(data.payments, data.debts, currency, now);
  const events = buildDashboardEvents(data.payments, data.subscriptions, data.debts, now);
  const currencyEvents = events.filter(item => item.currency === currency);
  const upcoming = currencyEvents.filter(item => !item.overdue);
  const overdue = currencyEvents.filter(item => item.overdue);
  const visibleEvents = eventFilter === 'upcoming' ? upcoming : overdue;
  const outflow = visibleEvents.filter(item => !item.receivable).reduce((sum, item) => sum + item.amount, 0);
  const change = previous.totalExpense > 0 ? Math.round((stats.totalExpense - previous.totalExpense) / previous.totalExpense * 100) : null;
  const activeSubscriptions = data.subscriptions.filter(item => item.active === 1 && item.currency === currency);
  const monthlyEstimate = getMonthlySubscriptionTotals(activeSubscriptions)[currency] ?? 0;

  return <View style={[styles.container, { paddingTop: insets.top }]}>
    <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + 20 }]} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={Colors.primaryLight} />}>
      <View style={styles.header}>
        <View style={styles.flex}><Text style={styles.greeting}>{getGreeting()}, {userName}</Text><Text style={styles.pageTitle}>NoX Finance App</Text><Text style={styles.caption}>{formatDate(formatLocalDateKey(now), 'd MMMM yyyy, EEEE')}</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Bildirimler, ${events.length} işlem`} onPress={() => setShowNotifications(true)} style={styles.notificationButton}>
          <MaterialCommunityIcons name="bell-outline" size={23} color={Colors.textPrimary} />
          {events.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{events.length > 9 ? '9+' : events.length}</Text></View>}
        </TouchableOpacity>
      </View>
      <CurrencySelector value={currency} onChange={setSelectedCurrency} />
      {!!error && <TouchableOpacity accessibilityRole="button" onPress={() => void load()} style={styles.error}><Text style={styles.errorText}>{error}</Text></TouchableOpacity>}
      {loading ? <View style={styles.loading}><ActivityIndicator color={Colors.primaryLight} size="large" /><Text style={styles.caption}>Finansal özetin hazırlanıyor</Text></View> : <>
        <View style={styles.hero}>
          <View style={styles.rowBetween}><View style={styles.row}><View style={styles.heroDot} /><Text style={styles.eyebrow}>AYLIK GÖRÜNÜM</Text></View><Text style={styles.month}>{formatDate(formatLocalDateKey(now), 'MMMM yyyy')}</Text></View>
          <Text style={styles.heroAmount} adjustsFontSizeToFit numberOfLines={1}>{formatCurrency(stats.totalExpense, currency)}</Text>
          <View style={styles.rowBetween}><Text style={styles.heroCaption}>Bu ayın toplam gideri</Text>{change !== null && <View style={styles.change}><MaterialCommunityIcons name={change > 0 ? 'trending-up' : change < 0 ? 'trending-down' : 'minus'} size={14} color="#D6D0FF" /><Text style={styles.changeText}>%{Math.abs(change)}</Text></View>}</View>
          <Text style={styles.heroHint}>{change !== null ? 'Değişim geçen ayın tamamına göredir.' : 'Ödemeler ve bu aya ait abonelik yenilemeleri.'}</Text>
          <View style={styles.distribution}>{[
            { value: summary.paidAmount, color: '#7DDDB0' }, { value: summary.pendingAmount, color: '#F4C182' }, { value: stats.subscriptionExpense, color: '#B3A5FF' },
          ].map((part, index) => part.value > 0 && <View key={index} style={{ width: `${part.value / stats.totalExpense * 100}%`, backgroundColor: part.color, height: 5 }} />)}</View>
          <View style={styles.heroDetails}>{[
            { label: 'Ödendi', amount: summary.paidAmount, color: '#7DDDB0' },
            { label: 'Bekleyen', amount: summary.pendingAmount, color: '#F4C182' },
            { label: 'Abonelik', amount: stats.subscriptionExpense, color: '#B3A5FF' },
          ].map(item => <View style={styles.flex} key={item.label}><View style={styles.row}><View style={[styles.dot, { backgroundColor: item.color }]} /><Text style={styles.heroCaption}>{item.label}</Text></View><Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroDetailAmount}>{formatCurrency(item.amount, currency)}</Text></View>)}</View>
          <TouchableOpacity accessibilityRole="button" style={styles.heroFooter} onPress={() => router.push('/(tabs)/stats')}><Text style={styles.heroCaption}>{summary.paidCount}/{summary.paymentCount} ödeme tamamlandı</Text><View style={styles.row}><Text style={styles.heroLink}>Raporu aç</Text><MaterialCommunityIcons name="arrow-top-right" size={17} color="#DDD7FF" /></View></TouchableOpacity>
        </View>

        <View style={styles.quickActions}>{[
          { label: 'Ödeme ekle', icon: 'plus' as const, action: () => router.push('/payment/add'), primary: true },
          { label: 'Abonelik ekle', icon: 'repeat' as const, action: () => router.push({ pathname: '/(tabs)/subscriptions', params: { add: '1' } }), primary: false },
          { label: 'Borç ekle', icon: 'account-cash-outline' as const, action: () => router.push('/debt/add'), primary: false },
        ].map(item => <TouchableOpacity accessibilityRole="button" key={item.label} onPress={item.action} style={[styles.quickAction, item.primary && styles.quickPrimary]}><MaterialCommunityIcons name={item.icon} size={23} color={item.primary ? 'white' : '#B9B3FF'} /><Text style={styles.quickText}>{item.label}</Text></TouchableOpacity>)}</View>

        {overdue.length > 0 && <TouchableOpacity accessibilityRole="button" onPress={() => setEventFilter('overdue')} style={styles.overdueBanner}><View style={styles.row}><MaterialCommunityIcons name="alert-circle-outline" size={21} color={Colors.danger} /><Text style={styles.overdueText}>{overdue.length} gecikmiş işlem var</Text></View><MaterialCommunityIcons name="arrow-right" size={20} color={Colors.danger} /></TouchableOpacity>}

        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Sıradaki işlemler</Text><Text style={styles.caption}>Ödeme, abonelik, borç ve alacakların</Text></View><TouchableOpacity accessibilityRole="button" style={styles.textButton} onPress={() => router.push('/(tabs)/planner')}><Text style={styles.link}>Planı aç</Text><MaterialCommunityIcons name="arrow-top-right" size={17} color={Colors.primaryLight} /></TouchableOpacity></View>
        <View style={styles.agenda}>
          <View style={styles.agendaTabs}>{([{ key: 'upcoming', label: 'Önümüzdeki 7 gün', count: upcoming.length }, { key: 'overdue', label: 'Gecikenler', count: overdue.length }] as const).map(tab => <TouchableOpacity key={tab.key} accessibilityRole="button" accessibilityState={{ selected: eventFilter === tab.key }} style={[styles.agendaTab, eventFilter === tab.key && styles.agendaTabActive]} onPress={() => setEventFilter(tab.key)}><Text style={[styles.agendaTabText, eventFilter === tab.key && { color: Colors.textPrimary }]}>{tab.label} <Text style={styles.caption}>({tab.count})</Text></Text></TouchableOpacity>)}</View>
          <View style={styles.agendaTotal}><Text style={styles.caption}>Planlanan çıkış · {currency}</Text><Text style={styles.agendaAmount}>{formatCurrency(outflow, currency)}</Text></View>
          {visibleEvents.length ? visibleEvents.slice(0, 5).map(event => <EventRow key={event.id} event={event} onPress={() => openEvent(event)}
            onPaid={event.kind === 'payment' ? () => void markPaid(event) : undefined} busy={busyPayment === event.entityId} />)
            : <View style={styles.empty}><View style={styles.emptyIcon}><MaterialCommunityIcons name={eventFilter === 'overdue' ? 'check-all' : 'calendar-blank-outline'} size={29} color={Colors.primaryLight} /></View><Text style={styles.emptyTitle}>{eventFilter === 'overdue' ? 'Gecikmiş işlemin yok' : 'Bu hafta takvimin boş'}</Text><Text style={styles.emptyText}>{eventFilter === 'overdue' ? 'Bu para birimindeki işlemler güncel.' : 'Yeni bir ödeme veya abonelik eklediğinde yaklaşan işlemlerin burada görünür.'}</Text></View>}
          {visibleEvents.length > 5 && <TouchableOpacity accessibilityRole="button" style={styles.allEvents} onPress={() => setShowNotifications(true)}><Text style={styles.link}>Tüm işlemleri gör ({visibleEvents.length})</Text></TouchableOpacity>}
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Borç & alacak</Text><TouchableOpacity accessibilityRole="button" style={styles.textButton} onPress={() => router.push('/(tabs)/debts')}><Text style={styles.link}>Detaylar</Text><MaterialCommunityIcons name="chevron-right" size={18} color={Colors.primaryLight} /></TouchableOpacity></View>
        <View style={styles.debtCards}>{[
          { title: 'Kalan borcum', amount: summary.owe, icon: 'arrow-top-right' as const, color: '#ECAA83' },
          { title: 'Kalan alacağım', amount: summary.owed, icon: 'arrow-bottom-left' as const, color: '#79D6AC' },
        ].map(item => <TouchableOpacity accessibilityRole="button" key={item.title} style={styles.debtCard} onPress={() => router.push('/(tabs)/debts')}><View style={styles.rowBetween}><Text style={styles.caption}>{item.title}</Text><MaterialCommunityIcons name={item.icon} size={19} color={item.color} /></View><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.debtAmount, { color: item.color }]}>{formatCurrency(item.amount, currency)}</Text></TouchableOpacity>)}</View>

        <TouchableOpacity accessibilityRole="button" style={styles.subscriptionSummary} onPress={() => router.push('/(tabs)/subscriptions')}><View style={styles.subscriptionIcon}><MaterialCommunityIcons name="repeat" size={24} color="#B9B3FF" /></View><View style={styles.flex}><Text style={styles.eventName}>Aboneliklerin</Text><Text style={styles.caption}>{activeSubscriptions.length} aktif · aylık tahmini</Text><Text style={styles.subscriptionAmount}>{formatCurrency(monthlyEstimate, currency)}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textSecondary} /></TouchableOpacity>
        <Text style={styles.footerNote}>Tutarlar {currency} cinsindedir. Para birimleri ayrı hesaplanır.</Text>
      </>}
    </ScrollView>

    <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
      <View style={styles.modalOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Bildirimleri kapat" onPress={() => setShowNotifications(false)} style={StyleSheet.absoluteFill} />
        <View style={[styles.notificationPanel, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.handle} /><View style={styles.sectionHeading}><View style={styles.flex}><Text style={styles.sectionTitle}>Bildirimler</Text><Text style={styles.caption}>Gecikenler ve 7 gün içindeki işlemler · tüm para birimleri</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Kapat" style={styles.notificationButton} onPress={() => setShowNotifications(false)}><MaterialCommunityIcons name="close" size={23} color={Colors.textPrimary} /></TouchableOpacity></View>
          <ScrollView>{events.length ? events.map(event => <EventRow key={event.id} event={event} onPress={() => { setShowNotifications(false); openEvent(event); }} />) : <View style={styles.empty}><MaterialCommunityIcons name="bell-check-outline" size={40} color={Colors.primaryLight} /><Text style={styles.emptyTitle}>Her şey güncel</Text><Text style={styles.emptyText}>Yaklaşan veya gecikmiş bir işlem bulunmuyor.</Text></View>}</ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, width: '100%', maxWidth: 780, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 22 },
  greeting: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary, marginBottom: 3 },
  pageTitle: { fontFamily: 'Poppins_700Bold', fontSize: 25, letterSpacing: -0.7, color: Colors.textPrimary, marginBottom: 3 },
  caption: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textSecondary },
  notificationButton: { width: 46, height: 46, borderRadius: 17, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -2, top: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, color: 'white' },
  error: { borderRadius: 14, padding: 14, backgroundColor: `${Colors.danger}15`, marginBottom: 16 },
  errorText: { color: Colors.danger, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  loading: { alignItems: 'center', paddingVertical: 80, gap: 16 },
  hero: { backgroundColor: '#302A55', borderRadius: 26, borderWidth: 1, borderColor: '#514474', padding: 20, overflow: 'hidden' },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B9A4FF' },
  eyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: '#C5B5FA' },
  month: { fontFamily: 'Poppins_500Medium', fontSize: 10, color: '#D1C8E6', textTransform: 'capitalize' },
  heroAmount: { fontFamily: 'Poppins_700Bold', fontSize: 37, letterSpacing: -1.2, color: '#FFFFFF', marginTop: 18 },
  heroCaption: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#D1C8E6' },
  heroHint: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: '#B4A8CE', marginTop: 5 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF0F', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  changeText: { fontFamily: 'Poppins_500Medium', fontSize: 10, color: '#D6D0FF' },
  distribution: { height: 5, backgroundColor: '#FFFFFF12', flexDirection: 'row', borderRadius: 5, overflow: 'hidden', marginTop: 22, marginBottom: 16 },
  heroDetails: { flexDirection: 'row', gap: 10 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  heroDetailAmount: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: 'white', marginTop: 5 },
  heroFooter: { borderTopWidth: 1, borderTopColor: '#FFFFFF12', marginTop: 18, paddingTop: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroLink: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: '#DDD7FF' },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 24 },
  quickAction: { flex: 1, minHeight: 80, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  quickPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  quickText: { fontFamily: 'Poppins_500Medium', fontSize: 10, textAlign: 'center', color: Colors.textPrimary },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: '#FF5B5B0D', borderWidth: 1, borderColor: '#FF5B5B30', padding: 14, borderRadius: 16, marginBottom: 20 },
  overdueText: { color: '#FF9292', fontFamily: 'Poppins_500Medium', fontSize: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: Colors.textPrimary },
  textButton: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4 },
  link: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: Colors.primaryLight },
  agenda: { backgroundColor: '#242436', borderWidth: 1, borderColor: '#363648', borderRadius: 22, paddingHorizontal: 14, paddingTop: 14, marginBottom: 24 },
  agendaTabs: { flexDirection: 'row', padding: 3, gap: 4, borderRadius: 12, backgroundColor: Colors.background },
  agendaTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, minHeight: 40, borderRadius: 10 },
  agendaTabActive: { backgroundColor: Colors.surfaceLight },
  agendaTabText: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: Colors.textSecondary },
  agendaTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 16 },
  agendaAmount: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  eventRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#FFFFFF08', minHeight: 77 },
  eventLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  eventIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventName: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.textPrimary, marginBottom: 3 },
  eventAmount: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: Colors.textPrimary, maxWidth: '40%', textAlign: 'right' },
  paidButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center', gap: 9 },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#6C63FF14', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 19, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },
  allEvents: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#FFFFFF08' },
  debtCards: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  debtCard: { flex: 1, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: '#252537' },
  debtAmount: { fontFamily: 'Poppins_600SemiBold', fontSize: 19, marginTop: 12 },
  subscriptionSummary: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: '#252537' },
  subscriptionIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#6C63FF18', alignItems: 'center', justifyContent: 'center' },
  subscriptionAmount: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: Colors.textPrimary, marginTop: 5 },
  footerNote: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: Colors.textSecondary, textAlign: 'center', marginTop: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  notificationPanel: { backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 10, borderWidth: 1, borderColor: Colors.surfaceBorder },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceBorder, alignSelf: 'center', marginBottom: 18 },
});