import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Modal, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { addPayment, getCategories } from '../../src/db/database';
import { schedulePaymentNotification } from '../../src/utils/notifications';
import { CurrencyInput } from '../../src/components/CurrencyInput';
import { Currency, RecurrenceType } from '../../src/constants/types';

const CURRENCIES: { value: Currency; symbol: string }[] = [
  { value: 'TRY', symbol: '₺' },
  { value: 'USD', symbol: '$' },
  { value: 'EUR', symbol: '€' },
  { value: 'GBP', symbol: '£' },
];

const RECURRENCE: { value: RecurrenceType; label: string; icon: string }[] = [
  { value: 'once', label: 'Tek Seferlik', icon: 'numeric-1-circle-outline' },
  { value: 'weekly', label: 'Haftalık', icon: 'calendar-week' },
  { value: 'monthly', label: 'Aylık', icon: 'calendar-month' },
  { value: 'yearly', label: 'Yıllık', icon: 'calendar-star' },
];

const QUICK_ICONS = [
  // Para & Finans
  'cash', 'credit-card', 'bank', 'wallet', 'currency-usd', 'piggy-bank',
  'receipt', 'invoice-text', 'finance', 'trending-up', 'trending-down', 'chart-line',
  // Ev & Yaşam
  'home', 'home-city', 'sofa', 'bed', 'shower', 'flash',
  'water', 'fire', 'hvac', 'washing-machine', 'fridge', 'television',
  // Ulaşım
  'car', 'car-wash', 'gas-station', 'airplane', 'train', 'bus',
  'motorbike', 'bicycle', 'taxi', 'ferry', 'parking', 'road',
  // Teknoloji & İletişim
  'phone', 'wifi', 'cellphone', 'laptop', 'tablet', 'monitor',
  'printer', 'headphones', 'camera', 'router-wireless', 'cloud', 'server',
  // Sağlık & Spor
  'medical-bag', 'hospital-box', 'heart-pulse', 'pill', 'tooth', 'eye',
  'dumbbell', 'yoga', 'run', 'swim', 'soccer', 'basketball',
  // Yiyecek & İçecek
  'food', 'coffee', 'food-fork-drink', 'pizza', 'hamburger', 'cake',
  'fruit-watermelon', 'cup', 'bottle-wine', 'grocery', 'silverware', 'chef-hat',
  // Eğitim & Kültür
  'school', 'book', 'bookshelf', 'pencil', 'graduation-cap', 'library',
  'music', 'music-note', 'theater', 'palette', 'film', 'gamepad',
  // Alışveriş & Hizmet
  'cart', 'store', 'tag', 'gift', 'hanger', 'shoe-heel',
  'scissors', 'hammer', 'tools', 'broom', 'face-woman', 'baby-carriage',
  // Diğer
  'star', 'heart', 'flower', 'leaf', 'paw', 'earth',
  'shield', 'lock', 'key', 'bell', 'alarm', 'calendar',
];

const REMINDER_OPTIONS = [
  { days: 1, label: '1 gün' },
  { days: 3, label: '3 gün' },
  { days: 7, label: '1 hafta' },
  { days: 14, label: '2 hafta' },
];


const InputGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    {children}
  </View>
);

export default function AddPaymentScreen() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [category, setCategory] = useState('Diğer');
  const [iconType, setIconType] = useState<'icon' | 'emoji' | 'gallery'>('icon');
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
  const [activeIconTab, setActiveIconTab] = useState<'icon' | 'emoji'>('icon');
  const [emojiInput, setEmojiInput] = useState('');

  useFocusEffect(useCallback(() => {
    getCategories().then(setCategories);
  }, []));

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Ödeme adı zorunludur.');
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
      const dueDateStr = dueDate.toISOString();
      const dueTimeStr = `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;

      const notifId = await schedulePaymentNotification(
        { name, amount: parsedAmount, currency, due_date: dueDateStr, due_time: dueTimeStr },
        reminderDays
      );

      await addPayment({
        name: name.trim(),
        amount: parsedAmount,
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

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: (ImagePicker.MediaType as any)?.images ?? (ImagePicker.MediaTypeOptions as any).Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setIconType('gallery');
      setIconValue(result.assets[0].uri);
      setShowIconPicker(false);
    }
  };

  const handleEmojiConfirm = () => {
    if (emojiInput.trim()) {
      setIconType('emoji');
      setIconValue(emojiInput.trim());
      setShowIconPicker(false);
    }
  };



  const renderIconPreview = () => {
    if (iconType === 'gallery') {
      return <Image source={{ uri: iconValue }} style={{ width: 36, height: 36, borderRadius: 18 }} />;
    }
    if (iconType === 'emoji') {
      return <Text style={styles.emojiPreview}>{iconValue}</Text>;
    }
    return <MaterialCommunityIcons name={iconValue as any} size={32} color={Colors.primary} />;
  };

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
          <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">

        {/* Icon picker preview */}
        <TouchableOpacity style={styles.iconPreview} onPress={() => setShowIconPicker(true)}>
          <View style={styles.iconCircle}>
            {renderIconPreview()}
          </View>
          <Text style={styles.iconHint}>İkon seç</Text>
        </TouchableOpacity>

        {/* Ödeme Adı */}
        <InputGroup label="Ödeme Adı">
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="örn. Netflix Aboneliği"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="next"
            blurOnSubmit={false}
          />
        </InputGroup>

        {/* Tutar + Para Birimi */}
        <InputGroup label="Tutar">
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            symbol={CURRENCIES.find(c => c.value === currency)?.symbol ?? '₺'}
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

        {/* Kategori */}
        <InputGroup label="Kategori">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, category === cat.name && { backgroundColor: cat.color, borderColor: cat.color }]}
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

        {/* Tarih & Saat */}
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

        {/* Tekrarlama */}
        <InputGroup label="Tekrarlama">
          <View style={styles.recurrenceGrid}>
            {RECURRENCE.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.recCard, recurrence === r.value && styles.recCardActive]}
                onPress={() => setRecurrence(r.value)}
              >
                <MaterialCommunityIcons
                  name={r.icon as any}
                  size={20}
                  color={recurrence === r.value ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.recText, recurrence === r.value && styles.recTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </InputGroup>

        {/* Hatırlatıcı */}
        <InputGroup label="Hatırlatıcı (kaç gün önce)">
          <View style={styles.reminderRow}>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.days}
                style={[styles.recBtn, reminderDays === opt.days && styles.recBtnActive]}
                onPress={() => setReminderDays(opt.days)}
              >
                <Text style={[styles.recBtnText, reminderDays === opt.days && styles.recBtnTextActive]}>
                  {opt.label}
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

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Picker */}
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

      {/* İkon Seçici Modal */}
      <Modal visible={showIconPicker} transparent animationType="slide" onRequestClose={() => setShowIconPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.iconPickerModal}>
            <View style={styles.iconPickerHeader}>
              <Text style={styles.iconPickerTitle}>İkon Seç</Text>
              <TouchableOpacity onPress={() => setShowIconPicker(false)}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Sekmeler */}
            <View style={styles.iconTabRow}>
              <TouchableOpacity
                style={[styles.iconTab, activeIconTab === 'icon' && styles.iconTabActive]}
                onPress={() => setActiveIconTab('icon')}
              >
                <Text style={[styles.iconTabText, activeIconTab === 'icon' && styles.iconTabTextActive]}>İkonlar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconTab, activeIconTab === 'emoji' && styles.iconTabActive]}
                onPress={() => setActiveIconTab('emoji')}
              >
                <Text style={[styles.iconTabText, activeIconTab === 'emoji' && styles.iconTabTextActive]}>Emoji</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconTab}
                onPress={handlePickImage}
              >
                <Text style={styles.iconTabText}>Galeri</Text>
              </TouchableOpacity>
            </View>

            {activeIconTab === 'icon' ? (
              <View style={styles.iconGrid}>
                {QUICK_ICONS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconOption, iconType === 'icon' && iconValue === icon && styles.iconOptionActive]}
                    onPress={() => {
                      setIconType('icon');
                      setIconValue(icon);
                      setShowIconPicker(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name={icon as any}
                      size={26}
                      color={iconType === 'icon' && iconValue === icon ? '#fff' : Colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emojiInputSection}>
                <Text style={styles.emojiHint}>Emoji yapıştırın veya yazın</Text>
                <TextInput
                  style={styles.emojiTextInput}
                  value={emojiInput}
                  onChangeText={setEmojiInput}
                  placeholder="😊"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={2}
                />
                <TouchableOpacity style={styles.emojiConfirmBtn} onPress={handleEmojiConfirm}>
                  <Text style={styles.emojiConfirmText}>Seç</Text>
                </TouchableOpacity>
              </View>
            )}
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
  iconPreview: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.sm },
  iconCircle: {
    width: 88, height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  emojiPreview: { fontSize: 38 },
  iconHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginTop: 10,
  },
  inputGroup: { marginBottom: Spacing.xl },
  inputLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
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
  chipScroll: { marginHorizontal: -2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
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
  recurrenceGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  recCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  recCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  recText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  recTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  reminderRow: { flexDirection: 'row', gap: 8 },
  recBtn: {
    flex: 1, paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  recBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  recBtnText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  recBtnTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  iconPickerModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: 36,
    maxHeight: '70%',
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
  iconTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  iconTab: {
    flex: 1, paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
  },
  iconTabActive: { backgroundColor: Colors.primary },
  iconTabText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  iconTabTextActive: { color: '#fff' },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    width: 58, height: 58,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },
  iconOptionActive: { backgroundColor: Colors.primary },
  emojiInputSection: { alignItems: 'center', paddingVertical: 8 },
  emojiHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  emojiTextInput: {
    fontSize: 36, textAlign: 'center',
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: 16,
    marginVertical: 12,
    width: '100%',
  },
  emojiConfirmBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40, paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    marginTop: 4,
  },
  emojiConfirmText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: '#fff',
  },
});
