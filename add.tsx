import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Platform, Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { addPayment, getCategories } from '../../src/db/database';
import { schedulePaymentNotification } from '../../src/utils/notifications';
import { Currency, RecurrenceType } from '../../src/constants/types';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

const CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];
const CURRENCY_SYMBOLS: Record<Currency, string> = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };
const RECURRENCE: { value: RecurrenceType; label: string }[] = [
  { value: 'once', label: 'Tek Seferlik' },
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
  { value: 'yearly', label: 'Yıllık' },
];
const QUICK_ICONS = ['cash', 'flash', 'home', 'car', 'cart', 'phone', 'wifi', 'television', 'medical-bag', 'school', 'airplane', 'dumbbell'];

export default function AddPaymentScreen() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [category, setCategory] = useState('Diğer');
  const [iconType, setIconType] = useState<'icon' | 'emoji'>('icon');
  const [iconValue, setIconValue] = useState('cash');
  const [dueDate, setDueDate] = useState(new Date());
  const [recurrence, setRecurrence] = useState<RecurrenceType>('once');
  const [notes, setNotes] = useState('');
  const [reminderDays, setReminderDays] = useState(3);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  useFocusEffect(useCallback(() => {
    getCategories().then(setCategories);
  }, []));

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Hata', 'Ödeme adı zorunludur.'); return; }
    if (!amount || isNaN(parseFloat(amount))) { Alert.alert('Hata', 'Geçerli bir tutar girin.'); return; }

    setSaving(true);
    try {
      const dueDateStr = dueDate.toISOString();
      const dueTimeStr = `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;

      const notifId = await schedulePaymentNotification(
        { name, amount: parseFloat(amount), currency, due_date: dueDateStr, due_time: dueTimeStr },
        reminderDays
      );

      await addPayment({
        name: name.trim(),
        amount: parseFloat(amount),
        currency,
        category,
        icon_type: iconType,
        icon_value: iconValue,
        due_date: dueDateStr,
        due_time: dueTimeStr,
        recurrence,
        status: 'pending',
        notes: notes.trim(),
        notification_id: notifId,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Alert.alert('Hata', 'Ödeme kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const InputGroup = ({ label, children }: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      {children}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni Ödeme</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>Kaydet</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Icon picker preview */}
        <TouchableOpacity
          style={styles.iconPreview}
          onPress={() => setShowIconPicker(true)}
        >
          <View style={styles.iconCircle}>
            {iconType === 'emoji' ? (
              <Text style={styles.emojiPreview}>{iconValue}</Text>
            ) : (
              <MaterialCommunityIcons name={iconValue as any} size={32} color={Colors.primary} />
            )}
          </View>
          <Text style={styles.iconHint}>İkon seç</Text>
        </TouchableOpacity>

        <InputGroup label="Ödeme Adı">
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="örn. Netflix Aboneliği"
            placeholderTextColor={Colors.textMuted}
          />
        </InputGroup>

        {/* Amount + Currency */}
        <InputGroup label="Tutar">
          <View style={styles.amountRow}>
            <TextInput
              style={[styles.textInput, styles.amountInput]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0,00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
            <View style={styles.currencyRow}>
              {CURRENCIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.currencyBtn, currency === c && styles.currencyBtnActive]}
                  onPress={() => setCurrency(c)}
                >
                  <Text style={[styles.currencyText, currency === c && styles.currencyTextActive]}>
                    {CURRENCY_SYMBOLS[c]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </InputGroup>

        {/* Category */}
        <InputGroup label="Kategori">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, category === cat.name && { backgroundColor: cat.color }]}
                onPress={() => setCategory(cat.name)}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={14}
                  color={category === cat.name ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.chipText, category === cat.name && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </InputGroup>

        {/* Date */}
        <InputGroup label="Tarih & Saat">
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateBtn, { flex: 1 }]}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar" size={18} color={Colors.primary} />
              <Text style={styles.dateBtnText}>
                {dueDate.toLocaleDateString('tr-TR')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateBtn, { flex: 0.6 }]}
              onPress={() => setShowTimePicker(true)}
            >
              <MaterialCommunityIcons name="clock-outline" size={18} color={Colors.primary} />
              <Text style={styles.dateBtnText}>
                {String(dueDate.getHours()).padStart(2, '0')}:{String(dueDate.getMinutes()).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          </View>
        </InputGroup>

        {/* Recurrence */}
        <InputGroup label="Tekrarlama">
          <View style={styles.recurrenceRow}>
            {RECURRENCE.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.recBtn, recurrence === r.value && styles.recBtnActive]}
                onPress={() => setRecurrence(r.value)}
              >
                <Text style={[styles.recText, recurrence === r.value && styles.recTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </InputGroup>

        {/* Reminder */}
        <InputGroup label="Hatırlatıcı">
          <View style={styles.reminderRow}>
            {[1, 3, 7, 14].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.recBtn, reminderDays === d && styles.recBtnActive]}
                onPress={() => setReminderDays(d)}
              >
                <Text style={[styles.recText, reminderDays === d && styles.recTextActive]}>
                  {d} gün
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </InputGroup>

        {/* Notes */}
        <InputGroup label="Not (Opsiyonel)">
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Not ekleyin..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </InputGroup>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Date picker */}
      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        date={dueDate}
        onConfirm={(date) => { setDueDate(date); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
        locale="tr"
      />
      <DateTimePickerModal
        isVisible={showTimePicker}
        mode="time"
        date={dueDate}
        onConfirm={(date) => { setDueDate(date); setShowTimePicker(false); }}
        onCancel={() => setShowTimePicker(false)}
        locale="tr"
      />

      {/* Icon picker modal */}
      <Modal visible={showIconPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.iconPickerModal}>
            <View style={styles.iconPickerHeader}>
              <Text style={styles.iconPickerTitle}>İkon Seç</Text>
              <TouchableOpacity onPress={() => setShowIconPicker(false)}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.iconGrid}>
              {QUICK_ICONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconOption, iconValue === icon && styles.iconOptionActive]}
                  onPress={() => { setIconType('icon'); setIconValue(icon); setShowIconPicker(false); }}
                >
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={28}
                    color={iconValue === icon ? '#fff' : Colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: '#fff',
  },
  content: { padding: Spacing.lg },
  iconPreview: { alignItems: 'center', marginBottom: Spacing.xl },
  iconCircle: {
    width: 80, height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  emojiPreview: { fontSize: 36 },
  iconHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginTop: 8,
  },
  inputGroup: { marginBottom: Spacing.lg },
  inputLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
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
  notesInput: { height: 80, textAlignVertical: 'top' },
  amountRow: { gap: Spacing.sm },
  amountInput: { fontSize: FontSize.xl, fontFamily: 'Poppins_600SemiBold' },
  currencyRow: { flexDirection: 'row', gap: Spacing.sm },
  currencyBtn: {
    flex: 1, paddingVertical: 10,
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
  chipScroll: { marginHorizontal: -2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    marginRight: 8,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  chipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  dateBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  recurrenceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  reminderRow: { flexDirection: 'row', gap: 8 },
  recBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  recBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  recText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  recTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  // Icon picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  iconPickerModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.xl,
  },
  iconPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconPickerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconOption: {
    width: 60, height: 60,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },
  iconOptionActive: { backgroundColor: Colors.primary },
});
