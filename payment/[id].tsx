import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../src/constants/theme';
import { getPayments, updatePaymentStatus, deletePayment } from '../src/db/database';
import { cancelNotification } from '../src/utils/notifications';
import {
  formatCurrency, formatDateWithTime, getStatusColor,
  getStatusLabel, getStatusIcon, getRecurrenceLabel, getDueDateLabel,
} from '../src/utils/helpers';
import { Payment } from '../src/constants/types';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);

  useFocusEffect(useCallback(() => {
    loadPayment();
  }, [id]));

  const loadPayment = async () => {
    const all = await getPayments();
    const found = all.find(p => p.id === parseInt(id));
    setPayment(found ?? null);
  };

  const handleMarkPaid = async () => {
    if (!payment) return;
    await updatePaymentStatus(payment.id, 'paid');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadPayment();
  };

  const handleMarkPending = async () => {
    if (!payment) return;
    await updatePaymentStatus(payment.id, 'pending');
    Haptics.selectionAsync();
    await loadPayment();
  };

  const handleDelete = () => {
    Alert.alert(
      'Ödemeyi Sil',
      `"${payment?.name}" ödemesini silmek istediğinizden emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (!payment) return;
            if (payment.notification_id) {
              await cancelNotification(payment.notification_id);
            }
            await deletePayment(payment.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
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
  const formattedAmount = formatCurrency(payment.amount, payment.currency);

  const renderIcon = () => {
    if (payment.icon_type === 'gallery') {
      return <Image source={{ uri: payment.icon_value }} style={styles.iconImage} />;
    }
    if (payment.icon_type === 'emoji') {
      return <Text style={styles.emojiIcon}>{payment.icon_value}</Text>;
    }
    return (
      <MaterialCommunityIcons
        name={payment.icon_value as any}
        size={36}
        color={Colors.primary}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ödeme Detayı</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero kartı */}
        <View style={styles.heroCard}>
          <View style={styles.iconCircle}>
            {renderIcon()}
          </View>
          <Text style={styles.paymentName}>{payment.name}</Text>
          <Text style={styles.amountText}>{formattedAmount}</Text>

          {/* Durum badge */}
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
            <MaterialCommunityIcons
              name={getStatusIcon(payment.status) as any}
              size={14}
              color={statusColor}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(payment.status)}
            </Text>
          </View>

          {payment.status !== 'paid' && (
            <Text style={[styles.daysLabel, { color: payment.status === 'overdue' ? Colors.danger : Colors.textSecondary }]}>
              {daysLabel}
            </Text>
          )}
        </View>

        {/* Detay Satırları */}
        <View style={styles.detailCard}>
          <DetailRow icon="calendar" label="Tarih" value={formatDateWithTime(payment.due_date, payment.due_time)} />
          <Divider />
          <DetailRow icon="tag" label="Kategori" value={payment.category} />
          <Divider />
          <DetailRow icon="refresh" label="Tekrarlama" value={getRecurrenceLabel(payment.recurrence)} />
          {payment.notes ? (
            <>
              <Divider />
              <DetailRow icon="note-text-outline" label="Not" value={payment.notes} />
            </>
          ) : null}
          {payment.notification_id ? (
            <>
              <Divider />
              <DetailRow icon="bell-outline" label="Hatırlatıcı" value="Aktif" valueColor={Colors.success} />
            </>
          ) : null}
        </View>

        {/* Aksiyon Butonları */}
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
    padding: Spacing.xxxl,
    paddingBottom: Spacing.xl,
  },
  iconCircle: {
    width: 90, height: 90,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.primary,
  },
  iconImage: { width: 90, height: 90, borderRadius: BorderRadius.full },
  emojiIcon: { fontSize: 42 },
  paymentName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  amountText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 36,
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: 8,
  },
  statusText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
  },
  daysLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  detailCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    ...Shadow.sm,
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
  actionContainer: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    ...Shadow.md,
  },
  primaryActionText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: '#fff',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: `${Colors.primary}18`,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryActionText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.primary,
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
