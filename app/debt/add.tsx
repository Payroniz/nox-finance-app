import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Modal, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { addDebt } from '../../src/db/database';
import { scheduleDebtNotification } from '../../src/utils/notifications';
import { CurrencyInput } from '../../src/components/CurrencyInput';
import { Currency, DebtDirection } from '../../src/constants/types';

const CURRENCIES: { value: Currency; symbol: string; name: string }[] = [
  { value: 'TRY', symbol: '₺', name: 'Türk Lirası' },
  { value: 'USD', symbol: '$', name: 'Dolar' },
  { value: 'EUR', symbol: '€', name: 'Euro' },
  { value: 'GBP', symbol: '£', name: 'Sterlin' },
];

const REMINDER_OPTIONS = [
  { days: 1, label: '1 gün' },
  { days: 3, label: '3 gün' },
  { days: 7, label: '1 hafta' },
];


const InputGroup = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    {children}
    {hint && <Text style={styles.inputHint}>{hint}</Text>}
  </View>
);

export default function AddDebtScreen() {
  const [personName, setPersonName] = useState('');
  const [personPhoto, setPersonPhoto] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [direction, setDirection] = useState<DebtDirection>('owe');
  const [dueDate, setDueDate] = useState(new Date());
  const [hasDueDate, setHasDueDate] = useState(false);
  const [interestRate, setInterestRate] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderDays, setReminderDays] = useState([1, 3, 7]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showInterest, setShowInterest] = useState(false);

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPersonPhoto(result.assets[0].uri);
    }
  };

  const toggleReminder = (days: number) => {
    setReminderDays(prev =>
      prev.includes(days) ? prev.filter(d => d !== days) : [...prev, days]
    );
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    if (!personName.trim()) {
      Alert.alert('Hata', 'Kişi/kurum adı zorunludur.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Hata', 'Geçerli bir tutar girin.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setSaving(true);
    try {
      const dueDateStr = hasDueDate ? dueDate.toISOString() : '';
      const parsedRate = parseFloat(interestRate.replace(',', '.')) || 0;

      const notifIds = await scheduleDebtNotification(
        {
          person_name: personName.trim(),
          total_amount: parsedAmount,
          currency,
          due_date: dueDateStr,
          debt_direction: direction,
        },
        reminderDays
      );

      await addDebt({
        person_name: personName.trim(),
        person_photo: personPhoto,
        total_amount: parsedAmount,
        paid_amount: 0,
        currency,
        debt_direction: direction,
        due_date: dueDateStr,
        interest_rate: parsedRate,
        notes: notes.trim(),
        notification_ids: JSON.stringify(notifIds),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Alert.alert('Hata', 'Borç kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };



  const currencySymbol = CURRENCIES.find(c => c.value === currency)?.symbol ?? '₺';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni Borç</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">

        {/* Kişi / Fotoğraf */}
        <View style={styles.personRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
            {personPhoto ? (
              <Image source={{ uri: personPhoto }} style={styles.personPhoto} />
            ) : (
              <View style={styles.personPhotoPlaceholder}>
                <MaterialCommunityIcons name="account-plus" size={28} color={Colors.primary} />
              </View>
            )}
            <View style={styles.photoBadge}>
              <MaterialCommunityIcons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.personNameContainer}>
            <Text style={styles.inputLabel}>Kişi / Kurum Adı</Text>
            <TextInput
              style={styles.textInput}
              value={personName}
              onChangeText={setPersonName}
              placeholder="örn. Ahmet Yılmaz"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="next"
              blurOnSubmit={false}
            />
          </View>
        </View>

        {/* Borç Yönü */}
        <InputGroup label="Borç Türü">
          <View style={styles.directionRow}>
            <TouchableOpacity
              style={[styles.directionBtn, direction === 'owe' && styles.directionBtnOweDanger]}
              onPress={() => setDirection('owe')}
            >
              <MaterialCommunityIcons
                name="arrow-up-circle"
                size={22}
                color={direction === 'owe' ? '#fff' : Colors.textSecondary}
              />
              <View>
                <Text style={[styles.directionTitle, direction === 'owe' && { color: '#fff' }]}>
                  Ben borçluyum
                </Text>
                <Text style={[styles.directionSub, direction === 'owe' && { color: 'rgba(255,255,255,0.7)' }]}>
                  Kişiye borcum var
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.directionBtn, direction === 'owed' && styles.directionBtnOwedSuccess]}
              onPress={() => setDirection('owed')}
            >
              <MaterialCommunityIcons
                name="arrow-down-circle"
                size={22}
                color={direction === 'owed' ? '#fff' : Colors.textSecondary}
              />
              <View>
                <Text style={[styles.directionTitle, direction === 'owed' && { color: '#fff' }]}>
                  Bana borçlu
                </Text>
                <Text style={[styles.directionSub, direction === 'owed' && { color: 'rgba(255,255,255,0.7)' }]}>
                  Kişi bana borçlu
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </InputGroup>

        {/* Tutar */}
        <InputGroup label="Borç Tutarı">
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            symbol={{ TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[currency] ?? '₺'}
          />
          <View style={styles.currencyRow}>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.currencyBtn, currency === c.value && styles.currencyBtnActive]}
                onPress={() => setCurrency(c.value)}
              >
                <Text style={[styles.currencyText, currency === c.value && styles.currencyTextActive]}>
                  {c.symbol}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </InputGroup>

        {/* Son Ödeme Tarihi (Opsiyonel) */}
        <TouchableOpacity
          style={styles.optionalToggle}
          onPress={() => setHasDueDate(v => !v)}
        >
          <MaterialCommunityIcons
            name={hasDueDate ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.primary}
          />
          <Text style={styles.optionalToggleText}>
            Son Ödeme Tarihi (Opsiyonel)
          </Text>
        </TouchableOpacity>
        {hasDueDate && (
          <InputGroup label="Son Ödeme Tarihi">
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar" size={20} color={Colors.primary} />
              <Text style={styles.dateBtnText}>
                {dueDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </InputGroup>
        )}

        {/* Faiz (opsiyonel) */}
        <TouchableOpacity
          style={styles.optionalToggle}
          onPress={() => setShowInterest(v => !v)}
        >
          <MaterialCommunityIcons
            name={showInterest ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.primary}
          />
          <Text style={styles.optionalToggleText}>
            {showInterest ? 'Faizi Gizle' : 'Faiz Ekle (Opsiyonel)'}
          </Text>
        </TouchableOpacity>

        {showInterest && (
          <InputGroup label="Yıllık Faiz Oranı (%)" hint="Basit faiz hesabı yapılır">
            <View style={styles.interestRow}>
              <TextInput
                style={[styles.textInput, styles.interestInput]}
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              blurOnSubmit={false}
              />
              <View style={styles.interestSuffix}>
                <Text style={styles.interestSuffixText}>%</Text>
              </View>
            </View>
          </InputGroup>
        )}

        {/* Hatırlatıcılar */}
        <InputGroup label="Hatırlatıcılar" hint="Birden fazla seçebilirsiniz">
          <View style={styles.reminderRow}>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.days}
                style={[styles.reminderChip, reminderDays.includes(opt.days) && styles.reminderChipActive]}
                onPress={() => toggleReminder(opt.days)}
              >
                {reminderDays.includes(opt.days) && (
                  <MaterialCommunityIcons name="check" size={14} color="#fff" />
                )}
                <Text style={[styles.reminderChipText, reminderDays.includes(opt.days) && styles.reminderChipTextActive]}>
                  {opt.label} önce
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </InputGroup>

        {/* Not */}
        <InputGroup label="Not (Opsiyonel)">
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Not ekleyin..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            blurOnSubmit={false}
          />
        </InputGroup>

        {/* Özet Kartı */}
        {personName.trim() && amount ? (
          <View style={[styles.summaryCard, direction === 'owe' ? styles.summaryDanger : styles.summarySuccess]}>
            <MaterialCommunityIcons
              name={direction === 'owe' ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={20}
              color="#fff"
            />
            <Text style={styles.summaryText}>
              {direction === 'owe'
                ? `${personName}'e ${currencySymbol}${amount} borçlusun`
                : `${personName} sana ${currencySymbol}${amount} borçlu`}
            </Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Picker */}
      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        date={dueDate}
        minimumDate={new Date()}
        onConfirm={(date) => { setDueDate(date); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
        locale="tr"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  closeBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    ...Shadow.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: '#fff',
  },
  content: { padding: Spacing.lg },
  personRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  photoBtn: { position: 'relative' },
  personPhoto: {
    width: 72, height: 72,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  personPhotoPlaceholder: {
    width: 72, height: 72,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  photoBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  personNameContainer: { flex: 1 },
  inputGroup: { marginBottom: Spacing.xl },
  inputLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  inputHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  notesInput: { height: 88, textAlignVertical: 'top' },
  directionRow: { flexDirection: 'row', gap: 10 },
  directionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
  },
  directionBtnOweDanger: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  directionBtnOwedSuccess: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  directionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  directionSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  amountRow: { gap: Spacing.sm },
  amountInput: {
    fontSize: FontSize.xxl,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  currencyRow: { flexDirection: 'row', gap: Spacing.sm },
  currencyBtn: {
    flex: 1, paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  currencyBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  currencyTextActive: { color: '#fff' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  dateBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
  },
  optionalToggleText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  interestRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  interestInput: {
    flex: 1,
    fontSize: FontSize.xl,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  interestSuffix: {
    width: 48, height: 48,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  interestSuffixText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xl,
    color: Colors.primary,
  },
  reminderRow: { flexDirection: 'row', gap: 8 },
  reminderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  reminderChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  reminderChipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  reminderChipTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: BorderRadius.lg,
    marginTop: 8,
  },
  summaryDanger: { backgroundColor: `${Colors.danger}20`, borderWidth: 1, borderColor: Colors.danger },
  summarySuccess: { backgroundColor: `${Colors.success}20`, borderWidth: 1, borderColor: Colors.success },
  summaryText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
});
