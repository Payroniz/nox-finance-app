import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SalaryButton as Button, SalaryField as Field, SalaryChip as Chip, SalaryIconButton as IconButton, SalaryColors, SalaryPanel, SalaryGlow, SalaryGauge, SalarySection, SalaryDateField, SalaryResult, SalaryIconTile } from '../../src/components/salary/SalaryUI';
import { SalaryRangePicker } from '../../src/components/salary/SalaryRangePicker';
import { Currency, Debt, Payment, SalaryAllocation, SalaryData, SalaryPeriod, SalaryWorkEntry, Subscription } from '../../src/constants/types';
import { deleteSalaryAllocation, deleteSalaryWorkEntry, getAllSettings, getDebts, getPayments, getSalaryData, getSubscriptions, saveSalaryAllocation, saveSalaryPeriod, saveSalaryWorkEntry } from '../../src/db/database';
import { useTabBarInset } from '../../src/components/TabBarInset';
import { formatCurrency, formatDate, formatLocalDateKey, parseLocalDate } from '../../src/utils/helpers';
import { EMPTY_SALARY_DATA, formatWorkDuration, isSalaryMonth, parseSalaryMoney, parseWorkDuration, salaryExpenseCandidates, SalaryExpenseCandidate, salaryMoneyInput, salarySourceKey, salarySummary, validateSalaryWorkEntry, workEntryEarnings, salaryMonthRange, SalaryExpenseRange, salaryAllocationGroups } from '../../src/utils/salary';

const KIND_LABELS = { manual: 'Diğer gider', payment: 'Ödeme', debt: 'Borç', subscription: 'Abonelik' };
const KIND_ICONS = { manual: 'tag-outline', payment: 'calendar-check-outline', debt: 'account-cash-outline', subscription: 'repeat' } as const;
type Editor = 'settings' | 'work' | 'allocation' | 'delete';
type Deletion = { kind: 'work'; item: SalaryWorkEntry } | { kind: 'allocation'; item: SalaryAllocation };

const Colors = { background: SalaryColors.background, surface: SalaryColors.surface, surfaceBorder: SalaryColors.border, textPrimary: SalaryColors.text, textSecondary: SalaryColors.muted, textMuted: SalaryColors.muted, primary: '#795DE8', primaryLight: SalaryColors.purple, warning: SalaryColors.warning, danger: SalaryColors.danger };

export default function SalaryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const [month, setMonth] = useState(() => formatLocalDateKey(new Date()).slice(0, 7));
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [data, setData] = useState<SalaryData>(EMPTY_SALARY_DATA);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const initialized = useRef(false);
  const request = useRef(0);
  const [editor, setEditor] = useState<Editor>('settings');
  const [editorVisible, setEditorVisible] = useState(false);
  const openEditor = (value: Editor) => { setEditor(value); setEditorVisible(true); };
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [section, setSection] = useState<'work' | 'allocation'>('work');
  const [mode, setMode] = useState<SalaryPeriod['mode']>('hourly');
  const [rate, setRate] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [editingWork, setEditingWork] = useState<SalaryWorkEntry | null>(null);
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('0');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [dayRate, setDayRate] = useState('');
  const [notes, setNotes] = useState('');
  const [editingAllocation, setEditingAllocation] = useState<SalaryAllocation | null>(null);
  const [origin, setOrigin] = useState<'linked' | 'manual'>('linked');
  const [candidate, setCandidate] = useState<SalaryExpenseCandidate | null>(null);
  const [allocationTitle, setAllocationTitle] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');
  const allocationPreviewRef = useRef<number | null>(null);
  const [allocationDate, setAllocationDate] = useState('');
  const [expenseRange, setExpenseRange] = useState<SalaryExpenseRange>(() => salaryMonthRange(month));
  const [customRange, setCustomRange] = useState(false);
  const rangeOwner = useRef(`${month}:${currency}`);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'payment' | 'debt' | 'subscription'>('all');
  const [deletion, setDeletion] = useState<Deletion | null>(null);

  const load = useCallback(async () => {
    const token = ++request.current;
    try {
      const [salary, paymentRows, debtRows, subscriptionRows, settings] = await Promise.all([getSalaryData(), getPayments(), getDebts(), getSubscriptions(), getAllSettings()]);
      if (token !== request.current) return;
      setData(salary); setPayments(paymentRows); setDebts(debtRows); setSubscriptions(subscriptionRows);
      if (!initialized.current) { setCurrency(settings.defaultCurrency); initialized.current = true; }
      setLoadError(false);
    } catch { if (token === request.current) setLoadError(true); }
    finally { if (token === request.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));

  const period = data.periods.find(item => item.month === month && item.currency === currency);
  const entries = data.workEntries.filter(item => item.period_id === period?.id);
  const allocations = data.allocations.filter(item => item.period_id === period?.id);
  const allocationGroups = salaryAllocationGroups(allocations);
  const futureAllocated = allocations.filter(item => item.occurrence_date.slice(0, 7) > month).reduce((total, item) => total + item.amount_minor, 0);
  const summary = period ? salarySummary(period, entries, allocations) : null;
  const money = (minor: number) => formatCurrency(minor / 100, currency);
  const today = formatLocalDateKey(new Date());
  const currentMonth = today.slice(0, 7);
  const monthDate = parseLocalDate(`${month}-01`)!;
  const monthLabel = monthDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const canAct = !loading && !loadError && !busy;
  const candidates = useMemo(() => {
    if (!period) return { items: [], error: '' };
    try {
      const linked = new Set(data.allocations.filter(item => item.kind !== 'debt' || item.period_id === period.id).map(salarySourceKey));
      return { items: salaryExpenseCandidates(period, payments, debts, subscriptions, expenseRange).filter(item => !linked.has(salarySourceKey(item))), error: '' };
    } catch (err) { return { items: [], error: err instanceof Error ? err.message : 'Giderler hesaplanamadı.' }; }
  }, [period, payments, debts, subscriptions, data.allocations, expenseRange]);
  const visibleCandidates = candidates.items.filter(item => (kindFilter === 'all' || item.kind === kindFilter) && item.title.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));

  const moveMonth = (delta: number) => {
    const next = formatLocalDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1)).slice(0, 7);
    if (isSalaryMonth(next)) setMonth(next);
  };
  const showSettings = () => {
    const previous = period ?? [...data.periods].filter(item => item.currency === currency && item.month < month).sort((a, b) => b.month.localeCompare(a.month))[0];
    setMode(previous?.mode ?? 'hourly'); setRate(previous?.hourly_rate_minor ? salaryMoneyInput(previous.hourly_rate_minor) : '');
    setMonthlySalary(previous?.monthly_salary_minor ? salaryMoneyInput(previous.monthly_salary_minor) : '');
    setError(''); openEditor('settings');
  };
  const showWork = (item?: SalaryWorkEntry) => {
    if (!period) return;
    setEditingWork(item ?? null);
    setDate(item?.date ?? (month === currentMonth ? today : formatLocalDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0))));
    setHours(item ? String(Math.floor(item.worked_minutes / 60)) : ''); setMinutes(item ? String(item.worked_minutes % 60) : '0');
    setBreakMinutes(String(item?.break_minutes ?? 0)); setDayRate(salaryMoneyInput(item?.hourly_rate_minor ?? period.hourly_rate_minor));
    setNotes(item?.notes ?? ''); setError(''); openEditor('work');
  };
  const showAllocation = (item?: SalaryAllocation) => {
    if (rangeOwner.current !== `${month}:${currency}`) { setExpenseRange(salaryMonthRange(month)); setCustomRange(false); rangeOwner.current = `${month}:${currency}`; }
    setAllocationDate(item?.occurrence_date ?? '');
    setEditingAllocation(item ?? null); setCandidate(item ?? null); setOrigin(item?.kind === 'manual' ? 'manual' : 'linked');
    setAllocationTitle(item?.title ?? ''); setAllocationAmount(item ? salaryMoneyInput(item.amount_minor) : ''); setNotes(item?.notes ?? '');
    setSearch(''); setKindFilter('all'); setError(''); openEditor('allocation');
  };
  const close = () => { if (!busyRef.current) { setEditorVisible(false); setError(''); } };
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); setEditorVisible(false); await load(); }
    catch (err) { setError(err instanceof Error && !/SQL|constraint|database/i.test(err.message) ? err.message : 'Kayıt tamamlanamadı. Bilgileri kontrol edip yeniden deneyin.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const workInput = (): Omit<SalaryWorkEntry, 'id'> => {
    if (!period) throw new Error('Önce maaş tanımlayın.');
    if (!/^\d{1,4}$/.test(breakMinutes)) throw new Error('Ücretsiz molayı dakika olarak girin.');
    const item = { period_id: period.id, date, worked_minutes: parseWorkDuration(hours, minutes), break_minutes: Number(breakMinutes), hourly_rate_minor: parseSalaryMoney(dayRate), notes };
    validateSalaryWorkEntry(item, period, today);
    return item;
  };
  let preview: { minutes: number; amount: number } | null = null;
  if (editor === 'work') {
    try { const item = workInput(); preview = { minutes: item.worked_minutes - item.break_minutes, amount: workEntryEarnings(item) }; } catch { /* Incomplete form. */ }
  }
  let allocationPreview: number | null = editorVisible ? null : allocationPreviewRef.current;
  if (editorVisible && editor === 'allocation' && summary) {
    try { allocationPreview = summary.remaining + (editingAllocation?.amount_minor ?? 0) - parseSalaryMoney(allocationAmount); } catch { /* Incomplete form. */ }
  }
  allocationPreviewRef.current = allocationPreview;
  const saveSettings = () => void run(async () => {
    await saveSalaryPeriod({ month, currency, mode,
      hourly_rate_minor: mode === 'hourly' ? parseSalaryMoney(rate) : period?.hourly_rate_minor ?? 0,
      monthly_salary_minor: mode === 'monthly' ? parseSalaryMoney(monthlySalary) : period?.monthly_salary_minor ?? 0 }, period?.id);
  });
  const saveWork = () => void run(() => saveSalaryWorkEntry(workInput(), editingWork?.id));
  const saveAllocation = () => void run(async () => {
    if (!period) throw new Error('Önce maaş tanımlayın.');
    if (origin === 'linked' && !candidate) throw new Error('Bağlanacak bir gider seçin.');
    await saveSalaryAllocation({ period_id: period.id, kind: origin === 'manual' ? 'manual' : candidate!.kind,
      source_id: origin === 'manual' ? null : candidate!.source_id, occurrence_date: origin === 'manual' ? allocationDate : candidate!.occurrence_date,
      title: allocationTitle, amount_minor: parseSalaryMoney(allocationAmount), notes }, editingAllocation?.id);
  });
  const confirmDelete = (value: Deletion) => { setDeletion(value); setError(''); openEditor('delete'); };
  const remove = () => void run(async () => {
    if (!deletion) return;
    if (deletion.kind === 'work') await deleteSalaryWorkEntry(deletion.item.id, deletion.item.period_id);
    else await deleteSalaryAllocation(deletion.item.id, deletion.item.period_id);
  });
  const openSource = (item: SalaryAllocation) => {
    if (item.kind === 'payment') router.push(`/payment/${item.source_id}`);
    else if (item.kind === 'debt') router.push(`/debt/${item.source_id}`);
    else if (item.kind === 'subscription') router.push({ pathname: '/(tabs)/subscriptions', params: { edit: String(item.source_id) } });
  };
  const sourceExists = (item: SalaryAllocation) => item.kind === 'payment' ? payments.some(source => source.id === item.source_id)
    : item.kind === 'debt' ? debts.some(source => source.id === item.source_id) : item.kind === 'subscription' && subscriptions.some(source => source.id === item.source_id);

  return <View style={[styles.container, { paddingTop: insets.top }]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + 24 }]}
      refreshControl={<RefreshControl refreshing={loading} tintColor={Colors.primaryLight} onRefresh={() => { setLoading(true); void load(); }} />}>
      <View style={styles.header}><View style={styles.flex}><Text style={styles.eyebrow}>GELİR MERKEZİ</Text><Text style={styles.title}>Maaş<Text style={{ color: SalaryColors.cyan }}>.</Text></Text><Text style={styles.muted}>Bugünün emeği, yarının planı.</Text></View>
        <IconButton icon="tune-variant" label="Maaş ayarları" disabled={!canAct} onPress={showSettings} /></View>
      <View style={styles.monthRow}><IconButton icon="chevron-left" label="Önceki ay" onPress={() => moveMonth(-1)} disabled={busy || month === '1900-01'} />
        <View style={styles.monthCenter}><Text style={styles.eyebrow}>MAAŞ DÖNEMİ</Text><Text style={styles.monthTitle}>{monthLabel}</Text>{month !== currentMonth && <TouchableOpacity accessibilityRole="button" onPress={() => setMonth(currentMonth)}><Text style={styles.link}>Bu aya dön</Text></TouchableOpacity>}</View>
        <IconButton icon="chevron-right" label="Sonraki ay" onPress={() => moveMonth(1)} disabled={busy || month === '2199-12'} /></View>
      <View style={styles.currencyRow}>{(['TRY', 'USD', 'EUR', 'GBP'] as const).map(value => <Chip key={value} label={value} selected={currency === value} onPress={() => setCurrency(value)} />)}</View>
      {loadError ? <View style={styles.card}><Text style={styles.error}>Maaş bilgileri yüklenemedi.</Text><Button label="Yeniden dene" onPress={() => { setLoading(true); void load(); }} /></View>
        : loading ? <ActivityIndicator style={styles.loader} size="large" color={Colors.primaryLight} />
          : !period ? <View style={styles.setupCard}><SalaryGlow /><SalaryIconTile icon="wallet-outline" size={64} />
            <Text style={styles.setupTitle}>Emeğini bir plana dönüştür.</Text><Text style={styles.emptyText}>{monthLabel} · {currency}{'\n'}Ücretini belirle, çalışmanı kaydet. Bu ayın veya gelecek ayların giderlerini maaşına bağla.</Text>
            <Button label="Maaş tanımla" onPress={showSettings} /><Text style={styles.hint}>Her ay ve para birimi ayrı tutulur.</Text></View>
            : summary && <>
              <View style={styles.hero}><SalaryGlow /><View style={styles.heroTop}><Text style={styles.heroLabel}>KULLANILABİLİR MAAŞ</Text><View style={styles.badge}><Text style={styles.badgeText}>{period.mode === 'hourly' ? 'Saatlik' : 'Sabit aylık'}</Text></View></View>
                <View style={styles.heroMain}><View style={styles.flex}><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.heroAmount, summary.remaining < 0 && styles.warning]}>{money(summary.remaining)}</Text>
                  <Text style={styles.heroHint}>{period.mode === 'hourly' ? `${summary.days} gün · ${formatWorkDuration(summary.paidMinutes)} ücretli çalışma` : 'Tanımladığın aylık net maaş üzerinden'}</Text></View>
                  <SalaryGauge ratio={summary.earned > 0 ? summary.allocated / summary.earned : summary.allocated > 0 ? null : 0} negative={summary.remaining < 0} /></View>
                <View style={styles.heroStats}><View style={styles.flex}><Text style={styles.heroCaption}>{period.mode === 'hourly' ? 'Hesaplanan kazanç' : 'Aylık maaş'}</Text><Text style={styles.heroValue}>{money(summary.earned)}</Text></View>
                  <View style={styles.heroDivider} /><View style={styles.flex}><Text style={styles.heroCaption}>Giderlere ayrılan</Text><Text style={styles.heroValue}>{money(summary.allocated)}</Text></View></View>
                {futureAllocated > 0 && <View style={styles.futureNote}><MaterialCommunityIcons name="calendar-arrow-right" color={SalaryColors.cyan} size={18} /><Text style={styles.heroHint}>Gelecek aylar için {money(futureAllocated)} ayrıldı</Text></View>}
              </View>
              {summary.remaining < 0 && <View style={styles.notice}><MaterialCommunityIcons name="alert-circle-outline" size={21} color={Colors.warning} /><Text style={styles.noticeText}>Ayrılan giderler {money(-summary.remaining)} fazla. {period.mode === 'hourly' ? 'Kazanç yalnızca kaydettiğin çalışma günlerinden hesaplanır.' : 'Gider planını veya maaş tutarını gözden geçir.'}</Text></View>}
              <View style={styles.infoRow}><MaterialCommunityIcons name="information-outline" size={17} color={Colors.primaryLight} /><Text style={styles.hint}>Bu alan maaş bütçeni gösterir. Gider bağlamak ödeme yapmaz ve kayıtları “ödendi” olarak işaretlemez.</Text></View>
              <View style={styles.sectionTabs}><Chip label={`Çalışma (${entries.length})`} selected={section === 'work'} onPress={() => setSection('work')} /><Chip label={`Maaş dağılımı (${allocations.length})`} selected={section === 'allocation'} onPress={() => setSection('allocation')} /></View>
              {section === 'work' ? <>
                <View style={styles.sectionHeading}><View style={styles.flex}><Text style={styles.sectionTitle}>Çalışma günleri</Text><Text style={styles.muted}>{period.mode === 'hourly' ? `Varsayılan ücret ${money(period.hourly_rate_minor)} / saat` : 'Sabit aylık maaş kullanılıyor'}</Text></View>
                  {period.mode === 'hourly' && <IconButton icon="plus" label="Çalışma günü ekle" disabled={!canAct || month > currentMonth} onPress={() => showWork()} />}</View>
                {period.mode === 'monthly' && <View style={styles.card}><Text style={styles.emptyText}>Maaşın {money(period.monthly_salary_minor)} olarak hesaplanır. Saatlik takibe maaş ayarlarından geçebilirsin.{entries.length > 0 ? ' Önceki çalışma kayıtların korunur; sabit maaşa ayrıca eklenmez.' : ''}</Text></View>}
                {period.mode === 'hourly' && entries.length === 0 && <View style={styles.card}><MaterialCommunityIcons name="clock-plus-outline" size={32} color={Colors.primaryLight} /><Text style={styles.cardTitle}>Henüz çalışma kaydı yok</Text><Text style={styles.emptyText}>{month > currentMonth ? 'Bu ay başladığında çalıştığın günleri ekleyebilirsin.' : 'Toplam süreyi ve ücretsiz molanı gir. Günün kazancını hemen hesaplayalım.'}</Text>
                  {month <= currentMonth && <Button label="Çalışma günü ekle" onPress={() => showWork()} />}</View>}
                {entries.map(item => <View style={styles.card} key={item.id}><View style={styles.row}><View style={styles.dayTile}><Text style={styles.dayNumber}>{formatDate(item.date, 'dd')}</Text><Text style={styles.dayMonth}>{formatDate(item.date, 'MMM')}</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>{formatDate(item.date, 'EEEE')}</Text><Text style={styles.muted}>{formatWorkDuration(item.worked_minutes - item.break_minutes)}</Text><Text style={styles.muted}>{money(item.hourly_rate_minor)}/sa</Text></View><Text style={[styles.amount, { color: SalaryColors.cyan }]}>{money(workEntryEarnings(item))}</Text></View>
                  {item.break_minutes > 0 && <Text style={styles.hint}>{formatWorkDuration(item.break_minutes)} ücretsiz mola düşüldü.</Text>}{!!item.notes && <Text style={styles.note}>{item.notes}</Text>}
                  <View style={styles.actions}>{period.mode === 'hourly' && <IconButton icon="pencil-outline" label={`${formatDate(item.date)} çalışmasını düzenle`} disabled={!canAct} onPress={() => showWork(item)} />}<IconButton icon="trash-can-outline" label={`${formatDate(item.date)} çalışmasını sil`} disabled={!canAct} onPress={() => confirmDelete({ kind: 'work', item })} /></View></View>)}
                {period.mode === 'hourly' && entries.length > 0 && <Text style={styles.hint}>Ücretsiz molalar hariç tutulur. Her günün kazancı kuruşa yuvarlanıp toplanır. Ücret değişiklikleri eski günlere uygulanmaz.</Text>}
              </> : <>
                <View style={styles.sectionHeading}><View style={styles.flex}><Text style={styles.sectionTitle}>Maaşın nereye gidiyor?</Text><Text style={styles.muted}>Ödeme, borç, abonelik veya başka bir gider</Text></View><IconButton icon="plus" label="Maaştan gider ayır" disabled={!canAct} onPress={() => showAllocation()} /></View>
                {allocations.length === 0 && <View style={styles.card}><MaterialCommunityIcons name="cash-minus" size={32} color={Colors.primaryLight} /><Text style={styles.cardTitle}>İlk giderini maaşına bağla</Text><Text style={styles.emptyText}>Mevcut kayıtlarından seç veya yeni bir bütçe kalemi ekle. Ayırdığın tutar kalan maaşından otomatik düşer.</Text><Button label="Gider ekle" onPress={() => showAllocation()} /></View>}
                {allocationGroups.map(group => <View key={group.month || 'undated'}><View style={styles.groupHeader}><View style={styles.flex}><Text style={styles.cardTitle}>{group.month ? formatDate(`${group.month}-01`, 'MMMM yyyy') : 'Tarihsiz giderler'}</Text>{group.month > month && <Text style={styles.eyebrow}>GELECEK AY</Text>}</View><Text style={styles.muted}>{money(group.amount)}</Text></View>{group.items.map(item => <View style={styles.card} key={item.id}><View style={styles.row}><SalaryIconTile icon={KIND_ICONS[item.kind]} /><View style={styles.flex}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{KIND_LABELS[item.kind]}{item.occurrence_date ? ` · ${formatDate(item.occurrence_date, 'd MMM yyyy')}` : ''}</Text></View><Text style={styles.amount}>−{money(item.amount_minor)}</Text></View>
                  {!!item.notes && <Text style={styles.note}>{item.notes}</Text>}{item.kind !== 'manual' && !sourceExists(item) && <Text style={styles.hint}>Kaynak silinmiş; bu ay ayırdığın tutar korunuyor.</Text>}
                  <View style={styles.actions}>{sourceExists(item) && <TouchableOpacity accessibilityRole="button" style={styles.sourceLink} onPress={() => openSource(item)}><Text style={styles.link}>Kaydı aç</Text></TouchableOpacity>}
                    <IconButton icon="pencil-outline" label={`${item.title} ayırmasını düzenle`} disabled={!canAct} onPress={() => showAllocation(item)} /><IconButton icon="trash-can-outline" label={`${item.title} ayırmasını kaldır`} disabled={!canAct} danger onPress={() => confirmDelete({ kind: 'allocation', item })} /></View></View>)}</View>)}
                {allocations.length > 0 && <Text style={styles.hint}>Tutarlar bağladığın andaki haliyle saklanır. Kaynak sonradan ödense, değişse veya silinse de ayırdığın para korunur. Değişiklik için bu ayırmayı düzenle. Abonelik için ayrıca ödeme kaydı açtıysan yalnızca birini bağla.</Text>}
              </>}
            </>}
    </ScrollView>

    <Modal visible={editorVisible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.modalHeader}><SalaryIconTile icon={editor === 'settings' ? 'tune-variant' : editor === 'work' ? 'clock-edit-outline' : editor === 'delete' ? 'trash-can-outline' : 'wallet-plus-outline'} tone={editor === 'delete' ? 'danger' : 'cyan'} /><View style={styles.flex}><Text style={styles.eyebrow}>MAAŞ ATÖLYESİ</Text><Text style={styles.sectionTitle}>{editor === 'settings' ? 'Maaş ayarları' : editor === 'work' ? editingWork ? 'Çalışmayı düzenle' : 'Çalışma günü ekle' : editor === 'delete' ? 'Kaydı kaldır' : editingAllocation ? 'Ayırmayı düzenle' : 'Maaştan gider ayır'}</Text><Text style={styles.muted}>{monthLabel} · {currency}</Text></View><IconButton icon="close" label="Kapat" disabled={busy} onPress={close} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <View pointerEvents={busy ? 'none' : 'auto'}>
            {editor === 'settings' && <>
              <SalarySection number="01" title="Kazancın nasıl hesaplanıyor?" subtitle="Bu maaş dönemi için çalışma biçimini seç.">
                <View style={styles.modeRow}>{(['hourly', 'monthly'] as const).map(value => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: mode === value }} key={value} onPress={() => setMode(value)} style={[styles.modeCard, mode === value && styles.modeSelected]}><SalaryIconTile icon={value === 'hourly' ? 'clock-outline' : 'calendar-month-outline'} tone={mode === value ? 'cyan' : 'purple'} /><Text style={styles.cardTitle}>{value === 'hourly' ? 'Saatlik ücret' : 'Sabit aylık'}</Text><Text style={styles.hint}>{value === 'hourly' ? 'Süre × net saatlik ücret' : 'Her ay belirlediğin tutar'}</Text><MaterialCommunityIcons name={mode === value ? 'check-circle' : 'circle-outline'} size={20} color={mode === value ? SalaryColors.cyan : Colors.textMuted} /></TouchableOpacity>)}</View>
              </SalarySection>
              <SalarySection number="02" title="Net ücretin" subtitle="Eline geçen tutarı gir.">
              {mode === 'hourly' ? <Field label={`Net saatlik ücret (${currency})`} value={rate} onChange={setRate} numeric large unit={currency} placeholder="150,50" maxLength={12} />
                : <Field label={`Net aylık maaş (${currency})`} value={monthlySalary} onChange={setMonthlySalary} numeric large unit={currency} placeholder="35000,00" maxLength={12} />}
              <Text style={styles.emptyText}>Eline geçen net ücreti gir. Vergi, sigorta veya mesai katsayısı otomatik uygulanmaz. Farklı ücretli bir gün için günlük saatlik ücreti değiştirebilirsin.</Text>
              </SalarySection><SalaryPanel tone="purple"><Text style={styles.cardTitle}>Geçmiş emeğin korunur</Text><Text style={styles.hint}>Bu ayarlar yalnızca {monthLabel} için geçerli. Saatlik ücret değiştiğinde kayıtlı günler kendi ücretlerini korur. Sabit aylığa geçersen çalışma kayıtları saklanır ancak maaşa ayrıca eklenmez.</Text></SalaryPanel>
            </>}
            {editor === 'work' && <>
              <SalarySection number="01" title="Günün ve süren" subtitle="Molalar dahil toplam çalışma süresini gir.">
              <SalaryDateField label="Çalışma tarihi" value={date} onChange={setDate} minimumDate={monthDate} maximumDate={new Date(Math.min(new Date().getTime(), new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59).getTime()))} />
              <View style={styles.row}><View style={styles.flex}><Field label="Saat" value={hours} onChange={setHours} numeric large placeholder="8" maxLength={2} unit="sa" /></View><Text style={styles.timeSeparator}>:</Text><View style={styles.flex}><Field label="Dakika" value={minutes} onChange={setMinutes} numeric large placeholder="0" maxLength={2} unit="dk" /></View></View>
              <View style={styles.chips}>{[4, 6, 8].map(value => <Chip key={value} label={`${value} saat`} selected={hours === String(value) && minutes === '0'} onPress={() => { setHours(String(value)); setMinutes('0'); }} />)}</View>
              </SalarySection><SalarySection number="02" title="Mola ve ücret" subtitle="Bu güne ait ücret ayrı saklanır.">
              <Field label="Ücretsiz mola (dakika)" value={breakMinutes} onChange={setBreakMinutes} numeric maxLength={4} icon="coffee-outline" unit="dk" />
              <Field label={`Bu günün net saatlik ücreti (${currency})`} value={dayRate} onChange={setDayRate} numeric large maxLength={12} unit={currency} />
              <Field label="Not (isteğe bağlı)" value={notes} onChange={setNotes} placeholder="Örn. akşam vardiyası" icon="text-box-outline" />
              </SalarySection><SalaryResult label="GÜNÜN KAZANCI" amount={preview ? money(preview.amount) : '—'} hint={preview ? `${formatWorkDuration(preview.minutes)} ücretli çalışma · mola düşüldü` : 'Geçerli süre ve ücret girdiğinde hesaplanır.'} />
              <Text style={styles.hint}>Aynı gün için tek kayıt tutulur. Gece yarısını aşan çalışmayı ilgili iki güne bölerek gir.</Text>
            </>}
            {editor === 'allocation' && <>
              {!editingAllocation && <View style={styles.chips}><Chip label="Kayıtlarımdan seç" selected={origin === 'linked'} onPress={() => { setOrigin('linked'); setCandidate(null); setAllocationTitle(''); setAllocationAmount(''); }} /><Chip label="Diğer gider" selected={origin === 'manual'} onPress={() => { setOrigin('manual'); setCandidate(null); setAllocationTitle(''); setAllocationAmount(''); }} /></View>}
              {origin === 'linked' && !candidate && <>
                <SalarySection number="01" title="Hangi dönemin giderleri?" subtitle={`${monthLabel} maaşından gelecek ayları da planlayabilirsin.`}><SalaryRangePicker salaryMonth={month} value={expenseRange} onChange={setExpenseRange} custom={customRange} onCustomChange={setCustomRange} /></SalarySection>
                <SalarySection number="02" title="Bir gider seç" subtitle={`Yalnızca ${currency} kayıtları · ${visibleCandidates.length} uygun gider`}>
                <Field label="Gider ara" value={search} onChange={setSearch} maxLength={100} icon="magnify" placeholder="Ödeme, kişi veya abonelik" /><View style={styles.chips}>{(['all', 'payment', 'debt', 'subscription'] as const).map(kind => <Chip key={kind} label={kind === 'all' ? 'Tümü' : KIND_LABELS[kind]} selected={kindFilter === kind} onPress={() => setKindFilter(kind)} />)}</View>
                {!!candidates.error && <Text style={styles.error}>{candidates.error}</Text>}
                {visibleCandidates.map(item => <TouchableOpacity accessibilityRole="button" key={salarySourceKey(item)} style={styles.candidate} onPress={() => { setCandidate(item); setAllocationTitle(item.title); setAllocationAmount(salaryMoneyInput(item.amount_minor)); setError(''); }}>
                  <MaterialCommunityIcons name={KIND_ICONS[item.kind]} size={23} color={Colors.primaryLight} /><View style={styles.flex}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{KIND_LABELS[item.kind]}{item.occurrence_date ? ` · ${formatDate(item.occurrence_date, 'd MMM yyyy')}` : ' · Kalan borç'}</Text></View><Text style={styles.amount}>{money(item.amount_minor)}</Text><MaterialCommunityIcons name="plus-circle-outline" size={21} color={Colors.primaryLight} /></TouchableOpacity>)}
                {!visibleCandidates.length && !candidates.error && <View style={styles.card}><Text style={styles.emptyText}>Bu seçimde bağlanabilir gider yok. Daha önce bağlanmış faturalar ve abonelik yenilemeleri tekrar listelenmez. Yeni bir bütçe kalemi için “Diğer gider” seçeneğini kullanabilirsin.</Text></View>}
                <Text style={styles.hint}>Bağlanmış ödemeler ve aynı abonelik yenilemesi tekrar listelenmez. Abonelikler seçtiğin aralıktaki yenileme tarihleriyle gösterilir.</Text></SalarySection>
              </>}
              {(origin === 'manual' || candidate) && <>
                <SalaryPanel tone="purple" style={{ marginBottom: 16 }}><View style={styles.bridge}><View style={styles.flex}><Text style={styles.eyebrow}>MAAŞ</Text><Text style={styles.cardTitle}>{monthLabel}</Text></View><MaterialCommunityIcons name="arrow-right" size={22} color={SalaryColors.cyan} /><View style={styles.flex}><Text style={styles.eyebrow}>GİDER VADESİ</Text><Text style={styles.cardTitle}>{(origin === 'manual' ? allocationDate : candidate?.occurrence_date) ? formatDate(origin === 'manual' ? allocationDate : candidate!.occurrence_date, 'd MMM yyyy') : 'Tarih belirtilmedi'}</Text></View></View>
                {origin === 'linked' && candidate && <><View style={styles.selectedSource}><SalaryIconTile icon={KIND_ICONS[candidate.kind]} /><View style={styles.flex}><Text style={styles.muted}>{KIND_LABELS[candidate.kind]}</Text><Text style={styles.cardTitle}>{candidate.title}</Text></View></View>{!editingAllocation && <TouchableOpacity accessibilityRole="button" onPress={() => { setCandidate(null); setAllocationAmount(''); }}><Text style={styles.link}>Başka kayıt seç</Text></TouchableOpacity>}</>}</SalaryPanel>
                <SalarySection number="03" title={editingAllocation ? 'Ayırmanı güncelle' : 'Ayıracağın tutar'} subtitle="Kaydettiğinde kalan maaşın otomatik güncellenir.">
                {origin === 'manual' && <><Field label="Gider adı" value={allocationTitle} onChange={setAllocationTitle} placeholder="Örn. market bütçesi" maxLength={100} icon="tag-outline" /><SalaryDateField label="Gider tarihi" value={allocationDate} onChange={setAllocationDate} optional /></>}
                <Field label={`Maaştan ayrılacak tutar (${currency})`} value={allocationAmount} onChange={setAllocationAmount} numeric large unit={currency} maxLength={12} />
                {candidate?.kind === 'debt' && <Text style={styles.hint}>Borcun tamamını veya bir kısmını ayırabilirsin. Borç bakiyesi ancak Borçlar ekranından ödeme kaydedildiğinde değişir.</Text>}
                <Field label="Not (isteğe bağlı)" value={notes} onChange={setNotes} icon="text-box-outline" /></SalarySection>
                <SalaryResult label="AYIRMADAN SONRA KALAN" amount={allocationPreview === null ? '—' : money(allocationPreview)} negative={allocationPreview !== null && allocationPreview < 0} hint={allocationPreview !== null && allocationPreview < 0 ? 'Gider planın hesaplanan maaşını aşıyor.' : `${monthLabel} kazancından hesaplanır.`} />
                <Text style={styles.hint}>Ayırdığın tutar bu aya kaydedilir; kaynak kayıttaki sonraki değişiklikler bu tutarı değiştirmez. Bu gideri başka bir kayıtla tekrar eklememeye dikkat et.</Text>
              </>}
            </>}
            {editor === 'delete' && deletion && <SalaryPanel tone="danger" style={{ gap: 18 }}><SalaryIconTile icon="trash-can-outline" tone="danger" size={60} /><Text style={styles.sectionTitle}>{deletion.kind === 'work' ? formatDate(deletion.item.date) : deletion.item.title}</Text><Text style={styles.emptyText}>{deletion.kind === 'work' ? 'Bu çalışma kaydı silinecek ve saatlik maaşın yeniden hesaplanacak.' : 'Bu gider için ayırdığın tutar maaş bütçene geri eklenecek. Asıl ödeme, borç veya abonelik kaydı korunur.'}</Text></SalaryPanel>}
          </View>
        </ScrollView>
        <View style={styles.formFooter}>{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<View style={styles.row}><View style={styles.flex}><Button label="Vazgeç" icon="close" secondary disabled={busy} onPress={close} /></View>
          {(editor !== 'allocation' || origin === 'manual' || candidate) && <View style={{ flex: 2 }}><Button label={busy ? 'Kaydediliyor…' : editor === 'delete' ? 'Kaydı kaldır' : 'Kaydet'} busy={busy} danger={editor === 'delete'} icon={editor === 'delete' ? 'trash-can-outline' : 'check'} onPress={editor === 'settings' ? saveSettings : editor === 'work' ? saveWork : editor === 'delete' ? remove : saveAllocation} /></View>}</View></View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 1.7, color: SalaryColors.cyan, marginBottom: 4 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 36, color: Colors.textPrimary, letterSpacing: -1 },
  muted: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textSecondary, lineHeight: 18 },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textSecondary, lineHeight: 19, flexShrink: 1 },
  monthRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface, padding: 6, marginBottom: 14 },
  monthCenter: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  monthTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.textPrimary, textTransform: 'capitalize' },
  link: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: Colors.primaryLight, paddingVertical: 8 },
  loader: { padding: 56 },
  card: { borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: 22, padding: 16, backgroundColor: Colors.surface, marginBottom: 12, gap: 10 },
  setupCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#AA9BFF55', borderRadius: 26, padding: 24, gap: 20, marginTop: 8, overflow: 'hidden' },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.textSecondary, lineHeight: 23, marginBottom: 8 },
  sectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  hero: { backgroundColor: '#1A1D39', borderWidth: 1, borderColor: '#9A85F755', borderRadius: 26, padding: 20, marginTop: 4, marginBottom: 14, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  heroLabel: { fontFamily: 'Poppins_500Medium', fontSize: 10, letterSpacing: 1, color: '#D0CDF4' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#ffffff16', borderRadius: 20 },
  badgeText: { fontFamily: 'Poppins_500Medium', fontSize: 10, color: '#E7E5FF' },
  heroAmount: { fontFamily: 'Poppins_700Bold', fontSize: 38, color: '#FFFFFF', marginBottom: 6, letterSpacing: -1 },
  heroHint: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#D0CDF4', lineHeight: 19 },
  heroStats: { flexDirection: 'row', gap: 14, padding: 14, borderRadius: 16, backgroundColor: '#0D102055', borderWidth: 1, borderColor: '#FFFFFF0B', marginTop: 20 },
  heroCaption: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: '#D0CDF4', marginBottom: 4 },
  heroValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  heroDivider: { width: 1, backgroundColor: '#ffffff26' },
  warning: { color: '#FFC66D' },
  notice: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 14, backgroundColor: `${Colors.warning}12`, marginBottom: 12 },
  noticeText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 21, color: '#FFD497' },
  infoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 22 },
  sectionTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: Colors.textPrimary, lineHeight: 22 },
  amount: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: Colors.textPrimary, flexShrink: 1, maxWidth: '46%', textAlign: 'right' },
  note: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTopWidth: 1, borderColor: '#FFFFFF0A' },
  sourceLink: { flex: 1, justifyContent: 'center', minHeight: 44 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: '#14182A' },
  form: { padding: 18, paddingBottom: 30, maxWidth: 700, width: '100%', alignSelf: 'center' },
  error: { color: Colors.danger, fontFamily: 'Poppins_500Medium', fontSize: 12, lineHeight: 21, marginVertical: 12 },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: SalaryColors.inset, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#AA9BFF33' },
  currencyRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  setupTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 27, lineHeight: 38, color: Colors.textPrimary },
  heroMain: { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 24 },
  futureNote: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 },
  dayTile: { width: 52, paddingVertical: 10, borderRadius: 15, backgroundColor: '#AA9BFF15', borderWidth: 1, borderColor: '#AA9BFF33', alignItems: 'center' },
  dayNumber: { fontFamily: 'Poppins_600SemiBold', fontSize: 23, color: SalaryColors.purple },
  dayMonth: { fontFamily: 'Poppins_500Medium', fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: { flex: 1, backgroundColor: SalaryColors.inset, borderRadius: 18, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 14, gap: 10 },
  modeSelected: { borderColor: SalaryColors.cyan, backgroundColor: '#173039' },
  timeSeparator: { fontFamily: 'Poppins_500Medium', fontSize: 30, color: SalaryColors.purple },
  bridge: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  selectedSource: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 18, marginTop: 14, borderTopWidth: 1, borderColor: '#AA9BFF30' },
  formFooter: { padding: 16, borderTopWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: '#14182A', width: '100%', maxWidth: 740, alignSelf: 'center' },
});