import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Image, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { getPayments, updatePaymentStatus, updatePayment, deletePayment, getCategories } from '../../src/db/database';
import { cancelNotification, parseNotificationIds, parseReminderDays, schedulePaymentNotification } from '../../src/utils/notifications';
import {
  formatCurrency, formatDateWithTime, getStatusColor,
  getStatusLabel, getStatusIcon, getRecurrenceLabel, getDueDateLabel,
  formatLocalDateKey, parseLocalDate,
} from '../../src/utils/helpers';
import { Payment, Currency, RecurrenceType, IconType } from '../../src/constants/types';
import { CurrencyInput } from '../../src/components/CurrencyInput';

const QUICK_ICONS = [
  //Para & Finans
  'cash', 'credit-card', 'bank', 'wallet', 'currency-usd', 'piggy-bank',
  'receipt', 'invoice-text', 'finance', 'trending-up', 'trending-down', 'chart-line',
  //Ev & Yaşam
  'home', 'home-city', 'sofa', 'bed', 'shower', 'flash',
  'water', 'fire', 'hvac', 'washing-machine', 'fridge', 'television',
  //Ulaşım
  'car', 'car-wash', 'gas-station', 'airplane', 'train', 'bus',
  'motorbike', 'bicycle', 'taxi', 'ferry', 'parking', 'road',
  //Teknoloji & İletişim
  'phone', 'wifi', 'cellphone', 'laptop', 'tablet', 'monitor',
  'printer', 'headphones', 'camera', 'router-wireless', 'cloud', 'server',
  //Sağlık & Spor
  'medical-bag', 'hospital-box', 'heart-pulse', 'pill', 'tooth', 'eye',
  'dumbbell', 'yoga', 'run', 'swim', 'soccer', 'basketball',
  //Yiyecek & İçecek
  'food', 'coffee', 'food-fork-drink', 'pizza', 'hamburger', 'cake',
  'fruit-watermelon', 'cup', 'bottle-wine', 'grocery', 'silverware', 'chef-hat',
  //Eğitim & Kültür
  'school', 'book', 'bookshelf', 'pencil', 'graduation-cap', 'library',
  'music', 'music-note', 'theater', 'palette', 'film', 'gamepad',
  //Alışveriş & Hizmet
  'cart', 'store', 'tag', 'gift', 'hanger', 'shoe-heel',
  'scissors', 'hammer', 'tools', 'broom', 'face-woman', 'baby-carriage',
  //Diğer
  'star', 'heart', 'flower', 'leaf', 'paw', 'earth',
  'shield', 'lock', 'key', 'bell', 'alarm', 'calendar',
];

const CURRENCIES: { value: Currency; symbol: string }[] = [
  { value: 'TRY', symbol: '₺' }, { value: 'USD', symbol: '$' },
  { value: 'EUR', symbol: '€' }, { value: 'GBP', symbol: '£' },
];
const RECURRENCE: { value: RecurrenceType; label: string; icon: string }[] = [
  { value: 'once', label: 'Tek Seferlik', icon: 'numeric-1-circle-outline' },
  { value: 'weekly', label: 'Haftalık', icon: 'calendar-week' },
  { value: 'monthly', label: 'Aylık', icon: 'calendar-month' },
  { value: 'yearly', label: 'Yıllık', icon: 'calendar-star' },
];

const REMINDER_OPTIONS = [
  { days: 0, label: 'Aynı gün' },
  { days: 1, label: '1 gün' },
  { days: 3, label: '3 gün' },
  { days: 7, label: '1 hafta' },
  { days: 14, label: '2 hafta' },
];

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState<Currency>('TRY');
  const [editCategory, setEditCategory] = useState('');
  const [editDueDate, setEditDueDate] = useState(new Date());
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceType>('once');
  const [editReminderDays, setEditReminderDays] = useState<number[]>([1, 3]);
  const [editNotes, setEditNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editIconType, setEditIconType] = useState<IconType>('icon');
  const [editIconValue, setEditIconValue] = useState('credit-card');
  const [saving, setSaving] = useState(false);
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);
  const [activeEditIconTab, setActiveEditIconTab] = useState<'icon' | 'emoji'>('icon');
  const [editEmojiInput, setEditEmojiInput] = useState('');

  useFocusEffect(useCallback(() => {
    loadPayment();
    getCategories().then(setCategories);
  }, [id]));

  const loadPayment = async () => {
    const all = await getPayments();
    const found = all.find(p => p.id === parseInt(id));
    setPayment(found ?? null);
  };

  const openEdit = () => {
    if (!payment) return;
    setEditName(payment.name);
    setEditAmount(String(payment.amount));
    setEditCurrency(payment.currency);
    setEditCategory(payment.category);
    const d = parseLocalDate(payment.due_date) ?? new Date();
    const [h, m] = payment.due_time.split(':').map(Number);
    d.setHours(h, m);
    setEditDueDate(d);
    setEditRecurrence(payment.recurrence);
    setEditReminderDays(parseReminderDays(payment.reminder_days));
    setEditNotes(payment.notes);
    setEditIconType(payment.icon_type || 'icon');
    setEditIconValue(payment.icon_value || 'credit-card');
    setIsEditing(true);
  };

  const toggleEditReminder = (days: number) => {
    setEditReminderDays(current => {
      if (current.includes(days) && current.length === 1) return current;
      return current.includes(days)
        ? current.filter(value => value !== days)
        : [...current, days].sort((a, b) => a - b);
    });
    Haptics.selectionAsync();
  };

  const handleSaveEdit = async () => {
    if (!payment) return;
    if (!editName.trim()) { Alert.alert('Hata', 'Ödeme adı zorunludur.'); return; }
    const parsedAmount = parseFloat(editAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) { Alert.alert('Hata', 'Geçerli bir tutar girin.'); return; }

    setSaving(true);
    try {
      if (payment.notification_id) await cancelNotification(payment.notification_id);
      const dueDateStr = formatLocalDateKey(editDueDate);
      const dueTimeStr = `${String(editDueDate.getHours()).padStart(2, '0')}:${String(editDueDate.getMinutes()).padStart(2, '0')}`;
      const notificationIds = await schedulePaymentNotification(
        { id: payment.id, name: editName, amount: parsedAmount, currency: editCurrency, due_date: dueDateStr, due_time: dueTimeStr }, editReminderDays
      );
      await updatePayment(payment.id, {
        name: editName.trim(), amount: parsedAmount, currency: editCurrency,
        category: editCategory, due_date: dueDateStr, due_time: dueTimeStr,
        recurrence: editRecurrence, notes: editNotes.trim(),
        reminder_days: JSON.stringify(editReminderDays), notification_id: JSON.stringify(notificationIds),
        icon_type: editIconType, icon_value: editIconValue,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      await loadPayment();
    } catch (e) {
      Alert.alert('Hata', 'Güncelleme sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickEditImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setEditIconType('gallery');
      setEditIconValue(result.assets[0].uri);
      setShowEditIconPicker(false);
    }
  };

  const handleEditEmojiConfirm = () => {
    if (editEmojiInput.trim()) {
      setEditIconType('emoji');
      setEditIconValue(editEmojiInput.trim());
      setShowEditIconPicker(false);
    }
  };

  const renderEditIconPreview = () => {
    if (editIconType === 'gallery') {
      return <Image source={{ uri: editIconValue }} style={{ width: 36, height: 36, borderRadius: 18 }} />;
    }
    if (editIconType === 'emoji') {
      return <Text style={{ fontSize: 32 }}>{editIconValue}</Text>;
    }
    return <MaterialCommunityIcons name={editIconValue as any} size={32} color={Colors.primary} />;
  };

  const handleMarkPaid = async () => {
    if (!payment) return;
    if (payment.notification_id) await cancelNotification(payment.notification_id);
    await updatePaymentStatus(payment.id, 'paid');
    await updatePayment(payment.id, { notification_id: '' });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadPayment();
  };

  const handleMarkPending = async () => {
    if (!payment) return;
    await updatePaymentStatus(payment.id, 'pending');
    const reminderDays = parseReminderDays(payment.reminder_days);
    const notificationIds = await schedulePaymentNotification({ ...payment, id: payment.id }, reminderDays);
    await updatePayment(payment.id, { notification_id: JSON.stringify(notificationIds) });
    Haptics.selectionAsync();
    await loadPayment();
  };

  const handleDelete = () => {
    Alert.alert('Ödemeyi Sil', `"${payment?.name}" ödemesini silmek istediğinizden emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: async () => {
          if (!payment) return;
          if (payment.notification_id) await cancelNotification(payment.notification_id);
          await deletePayment(payment.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.back();
        }},
      ]
    );
  };

  if (!payment) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ödeme Detayı</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Ödeme bulunamadı</Text>
        </View>
      </View>
    );
  }

  const statusColor = getStatusColor(payment.status);
  const daysLabel = getDueDateLabel(payment.due_date);

  const renderIcon = () => {
    if (payment.icon_type === 'gallery') return <Image source={{ uri: payment.icon_value }} style={styles.iconImage} />;
    if (payment.icon_type === 'emoji') return <Text style={styles.emojiIcon}>{payment.icon_value}</Text>;
    return <MaterialCommunityIcons name={payment.icon_value as any} size={36} color={Colors.primary} />;
  };

  if (isEditing) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Düzenle</Text>
          <TouchableOpacity onPress={handleSaveEdit} style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? '...' : 'Kaydet'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" showsVerticalScrollIndicator={false}>
          <Text style={styles.editLabel}>Görsel</Text>
          <TouchableOpacity style={styles.editPhotoBtn} onPress={() => setShowEditIconPicker(true)}>
            <View style={styles.editPhotoPlaceholder}>
              {renderEditIconPreview()}
            </View>
            <View style={styles.editPhotoBadge}>
              <MaterialCommunityIcons name="pencil" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.editLabel}>Ödeme Adı</Text>
          <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholderTextColor={Colors.textMuted} blurOnSubmit={false} />

          <Text style={styles.editLabel}>Tutar</Text>
          <CurrencyInput
            value={editAmount}
            onChange={setEditAmount}
            symbol={CURRENCIES.find(c => c.value === editCurrency)?.symbol ?? '₺'}
          />

          <Text style={styles.editLabel}>Para Birimi</Text>
          <View style={styles.editCurrencyRow}>
            {CURRENCIES.map(c => (
              <TouchableOpacity key={c.value} style={[styles.editCurrencyBtn, editCurrency === c.value && styles.editCurrencyBtnActive]} onPress={() => setEditCurrency(c.value)}>
                <Text style={[styles.editCurrencySymbol, editCurrency === c.value && styles.editCurrencySymbolActive]}>{c.symbol}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.editLabel}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }}>
            {categories.map(cat => (
              <TouchableOpacity key={cat.id} style={[styles.editChip, editCategory === cat.name && { backgroundColor: cat.color, borderColor: cat.color }]} onPress={() => setEditCategory(cat.name)}>
                <MaterialCommunityIcons name={cat.icon as any} size={14} color={editCategory === cat.name ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.editChipText, editCategory === cat.name && styles.editChipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.editLabel}>Tarih & Saat</Text>
          <View style={styles.editRow}>
            <TouchableOpacity style={[styles.editInput, styles.editDateBtn, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar" size={16} color={Colors.primary} />
              <Text style={styles.editDateText}>{editDueDate.toLocaleDateString('tr-TR')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editInput, styles.editDateBtn, { flex: 0.6 }]} onPress={() => setShowTimePicker(true)}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={Colors.primary} />
              <Text style={styles.editDateText}>{String(editDueDate.getHours()).padStart(2,'0')}:{String(editDueDate.getMinutes()).padStart(2,'0')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.editLabel}>Tekrarlama</Text>
          <View style={styles.editRecurrenceGrid}>
            {RECURRENCE.map(r => (
              <TouchableOpacity key={r.value} style={[styles.editRecCard, editRecurrence === r.value && styles.editRecCardActive]} onPress={() => setEditRecurrence(r.value)}>
                <MaterialCommunityIcons name={r.icon as any} size={20} color={editRecurrence === r.value ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.editRecText, editRecurrence === r.value && styles.editRecTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.editLabel}>Hatırlatıcılar (birden fazla seçilebilir)</Text>
          <View style={[styles.editRow, { marginBottom: Spacing.lg }]}>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.days} style={[styles.editChip, editReminderDays.includes(opt.days) && styles.editChipActive]} onPress={() => toggleEditReminder(opt.days)}>
                {editReminderDays.includes(opt.days) && <MaterialCommunityIcons name="check" size={13} color="#fff" />}
                <Text style={[styles.editChipText, editReminderDays.includes(opt.days) && styles.editChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.editLabel}>Not</Text>
          <TextInput style={[styles.editInput, { height: 80, textAlignVertical: 'top' }]} value={editNotes} onChangeText={setEditNotes} multiline placeholderTextColor={Colors.textMuted} placeholder="Not ekleyin..." blurOnSubmit={false} />

          <View style={{ height: 40 }} />
        </ScrollView>

        <DateTimePickerModal isVisible={showDatePicker} mode="date" date={editDueDate}
          onConfirm={(d) => { setEditDueDate(d); setShowDatePicker(false); }} onCancel={() => setShowDatePicker(false)} locale="tr" />
        <DateTimePickerModal isVisible={showTimePicker} mode="time" date={editDueDate}
          onConfirm={(d) => { setEditDueDate(d); setShowTimePicker(false); }} onCancel={() => setShowTimePicker(false)} locale="tr" />

        {/* İkon Seçici Modal */}
        <Modal visible={showEditIconPicker} transparent animationType="slide" onRequestClose={() => setShowEditIconPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.iconPickerModal}>
              <View style={styles.iconPickerHeader}>
                <Text style={styles.iconPickerTitle}>İkon Seç</Text>
                <TouchableOpacity onPress={() => setShowEditIconPicker(false)}>
                  <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.iconTabRow}>
                <TouchableOpacity
                  style={[styles.iconTab, activeEditIconTab === 'icon' && styles.iconTabActive]}
                  onPress={() => setActiveEditIconTab('icon')}
                >
                  <Text style={[styles.iconTabText, activeEditIconTab === 'icon' && styles.iconTabTextActive]}>İkonlar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconTab, activeEditIconTab === 'emoji' && styles.iconTabActive]}
                  onPress={() => setActiveEditIconTab('emoji')}
                >
                  <Text style={[styles.iconTabText, activeEditIconTab === 'emoji' && styles.iconTabTextActive]}>Emoji</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconTab} onPress={handlePickEditImage}>
                  <Text style={styles.iconTabText}>Galeri</Text>
                </TouchableOpacity>
              </View>
              {activeEditIconTab === 'icon' ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.iconGrid}>
                    {QUICK_ICONS.map(icon => (
                      <TouchableOpacity
                        key={icon}
                        style={[styles.iconOption, editIconType === 'icon' && editIconValue === icon && styles.iconOptionActive]}
                        onPress={() => {
                          setEditIconType('icon');
                          setEditIconValue(icon);
                          setShowEditIconPicker(false);
                        }}
                      >
                        <MaterialCommunityIcons
                          name={icon as any}
                          size={26}
                          color={editIconType === 'icon' && editIconValue === icon ? '#fff' : Colors.textSecondary}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.emojiInputSection}>
                  <Text style={styles.emojiHint}>Emoji yapıştırın veya yazın</Text>
                  <TextInput
                    style={styles.emojiTextInput}
                    value={editEmojiInput}
                    onChangeText={setEditEmojiInput}
                    placeholder="😊"
                    placeholderTextColor={Colors.textMuted}
                    maxLength={2}
                  />
                  <TouchableOpacity style={styles.emojiConfirmBtn} onPress={handleEditEmojiConfirm}>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ödeme Detayı</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.iconCircle}>{renderIcon()}</View>
          <Text style={styles.paymentName}>{payment.name}</Text>
          <Text style={styles.amountText}>{formatCurrency(payment.amount, payment.currency)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
            <MaterialCommunityIcons name={getStatusIcon(payment.status) as any} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(payment.status)}</Text>
          </View>
          {payment.status !== 'paid' && (
            <Text style={[styles.daysLabel, { color: payment.status === 'overdue' ? Colors.danger : Colors.textSecondary }]}>{daysLabel}</Text>
          )}
        </View>

        <View style={styles.detailCard}>
          <DetailRow icon="calendar" label="Tarih" value={formatDateWithTime(payment.due_date, payment.due_time)} />
          <Divider />
          <DetailRow icon="tag" label="Kategori" value={payment.category} />
          <Divider />
          <DetailRow icon="refresh" label="Tekrarlama" value={getRecurrenceLabel(payment.recurrence)} />
          {payment.notes ? (<><Divider /><DetailRow icon="note-text-outline" label="Not" value={payment.notes} /></>) : null}
          {parseNotificationIds(payment.notification_id).length > 0 ? (
            <><Divider /><DetailRow icon="bell-outline" label="Hatırlatıcı" value={`${parseNotificationIds(payment.notification_id).length} bildirim planlandı`} valueColor={Colors.success} /></>
          ) : null}
        </View>

        <View style={styles.actionContainer}>
          {payment.status !== 'paid' ? (
            <TouchableOpacity style={styles.primaryActionBtn} onPress={handleMarkPaid}>
              <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
              <Text style={styles.primaryActionText}>Ödendi Olarak İşaretle</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.secondaryActionBtn} onPress={handleMarkPending}>
              <MaterialCommunityIcons name="clock-outline" size={22} color={Colors.primary} />
              <Text style={styles.secondaryActionText}>Bekliyor Olarak İşaretle</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;
const DetailRow = ({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIconWrap}>
      <MaterialCommunityIcons name={icon as any} size={18} color={Colors.textSecondary} />
    </View>
    <View style={styles.detailTexts}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.surface },
  headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.xl, color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: `${Colors.primary}18` },
  deleteBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: `${Colors.danger}18` },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: BorderRadius.lg },
  saveBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: '#fff' },
  heroCard: { alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.lg },
  iconCircle: { width: 90, height: 90, borderRadius: BorderRadius.full, backgroundColor: `${Colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, ...Shadow.primary },
  iconImage: { width: 90, height: 90, borderRadius: BorderRadius.full },
  emojiIcon: { fontSize: 42 },
  paymentName: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.xxl, color: Colors.textPrimary, textAlign: 'center', marginBottom: 6 },
  amountText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 36, color: Colors.primary, marginBottom: Spacing.lg },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1, marginBottom: 8 },
  statusText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm },
  daysLabel: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, marginTop: 4 },
  detailCard: { marginHorizontal: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder, ...Shadow.sm },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  detailIconWrap: { width: 32, height: 32, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  detailTexts: { flex: 1 },
  detailLabel: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.md, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: 4 },
  actionContainer: { padding: Spacing.lg, paddingTop: Spacing.xl },
  primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.success, borderRadius: BorderRadius.lg, paddingVertical: 16, ...Shadow.md },
  primaryActionText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: '#fff' },
  secondaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: `${Colors.primary}18`, borderRadius: BorderRadius.lg, paddingVertical: 16, borderWidth: 1, borderColor: Colors.primary },
  secondaryActionText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: Colors.primary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.md, color: Colors.textMuted },
  editContent: { padding: Spacing.lg },
  editLabel: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  editInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, fontFamily: 'Poppins_400Regular', fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: Spacing.lg },
  editRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.surface, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder },
  editChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  editChipText: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary },
  editChipTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  editCurrencyRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  editCurrencyBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surfaceBorder },
  editCurrencyBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  editCurrencySymbol: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary },
  editCurrencySymbolActive: { color: '#fff' },
  editRecurrenceGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: Spacing.lg },
  editRecCard: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surfaceBorder },
  editRecCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  editRecText: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary },
  editRecTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  editDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editPhotoBtn: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  editPhotoImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  editPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  editPhotoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  editDateText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, color: Colors.textPrimary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  iconPickerModal: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, paddingBottom: 36, maxHeight: '75%' },
  iconPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  iconPickerTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.lg, color: Colors.textPrimary },
  iconTabRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  iconTab: { flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md },
  iconTabActive: { backgroundColor: Colors.primary },
  iconTabText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary },
  iconTabTextActive: { color: '#fff' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconOption: { width: 58, height: 58, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  iconOptionActive: { backgroundColor: Colors.primary },
  emojiInputSection: { alignItems: 'center', paddingVertical: 8 },
  emojiHint: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary },
  emojiTextInput: { fontSize: 36, textAlign: 'center', color: Colors.textPrimary, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: 16, marginVertical: 12, width: '100%' },
  emojiConfirmBtn: { backgroundColor: Colors.primary, paddingHorizontal: 40, paddingVertical: 12, borderRadius: BorderRadius.lg, marginTop: 4 },
  emojiConfirmText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: '#fff' },
});
