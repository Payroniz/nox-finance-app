import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Image, TextInput, Modal, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../src/constants/theme';
import {
  getDebtById, deleteDebt, addDebtPayment, getDebtPayments, updateDebt,
} from '../src/db/database';
import { cancelMultipleNotifications } from '../src/utils/notifications';
import {
  formatCurrency, formatDate, getDueDateLabel, determineDebtStatus, getDebtStatusColor,
} from '../src/utils/helpers';
import { Debt, DebtPayment } from '../src/constants/types';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [id]));

  const loadData = async () => {
    const [d, p] = await Promise.all([
      getDebtById(parseInt(id)),
      getDebtPayments(parseInt(id)),
    ]);
    setDebt(d);
    setPayments(p);
  };

  const handleDelete = () => {
    Alert.alert(
      'Borcu Sil',
      `"${debt?.person_name}" borcunu silmek istediğinizden emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (!debt) return;
            const notifIds = JSON.parse(debt.notification_ids || '[]');
            await cancelMultipleNotifications(notifIds);
            await deleteDebt(debt.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ]
    );
  };

  const handleAddPayment = async () => {
    if (!debt) return;
    const parsed = parseFloat(payAmount.replace(',', '.'));
    if (!payAmount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Hata', 'Geçerli bir tutar girin.');
      return;
    }
    const remaining = debt.total_amount - debt.paid_amount;
    if (parsed > remaining) {
      Alert.alert('Hata', `Kalan borç tutarından (${formatCurrency(remaining, debt.currency)}) fazla ödeme yapılamaz.`);
      return;
    }

    setSaving(true);
    try {
      await addDebtPayment({
        debt_id: debt.id,
        amount: parsed,
        paid_at: new Date().toISOString(),
        notes: payNote.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPayModal(false);
      setPayAmount('');
      setPayNote('');
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
    if (remaining <= 0) {
      Alert.alert('Bilgi', 'Bu borç zaten tamamen ödenmiş.');
      return;
    }
    Alert.alert(
      'Tamamen Ödendi',
      `${formatCurrency(remaining, debt.currency)} kalan tutarı ödenmiş olarak işaretlemek istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet', onPress: async () => {
            await addDebtPayment({
              debt_id: debt.id,
              amount: remaining,
              paid_at: new Date().toISOString(),
              notes: 'Tamamen ödendi',
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await loadData();
          },
        },
      ]
    );
  };

  const handleCallPerson = () => {
    if (!debt) return;
    Alert.alert(
      `${debt.person_name} ile iletişim`,
      'Nasıl iletişim kurmak istersiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Ara',
          onPress: () => Linking.openURL(`tel:${debt.person_name}`),
        },
        {
          text: 'WhatsApp',
          onPress: () => Linking.openURL(`whatsapp://send?text=Merhaba ${debt.person_name},`),
        },
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Borç Detayı</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroCard}>
          {/* Profil / Avatar */}
          <View style={styles.avatarContainer}>
            {debt.person_photo ? (
              <Image source={{ uri: debt.person_photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: `${directionColor}20` }]}>
                <Text style={[styles.avatarInitial, { color: directionColor }]}>
                  {debt.person_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.directionBadge, { backgroundColor: directionColor }]}>
              <MaterialCommunityIcons
                name={isOwe ? 'arrow-up' : 'arrow-down'}
                size={12}
                color="#fff"
              />
            </View>
          </View>

          <Text style={styles.personName}>{debt.person_name}</Text>
          <Text style={[styles.directionLabel, { color: directionColor }]}>
            {isOwe ? 'Borcum var' : 'Alacağım var'}
          </Text>

          {/* Tutarlar */}
          <View style={styles.amountSection}>
            <View style={styles.amountBlock}>
              <Text style={styles.amountBlockLabel}>Toplam</Text>
              <Text style={styles.amountBlockValue}>
                {formatCurrency(debt.total_amount, debt.currency)}
              </Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountBlock}>
              <Text style={styles.amountBlockLabel}>Ödenen</Text>
              <Text style={[styles.amountBlockValue, { color: Colors.success }]}>
                {formatCurrency(debt.paid_amount, debt.currency)}
              </Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountBlock}>
              <Text style={styles.amountBlockLabel}>Kalan</Text>
              <Text style={[styles.amountBlockValue, { color: isFullyPaid ? Colors.success : directionColor }]}>
                {isFullyPaid ? '✓ Tamam' : formatCurrency(remaining, debt.currency)}
              </Text>
            </View>
          </View>

          {/* İlerleme çubuğu */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: isFullyPaid ? Colors.success : directionColor }]} />
            </View>
            <Text style={styles.progressText}>%{Math.round(progress * 100)} ödendi</Text>
          </View>
        </View>

        {/* Detaylar */}
        <View style={styles.detailCard}>
          <DetailRow
            icon="calendar"
            label="Son Ödeme Tarihi"
            value={formatDate(debt.due_date)}
            valueColor={isFullyPaid ? undefined : statusColor}
          />
          <Divider />
          <DetailRow
            icon="clock-alert-outline"
            label="Kalan Süre"
            value={isFullyPaid ? 'Ödendi' : getDueDateLabel(debt.due_date)}
            valueColor={isFullyPaid ? Colors.success : statusColor}
          />
          {debt.interest_rate > 0 && (
            <>
              <Divider />
              <DetailRow icon="percent" label="Faiz Oranı" value={`%${debt.interest_rate} yıllık`} />
            </>
          )}
          {debt.notes ? (
            <>
              <Divider />
              <DetailRow icon="note-text-outline" label="Not" value={debt.notes} />
            </>
          ) : null}
        </View>

        {/* Aksiyonlar */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.contactBtn} onPress={handleCallPerson}>
            <MaterialCommunityIcons name="phone" size={18} color={Colors.primary} />
            <Text style={styles.contactBtnText}>İletişim</Text>
          </TouchableOpacity>

          {!isFullyPaid && (
            <>
              <TouchableOpacity
                style={[styles.payBtn, { backgroundColor: directionColor }]}
                onPress={() => setShowPayModal(true)}
              >
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

        {/* Ödeme Geçmişi */}
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
                    <Text style={styles.timelineAmount}>
                      {formatCurrency(p.amount, debt.currency)}
                    </Text>
                    <Text style={styles.timelineDate}>
                      {formatDate(p.paid_at, 'dd MMM yyyy')}
                    </Text>
                  </View>
                  {p.notes ? (
                    <Text style={styles.timelineNote}>{p.notes}</Text>
                  ) : null}
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

            <Text style={styles.payModalRemaining}>
              Kalan: {formatCurrency(remaining, debt.currency)}
            </Text>

            <Text style={styles.payModalLabel}>Ödeme Tutarı</Text>
            <TextInput
              style={styles.payModalInput}
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder={`0,00 ${currencySymbol}`}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={styles.payModalLabel}>Not (Opsiyonel)</Text>
            <TextInput
              style={[styles.payModalInput, { height: 72, textAlignVertical: 'top' }]}
              value={payNote}
              onChangeText={setPayNote}
              placeholder="Not ekleyin..."
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            <TouchableOpacity
              style={[styles.payModalBtn, { backgroundColor: directionColor }, saving && { opacity: 0.6 }]}
              onPress={handleAddPayment}
              disabled={saving}
            >
              <Text style={styles.payModalBtnText}>
                {saving ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;

const DetailRow = ({
  icon, label, value, valueColor,
}: {
  icon: string; label: string; value: string; valueColor?: string;
}) => (
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
  deleteBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.danger}18`,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  heroCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  avatarContainer: { position: 'relative', marginBottom: Spacing.md },
  avatar: {
    width: 88, height: 88,
    borderRadius: BorderRadius.full,
    borderWidth: 3, borderColor: Colors.surfaceBorder,
  },
  avatarPlaceholder: {
    width: 88, height: 88,
    borderRadius: BorderRadius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.surfaceBorder,
  },
  avatarInitial: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 36,
  },
  directionBadge: {
    position: 'absolute',
    bottom: 2, right: 2,
    width: 24, height: 24,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  personName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  directionLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    marginBottom: Spacing.xl,
  },
  amountSection: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    width: '100%',
    marginBottom: Spacing.md,
  },
  amountBlock: { flex: 1, alignItems: 'center', gap: 4 },
  amountDivider: {
    width: 1,
    backgroundColor: Colors.surfaceBorder,
    marginVertical: 4,
  },
  amountBlockLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  amountBlockValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  progressContainer: {
    width: '100%',
    gap: 6,
  },
  progressBg: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  detailCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    ...Shadow.sm,
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  detailIconWrap: {
    width: 32, height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  detailTexts: { flex: 1 },
  detailLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginHorizontal: 4,
  },
  actionRow: {
    marginHorizontal: Spacing.lg,
    gap: 8,
    marginBottom: Spacing.xl,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${Colors.primary}18`,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  contactBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
  },
  payBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: '#fff',
  },
  fullPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${Colors.success}18`,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  fullPayBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.success,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  sectionCount: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  emptyHistory: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.xxxl,
  },
  emptyHistoryText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  timelineContainer: {
    paddingHorizontal: Spacing.lg,
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: Spacing.md,
    position: 'relative',
  },
  timelineDot: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 28,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.surfaceBorder,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineAmount: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.success,
  },
  timelineDate: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  timelineNote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  payModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: 36,
  },
  payModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  payModalTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  payModalRemaining: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  payModalLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  payModalInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.lg,
  },
  payModalBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    marginTop: 4,
  },
  payModalBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
});
