import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Image, TextInput, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import {
  getDebtById, deleteDebt, addDebtPayment, getDebtPayments, updateDebt,
} from '../../src/db/database';
import { cancelMultipleNotifications, parseNotificationIds, parseReminderDays, scheduleDebtNotification } from '../../src/utils/notifications';
import {
  formatCurrency, formatDate, getDueDateLabel, determineDebtStatus, getDebtStatusColor,
  formatLocalDateKey, parseLocalDate,
} from '../../src/utils/helpers';
import { Debt, DebtPayment, Currency, DebtDirection } from '../../src/constants/types';
import { CurrencyInput } from '../../src/components/CurrencyInput';

const QUICK_ICONS = [
  'cash', 'credit-card', 'bank', 'wallet', 'currency-usd', 'piggy-bank',
  'receipt', 'invoice-text', 'finance', 'trending-up', 'trending-down', 'chart-line',
  'home', 'home-city', 'sofa', 'bed', 'shower', 'flash',
  'water', 'fire', 'hvac', 'washing-machine', 'fridge', 'television',
  'car', 'car-wash', 'gas-station', 'airplane', 'train', 'bus',
  'motorbike', 'bicycle', 'taxi', 'ferry', 'parking', 'road',
  'phone', 'wifi', 'cellphone', 'laptop', 'tablet', 'monitor',
  'printer', 'headphones', 'camera', 'router-wireless', 'cloud', 'server',
  'medical-bag', 'hospital-box', 'heart-pulse', 'pill', 'tooth', 'eye',
  'dumbbell', 'yoga', 'run', 'swim', 'soccer', 'basketball',
  'food', 'coffee', 'food-fork-drink', 'pizza', 'hamburger', 'cake',
  'fruit-watermelon', 'cup', 'bottle-wine', 'grocery', 'silverware', 'chef-hat',
  'school', 'book', 'bookshelf', 'pencil', 'graduation-cap', 'library',
  'music', 'music-note', 'theater', 'palette', 'film', 'gamepad',
  'cart', 'store', 'tag', 'gift', 'hanger', 'shoe-heel',
  'scissors', 'hammer', 'tools', 'broom', 'face-woman', 'baby-carriage',
  'star', 'heart', 'flower', 'leaf', 'paw', 'earth',
  'shield', 'lock', 'key', 'bell', 'alarm', 'calendar',
];

const CURRENCIES: { value: Currency; symbol: string }[] = [
  { value: 'TRY', symbol: '₺' },
  { value: 'USD', symbol: '$' },
  { value: 'EUR', symbol: '€' },
  { value: 'GBP', symbol: '£' },
];

const DEBT_REMINDER_OPTIONS = [
  { days: 0, label: 'Aynı gün' },
  { days: 1, label: '1 gün' },
  { days: 3, label: '3 gün' },
  { days: 7, label: '1 hafta' },
];


export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editPersonName, setEditPersonName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState<Currency>('TRY');
  const [editDirection, setEditDirection] = useState<DebtDirection>('owe');
  const [editDueDate, setEditDueDate] = useState(new Date());
  const [editHasDueDate, setEditHasDueDate] = useState(false);
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editShowInterest, setEditShowInterest] = useState(false);
  const [editReminderDays, setEditReminderDays] = useState<number[]>([1, 3, 7]);
  const [editNotes, setEditNotes] = useState('');
  const [editPersonPhoto, setEditPersonPhoto] = useState('');
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);
  const [editIconType, setEditIconType] = useState<'icon' | 'emoji' | 'gallery'>('gallery');
  const [editIconValue, setEditIconValue] = useState('');
  const [activeEditIconTab, setActiveEditIconTab] = useState<'icon' | 'emoji'>('icon');
  const [editEmojiInput, setEditEmojiInput] = useState('');

  useFocusEffect(useCallback(() => { loadData(); }, [id]));

  const loadData = async () => {
    const [d, p] = await Promise.all([
      getDebtById(parseInt(id)),
      getDebtPayments(parseInt(id)),
    ]);
    setDebt(d);
    setPayments(p);
  };

  const openEdit = () => {
    if (!debt) return;
    setEditPersonName(debt.person_name);
    setEditAmount(String(debt.total_amount));
    setEditCurrency(debt.currency);
    setEditDirection(debt.debt_direction);
    setEditDueDate(parseLocalDate(debt.due_date) ?? new Date());
    setEditHasDueDate(!!debt.due_date);
    setEditInterestRate(debt.interest_rate > 0 ? String(debt.interest_rate) : '');
    setEditShowInterest(debt.interest_rate > 0);
    setEditReminderDays(parseReminderDays(debt.reminder_days, [1, 3, 7]));
    setEditNotes(debt.notes);
    setEditPersonPhoto(debt.person_photo || '');
    setEditIconType((debt.person_photo ? 'gallery' : 'icon') as any);
    setEditIconValue(debt.person_photo || '');
    setIsEditing(true);
  };

  const handlePickEditImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setEditIconType('gallery');
      setEditIconValue(uri);
      setEditPersonPhoto(uri);
      setShowEditIconPicker(false);
    }
  };

  const handleEditEmojiConfirm = () => {
    if (editEmojiInput.trim()) {
      setEditIconType('emoji');
      setEditIconValue(editEmojiInput.trim());
      setEditPersonPhoto('');
      setShowEditIconPicker(false);
    }
  };

  const renderEditIconPreview = () => {
    if (editIconType === 'gallery' && editIconValue) {
      return <Image source={{ uri: editIconValue }} style={styles.editPhotoImg} />;
    }
    if (editIconType === 'emoji' && editIconValue) {
      return (
        <View style={styles.editPhotoPlaceholder}>
          <Text style={{ fontSize: 32 }}>{editIconValue}</Text>
        </View>
      );
    }
    if (editIconType === 'icon' && editIconValue) {
      return (
        <View style={styles.editPhotoPlaceholder}>
          <MaterialCommunityIcons name={editIconValue as any} size={32} color={Colors.primary} />
        </View>
      );
    }
    return (
      <View style={styles.editPhotoPlaceholder}>
        <MaterialCommunityIcons name="camera-plus" size={28} color={Colors.primary} />
      </View>
    );
  };

  const handleSaveEdit = async () => {
    if (!debt) return;
    if (!editPersonName.trim()) { Alert.alert('Hata', 'Kişi adı zorunludur.'); return; }
    const parsedAmount = parseFloat(editAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) { Alert.alert('Hata', 'Geçerli bir tutar girin.'); return; }

    setSaving(true);
    try {
      const oldNotificationIds = parseNotificationIds(debt.notification_ids);
      await cancelMultipleNotifications(oldNotificationIds);

      const dueDate = editHasDueDate ? formatLocalDateKey(editDueDate) : '';
      const notificationIds = await scheduleDebtNotification({
        id: debt.id,
        person_name: editPersonName.trim(),
        total_amount: parsedAmount,
        currency: editCurrency,
        due_date: dueDate,
        debt_direction: editDirection,
      }, editReminderDays);

      await updateDebt(debt.id, {
        person_name: editPersonName.trim(),
        person_photo: editPersonPhoto,
        total_amount: parsedAmount,
        currency: editCurrency,
        debt_direction: editDirection,
        due_date: dueDate,
        interest_rate: parseFloat(editInterestRate) || 0,
        notes: editNotes.trim(),
        reminder_days: JSON.stringify(editReminderDays),
        notification_ids: JSON.stringify(notificationIds),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      await loadData();
    } catch (e) {
      Alert.alert('Hata', 'Güncelleme sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Borcu Sil', `"${debt?.person_name}" borcunu silmek istediğinizden emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: async () => {
          if (!debt) return;
          await cancelMultipleNotifications(parseNotificationIds(debt.notification_ids));
          await deleteDebt(debt.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.back();
        }},
      ]
    );
  };

  const handleAddPayment = async () => {
    if (!debt) return;
    const parsed = parseFloat(payAmount.replace(',', '.'));
    if (!payAmount || isNaN(parsed) || parsed <= 0) { Alert.alert('Hata', 'Geçerli bir tutar girin.'); return; }
    const remaining = debt.total_amount - debt.paid_amount;
    if (parsed > remaining) {
      Alert.alert('Hata', `Kalan borç tutarından (${formatCurrency(remaining, debt.currency)}) fazla ödeme yapılamaz.`);
      return;
    }
    setSaving(true);
    try {
      await addDebtPayment({ debt_id: debt.id, amount: parsed, paid_at: new Date().toISOString(), notes: payNote.trim() });
      if (parsed >= remaining) {
        await cancelMultipleNotifications(parseNotificationIds(debt.notification_ids));
        await updateDebt(debt.id, { notification_ids: '[]' });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPayModal(false);
      setPayAmount(''); setPayNote('');
      await loadData();
    } catch (e) {
      Alert.alert('Hata', 'Ödeme kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkFullyPaid = async () => {
    if (!debt) return;
    const remaining = debt.total_amount - debt.paid_amount;
    if (remaining <= 0) { Alert.alert('Bilgi', 'Bu borç zaten tamamen ödenmiş.'); return; }
    Alert.alert('Tamamen Ödendi', `${formatCurrency(remaining, debt.currency)} kalan tutarı ödenmiş olarak işaretlemek istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Evet', onPress: async () => {
          await addDebtPayment({ debt_id: debt.id, amount: remaining, paid_at: new Date().toISOString(), notes: 'Tamamen ödendi' });
          await cancelMultipleNotifications(parseNotificationIds(debt.notification_ids));
          await updateDebt(debt.id, { notification_ids: '[]' });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await loadData();
        }},
      ]
    );
  };

  if (!debt) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Borç Detayı</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Borç bulunamadı</Text>
        </View>
      </View>
    );
  }

  const remaining = debt.total_amount - debt.paid_amount;
  const progress = debt.total_amount > 0 ? Math.min(debt.paid_amount / debt.total_amount, 1) : 0;
  const isFullyPaid = remaining <= 0;
  const debtStatus = determineDebtStatus(debt.due_date);
  const statusColor = getDebtStatusColor(debtStatus);
  const isOwe = debt.debt_direction === 'owe';
  const directionColor = isOwe ? Colors.danger : Colors.success;
  const currencySymbol = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[debt.currency] ?? '₺';

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

          <Text style={styles.editLabel}>Fotoğraf / İkon</Text>
          <TouchableOpacity style={styles.editPhotoBtn} onPress={() => setShowEditIconPicker(true)}>
            {renderEditIconPreview()}
            <View style={styles.editPhotoBadge}>
              <MaterialCommunityIcons name="pencil" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.editLabel}>Kişi Adı</Text>
          <TextInput style={styles.editInput} value={editPersonName} onChangeText={setEditPersonName} placeholder="Ad Soyad" placeholderTextColor={Colors.textMuted} blurOnSubmit={false} />

          <Text style={styles.editLabel}>Borç Yönü</Text>
          <View style={styles.editRow}>
            <TouchableOpacity style={[styles.editChip, editDirection === 'owe' && { backgroundColor: Colors.danger, borderColor: Colors.danger }]} onPress={() => setEditDirection('owe')}>
              <Text style={[styles.editChipText, editDirection === 'owe' && styles.editChipTextActive]}>↑ Borcum Var</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editChip, editDirection === 'owed' && { backgroundColor: Colors.success, borderColor: Colors.success }]} onPress={() => setEditDirection('owed')}>
              <Text style={[styles.editChipText, editDirection === 'owed' && styles.editChipTextActive]}>↓ Alacağım Var</Text>
            </TouchableOpacity>
          </View>

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

          <TouchableOpacity
            style={styles.optionalToggle}
            onPress={() => setEditHasDueDate(v => !v)}
          >
            <MaterialCommunityIcons
              name={editHasDueDate ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.optionalToggleText}>
              Son Ödeme Tarihi (Opsiyonel)
            </Text>
          </TouchableOpacity>
          {editHasDueDate ? (
            <View style={styles.editDateRow}>
              <TouchableOpacity style={[styles.editInput, styles.editDateBtn, { flex: 1 }]} onPress={() => setShowEditDatePicker(true)}>
                <MaterialCommunityIcons name="calendar" size={16} color={Colors.primary} />
                <Text style={styles.editDateText}>{editDueDate.toLocaleDateString('tr-TR')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeDateBtn}
                onPress={() => setEditHasDueDate(false)}
              >
                <MaterialCommunityIcons name="calendar-remove" size={18} color={Colors.danger} />
                <Text style={styles.removeDateText}>Tarihi Kaldır</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.optionalToggle}
            onPress={() => setEditShowInterest(v => !v)}
          >
            <MaterialCommunityIcons
              name={editShowInterest ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.optionalToggleText}>
              {editShowInterest ? 'Faizi Gizle' : 'Faiz Ekle (Opsiyonel)'}
            </Text>
          </TouchableOpacity>

          {editShowInterest && (
            <>
              <Text style={styles.editLabel}>Faiz Oranı (%, opsiyonel)</Text>
              <View style={styles.editInterestRow}>
                <TextInput style={[styles.editInput, { flex: 1, marginBottom: 0 }]} value={editInterestRate} onChangeText={setEditInterestRate} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textMuted} blurOnSubmit={false} />
                <View style={styles.editInterestSuffix}>
                  <Text style={styles.editInterestSuffixText}>%</Text>
                </View>
              </View>
              <View style={{ height: Spacing.lg }} />
            </>
          )}

          <Text style={styles.editLabel}>Hatırlatıcılar</Text>
          <Text style={styles.editHint}>Birden fazla seçebilirsiniz</Text>
          <View style={styles.editReminderRow}>
            {DEBT_REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.days}
                style={[styles.editReminderChip, editReminderDays.includes(opt.days) && styles.editReminderChipActive]}
                onPress={() => setEditReminderDays(prev => {
                  if (prev.includes(opt.days) && prev.length === 1) return prev;
                  return prev.includes(opt.days) ? prev.filter(d => d !== opt.days) : [...prev, opt.days].sort((a, b) => a - b);
                })}
              >
                {editReminderDays.includes(opt.days) && (
                  <MaterialCommunityIcons name="check" size={14} color="#fff" />
                )}
                <Text style={[styles.editReminderChipText, editReminderDays.includes(opt.days) && styles.editReminderChipTextActive]}>
                  {opt.label} önce
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: Spacing.lg }} />

          <Text style={styles.editLabel}>Not</Text>
          <TextInput style={[styles.editInput, { height: 80, textAlignVertical: 'top' }]} value={editNotes} onChangeText={setEditNotes} multiline placeholder="Not ekleyin..." placeholderTextColor={Colors.textMuted} blurOnSubmit={false} />

          <View style={{ height: 40 }} />
        </ScrollView>

        <DateTimePickerModal isVisible={showEditDatePicker} mode="date" date={editDueDate}
          onConfirm={(d) => { setEditDueDate(d); setShowEditDatePicker(false); }} onCancel={() => setShowEditDatePicker(false)} locale="tr" />

        {/* İkon / Fotoğraf Seçici Modal */}
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
                          setEditPersonPhoto('');
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
        <Text style={styles.headerTitle}>Borç Detayı</Text>
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
          <View style={styles.avatarContainer}>
            {debt.person_photo ? (
              <Image source={{ uri: debt.person_photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: `${directionColor}20` }]}>
                <Text style={[styles.avatarInitial, { color: directionColor }]}>{debt.person_name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={[styles.directionBadge, { backgroundColor: directionColor }]}>
              <MaterialCommunityIcons name={isOwe ? 'arrow-up' : 'arrow-down'} size={12} color="#fff" />
            </View>
          </View>

          <Text style={styles.personName}>{debt.person_name}</Text>
          <Text style={[styles.directionLabel, { color: directionColor }]}>{isOwe ? 'Borcum var' : 'Alacağım var'}</Text>

          <View style={styles.amountSection}>
            <View style={styles.amountBlock}>
              <Text style={styles.amountBlockLabel}>Toplam</Text>
              <Text style={styles.amountBlockValue}>{formatCurrency(debt.total_amount, debt.currency)}</Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountBlock}>
              <Text style={styles.amountBlockLabel}>Ödenen</Text>
              <Text style={[styles.amountBlockValue, { color: Colors.success }]}>{formatCurrency(debt.paid_amount, debt.currency)}</Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountBlock}>
              <Text style={styles.amountBlockLabel}>Kalan</Text>
              <Text style={[styles.amountBlockValue, { color: isFullyPaid ? Colors.success : directionColor }]}>
                {isFullyPaid ? '✓ Tamam' : formatCurrency(remaining, debt.currency)}
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: isFullyPaid ? Colors.success : directionColor }]} />
            </View>
            <Text style={styles.progressText}>%{Math.round(progress * 100)} ödendi</Text>
          </View>
        </View>

        <View style={styles.detailCard}>
          {debt.due_date ? (
            <>
              <DetailRow icon="calendar" label="Son Ödeme Tarihi" value={formatDate(debt.due_date)} valueColor={isFullyPaid ? undefined : statusColor} />
              <Divider />
              <DetailRow icon="clock-alert-outline" label="Kalan Süre" value={isFullyPaid ? 'Ödendi' : getDueDateLabel(debt.due_date)} valueColor={isFullyPaid ? Colors.success : statusColor} />
            </>
          ) : null}
          {debt.due_date && (debt.interest_rate > 0 || debt.notes) ? <Divider /> : null}
          {debt.interest_rate > 0 ? (
            <>
              <DetailRow icon="percent" label="Faiz Oranı" value={`%${debt.interest_rate} yıllık`} />
              {debt.notes ? <Divider /> : null}
            </>
          ) : null}
          {debt.notes ? <DetailRow icon="note-text-outline" label="Not" value={debt.notes} /> : null}
          {parseNotificationIds(debt.notification_ids).length > 0 ? (
            <><Divider /><DetailRow icon="bell-outline" label="Hatırlatıcı" value={`${parseNotificationIds(debt.notification_ids).length} bildirim planlandı`} valueColor={Colors.success} /></>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          {!isFullyPaid && (
            <>
              <TouchableOpacity style={[styles.payBtn, { backgroundColor: directionColor }]} onPress={() => setShowPayModal(true)}>
                <MaterialCommunityIcons name="cash-plus" size={18} color="#fff" />
                <Text style={styles.payBtnText}>Kısmi Ödeme</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fullPayBtn} onPress={handleMarkFullyPaid}>
                <MaterialCommunityIcons name="check-circle" size={18} color={Colors.success} />
                <Text style={styles.fullPayBtnText}>Tamamen Öde</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ödeme Geçmişi</Text>
          <Text style={styles.sectionCount}>{payments.length} kayıt</Text>
        </View>

        {payments.length === 0 ? (
          <View style={styles.emptyHistory}>
            <MaterialCommunityIcons name="history" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyHistoryText}>Henüz ödeme yapılmadı</Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {payments.map((p, idx) => (
              <View key={p.id} style={styles.timelineItem}>
                <View style={styles.timelineDot}>
                  <MaterialCommunityIcons name="check" size={12} color="#fff" />
                </View>
                {idx < payments.length - 1 && <View style={styles.timelineLine} />}
                <View style={styles.timelineContent}>
                  <View style={styles.timelineRow}>
                    <Text style={styles.timelineAmount}>{formatCurrency(p.amount, debt.currency)}</Text>
                    <Text style={styles.timelineDate}>{formatDate(p.paid_at, 'dd MMM yyyy')}</Text>
                  </View>
                  {p.notes ? <Text style={styles.timelineNote}>{p.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Kısmi Ödeme Modal */}
      <Modal visible={showPayModal} transparent animationType="slide" onRequestClose={() => setShowPayModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.payModal}>
            <View style={styles.payModalHeader}>
              <Text style={styles.payModalTitle}>Kısmi Ödeme Ekle</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.payModalRemaining}>Kalan: {formatCurrency(remaining, debt.currency)}</Text>
            <Text style={styles.payModalLabel}>Ödeme Tutarı</Text>
            <TextInput
              style={styles.payModalInput} value={payAmount} onChangeText={setPayAmount}
              placeholder={`0,00 ${currencySymbol}`} placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" autoFocus blurOnSubmit={false}
            />
            <Text style={styles.payModalLabel}>Not (Opsiyonel)</Text>
            <TextInput
              style={[styles.payModalInput, { height: 72, textAlignVertical: 'top' }]}
              value={payNote} onChangeText={setPayNote} placeholder="Not ekleyin..." placeholderTextColor={Colors.textMuted} multiline
            />
            <TouchableOpacity
              style={[styles.payModalBtn, { backgroundColor: directionColor }, saving && { opacity: 0.6 }]}
              onPress={handleAddPayment} disabled={saving}
            >
              <Text style={styles.payModalBtnText}>{saving ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;
const DetailRow = ({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIconWrap}><MaterialCommunityIcons name={icon as any} size={18} color={Colors.textSecondary} /></View>
    <View style={styles.detailTexts}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.surface },
  headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.xl, color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: `${Colors.primary}18` },
  deleteBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: `${Colors.danger}18` },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: BorderRadius.lg },
  saveBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: '#fff' },
  heroCard: { alignItems: 'center', padding: Spacing.md, paddingBottom: Spacing.lg },
  avatarContainer: { position: 'relative', marginBottom: Spacing.md },
  avatar: { width: 88, height: 88, borderRadius: BorderRadius.full, borderWidth: 3, borderColor: Colors.surfaceBorder },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.surfaceBorder },
  avatarInitial: { fontFamily: 'Poppins_700Bold', fontSize: 36 },
  directionBadge: { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.background },
  personName: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.xxl, color: Colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  directionLabel: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, marginBottom: Spacing.xl },
  amountSection: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder, width: '100%', marginBottom: Spacing.md },
  amountBlock: { flex: 1, alignItems: 'center', gap: 4 },
  amountDivider: { width: 1, backgroundColor: Colors.surfaceBorder, marginVertical: 4 },
  amountBlockLabel: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted },
  amountBlockValue: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: Colors.textPrimary },
  progressContainer: { width: '100%', gap: 6 },
  progressBg: { height: 8, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: BorderRadius.full },
  progressText: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },
  detailCard: { marginHorizontal: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder, ...Shadow.sm, marginBottom: Spacing.lg },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  detailIconWrap: { width: 32, height: 32, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  detailTexts: { flex: 1 },
  detailLabel: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.md, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: 4 },
  actionRow: { marginHorizontal: Spacing.lg, gap: 8, marginBottom: Spacing.xl },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: `${Colors.primary}18`, borderRadius: BorderRadius.md, paddingVertical: 12, borderWidth: 1, borderColor: Colors.primary },
  contactBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: Colors.primary },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: BorderRadius.md, paddingVertical: 14 },
  payBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: '#fff' },
  fullPayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: `${Colors.success}18`, borderRadius: BorderRadius.md, paddingVertical: 12, borderWidth: 1, borderColor: Colors.success },
  fullPayBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: Colors.success },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: Colors.textPrimary },
  sectionCount: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted },
  emptyHistory: { alignItems: 'center', gap: 10, paddingVertical: Spacing.xxxl },
  emptyHistoryText: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.sm, color: Colors.textMuted },
  timelineContainer: { paddingHorizontal: Spacing.lg },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: Spacing.md, position: 'relative' },
  timelineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', marginTop: 4, zIndex: 1 },
  timelineLine: { position: 'absolute', left: 11, top: 28, bottom: 0, width: 2, backgroundColor: Colors.surfaceBorder },
  timelineContent: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: 12, borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: Spacing.sm },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineAmount: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: Colors.success },
  timelineDate: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted },
  timelineNote: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  payModal: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, paddingBottom: 36 },
  payModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  payModalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.lg, color: Colors.textPrimary },
  payModalRemaining: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.lg },
  payModalLabel: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  payModalInput: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: Spacing.md, fontFamily: 'Poppins_400Regular', fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: Spacing.lg },
  payModalBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg, paddingVertical: 16, marginTop: 4 },
  payModalBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.md, color: Colors.textMuted },
  editContent: { padding: Spacing.lg },
  editLabel: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  editInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, fontFamily: 'Poppins_400Regular', fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: Spacing.lg },
  editRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  editChip: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.surface, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder },
  editChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  editChipText: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary },
  editChipTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  editCurrencyRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  editCurrencyBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surfaceBorder },
  editCurrencyBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  editCurrencySymbol: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary },
  editCurrencySymbolActive: { color: '#fff' },
  optionalToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.lg, alignSelf: 'flex-start' },
  optionalToggleText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, color: Colors.primary },
  editInterestRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 0 },
  editInterestSuffix: { width: 48, height: 48, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  editInterestSuffixText: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.xl, color: Colors.primary },
  editHint: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm, marginTop: -Spacing.xs },
  editReminderRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  editReminderChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder },
  editReminderChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  editReminderChipText: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textSecondary },
  editReminderChipTextActive: { color: '#fff', fontFamily: 'Poppins_500Medium' },
  editDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  removeDateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: `${Colors.danger}15`,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: `${Colors.danger}40`,
    flex: 1,
    minWidth: 130,
  },
  removeDateText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.xs, color: Colors.danger },
  addDateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: Spacing.md,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: `${Colors.primary}40`,
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
  },
  addDateText: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.sm, color: Colors.primary },
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
    borderStyle: 'dashed',
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
