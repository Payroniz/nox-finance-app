import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Colors, BorderRadius, Spacing } from '../../src/constants/theme';
import { Currency, IconType, Subscription, SubscriptionCycle, UploadedIcon } from '../../src/constants/types';
import { deleteSubscription, getAllSettings, getSubscriptions, getUploadedIcons, saveSubscription } from '../../src/db/database';
import { CurrencyInput } from '../../src/components/CurrencyInput';
import { ColorPicker } from '../../src/components/ColorPicker';
import { SubscriptionCard, SubscriptionIcon } from '../../src/components/SubscriptionCard';
import { SubscriptionIconPicker } from '../../src/components/SubscriptionIconPicker';
import { formatCurrency, formatDate, formatLocalDateKey, parseLocalDate } from '../../src/utils/helpers';
import { getMonthlySubscriptionTotals, getNextRenewal, SUBSCRIPTION_CYCLES } from '../../src/utils/subscriptions';

const CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];
const SYMBOLS = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };
const SERVICES = [
  { name: 'YouTube Premium', icon: 'youtube' as const, color: '#FF5555' },
  { name: 'Spotify', icon: 'spotify' as const, color: '#1DB954' },
  { name: 'Netflix', icon: 'netflix' as const, color: '#E50914' },
];

export default function SubscriptionsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ edit?: string }>();
  const openedEdit = useRef<string | undefined>(undefined);
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('TRY');
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [cycle, setCycle] = useState<SubscriptionCycle>('monthly');
  const [renewal, setRenewal] = useState(new Date());
  const [renewalText, setRenewalText] = useState(formatLocalDateKey(new Date()));
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [iconType, setIconType] = useState<IconType>('icon');
  const [iconValue, setIconValue] = useState('repeat');
  const [color, setColor] = useState(Colors.surface);
  const [uploadedIcons, setUploadedIcons] = useState<UploadedIcon[]>([]);
  const [showIcons, setShowIcons] = useState(false);
  const [draggingColor, setDraggingColor] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [datePicker, setDatePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [subscriptions, settings, icons] = await Promise.all([getSubscriptions(), getAllSettings(), getUploadedIcons()]);
      setItems(subscriptions);
      setUploadedIcons(icons);
      setDefaultCurrency(settings.defaultCurrency);
      setLoadError(false);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  React.useEffect(() => {
    if (params.edit && params.edit !== openedEdit.current && items.length) {
      const item = items.find(item => String(item.id) === params.edit);
      if (item) { openedEdit.current = params.edit; openEditor(item); router.setParams({ edit: undefined }); }
    }
    if (!params.edit) openedEdit.current = undefined;
  }, [params.edit, items]);

  const openEditor = (item?: Subscription) => {
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setAmount(item ? String(item.amount) : '');
    setCurrency(item?.currency ?? defaultCurrency);
    setCycle(item?.billing_cycle ?? 'monthly');
    setRenewal(item ? parseLocalDate(item.renewal_date) ?? new Date() : new Date());
    setRenewalText(item?.renewal_date ?? formatLocalDateKey(new Date()));
    setActive(item ? item.active === 1 : true);
    setNotes(item?.notes ?? '');
    setIconType(item?.icon_type ?? 'icon');
    setIconValue(item?.icon_value ?? 'repeat');
    setColor(item?.color ?? Colors.surface);
    setShowIcons(false);
    setSaveError('');
    setDraggingColor(false);
    setVisible(true);
  };
  const closeEditor = () => { if (!busyRef.current) { setDatePicker(false); setVisible(false); } };
  const save = async () => {
    if (busyRef.current) return;
    if (Platform.OS === 'web' && (!parseLocalDate(renewalText) || formatLocalDateKey(parseLocalDate(renewalText)!) !== renewalText)) {
      setSaveError('Geçerli bir yenileme tarihi girin (YYYY-AA-GG).');
      return;
    }
    if (!name.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setSaveError('Abonelik adını ve sıfırdan büyük bir tutar girin.');
      Alert.alert('Bilgileri Kontrol Edin', 'Abonelik adını ve sıfırdan büyük bir tutar girin.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await saveSubscription({ name: name.trim(), amount: Number(amount), currency, billing_cycle: cycle,
        renewal_date: formatLocalDateKey(renewal), active: active ? 1 : 0, notes: notes.trim(),
        icon_type: iconType, icon_value: iconValue, color }, editing?.id);
      setVisible(false);
      await load();
    } catch { setSaveError('Abonelik kaydedilemedi. Bilgileri kontrol edip yeniden deneyin.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const remove = (item: Subscription) => Alert.alert('Aboneliği Sil', `${item.name} takip listenizden silinsin mi? Bu işlem hizmetteki aboneliğinizi iptal etmez.`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try { await deleteSubscription(item.id); await load(); }
      catch { Alert.alert('Silinemedi', 'Abonelik silinemedi. Yeniden deneyin.'); }
      finally { busyRef.current = false; setBusy(false); }
    } },
  ]);

  const totals = getMonthlySubscriptionTotals(items);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const weekEnd = formatLocalDateKey(nextWeek);
  const sorted = [...items].sort((a, b) => b.active - a.active || getNextRenewal(a).localeCompare(getNextRenewal(b)));
  const upcoming = items.filter(item => item.active === 1 && getNextRenewal(item) <= weekEnd).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View><Text style={styles.title}>Abonelikler</Text><Text style={styles.muted}>Düzenli harcamaların bir arada</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abonelik ekle" testID="add-subscription" disabled={busy || loading} style={styles.addButton} onPress={() => openEditor()}>
          <MaterialCommunityIcons name="plus" size={26} color="white" />
        </TouchableOpacity>
      </View>
      <FlatList data={sorted} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list} refreshing={loading} onRefresh={() => { setLoading(true); void load(); }}
        ListHeaderComponent={<>
          <View style={styles.summary}>
            <Text style={styles.eyebrow}>AYLIK TAHMİNİ TOPLAM</Text>
            {Object.entries(totals).length ? Object.entries(totals).map(([unit, total]) => <Text key={unit} style={styles.total}>{formatCurrency(total!, unit as Currency)}</Text>) : <Text style={styles.total}>{formatCurrency(0, defaultCurrency)}</Text>}
            <Text style={styles.muted}>{items.filter(item => item.active === 1).length} aktif abonelik • 7 gün içinde {upcoming} yenileme</Text>
            <Text style={styles.hint}>Yıllık ve haftalık ücretler aya bölünür. Para birimleri ayrı hesaplanır.</Text>
          </View>
          {loadError && <TouchableOpacity onPress={() => void load()} style={styles.card}><Text style={styles.error}>Abonelikler yüklenemedi. Yeniden denemek için dokunun.</Text></TouchableOpacity>}
        </>}
        ListEmptyComponent={loading ? <ActivityIndicator color={Colors.primary} /> : !loadError ? <View style={styles.empty}>
          <MaterialCommunityIcons name="repeat" size={52} color={Colors.primaryLight} />
          <Text style={styles.emptyTitle}>İlk aboneliğini ekle</Text>
          <Text style={styles.emptyText}>YouTube, Spotify, Netflix ve diğer aboneliklerinin tutarını ve yenileme tarihini takip et.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => openEditor()}><Text style={styles.buttonText}>Abonelik Ekle</Text></TouchableOpacity>
        </View> : null}
        renderItem={({ item }) => <SubscriptionCard item={item} disabled={busy} onEdit={() => openEditor(item)} onDelete={() => remove(item)} />} />

      <Modal visible={visible} animationType="slide" onRequestClose={closeEditor}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}><Text style={styles.modalTitle}>{editing ? 'Aboneliği Düzenle' : 'Yeni Abonelik'}</Text><TouchableOpacity accessibilityLabel="Kapat" disabled={busy} onPress={closeEditor} style={styles.action}><MaterialCommunityIcons name="close" size={25} color={Colors.textPrimary} /></TouchableOpacity></View>
          <ScrollView scrollEnabled={!draggingColor} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            {!editing && <View style={styles.chips}>{SERVICES.map(service => <TouchableOpacity key={service.name} onPress={() => { setName(service.name); setIconType('icon'); setIconValue(service.icon); setColor(service.color); }} style={styles.chip}><MaterialCommunityIcons name={service.icon} size={18} color={service.color} /><Text style={styles.chipText}>{service.name}</Text></TouchableOpacity>)}</View>}
            <Text style={styles.label}>Abonelik adı</Text>
            <TextInput accessibilityLabel="Abonelik adı" testID="subscription-name" style={styles.input} placeholder="Örn. YouTube Premium" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} maxLength={100} />
            <Text style={styles.label}>Her dönem ödenen tutar</Text>
            <CurrencyInput value={amount} onChange={setAmount} symbol={SYMBOLS[currency]} />
            <View style={styles.chips}>{CURRENCIES.map(unit => <TouchableOpacity key={unit} accessibilityRole="button" accessibilityState={{ selected: unit === currency }} style={[styles.chip, unit === currency && styles.selected]} onPress={() => setCurrency(unit)}><Text style={styles.chipText}>{SYMBOLS[unit]} {unit}</Text></TouchableOpacity>)}</View>
            <Text style={styles.label}>Ödeme sıklığı</Text>
            <View style={styles.chips}>{(Object.entries(SUBSCRIPTION_CYCLES) as [SubscriptionCycle, string][]).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: value === cycle }} style={[styles.chip, cycle === value && styles.selected]} onPress={() => setCycle(value)}><Text style={styles.chipText}>{label}</Text></TouchableOpacity>)}</View>
            <Text style={styles.label}>Yenileme tarihi</Text>
            {Platform.OS === 'web' ? <TextInput accessibilityLabel="Yenileme tarihi (YYYY-AA-GG)" style={styles.input} value={renewalText} placeholder="YYYY-AA-GG" maxLength={10}
              onChangeText={text => { setRenewalText(text); const date = parseLocalDate(text); if (date && formatLocalDateKey(date) === text) setRenewal(date); }} />
              : <TouchableOpacity accessibilityLabel="Yenileme tarihi seç" style={[styles.input, styles.row]} onPress={() => setDatePicker(true)}><MaterialCommunityIcons name="calendar-month-outline" size={22} color={Colors.primaryLight} /><Text style={styles.cardTitle}>{formatDate(formatLocalDateKey(renewal))}</Text></TouchableOpacity>}
            <Text style={styles.hint}>Bu tarihten başlayarak her yenileme giderlere otomatik katılır. Plan ve istatistiklerde yenileme günündeki tam tutar kullanılır.</Text>
            <View style={[styles.row, { marginVertical: Spacing.xl }]}><View style={styles.flex}><Text style={styles.cardTitle}>Aktif abonelik</Text><Text style={styles.hint}>Pasif abonelikler toplama dahil edilmez.</Text></View><Switch accessibilityLabel="Aktif abonelik" value={active} onValueChange={setActive} trackColor={{ false: Colors.surfaceBorder, true: Colors.primary }} thumbColor="white" /></View>
            <Text style={styles.label}>Notlar (isteğe bağlı)</Text>
            <TextInput accessibilityLabel="Abonelik notları" style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes} multiline maxLength={1000} placeholder="Plan, hesap veya diğer bilgiler" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>İkon / fotoğraf</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abonelik görselini değiştir" accessibilityState={{ expanded: showIcons }} style={[styles.input, styles.row]} onPress={() => setShowIcons(value => !value)}>
              <SubscriptionIcon item={{ icon_type: iconType, icon_value: iconValue }} color={Colors.primaryLight} />
              <Text style={[styles.chipText, styles.flex]}>Görsel seç veya yükle</Text><MaterialCommunityIcons name={showIcons ? 'chevron-up' : 'chevron-down'} size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            {showIcons && <View style={{ marginTop: 12 }}><SubscriptionIconPicker type={iconType} value={iconValue} uploaded={uploadedIcons} onUploaded={setUploadedIcons}
              onChange={(type, value) => { setIconType(type); setIconValue(value); }} onBusyChange={value => { busyRef.current = value; setBusy(value); }} /></View>}
            <Text style={styles.label}>Kart rengi</Text>
            <ColorPicker value={color} onChange={setColor} onInteractionChange={setDraggingColor} />
            <Text style={styles.label}>Kart önizlemesi</Text>
            <SubscriptionCard preview item={{ name, amount: Number(amount) || 0, currency, billing_cycle: cycle, renewal_date: formatLocalDateKey(renewal), active: active ? 1 : 0,
              notes, icon_type: iconType, icon_value: iconValue, color }} />
            {!!saveError && <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text>}
            <TouchableOpacity accessibilityRole="button" testID="save-subscription" disabled={busy} style={[styles.primaryButton, busy && styles.inactive]} onPress={() => void save()}>{busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{editing ? 'Değişiklikleri Kaydet' : 'Aboneliği Ekle'}</Text>}</TouchableOpacity>
          </ScrollView>
          <DateTimePickerModal isVisible={datePicker} mode="date" date={renewal} locale="tr-TR" onConfirm={date => { setRenewal(date); setDatePicker(false); }} onCancel={() => setDatePicker(false)} />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: Colors.textPrimary, fontFamily: 'Poppins_700Bold', fontSize: 26 },
  modalTitle: { color: Colors.textPrimary, fontFamily: 'Poppins_600SemiBold', fontSize: 20, flex: 1 },
  muted: { color: Colors.textSecondary, fontFamily: 'Poppins_400Regular', fontSize: 12 },
  hint: { color: Colors.textSecondary, fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 8 },
  addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, flexGrow: 1 },
  summary: { backgroundColor: `${Colors.primary}18`, borderWidth: 1, borderColor: `${Colors.primary}50`, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.xl },
  eyebrow: { color: Colors.primaryLight, fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 1 },
  total: { color: Colors.textPrimary, fontFamily: 'Poppins_700Bold', fontSize: 28, marginVertical: 8 },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  serviceIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: Colors.textPrimary, fontFamily: 'Poppins_600SemiBold', fontSize: 15 },
  amount: { color: Colors.textPrimary, fontFamily: 'Poppins_700Bold', fontSize: 22, marginTop: 14, marginBottom: 4 },
  notes: { color: Colors.textSecondary, fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder, paddingTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, minHeight: 44 },
  actionText: { color: Colors.primaryLight, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  error: { color: Colors.danger, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  inactive: { opacity: 0.6 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 10, gap: 12 },
  emptyTitle: { color: Colors.textPrimary, fontFamily: 'Poppins_600SemiBold', fontSize: 19 },
  emptyText: { color: Colors.textSecondary, fontFamily: 'Poppins_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 22 },
  primaryButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: 16, alignItems: 'center', marginTop: 20, minHeight: 54 },
  buttonText: { color: 'white', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  form: { paddingHorizontal: Spacing.xl, paddingBottom: 32 },
  label: { color: Colors.textSecondary, fontFamily: 'Poppins_500Medium', fontSize: 13, marginTop: 20, marginBottom: 8 },
  input: { color: Colors.textPrimary, backgroundColor: Colors.surface, borderColor: Colors.surfaceBorder, borderWidth: 1, borderRadius: BorderRadius.md, padding: 14, fontFamily: 'Poppins_400Regular', fontSize: 15, minHeight: 52 },
  notesInput: { minHeight: 95, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, minHeight: 44 },
  chipText: { color: Colors.textPrimary, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  selected: { borderColor: Colors.primaryLight, backgroundColor: `${Colors.primary}35` },
});
